-- =====================================================
-- Migration: Shipment Holds (Giacenze) System
-- Created: 2026-02-01
-- Description: Sistema gestione giacenze - spedizioni
--              bloccate presso corrieri con workflow
--              svincolo e addebito wallet
-- =====================================================

-- =====================================================
-- 1. Extend normalize_tracking_status() with giacenza patterns
-- =====================================================
CREATE OR REPLACE FUNCTION normalize_tracking_status(raw_status TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    -- *** Giacenza states (MUST be checked before exception) ***
    WHEN raw_status ILIKE '%giacenz%' THEN 'in_giacenza'
    WHEN raw_status ILIKE '%fermo deposito%' THEN 'in_giacenza'
    WHEN raw_status ILIKE '%in deposito%' THEN 'in_giacenza'
    WHEN raw_status ILIKE '%mancata consegna%' THEN 'in_giacenza'
    WHEN raw_status ILIKE '%tentativo%fallito%' THEN 'in_giacenza'
    WHEN raw_status ILIKE '%non consegnabile%' THEN 'in_giacenza'

    -- Delivered states
    WHEN raw_status ILIKE '%consegnat%' THEN 'delivered'
    WHEN raw_status ILIKE '%delivered%' THEN 'delivered'
    WHEN raw_status ILIKE '%recapitat%' THEN 'delivered'

    -- In transit states
    WHEN raw_status ILIKE '%transit%' THEN 'in_transit'
    WHEN raw_status ILIKE '%partita%' THEN 'in_transit'
    WHEN raw_status ILIKE '%partenza%' THEN 'in_transit'
    WHEN raw_status ILIKE '%viaggio%' THEN 'in_transit'
    WHEN raw_status ILIKE '%hub%' THEN 'in_transit'
    WHEN raw_status ILIKE '%smistamento%' THEN 'in_transit'

    -- Out for delivery
    WHEN raw_status ILIKE '%consegna prevista%' THEN 'out_for_delivery'
    WHEN raw_status ILIKE '%in consegna%' THEN 'out_for_delivery'
    WHEN raw_status ILIKE '%out for delivery%' THEN 'out_for_delivery'

    -- At destination
    WHEN raw_status ILIKE '%arrivata%sede%destinat%' THEN 'at_destination'
    WHEN raw_status ILIKE '%destinatar%' THEN 'at_destination'

    -- Exception states
    WHEN raw_status ILIKE '%eccezione%' THEN 'exception'
    WHEN raw_status ILIKE '%problem%' THEN 'exception'
    WHEN raw_status ILIKE '%errore%' THEN 'exception'
    WHEN raw_status ILIKE '%fallito%' THEN 'exception'
    WHEN raw_status ILIKE '%destinatario assente%' THEN 'exception'
    WHEN raw_status ILIKE '%indirizzo errato%' THEN 'exception'

    -- Pickup/Created states
    WHEN raw_status ILIKE '%generata%' THEN 'created'
    WHEN raw_status ILIKE '%registrata%' THEN 'created'
    WHEN raw_status ILIKE '%attesa%ritiro%' THEN 'pending_pickup'
    WHEN raw_status ILIKE '%ritirat%' THEN 'picked_up'

    -- Return states
    WHEN raw_status ILIKE '%reso%' THEN 'returned'
    WHEN raw_status ILIKE '%return%' THEN 'returned'
    WHEN raw_status ILIKE '%respint%' THEN 'returned'

    -- Cancelled
    WHEN raw_status ILIKE '%annullat%' THEN 'cancelled'
    WHEN raw_status ILIKE '%cancel%' THEN 'cancelled'

    -- Default
    ELSE 'unknown'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Update comment to include new status
COMMENT ON COLUMN tracking_events.status_normalized IS
  'Normalized status: delivered, in_transit, out_for_delivery, at_destination, in_giacenza, exception, created, pending_pickup, picked_up, returned, cancelled, unknown';

-- =====================================================
-- 2. Create shipment_holds table
-- =====================================================
CREATE TABLE IF NOT EXISTS shipment_holds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- Hold lifecycle
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'action_requested', 'action_confirmed', 'resolved', 'expired')),

  -- Reason
  reason TEXT CHECK (reason IN (
    'destinatario_assente',
    'indirizzo_errato',
    'rifiutata',
    'documenti_mancanti',
    'contrassegno_non_pagato',
    'zona_non_accessibile',
    'altro'
  )),
  reason_detail TEXT,  -- Raw text from courier

  -- Timing
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline_at TIMESTAMPTZ,  -- Auto-return deadline (typically +10 days)
  resolved_at TIMESTAMPTZ,

  -- Action chosen
  action_type TEXT CHECK (action_type IN (
    'riconsegna',
    'riconsegna_nuovo_destinatario',
    'reso_mittente',
    'distruggere',
    'ritiro_in_sede',
    'consegna_parziale_rendi',
    'consegna_parziale_distruggi'
  )),
  action_cost NUMERIC(10,2),
  action_requested_at TIMESTAMPTZ,
  action_confirmed_at TIMESTAMPTZ,

  -- New address (for riconsegna_nuovo_destinatario)
  new_recipient_name TEXT,
  new_recipient_address TEXT,
  new_recipient_city TEXT,
  new_recipient_zip TEXT,
  new_recipient_province TEXT,
  new_recipient_phone TEXT,

  -- Wallet link
  wallet_transaction_id UUID,
  idempotency_key TEXT UNIQUE,

  -- Audit
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_shipment_holds_user_id
  ON shipment_holds(user_id);
