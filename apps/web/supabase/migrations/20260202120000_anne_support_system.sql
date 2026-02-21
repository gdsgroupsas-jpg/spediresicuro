-- ============================================
-- ANNE SUPPORT SYSTEM
-- Created: 2026-02-02
-- Description: Tabelle minimali per il sistema
--              di assistenza AI-native con Anne.
--              Anne gestisce il 95-98% dei casi,
--              qui servono solo escalation e notifiche.
-- ============================================

-- ============================================
-- 1. SUPPORT_ESCALATIONS
-- Solo per il 2-5% di casi che Anne non riesce
-- a risolvere autonomamente.
-- ============================================

CREATE TABLE support_escalations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Chi ha il problema
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Riferimento opzionale alla spedizione
  shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,

  -- Motivo dell'escalation
  reason TEXT NOT NULL,

  -- Riassunto di Anne: cosa ha provato, cosa non ha funzionato
  anne_summary TEXT NOT NULL,

  -- Snapshot conversazione Anne (ultimi N messaggi)
  conversation_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Stato escalation
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open',        -- Aperta, nessun operatore assegnato
    'assigned',    -- Assegnata a un operatore
    'resolved',    -- Risolta dall'operatore
    'closed'       -- Chiusa (confermata dall'utente o auto-chiusa)
  )),

  -- Operatore assegnato
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Risoluzione
  resolution TEXT,

  -- Metadata flessibile (es. carrier, tracking_number, error_code)
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);

-- Indici
CREATE INDEX idx_support_escalations_user_id ON support_escalations(user_id);
CREATE INDEX idx_support_escalations_status ON support_escalations(status);
CREATE INDEX idx_support_escalations_assigned_to ON support_escalations(assigned_to)
  WHERE assigned_to IS NOT NULL;
CREATE INDEX idx_support_escalations_created_at ON support_escalations(created_at DESC);

-- RLS
ALTER TABLE support_escalations ENABLE ROW LEVEL SECURITY;

-- Utenti vedono solo le proprie escalation
CREATE POLICY "Users view own escalations"
  ON support_escalations FOR SELECT
  USING (user_id = auth.uid());

-- Admin/operatori vedono tutto
CREATE POLICY "Admins view all escalations"
  ON support_escalations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'superadmin')
    )
  );

-- Solo il service role (Anne backend) puo inserire
CREATE POLICY "Service role inserts escalations"
  ON support_escalations FOR INSERT
  WITH CHECK (true);  -- Controllato lato server con service role

-- Admin possono aggiornare (assegnare, risolvere)
CREATE POLICY "Admins update escalations"
  ON support_escalations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'superadmin')
    )
  );

COMMENT ON TABLE support_escalations IS
  'Casi escalati da Anne AI a operatore umano. Solo 2-5% delle richieste.';

-- ============================================
-- 2. SUPPORT_NOTIFICATIONS
-- Notifiche proattive per l'utente (giacenza
-- rilevata, tracking stale, etc.)
-- ============================================

CREATE TABLE support_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Destinatario
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Tipo notifica
  type TEXT NOT NULL CHECK (type IN (
    'giacenza_detected',    -- Spedizione in giacenza
    'tracking_stale',       -- Tracking non aggiornato >48h
    'delivery_failed',      -- Consegna fallita
    'hold_expiring',        -- Giacenza in scadenza
    'shipment_delivered',   -- Spedizione consegnata
    'refund_processed',     -- Rimborso processato
    'escalation_update'     -- Aggiornamento su escalation
  )),

  -- Riferimento spedizione (opzionale)
  shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,

  -- Messaggio per l'utente
  message TEXT NOT NULL,

  -- Stato lettura
  read BOOLEAN NOT NULL DEFAULT false,

  -- Su quali canali e stata consegnata
  channels_delivered JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- es: ["in_app", "telegram", "email"]

  -- Metadata (es. tracking_number, hold_id, etc.)
  metadata JSONB DEFAULT '{}'::jsonb,

  -- Timestamp
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indici
CREATE INDEX idx_support_notifications_user_unread
  ON support_notifications(user_id, read)
  WHERE read = false;
CREATE INDEX idx_support_notifications_user_id ON support_notifications(user_id);
CREATE INDEX idx_support_notifications_created_at ON support_notifications(created_at DESC);
CREATE INDEX idx_support_notifications_type ON support_notifications(type);

-- RLS
ALTER TABLE support_notifications ENABLE ROW LEVEL SECURITY;

-- Utenti vedono solo le proprie notifiche
CREATE POLICY "Users view own notifications"
  ON support_notifications FOR SELECT
  USING (user_id = auth.uid());

-- Utenti possono segnare come lette le proprie
CREATE POLICY "Users update own notifications"
  ON support_notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role inserisce (Anne backend)
CREATE POLICY "Service role inserts notifications"
  ON support_notifications FOR INSERT
  WITH CHECK (true);  -- Controllato lato server con service role

COMMENT ON TABLE support_notifications IS
  'Notifiche proattive inviate da Anne agli utenti (giacenze, tracking, etc.).';

-- ============================================
-- 3. Aggiunta notification_preferences a anne_user_memory
-- ============================================

-- Aggiungi campo per preferenze notifica se la tabella esiste
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'anne_user_memory'
  ) THEN
    -- notification_preferences viene salvato nel campo JSONB preferences
    -- Struttura: { ..., notification_channels: ["in_app", "telegram", "email"] }
    COMMENT ON TABLE anne_user_memory IS
      'Memoria utente di Anne. Include notification_channels in preferences JSONB.';
  END IF;
END $$;
