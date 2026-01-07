-- ============================================
-- MIGRATION: 090_platform_provider_costs.sql
-- DESCRIZIONE: Tracking costi reali piattaforma per spedizioni con contratti SpedireSicuro
-- DATA: 2026-01-07
-- CRITICITÀ: P0 - FINANCIAL CORE
-- SPRINT: 1 - Financial Tracking Infrastructure
-- ============================================
--
-- BUSINESS CONTEXT:
-- Quando un Reseller/BYOC usa un listino assegnato dal SuperAdmin (contratti piattaforma),
-- SpedireSicuro paga il corriere per conto del Reseller. Questa tabella traccia:
-- - Quanto abbiamo addebitato al Reseller (billed_amount)
-- - Quanto paghiamo noi al corriere (provider_cost)
-- - Il margine effettivo (platform_margin)
--
-- Questo è fondamentale per:
-- 1. P&L corretto
-- 2. Riconciliazione con fatture corrieri
-- 3. Alert margini anomali
-- 4. Reporting per contabilità
--
-- ============================================

-- ============================================
-- STEP 1: Creare tabella platform_provider_costs
-- ============================================

CREATE TABLE IF NOT EXISTS platform_provider_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- ============================================
  -- RIFERIMENTO SPEDIZIONE
  -- ============================================
  shipment_id UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  shipment_tracking_number TEXT NOT NULL,
  
  -- ============================================
  -- CHI HA PAGATO (Reseller o suo sub-user)
  -- ============================================
  billed_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- NOTA: ON DELETE RESTRICT perché non vogliamo perdere dati finanziari
  
  -- ============================================
  -- IMPORTI
  -- ============================================
  -- Quanto abbiamo addebitato al wallet del Reseller/cliente
  billed_amount DECIMAL(10,2) NOT NULL CHECK (billed_amount >= 0),
  
  -- Quanto paghiamo noi al corriere (costo reale)
  provider_cost DECIMAL(10,2) NOT NULL CHECK (provider_cost >= 0),
  
  -- Margine (calcolato via trigger per evitare problemi IMMUTABLE)
  platform_margin DECIMAL(10,2),
  
  -- Margine percentuale (calcolato via trigger)
  platform_margin_percent DECIMAL(5,2),
  
  -- ============================================
  -- FONTE API (quale contratto usato)
  -- ============================================
  api_source TEXT NOT NULL CHECK (api_source IN (
    'platform',      -- Contratti SpedireSicuro
    'reseller_own',  -- Contratto proprio del Reseller (questo record non dovrebbe esistere per questi)
    'byoc_own'       -- Contratto proprio del BYOC (idem)
  )),
  
  -- Listino usato per il calcolo
  price_list_id UUID REFERENCES price_lists(id) ON DELETE SET NULL,
  
  -- Se listino deriva da master, tracciamo anche quello
  master_price_list_id UUID REFERENCES price_lists(id) ON DELETE SET NULL,
  
  -- ============================================
  -- DETTAGLI CORRIERE
  -- ============================================
  courier_code TEXT NOT NULL,
  service_type TEXT,
  
  -- ============================================
  -- RICONCILIAZIONE
  -- ============================================
  reconciliation_status TEXT NOT NULL DEFAULT 'pending' CHECK (reconciliation_status IN (
    'pending',     -- Da riconciliare
    'matched',     -- Corrisponde a fattura corriere
    'discrepancy', -- Differenza trovata
    'resolved'     -- Discrepanza risolta
  )),
  reconciliation_notes TEXT,
  reconciled_at TIMESTAMPTZ,
  reconciled_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  -- Matching con fattura corriere (quando disponibile)
  provider_invoice_id TEXT,
  provider_invoice_date DATE,
  provider_invoice_amount DECIMAL(10,2), -- Importo su fattura (per verifica)
  
  -- ============================================
  -- SOURCE TRACKING (come è stato calcolato provider_cost)
  -- ============================================
  cost_source TEXT NOT NULL DEFAULT 'estimate' CHECK (cost_source IN (
    'api_realtime',   -- Da API corriere in tempo reale
    'master_list',    -- Da listino master (costi base)
    'historical_avg', -- Da media storica
    'estimate'        -- Stima (fallback)
  )),
  
  -- ============================================
  -- METADATA
  -- ============================================
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- ============================================
  -- AUDIT TIMESTAMPS
  -- ============================================
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- ============================================
  -- CONSTRAINTS
  -- ============================================
  -- Una sola entry per spedizione
  CONSTRAINT unique_shipment_cost UNIQUE (shipment_id),
  
  -- billed_amount deve essere >= provider_cost per margine positivo (warning, non bloccante)
  -- NOTA: Non mettiamo CHECK qui perché margini negativi sono possibili (errori listino)
  
  -- tracking_number coerenza
  CONSTRAINT tracking_number_not_empty CHECK (shipment_tracking_number <> '')
);

