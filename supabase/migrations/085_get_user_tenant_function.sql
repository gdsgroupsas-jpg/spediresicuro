-- ============================================
-- MIGRATION: 085_get_user_tenant_function.sql
-- DESCRIZIONE: Crea funzione helper get_user_tenant() con fallback
-- DATA: 2025-01 (Enterprise Hardening - Fase 2)
-- 
-- ⚠️ IMPORTANTE: Funzione helper per recuperare tenant_id con fallback.
-- Non breaking: mantiene compatibilità con parent_id esistente.
-- ============================================

-- ============================================
-- STEP 1: Crea funzione get_user_tenant()
-- ============================================

CREATE OR REPLACE FUNCTION get_user_tenant(
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_tenant_id UUID;
  v_parent_id UUID;
BEGIN
  -- 1. Recupera tenant_id e parent_id
  SELECT tenant_id, parent_id
  INTO v_tenant_id, v_parent_id
  FROM users
  WHERE id = p_user_id;
  
  -- 2. Se tenant_id è NULL, usa fallback
  IF v_tenant_id IS NULL THEN
    -- Fallback 1: usa parent_id se esiste (Sub-User)
    IF v_parent_id IS NOT NULL THEN
      RETURN v_parent_id;
    END IF;
    
    -- Fallback 2: usa user_id (self-tenant per Reseller/BYOC/User standard)
    RETURN p_user_id;
  END IF;
  
  -- 3. Restituisci tenant_id trovato
  RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_tenant IS 
  'Recupera tenant_id di un utente con fallback automatico. Se tenant_id è NULL, usa parent_id o user_id. Mantiene retrocompatibilità.';

-- ============================================
-- STEP 2: Test funzione (opzionale, solo per verifica)
-- ============================================

DO $$
BEGIN
  -- Verifica che la funzione esista
  IF EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_user_tenant'
  ) THEN
    RAISE NOTICE '✅ Funzione get_user_tenant() creata con successo';
  ELSE
    RAISE WARNING '⚠️ Funzione get_user_tenant() non trovata';
  END IF;
END $$;

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 085 completata con successo';
  RAISE NOTICE '✅ Funzione get_user_tenant() creata';
  RAISE NOTICE '';
  RAISE NOTICE 'Uso:';
  RAISE NOTICE '  SELECT get_user_tenant(user_id);';
  RAISE NOTICE '';
  RAISE NOTICE 'Fallback:';
  RAISE NOTICE '  1. Se tenant_id IS NULL e parent_id IS NOT NULL → usa parent_id';
  RAISE NOTICE '  2. Altrimenti → usa user_id (self-tenant)';
  RAISE NOTICE '';
  RAISE NOTICE 'Prossimi step:';
  RAISE NOTICE '  1. Popolare tenant_id da parent_id/user_id esistenti';
  RAISE NOTICE '  2. Aggiornare RLS policies per usare tenant_id';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ NOTA: Funzione non breaking, solo aggiunta';
  RAISE NOTICE '========================================';
END $$;
