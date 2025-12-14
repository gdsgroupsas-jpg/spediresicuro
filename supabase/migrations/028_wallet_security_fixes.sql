-- ============================================
-- MIGRATION: 028_wallet_security_fixes.sql
-- DESCRIZIONE: Fix sicurezza wallet - Limiti importo e anti-duplicati
-- DATA: 2025-01
-- PREREQUISITO: Migration 027_wallet_topups.sql deve essere eseguita prima
-- ============================================

-- ============================================
-- STEP 1: Aggiungi limite massimo importo a add_wallet_credit()
-- ============================================

CREATE OR REPLACE FUNCTION add_wallet_credit(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  MAX_SINGLE_AMOUNT CONSTANT DECIMAL(10,2) := 10000.00;
BEGIN
  -- Verifica che l'importo sia positivo
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'L''importo deve essere positivo';
  END IF;
  
  -- Verifica limite massimo per singola operazione
  IF p_amount > MAX_SINGLE_AMOUNT THEN
    RAISE EXCEPTION 'Importo massimo consentito per singola operazione: €%.2f. Importo richiesto: €%.2f', MAX_SINGLE_AMOUNT, p_amount;
  END IF;
  
  -- Crea transazione
  INSERT INTO wallet_transactions (
    user_id,
    amount,
    type,
    description,
    created_by
  ) VALUES (
    p_user_id,
    p_amount,
    'deposit',
    COALESCE(p_description, 'Ricarica credito'),
    p_created_by
  ) RETURNING id INTO v_transaction_id;
  
  -- Il trigger aggiornerà automaticamente wallet_balance
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION add_wallet_credit IS 'Aggiunge credito al wallet di un utente (solo per Super Admin o Reseller). Limite max: €10.000 per operazione.';

-- ============================================
-- STEP 2: Aggiungi colonna file_hash a top_up_requests (per anti-duplicati)
-- ============================================

DO $$ 
BEGIN
  -- Verifica che la tabella esista (creata in migration 027)
  -- Usa pg_tables per maggiore affidabilità
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'top_up_requests'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'top_up_requests' AND column_name = 'file_hash'
    ) THEN
      ALTER TABLE public.top_up_requests ADD COLUMN file_hash TEXT;
      COMMENT ON COLUMN public.top_up_requests.file_hash IS 'SHA256 hash del file per prevenire duplicati';
      RAISE NOTICE '✅ Aggiunto campo: top_up_requests.file_hash';
    ELSE
      RAISE NOTICE '⚠️ Campo top_up_requests.file_hash già esistente';
    END IF;
  ELSE
    RAISE NOTICE '⚠️ Tabella top_up_requests non trovata. Eseguire prima migration 027_wallet_topups.sql';
    RAISE NOTICE '   La migration continuerà senza aggiungere colonne a top_up_requests.';
  END IF;
END $$;

-- Indice per ricerca duplicati veloce (solo se tabella esiste)
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'top_up_requests'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_top_up_requests_file_hash ON public.top_up_requests(user_id, file_hash) WHERE file_hash IS NOT NULL;
  END IF;
END $$;

-- ============================================
-- STEP 3: Aggiungi colonne per approvazione top_up_requests
-- ============================================

DO $$ 
BEGIN
  -- Verifica che la tabella esista (usa pg_tables per maggiore affidabilità)
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'top_up_requests'
  ) THEN
    -- approved_by
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'top_up_requests' AND column_name = 'approved_by'
    ) THEN
      ALTER TABLE public.top_up_requests ADD COLUMN approved_by UUID REFERENCES auth.users(id);
      COMMENT ON COLUMN public.top_up_requests.approved_by IS 'ID admin che ha approvato/rifiutato la richiesta';
      RAISE NOTICE '✅ Aggiunto campo: top_up_requests.approved_by';
    END IF;

    -- approved_at
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'top_up_requests' AND column_name = 'approved_at'
    ) THEN
      ALTER TABLE public.top_up_requests ADD COLUMN approved_at TIMESTAMPTZ;
      COMMENT ON COLUMN public.top_up_requests.approved_at IS 'Data/ora approvazione/rifiuto';
      RAISE NOTICE '✅ Aggiunto campo: top_up_requests.approved_at';
    END IF;

    -- approved_amount
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'top_up_requests' AND column_name = 'approved_amount'
    ) THEN
      ALTER TABLE public.top_up_requests ADD COLUMN approved_amount DECIMAL(10,2);
      COMMENT ON COLUMN public.top_up_requests.approved_amount IS 'Importo effettivamente accreditato (può differire da amount dichiarato)';
      RAISE NOTICE '✅ Aggiunto campo: top_up_requests.approved_amount';
    END IF;
  ELSE
    RAISE NOTICE '⚠️ Tabella top_up_requests non trovata. Eseguire prima migration 027_wallet_topups.sql';
    RAISE NOTICE '   La migration continuerà senza aggiungere colonne a top_up_requests.';
  END IF;
END $$;

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration completata: Wallet Security Fixes';
  RAISE NOTICE '   - Limite max €10.000 aggiunto a add_wallet_credit()';
  RAISE NOTICE '   - Colonne file_hash, approved_by, approved_at, approved_amount aggiunte a top_up_requests';
END $$;
