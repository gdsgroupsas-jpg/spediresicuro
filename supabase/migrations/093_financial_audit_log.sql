-- ============================================
-- MIGRATION: 093_financial_audit_log.sql
-- DESCRIZIONE: Audit log dedicato per operazioni finanziarie
-- DATA: 2026-01-07
-- CRITICITÀ: P0 - COMPLIANCE
-- SPRINT: 1 - Financial Tracking Infrastructure
-- ============================================
--
-- SCOPO:
-- Tracciare OGNI operazione finanziaria per:
-- 1. Compliance (audit trail immutabile)
-- 2. Debug (cosa è successo e quando)
-- 3. Alert (margini anomali, errori)
-- 4. Reporting (analisi operazioni)
--
-- EVENTI TRACCIATI:
-- - wallet_debit: Addebito wallet
-- - wallet_credit: Accredito wallet
-- - platform_cost_recorded: Registrazione costo piattaforma
-- - reconciliation_completed: Riconciliazione completata
-- - reconciliation_discrepancy: Discrepanza trovata
-- - margin_alert: Alert margine anomalo
-- - cost_estimation_fallback: Costo stimato (non da API)
--
-- ============================================

-- ============================================
-- STEP 1: Creare tipo enum per event types
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'financial_event_type') THEN
    CREATE TYPE financial_event_type AS ENUM (
      'wallet_debit',
      'wallet_credit',
      'wallet_refund',
      'platform_cost_recorded',
      'platform_cost_updated',
      'reconciliation_started',
      'reconciliation_completed',
      'reconciliation_discrepancy',
      'margin_alert',
      'cost_estimation_fallback',
      'invoice_matched',
      'manual_adjustment'
    );
    RAISE NOTICE '✅ Creato tipo: financial_event_type';
  ELSE
    RAISE NOTICE '⚠️ Tipo financial_event_type già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 2: Creare tabella financial_audit_log
-- ============================================

CREATE TABLE IF NOT EXISTS financial_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- ============================================
  -- EVENTO
  -- ============================================
  event_type TEXT NOT NULL CHECK (event_type IN (
    'wallet_debit',
    'wallet_credit',
    'wallet_refund',
    'platform_cost_recorded',
    'platform_cost_updated',
    'reconciliation_started',
    'reconciliation_completed',
    'reconciliation_discrepancy',
    'margin_alert',
    'cost_estimation_fallback',
    'invoice_matched',
    'manual_adjustment'
  )),
  
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN (
    'debug',
    'info',
    'warning',
    'error',
    'critical'
  )),
  
  -- ============================================
  -- RIFERIMENTI
  -- ============================================
  -- Utente coinvolto (chi ha subito l'operazione)
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  user_email TEXT, -- Denormalizzato per audit (user potrebbe essere cancellato)
  
  -- Spedizione (se applicabile)
  shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
  tracking_number TEXT,
  
  -- Listino (se applicabile)
  price_list_id UUID REFERENCES price_lists(id) ON DELETE SET NULL,
  
  -- Platform cost record (se applicabile)
  platform_cost_id UUID REFERENCES platform_provider_costs(id) ON DELETE SET NULL,
  
  -- ============================================
  -- VALORI FINANZIARI
  -- ============================================
  amount DECIMAL(10,2), -- Importo principale dell'operazione
  
  -- Per operazioni con before/after
  old_value JSONB, -- Valore precedente
  new_value JSONB, -- Valore nuovo
  
  -- Per wallet operations
  wallet_balance_before DECIMAL(10,2),
  wallet_balance_after DECIMAL(10,2),
  
  -- ============================================
  -- ATTORE (chi ha fatto l'operazione)
  -- ============================================
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_email TEXT, -- Denormalizzato
  actor_type TEXT CHECK (actor_type IN ('user', 'admin', 'superadmin', 'system', 'cron')),
  
  -- Impersonation tracking
  is_impersonation BOOLEAN DEFAULT FALSE,
  impersonated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- ============================================
  -- CONTEXT
  -- ============================================
  request_id TEXT, -- Per correlare con logs applicativi
  ip_address INET,
  user_agent TEXT,
  
  -- ============================================
  -- DETTAGLI
  -- ============================================
  message TEXT, -- Descrizione human-readable
  error_message TEXT, -- Se errore
  
  -- Metadata flessibile per dettagli aggiuntivi
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- ============================================
  -- TIMESTAMP
  -- ============================================
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- ============================================
  -- CONSTRAINTS
  -- ============================================
  -- Almeno uno tra user_id, shipment_id, platform_cost_id deve essere presente
  CONSTRAINT fal_has_reference CHECK (
    user_id IS NOT NULL 
    OR shipment_id IS NOT NULL 
    OR platform_cost_id IS NOT NULL
  )
);

-- ============================================
-- STEP 3: Indici
-- ============================================

-- Per query per tipo evento
CREATE INDEX IF NOT EXISTS idx_fal_event_type 
  ON financial_audit_log(event_type);

-- Per query per user
CREATE INDEX IF NOT EXISTS idx_fal_user_id 
  ON financial_audit_log(user_id) 
  WHERE user_id IS NOT NULL;

-- Per query per shipment
CREATE INDEX IF NOT EXISTS idx_fal_shipment_id 
  ON financial_audit_log(shipment_id) 
  WHERE shipment_id IS NOT NULL;

-- Per query temporali
CREATE INDEX IF NOT EXISTS idx_fal_created_at 
  ON financial_audit_log(created_at DESC);

-- Per query per severity (alert)
CREATE INDEX IF NOT EXISTS idx_fal_severity 
  ON financial_audit_log(severity) 
  WHERE severity IN ('warning', 'error', 'critical');

-- Per query per actor
CREATE INDEX IF NOT EXISTS idx_fal_actor_id 
  ON financial_audit_log(actor_id) 
  WHERE actor_id IS NOT NULL;

-- Composite per dashboard: tipo + data (usa created_at diretto)
CREATE INDEX IF NOT EXISTS idx_fal_type_date 
  ON financial_audit_log(event_type, created_at);

-- ============================================
-- STEP 4: RLS Policies
-- ============================================

ALTER TABLE financial_audit_log ENABLE ROW LEVEL SECURITY;

-- Solo SuperAdmin può vedere
CREATE POLICY fal_superadmin_select ON financial_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.account_type = 'superadmin'
    )
  );

