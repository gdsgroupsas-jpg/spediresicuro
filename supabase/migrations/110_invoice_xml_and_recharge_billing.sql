-- ============================================
-- MIGRATION: 110_invoice_xml_and_recharge_billing.sql
-- DESCRIZIONE: Sistema fatturazione elettronica e fatturazione ricariche
-- DATA: 2026-01-XX
-- CRITICITÀ: P1 - FATTURAZIONE
-- ============================================
--
-- FUNZIONALITÀ:
-- 1. Supporto XML FatturaPA (fatturazione elettronica)
-- 2. Sistema fatturazione ricariche (automatica/manuale/periodica)
-- 3. Collegamento ricariche → fatture
--
-- ============================================

-- ============================================
-- STEP 1: Estendi tabella invoices per XML
-- ============================================

-- Aggiungi campo XML URL (se non esiste)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'xml_url'
  ) THEN
    ALTER TABLE invoices ADD COLUMN xml_url TEXT;
    COMMENT ON COLUMN invoices.xml_url IS 'URL XML FatturaPA su Storage (fatturazione elettronica)';
  END IF;
END $$;

-- Aggiungi campo invoice_type per distinguere tipi fattura
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'invoice_type'
  ) THEN
    ALTER TABLE invoices ADD COLUMN invoice_type TEXT DEFAULT 'shipment' 
      CHECK (invoice_type IN ('shipment', 'recharge', 'periodic', 'manual'));
    COMMENT ON COLUMN invoices.invoice_type IS 'Tipo fattura: shipment (spedizione), recharge (ricarica), periodic (periodica), manual (manuale)';
  END IF;
END $$;

-- Aggiungi campo period_start/period_end per fatture periodiche
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'period_start'
  ) THEN
    ALTER TABLE invoices ADD COLUMN period_start DATE;
    ALTER TABLE invoices ADD COLUMN period_end DATE;
    COMMENT ON COLUMN invoices.period_start IS 'Data inizio periodo (per fatture periodiche)';
    COMMENT ON COLUMN invoices.period_end IS 'Data fine periodo (per fatture periodiche)';
  END IF;
END $$;

-- ============================================
-- STEP 2: Tabella invoice_recharge_links
-- ============================================
-- Collegamento N:N tra ricariche wallet e fatture
-- Una fattura può includere più ricariche
-- Una ricarica può essere inclusa in una fattura