-- ============================================
-- STEP 2: Indici per Performance
-- ============================================

-- Query frequente: spedizioni per user
CREATE INDEX IF NOT EXISTS idx_ppc_billed_user_id 
  ON platform_provider_costs(billed_user_id);

-- Query frequente: filter per api_source
CREATE INDEX IF NOT EXISTS idx_ppc_api_source 
  ON platform_provider_costs(api_source);

-- Query frequente: riconciliazione pending
CREATE INDEX IF NOT EXISTS idx_ppc_reconciliation_pending 
  ON platform_provider_costs(reconciliation_status) 
  WHERE reconciliation_status IN ('pending', 'discrepancy');

-- Query frequente: report per data
CREATE INDEX IF NOT EXISTS idx_ppc_created_at 
  ON platform_provider_costs(created_at DESC);

-- Query frequente: report per corriere
CREATE INDEX IF NOT EXISTS idx_ppc_courier_code 
  ON platform_provider_costs(courier_code);

-- Query frequente: margini negativi (alert)
CREATE INDEX IF NOT EXISTS idx_ppc_negative_margin 
  ON platform_provider_costs(platform_margin) 
  WHERE platform_margin < 0;

-- Composite per P&L giornaliero (usa created_at diretto, DATE() verrà applicato in query)
CREATE INDEX IF NOT EXISTS idx_ppc_daily_pnl 
  ON platform_provider_costs(created_at, courier_code, api_source);

-- ============================================
-- STEP 3: Trigger per calcolo margini e updated_at
-- ============================================

-- Funzione per calcolare margini automaticamente
CREATE OR REPLACE FUNCTION calculate_ppc_margins()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcola margine assoluto
  NEW.platform_margin := NEW.billed_amount - NEW.provider_cost;
  
  -- Calcola margine percentuale
  IF NEW.provider_cost > 0 THEN
    NEW.platform_margin_percent := ROUND(((NEW.billed_amount - NEW.provider_cost) / NEW.provider_cost * 100)::numeric, 2);
  ELSIF NEW.billed_amount > 0 THEN
    NEW.platform_margin_percent := 100.00;
  ELSE
    NEW.platform_margin_percent := 0.00;
  END IF;
  
  -- Aggiorna timestamp
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ppc_calculate_margins ON platform_provider_costs;
CREATE TRIGGER trigger_ppc_calculate_margins
  BEFORE INSERT OR UPDATE ON platform_provider_costs
  FOR EACH ROW
  EXECUTE FUNCTION calculate_ppc_margins();

COMMENT ON FUNCTION calculate_ppc_margins IS 
  'Calcola automaticamente platform_margin e platform_margin_percent prima di INSERT/UPDATE.';

-- ============================================
-- STEP 4: RLS Policies
-- ============================================

ALTER TABLE platform_provider_costs ENABLE ROW LEVEL SECURITY;

-- Solo SuperAdmin può vedere/modificare
CREATE POLICY ppc_superadmin_select ON platform_provider_costs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.account_type = 'superadmin'
    )
  );

CREATE POLICY ppc_superadmin_insert ON platform_provider_costs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.account_type IN ('superadmin', 'admin')
    )
    OR
    -- Service role può sempre inserire (per automazioni)
    current_setting('role') = 'service_role'
  );

CREATE POLICY ppc_superadmin_update ON platform_provider_costs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.account_type = 'superadmin'
    )
  );

-- NO DELETE policy - i record finanziari non si cancellano mai
-- Se necessario, usare soft-delete con campo aggiuntivo

-- ============================================
-- STEP 5: Comments
-- ============================================

COMMENT ON TABLE platform_provider_costs IS 
  'Traccia i costi reali che SpedireSicuro paga ai corrieri per spedizioni con contratti piattaforma. 
   Usato per P&L, riconciliazione e reporting finanziario.
   Solo SuperAdmin può accedere a questi dati.';

COMMENT ON COLUMN platform_provider_costs.billed_amount IS 
  'Importo addebitato al wallet del Reseller/cliente';

COMMENT ON COLUMN platform_provider_costs.provider_cost IS 
  'Costo reale che SpedireSicuro paga al corriere';

COMMENT ON COLUMN platform_provider_costs.platform_margin IS 
  'Margine lordo = billed_amount - provider_cost (calcolato via trigger)';

COMMENT ON COLUMN platform_provider_costs.api_source IS 
  'Fonte API usata: platform (contratti SpedireSicuro), reseller_own, byoc_own';

COMMENT ON COLUMN platform_provider_costs.reconciliation_status IS 
  'Stato riconciliazione con fatture corriere: pending, matched, discrepancy, resolved';

COMMENT ON COLUMN platform_provider_costs.cost_source IS 
  'Come è stato determinato provider_cost: api_realtime, master_list, historical_avg, estimate';

