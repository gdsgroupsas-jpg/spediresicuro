-- ============================================
-- MIGRATION: 082_has_capability_function.sql
-- DESCRIZIONE: Crea funzione helper has_capability() per controlli granulari
-- DATA: 2025-01 (Enterprise Hardening - Fase 1)
-- 
-- ⚠️ IMPORTANTE: Funzione helper per verificare capability attive.
-- Non breaking: mantiene compatibilità con role/account_type esistenti.
-- ============================================

-- ============================================
-- STEP 1: Crea funzione has_capability()
-- ============================================

CREATE OR REPLACE FUNCTION has_capability(
  p_user_id UUID,
  p_capability_name TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verifica capability attiva (revoked_at IS NULL)
  RETURN EXISTS (
    SELECT 1 FROM account_capabilities
    WHERE user_id = p_user_id
      AND capability_name = p_capability_name
      AND revoked_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION has_capability IS 
  'Verifica se un utente ha una capability attiva. Usa per controlli granulari. Restituisce TRUE se capability esiste e non è revocata, FALSE altrimenti.';

-- ============================================
-- STEP 2: Test funzione (opzionale, solo per verifica)
-- ============================================

-- Nota: I test veri verranno fatti dopo la migrazione dati
-- Questa è solo una verifica sintattica

DO $$
BEGIN
  -- Verifica che la funzione esista
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'has_capability'
  ) THEN
    RAISE NOTICE '✅ Funzione has_capability() creata con successo';
  ELSE
    RAISE WARNING '⚠️ Funzione has_capability() non trovata';
  END IF;
END $$;

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 082 completata con successo';
  RAISE NOTICE '✅ Funzione has_capability() creata';
  RAISE NOTICE '';
  RAISE NOTICE 'Uso:';
  RAISE NOTICE '  SELECT has_capability(user_id, ''can_manage_pricing'');';
  RAISE NOTICE '';
  RAISE NOTICE 'Prossimi step:';
  RAISE NOTICE '  1. Popolare capability da role/account_type esistenti';
  RAISE NOTICE '  2. Integrare in backend TypeScript';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ NOTA: Funzione non breaking, solo aggiunta';
  RAISE NOTICE '========================================';
END $$;