-- Insert: superadmin, admin, o service_role
CREATE POLICY fal_insert ON financial_audit_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.account_type IN ('superadmin', 'admin')
    )
    OR current_setting('role') = 'service_role'
  );

-- NO UPDATE policy - audit log è immutabile
-- NO DELETE policy - audit log non si cancella mai

-- ============================================
-- STEP 5: Function helper per logging
-- ============================================

CREATE OR REPLACE FUNCTION log_financial_event(
  p_event_type TEXT,
  p_user_id UUID DEFAULT NULL,
  p_shipment_id UUID DEFAULT NULL,
  p_amount DECIMAL DEFAULT NULL,
  p_message TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT 'info',
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_actor_id UUID DEFAULT NULL,
  p_platform_cost_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_user_email TEXT;
  v_actor_email TEXT;
  v_actor_type TEXT;
  v_tracking_number TEXT;
BEGIN
  -- Recupera email utente
  IF p_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email FROM users WHERE id = p_user_id;
  END IF;

  -- Recupera info actor
  IF p_actor_id IS NOT NULL THEN
    SELECT email, account_type INTO v_actor_email, v_actor_type 
    FROM users WHERE id = p_actor_id;
  ELSE
    v_actor_type := 'system';
  END IF;

  -- Recupera tracking number
  IF p_shipment_id IS NOT NULL THEN
    SELECT tracking_number INTO v_tracking_number 
    FROM shipments WHERE id = p_shipment_id;
  END IF;

  -- Insert log
  INSERT INTO financial_audit_log (
    event_type,
    severity,
    user_id,
    user_email,
    shipment_id,
    tracking_number,
    platform_cost_id,
    amount,
    actor_id,
    actor_email,
    actor_type,
    message,
    metadata
  )
  VALUES (
    p_event_type,
    p_severity,
    p_user_id,
    v_user_email,
    p_shipment_id,
    v_tracking_number,
    p_platform_cost_id,
    p_amount,
    p_actor_id,
    v_actor_email,
    v_actor_type,
    p_message,
    p_metadata
  )
  RETURNING id INTO v_id;

  -- Log anche in console per severity alta
  IF p_severity IN ('warning', 'error', 'critical') THEN
    RAISE WARNING '[FINANCIAL_AUDIT] %: % (user=%, amount=%, shipment=%)',
      p_event_type, p_message, p_user_id, p_amount, p_shipment_id;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

COMMENT ON FUNCTION log_financial_event IS 
  'Helper per inserire eventi nel financial audit log.
   Denormalizza automaticamente email e tracking number.
   Logga in console per severity alta.';

-- ============================================
-- STEP 6: Function per logging wallet operations
-- ============================================

CREATE OR REPLACE FUNCTION log_wallet_operation(
  p_user_id UUID,
  p_operation TEXT, -- 'debit', 'credit', 'refund'
  p_amount DECIMAL,
  p_balance_before DECIMAL,
  p_balance_after DECIMAL,
  p_reason TEXT DEFAULT NULL,
  p_shipment_id UUID DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_type TEXT;
BEGIN
  -- Map operation to event type
  v_event_type := CASE p_operation
    WHEN 'debit' THEN 'wallet_debit'
    WHEN 'credit' THEN 'wallet_credit'
    WHEN 'refund' THEN 'wallet_refund'
    ELSE 'manual_adjustment'
  END;

  -- Insert via helper
  RETURN log_financial_event(
    p_event_type := v_event_type,
    p_user_id := p_user_id,
    p_shipment_id := p_shipment_id,
    p_amount := p_amount,
    p_message := p_reason,
    p_severity := 'info',
    p_metadata := jsonb_build_object(
      'operation', p_operation,
      'balance_before', p_balance_before,
      'balance_after', p_balance_after
    ),
    p_actor_id := p_actor_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

COMMENT ON FUNCTION log_wallet_operation IS 
  'Shortcut per loggare operazioni wallet con balance tracking.';

-- ============================================
-- STEP 7: View per dashboard alert
-- ============================================

CREATE OR REPLACE VIEW v_financial_alerts AS
SELECT 
  id,
  event_type,
  severity,
  created_at,
  user_email,
  tracking_number,
  amount,
  message,
  metadata,
  EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 AS hours_ago
FROM financial_audit_log
WHERE severity IN ('warning', 'error', 'critical')
  AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY 
  CASE severity
    WHEN 'critical' THEN 0
    WHEN 'error' THEN 1
    ELSE 2
  END,
  created_at DESC;

COMMENT ON VIEW v_financial_alerts IS 
  'Alert finanziari degli ultimi 7 giorni, ordinati per severità.';

-- ============================================
-- STEP 8: Statistiche per dashboard
-- ============================================

CREATE OR REPLACE VIEW v_financial_audit_stats AS
SELECT 
  DATE(created_at) AS date,
  event_type,
  severity,
  COUNT(*) AS event_count,
  SUM(COALESCE(amount, 0)) AS total_amount,
  AVG(COALESCE(amount, 0)) AS avg_amount
FROM financial_audit_log
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), event_type, severity
ORDER BY date DESC, event_type;

COMMENT ON VIEW v_financial_audit_stats IS 
  'Statistiche giornaliere eventi finanziari ultimi 30 giorni.';

-- ============================================
-- STEP 9: Retention Policy (commento)
-- ============================================

-- NOTA LEGALE: I dati fiscali devono essere conservati per 10 anni in Italia.
-- NON implementare delete automatico senza consulenza legale.
--
-- Se necessario, creare partitioned table o archiving strategy:
--
-- 1. PARTITIONING per anno:
--    CREATE TABLE financial_audit_log_2026 PARTITION OF financial_audit_log
--    FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
--
-- 2. ARCHIVING a cold storage:
--    - Dopo 1 anno: move to archive table
--    - Dopo 10 anni: export e delete (con approvazione legale)

-- ============================================
-- STEP 10: Verifica
-- ============================================

DO $$
BEGIN
  -- Verifica tabella
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'financial_audit_log'
  ) THEN
    RAISE EXCEPTION 'FAIL: Tabella financial_audit_log non creata';
  END IF;

  -- Verifica RLS
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'financial_audit_log' 
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'FAIL: RLS non abilitato';
  END IF;

  -- Verifica funzioni
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'log_financial_event'
  ) THEN
    RAISE EXCEPTION 'FAIL: Funzione log_financial_event non creata';
  END IF;

  RAISE NOTICE '✅ Migration 093 verificata con successo';
END $$;

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 093 completata con successo';
  RAISE NOTICE '';
  RAISE NOTICE '📊 TABELLA CREATA: financial_audit_log';
  RAISE NOTICE '   - Audit trail immutabile';
  RAISE NOTICE '   - RLS: solo SuperAdmin può leggere';
  RAISE NOTICE '   - NO UPDATE/DELETE (compliance)';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 FUNZIONI CREATE:';
  RAISE NOTICE '   - log_financial_event() - General purpose';
  RAISE NOTICE '   - log_wallet_operation() - Wallet specific';
  RAISE NOTICE '';
  RAISE NOTICE '📈 VIEWS CREATE:';
  RAISE NOTICE '   - v_financial_alerts - Dashboard alert';
  RAISE NOTICE '   - v_financial_audit_stats - Statistiche';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  NOTA LEGALE: Retention 10 anni per dati fiscali IT.';
  RAISE NOTICE '   Non implementare delete automatico.';
  RAISE NOTICE '========================================';
END $$;
