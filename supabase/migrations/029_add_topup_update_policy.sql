-- ============================================
-- MIGRATION: 029_add_topup_update_policy.sql
-- DESCRIZIONE: Aggiunge policy UPDATE per top_up_requests (admin only)
-- DATA: 2025-01
-- PREREQUISITO: Migration 027_wallet_topups.sql deve essere eseguita prima
-- ============================================

-- ============================================
-- STEP 1: Aggiungi policy UPDATE per admin su top_up_requests
-- ============================================

-- Policy per permettere agli admin di aggiornare top_up_requests
-- (per approvazione/rifiuto richieste)
-- Nota: Service role key bypassa RLS, ma questa policy è utile per chiarezza
-- e per eventuali operazioni con client autenticati admin

DO $$ 
BEGIN
  -- Verifica che la tabella esista
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'top_up_requests'
  ) THEN
    -- Rimuovi policy esistente se presente (per idempotenza)
    DROP POLICY IF EXISTS "Admins can update top-up requests" ON top_up_requests;
    
    -- Crea policy UPDATE per admin
    -- Nota: Service role key bypassa RLS, ma questa policy è per chiarezza
    -- La policy permette UPDATE se:
    -- 1. auth.uid() è NULL (service role key) - bypassa RLS
    -- 2. auth.uid() corrisponde a un admin nella tabella users
    CREATE POLICY "Admins can update top-up requests" 
    ON top_up_requests FOR UPDATE 
    USING (
      -- Service role key (auth.uid() è NULL) bypassa automaticamente
      auth.uid() IS NULL
      OR
      -- Oppure utente autenticato che è admin
      EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
          users.account_type IN ('admin', 'superadmin') 
          OR users.role = 'admin'
        )
      )
    )
    WITH CHECK (
      -- Stessa logica per WITH CHECK
      auth.uid() IS NULL
      OR
      EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = auth.uid() 
        AND (
          users.account_type IN ('admin', 'superadmin') 
          OR users.role = 'admin'
        )
      )
    );
    
    RAISE NOTICE '✅ Policy UPDATE aggiunta: top_up_requests';
  ELSE
    RAISE NOTICE '⚠️ Tabella top_up_requests non trovata. Eseguire prima migration 027_wallet_topups.sql';
  END IF;
END $$;

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration completata: Add TopUp Update Policy';
  RAISE NOTICE '   - Policy UPDATE aggiunta per admin su top_up_requests';
  RAISE NOTICE '   - Nota: Service role key bypassa RLS, questa policy è per chiarezza';
END $$;