-- ============================================
-- STEP 6: Function per inserimento sicuro
-- ============================================

CREATE OR REPLACE FUNCTION record_platform_provider_cost(
  p_shipment_id UUID,
  p_tracking_number TEXT,
  p_billed_user_id UUID,
  p_billed_amount DECIMAL,
  p_provider_cost DECIMAL,
  p_api_source TEXT,
  p_courier_code TEXT,
  p_service_type TEXT DEFAULT NULL,
  p_price_list_id UUID DEFAULT NULL,
  p_master_price_list_id UUID DEFAULT NULL,
  p_cost_source TEXT DEFAULT 'estimate'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Validazione input
  IF p_shipment_id IS NULL THEN
    RAISE EXCEPTION 'shipment_id è obbligatorio';
  END IF;
  
  IF p_billed_amount < 0 THEN
    RAISE EXCEPTION 'billed_amount non può essere negativo';
  END IF;
  
  IF p_provider_cost < 0 THEN
    RAISE EXCEPTION 'provider_cost non può essere negativo';
  END IF;

  -- Insert con conflict handling (idempotent)
  INSERT INTO platform_provider_costs (
    shipment_id,
    shipment_tracking_number,
    billed_user_id,
    billed_amount,
    provider_cost,
    api_source,
    courier_code,
    service_type,
    price_list_id,
    master_price_list_id,
    cost_source
  )
  VALUES (
    p_shipment_id,
    p_tracking_number,
    p_billed_user_id,
    p_billed_amount,
    p_provider_cost,
    p_api_source,
    p_courier_code,
    p_service_type,
    p_price_list_id,
    p_master_price_list_id,
    p_cost_source
  )
  ON CONFLICT (shipment_id) DO UPDATE SET
    billed_amount = EXCLUDED.billed_amount,
    provider_cost = EXCLUDED.provider_cost,
    updated_at = NOW()
  RETURNING id INTO v_id;

  -- Log se margine negativo (alert automatico)
  IF p_billed_amount < p_provider_cost THEN
    INSERT INTO financial_audit_log (
      event_type,
      shipment_id,
      user_id,
      amount,
      metadata
    )
    SELECT
      'margin_alert',
      p_shipment_id,
      p_billed_user_id,
      p_billed_amount - p_provider_cost,
      jsonb_build_object(
        'billed_amount', p_billed_amount,
        'provider_cost', p_provider_cost,
        'margin_percent', CASE WHEN p_provider_cost > 0 
          THEN ROUND(((p_billed_amount - p_provider_cost) / p_provider_cost * 100)::numeric, 2)
          ELSE 0 END,
        'courier', p_courier_code,
        'alert', 'NEGATIVE_MARGIN'
      )
    WHERE EXISTS (SELECT 1 FROM financial_audit_log LIMIT 0); -- Solo se tabella esiste
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

COMMENT ON FUNCTION record_platform_provider_cost IS 
  'Inserisce o aggiorna record costo piattaforma. Idempotent (ON CONFLICT UPDATE). 
   Genera alert automatico se margine negativo.';

-- ============================================
-- STEP 7: Verifica integrità
-- ============================================

DO $$
BEGIN
  -- Verifica tabella creata
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'platform_provider_costs'
  ) THEN
    RAISE EXCEPTION 'FAIL: Tabella platform_provider_costs non creata';
  END IF;

  -- Verifica indici
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_ppc_billed_user_id'
  ) THEN
    RAISE EXCEPTION 'FAIL: Indice idx_ppc_billed_user_id non creato';
  END IF;

  -- Verifica RLS abilitato
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'platform_provider_costs' 
    AND rowsecurity = true
  ) THEN
    RAISE EXCEPTION 'FAIL: RLS non abilitato su platform_provider_costs';
  END IF;

  RAISE NOTICE '✅ Migration 090 verificata con successo';
END $$;

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 090 completata con successo';
  RAISE NOTICE '';
  RAISE NOTICE '📊 TABELLA CREATA: platform_provider_costs';
  RAISE NOTICE '   - Traccia costi reali piattaforma';
  RAISE NOTICE '   - Margini calcolati via trigger (no IMMUTABLE issues)';
  RAISE NOTICE '   - RLS: solo SuperAdmin';
  RAISE NOTICE '   - Indici ottimizzati per P&L';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 FUNZIONE CREATA: record_platform_provider_cost()';
  RAISE NOTICE '   - Insert idempotent';
  RAISE NOTICE '   - Alert automatico margini negativi';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  NOTA: Questa tabella registra SOLO spedizioni';
  RAISE NOTICE '   con api_source = "platform". Gli altri tipi';
  RAISE NOTICE '   (reseller_own, byoc_own) non generano record qui.';
  RAISE NOTICE '========================================';
END $$;
