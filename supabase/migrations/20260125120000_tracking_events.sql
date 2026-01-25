-- =====================================================
-- Migration: Tracking Events System
-- Created: 2026-01-25
-- Description: Add tracking_events table for caching
--              shipment tracking data from carriers
-- =====================================================

-- Create tracking_events table
CREATE TABLE IF NOT EXISTS tracking_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Reference to shipment
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  tracking_number TEXT NOT NULL,

  -- Event data from carrier API
  event_date TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,  -- Raw status from carrier (CONSEGNATA, IN TRANSITO, etc.)
  status_normalized TEXT,  -- Normalized status (delivered, in_transit, exception, etc.)
  location TEXT,
  description TEXT,

  -- Source metadata
  carrier TEXT,  -- GLS, BRT, POSTE, etc.
  provider TEXT DEFAULT 'spediscionline',  -- Source API
  raw_data JSONB DEFAULT '{}',  -- Original API response

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  fetched_at TIMESTAMPTZ DEFAULT NOW()  -- When we last fetched from API
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tracking_events_shipment_id
  ON tracking_events(shipment_id);
CREATE INDEX IF NOT EXISTS idx_tracking_events_tracking_number
  ON tracking_events(tracking_number);
CREATE INDEX IF NOT EXISTS idx_tracking_events_status_normalized
  ON tracking_events(status_normalized);
CREATE INDEX IF NOT EXISTS idx_tracking_events_event_date
  ON tracking_events(event_date DESC);

-- Unique constraint to prevent duplicate events
CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_events_unique
  ON tracking_events(shipment_id, event_date, status);

-- Add tracking metadata to shipments table
ALTER TABLE shipments
  ADD COLUMN IF NOT EXISTS tracking_status TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS tracking_last_update TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tracking_last_event TEXT;

-- Index for tracking status queries
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_status
  ON shipments(tracking_status)
  WHERE tracking_status IS NOT NULL;

-- RLS Policies
ALTER TABLE tracking_events ENABLE ROW LEVEL SECURITY;

-- Users can view tracking events for their own shipments
CREATE POLICY "tracking_events_select_own" ON tracking_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shipments s
      WHERE s.id = tracking_events.shipment_id
        AND (
          s.user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM users u
            WHERE u.id = auth.uid()
              AND u.role IN ('admin', 'superadmin')
          )
        )
    )
  );

-- Only service role can insert/update (via API)
-- No INSERT/UPDATE policies for regular users

-- Function to normalize tracking status
CREATE OR REPLACE FUNCTION normalize_tracking_status(raw_status TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
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

-- Function to update shipment tracking status from latest event
CREATE OR REPLACE FUNCTION update_shipment_tracking_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the shipment with the latest tracking info
  UPDATE shipments
  SET
    tracking_status = NEW.status_normalized,
    tracking_last_update = NEW.fetched_at,
    tracking_last_event = NEW.status,
    updated_at = NOW(),
    -- Auto-set delivered_at if status is delivered
    delivered_at = CASE
      WHEN NEW.status_normalized = 'delivered' AND delivered_at IS NULL
      THEN NEW.event_date
      ELSE delivered_at
    END
  WHERE id = NEW.shipment_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-update shipment status
CREATE TRIGGER trigger_update_shipment_tracking
  AFTER INSERT ON tracking_events
  FOR EACH ROW
  EXECUTE FUNCTION update_shipment_tracking_status();

-- Grant permissions
GRANT SELECT ON tracking_events TO authenticated;
GRANT ALL ON tracking_events TO service_role;

-- Comment for documentation
COMMENT ON TABLE tracking_events IS
  'Stores tracking events fetched from carrier APIs. Events are cached to reduce API calls and provide instant access to tracking history.';

COMMENT ON COLUMN tracking_events.status_normalized IS
  'Normalized status: delivered, in_transit, out_for_delivery, at_destination, exception, created, pending_pickup, picked_up, returned, cancelled, unknown';

-- RPC function to upsert tracking events (used by TrackingService)
CREATE OR REPLACE FUNCTION upsert_tracking_event(
  p_shipment_id UUID,
  p_tracking_number TEXT,
  p_event_date TIMESTAMPTZ,
  p_status TEXT,
  p_status_normalized TEXT,
  p_location TEXT,
  p_carrier TEXT,
  p_provider TEXT,
  p_raw_data JSONB,
  p_fetched_at TIMESTAMPTZ
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO tracking_events (
    shipment_id,
    tracking_number,
    event_date,
    status,
    status_normalized,
    location,
    carrier,
    provider,
    raw_data,
    fetched_at
  ) VALUES (
    p_shipment_id,
    p_tracking_number,
    p_event_date,
    p_status,
    p_status_normalized,
    p_location,
    p_carrier,
    p_provider,
    p_raw_data,
    p_fetched_at
  )
  ON CONFLICT (shipment_id, event_date, status)
  DO UPDATE SET
    fetched_at = EXCLUDED.fetched_at
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