CREATE INDEX IF NOT EXISTS idx_shipment_holds_shipment_id
  ON shipment_holds(shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_holds_status
  ON shipment_holds(status)
  WHERE status IN ('open', 'action_requested');

-- Only one active hold per shipment
CREATE UNIQUE INDEX IF NOT EXISTS idx_shipment_holds_active_per_shipment
  ON shipment_holds(shipment_id)
  WHERE status IN ('open', 'action_requested');

-- =====================================================
-- 3. RLS Policies
-- =====================================================
ALTER TABLE shipment_holds ENABLE ROW LEVEL SECURITY;

-- Users can view their own holds
CREATE POLICY "shipment_holds_select_own" ON shipment_holds
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND u.role IN ('admin', 'superadmin')
    )
  );

-- Grant permissions
GRANT SELECT ON shipment_holds TO authenticated;
GRANT ALL ON shipment_holds TO service_role;

-- =====================================================
-- 4. Auto-create hold trigger
-- =====================================================
CREATE OR REPLACE FUNCTION auto_create_shipment_hold()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Only act on in_giacenza events
  IF NEW.status_normalized <> 'in_giacenza' THEN
    RETURN NEW;
  END IF;

  -- Get shipment owner
  SELECT user_id INTO v_user_id
  FROM shipments
  WHERE id = NEW.shipment_id;

  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Create hold record (ON CONFLICT prevents duplicates via unique index)
  INSERT INTO shipment_holds (
    shipment_id,
    user_id,
    status,
    reason,
    reason_detail,
    detected_at,
    deadline_at
  ) VALUES (
    NEW.shipment_id,
    v_user_id,
    'open',
    CASE
      WHEN NEW.status ILIKE '%assente%' THEN 'destinatario_assente'
      WHEN NEW.status ILIKE '%errat%' OR NEW.status ILIKE '%incompleto%' THEN 'indirizzo_errato'
      WHEN NEW.status ILIKE '%rifiut%' THEN 'rifiutata'
      WHEN NEW.status ILIKE '%document%' THEN 'documenti_mancanti'
      WHEN NEW.status ILIKE '%contrassegn%' THEN 'contrassegno_non_pagato'
      WHEN NEW.status ILIKE '%accessibil%' OR NEW.status ILIKE '%zona%' THEN 'zona_non_accessibile'
      ELSE 'altro'
    END,
    NEW.status,  -- Raw courier text as detail
    COALESCE(NEW.event_date, NOW()),
    COALESCE(NEW.event_date, NOW()) + INTERVAL '10 days'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Trigger on tracking_events insert
CREATE TRIGGER trigger_auto_create_shipment_hold
  AFTER INSERT ON tracking_events
  FOR EACH ROW
  WHEN (NEW.status_normalized = 'in_giacenza')
  EXECUTE FUNCTION auto_create_shipment_hold();

-- =====================================================
-- 5. Auto-update updated_at
-- =====================================================
CREATE OR REPLACE FUNCTION update_shipment_holds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_shipment_holds_updated_at
  BEFORE UPDATE ON shipment_holds
  FOR EACH ROW
  EXECUTE FUNCTION update_shipment_holds_updated_at();

-- =====================================================
-- 6. Documentation
-- =====================================================
COMMENT ON TABLE shipment_holds IS
  'Tracks shipments held at courier depots (giacenze). Auto-created from tracking events, resolved via customer action with wallet charge.';
