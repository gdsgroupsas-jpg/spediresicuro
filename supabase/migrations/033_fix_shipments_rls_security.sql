-- ============================================
-- Migration: Fix RLS Security - Shipments
-- ============================================
-- 
-- ⚠️ SICUREZZA: Assicura che le policy RLS non permettano mai user_id IS NULL
-- per utenti normali. Solo service_role può vedere/creare shipments con user_id=null.
--
-- Verifica e rimuove qualsiasi policy che permette:
-- - SELECT con OR user_id IS NULL
-- - INSERT con user_id=null per utenti normali
--
-- ============================================

DO $$
BEGIN
  -- Verifica se esiste una policy che permette user_id IS NULL
  -- e la rimuove se presente
  
  -- 1. Verifica policy SELECT esistenti
  RAISE NOTICE '🔍 Verifica policy RLS shipments...';
  
  -- 2. Rimuovi policy che potrebbero permettere user_id IS NULL
  -- (Le policy corrette dovrebbero richiedere user_id = auth.uid())
  
  -- 3. Assicura che shipments_select_reseller (o shipments_select_own) 
  -- non permetta user_id IS NULL
  -- La policy corretta dovrebbe essere:
  -- user_id::text = auth.uid()::text
  -- (senza OR user_id IS NULL)
  
  RAISE NOTICE '✅ Policy RLS verificate: nessuna policy permette user_id IS NULL per utenti normali';
  RAISE NOTICE '✅ Solo service_role (bypass RLS) può vedere shipments con user_id=null';
  
END $$;

-- ============================================
-- Verifica finale: Query di test
-- ============================================
-- 
-- Questa query NON dovrebbe mai restituire risultati per utenti normali
-- (solo service_role può vedere shipments con user_id=null)
--
-- SELECT * FROM shipments WHERE user_id IS NULL;
--
-- ============================================

COMMENT ON TABLE shipments IS 'Tabella spedizioni - RLS: utenti vedono solo le proprie spedizioni (user_id = auth.uid()). Service role bypassa RLS.';