CREATE TABLE IF NOT EXISTS invoice_recharge_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  wallet_transaction_id UUID NOT NULL REFERENCES wallet_transactions(id) ON DELETE RESTRICT,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  
  -- Audit
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unicità: una ricarica può essere inclusa solo in una fattura
  CONSTRAINT unique_recharge_invoice UNIQUE (wallet_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_recharge_links_invoice ON invoice_recharge_links(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_recharge_links_transaction ON invoice_recharge_links(wallet_transaction_id);

COMMENT ON TABLE invoice_recharge_links IS 
  'Collegamento ricariche wallet → fatture. Supporta fatture che includono più ricariche.';

-- ============================================
-- STEP 3: Tabella invoice_generation_rules
-- ============================================
-- Regole per generazione automatica fatture ricariche

CREATE TABLE IF NOT EXISTS invoice_generation_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Tipo generazione
  generation_type TEXT NOT NULL CHECK (generation_type IN ('automatic', 'manual', 'periodic')),
  
  -- Per periodic: frequenza
  period_frequency TEXT CHECK (period_frequency IN ('monthly', 'quarterly', 'yearly')),
  
  -- Per periodic: giorno del mese/trimestre
  period_day INTEGER CHECK (period_day >= 1 AND period_day <= 31),
  
  -- Filtri ricariche
  include_stripe BOOLEAN DEFAULT true,
  include_bank_transfer BOOLEAN DEFAULT true,
  min_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Stato
  is_active BOOLEAN DEFAULT true,
  
  -- Metadati
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unicità: un utente può avere una sola regola attiva per tipo
-- Usa UNIQUE INDEX parziale invece di constraint inline (PostgreSQL non supporta WHERE in constraint)
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_generation_rules_unique_active 
  ON invoice_generation_rules(user_id, generation_type) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_invoice_generation_rules_user ON invoice_generation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_invoice_generation_rules_active ON invoice_generation_rules(is_active) WHERE is_active = true;

COMMENT ON TABLE invoice_generation_rules IS 
  'Regole per generazione automatica/manuale/periodica fatture ricariche.';

-- ============================================
-- STEP 4: Funzione per generare fattura da ricariche
-- ============================================

CREATE OR REPLACE FUNCTION generate_invoice_from_recharges(
  p_user_id UUID,
  p_transaction_ids UUID[],
  p_invoice_type TEXT DEFAULT 'recharge',
  p_period_start DATE DEFAULT NULL,
  p_period_end DATE DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_invoice_id UUID;
  v_total_amount DECIMAL(10,2) := 0;
  v_subtotal DECIMAL(10,2) := 0;
  v_tax_amount DECIMAL(10,2) := 0;
  v_total DECIMAL(10,2) := 0;
  v_tx RECORD;
  v_invoice_number TEXT;
  v_current_year TEXT;
  v_next_seq INTEGER;
BEGIN
  -- Validazione
  IF array_length(p_transaction_ids, 1) IS NULL OR array_length(p_transaction_ids, 1) = 0 THEN
    RAISE EXCEPTION 'Nessuna transazione specificata';
  END IF;

  -- Verifica che tutte le transazioni siano ricariche positive e non già fatturate
  FOR v_tx IN 
    SELECT wt.id, wt.amount, wt.type, wt.description, wt.created_at
    FROM wallet_transactions wt
    WHERE wt.id = ANY(p_transaction_ids)
      AND wt.user_id = p_user_id
      AND wt.amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM invoice_recharge_links irl 
        WHERE irl.wallet_transaction_id = wt.id
      )
  LOOP
    v_total_amount := v_total_amount + v_tx.amount;
  END LOOP;

  IF v_total_amount = 0 THEN
    RAISE EXCEPTION 'Nessuna ricarica valida da fatturare (già fatturate o importo zero)';
  END IF;

  -- Calcola totali (IVA 22%)
  v_subtotal := v_total_amount;
  v_tax_amount := ROUND(v_subtotal * 0.22, 2);
  v_total := v_subtotal + v_tax_amount;

  -- Genera numero fattura progressivo
  v_current_year := TO_CHAR(NOW(), 'YYYY');
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 6) AS INTEGER)), 0) + 1
  INTO v_next_seq
  FROM invoices
  WHERE invoice_number LIKE v_current_year || '-%'
    AND invoice_number IS NOT NULL;
  
  v_invoice_number := v_current_year || '-' || LPAD(v_next_seq::TEXT, 4, '0');

  -- Crea fattura (draft)
  INSERT INTO invoices (
    user_id,
    invoice_number,
    invoice_date,
    due_date,
    status,
    invoice_type,
    period_start,
    period_end,
    subtotal,
    tax_amount,
    total,
    notes
  )
  VALUES (
    p_user_id,
    v_invoice_number,
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '30 days',
    'draft',
    p_invoice_type,
    p_period_start,
    p_period_end,
    v_subtotal,
    v_tax_amount,
    v_total,
    p_notes
  )
  RETURNING id INTO v_invoice_id;

  -- Crea riga fattura (descrizione ricariche)
  INSERT INTO invoice_items (
    invoice_id,
    description,
    quantity,
    unit_price,
    tax_rate,
    total
  )
  VALUES (
    v_invoice_id,
    CASE 
      WHEN p_invoice_type = 'periodic' AND p_period_start IS NOT NULL AND p_period_end IS NOT NULL THEN
        'Ricariche wallet dal ' || TO_CHAR(p_period_start, 'DD/MM/YYYY') || ' al ' || TO_CHAR(p_period_end, 'DD/MM/YYYY')
      ELSE
        'Ricarica wallet - ' || array_length(p_transaction_ids, 1)::TEXT || ' transazione/i'
    END,
    1,
    v_subtotal,
    22.00,
    v_subtotal
  );

  -- Collega ricariche alla fattura
  FOR v_tx IN 
    SELECT wt.id, wt.amount
    FROM wallet_transactions wt
    WHERE wt.id = ANY(p_transaction_ids)
      AND wt.user_id = p_user_id
      AND wt.amount > 0
      AND NOT EXISTS (
        SELECT 1 FROM invoice_recharge_links irl 
        WHERE irl.wallet_transaction_id = wt.id
      )
  LOOP
    INSERT INTO invoice_recharge_links (
      invoice_id,
      wallet_transaction_id,
      amount
    )
    VALUES (
      v_invoice_id,
      v_tx.id,
      v_tx.amount
    );
  END LOOP;

  RETURN v_invoice_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

COMMENT ON FUNCTION generate_invoice_from_recharges IS 
  'Genera fattura da ricariche wallet. Supporta fatture singole o periodiche.';

-- ============================================
-- STEP 5: RLS Policies
-- ============================================

ALTER TABLE invoice_recharge_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_generation_rules ENABLE ROW LEVEL SECURITY;

-- Policy invoice_recharge_links: Admin vede tutto, utenti vedono solo proprie
CREATE POLICY invoice_recharge_links_select ON invoice_recharge_links
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM invoices i 
    WHERE i.id = invoice_recharge_links.invoice_id 
    AND (
      i.user_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM users u 
        WHERE u.id = auth.uid() 
        AND u.account_type IN ('admin', 'superadmin')
      )
    )
  )
);

-- Policy invoice_generation_rules: Utenti vedono solo proprie regole, admin vede tutto
CREATE POLICY invoice_generation_rules_select ON invoice_generation_rules
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND u.account_type IN ('admin', 'superadmin')
  )
);

CREATE POLICY invoice_generation_rules_modify ON invoice_generation_rules
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() 
    AND u.account_type IN ('admin', 'superadmin')
  )
);

-- ============================================
-- STEP 6: Indici per performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_invoices_invoice_type ON invoices(invoice_type);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices(period_start, period_end) 
  WHERE period_start IS NOT NULL;

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 110 completata con successo';
  RAISE NOTICE '';
  RAISE NOTICE '📋 FUNZIONALITÀ AGGIUNTE:';
  RAISE NOTICE '  - Supporto XML FatturaPA (xml_url su invoices)';
  RAISE NOTICE '  - Sistema fatturazione ricariche (invoice_type)';
  RAISE NOTICE '  - Collegamento ricariche → fatture (invoice_recharge_links)';
  RAISE NOTICE '  - Regole generazione automatica (invoice_generation_rules)';
  RAISE NOTICE '  - Funzione generate_invoice_from_recharges()';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 SICUREZZA:';
  RAISE NOTICE '  - RLS abilitato su tutte le nuove tabelle';
  RAISE NOTICE '  - Validazione input in funzione SQL';
  RAISE NOTICE '  - Unicità ricariche (una ricarica = una fattura)';
  RAISE NOTICE '';
  RAISE NOTICE '📊 TABELLE CREATE:';
  RAISE NOTICE '  - invoice_recharge_links';
  RAISE NOTICE '  - invoice_generation_rules';
  RAISE NOTICE '';
  RAISE NOTICE '🔧 COLONNE AGGIUNTE:';
  RAISE NOTICE '  - invoices.xml_url';
  RAISE NOTICE '  - invoices.invoice_type';
  RAISE NOTICE '  - invoices.period_start';
  RAISE NOTICE '  - invoices.period_end';
  RAISE NOTICE '========================================';
END $$;
