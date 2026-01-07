-- ============================================
-- MIGRATION: 087_update_rls_users_tenant_id.sql
-- DESCRIZIONE: Aggiorna RLS policy users per usare tenant_id con fallback
-- DATA: 2025-01 (Enterprise Hardening - Fase 2)
-- 
-- ⚠️ IMPORTANTE: Aggiorna RLS policy con supporto tenant_id.
-- Non breaking: mantiene fallback a parent_id per retrocompatibilità.
-- ============================================

-- ============================================
-- STEP 1: Rimuovi policy esistente
-- ============================================

DROP POLICY IF EXISTS users_select_reseller ON users;

-- ============================================
-- STEP 2: Crea nuova policy con supporto tenant_id
-- ============================================

CREATE POLICY users_select_reseller ON users
  FOR SELECT USING (
    -- Super Admin vede tutto
    is_super_admin(auth.uid())
    OR
    -- Utente vede se stesso
    auth.uid()::text = id::text
    OR
    -- Reseller vede Sub-Users (via tenant_id o parent_id fallback)
    (
      is_reseller(auth.uid())
      AND (
        -- Nuovo: usa tenant_id se disponibile
        (
          tenant_id IS NOT NULL
          AND tenant_id = get_user_tenant(auth.uid())
        )
        OR
        -- Fallback: usa parent_id (retrocompatibilità)
        is_sub_user_of(id, auth.uid())
      )
    )
  );

COMMENT ON POLICY users_select_reseller ON users IS 
  'RLS: Super Admin vede tutto, Reseller vede Sub-Users (via tenant_id o parent_id fallback), User vede solo se stesso. Usa tenant_id se disponibile, altrimenti fallback a parent_id.';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 087 completata con successo';
  RAISE NOTICE '✅ RLS policy users_select_reseller aggiornata';
  RAISE NOTICE '';
  RAISE NOTICE 'Modifiche:';
  RAISE NOTICE '  - Aggiunto supporto tenant_id';
  RAISE NOTICE '  - Mantenuto fallback a parent_id';
  RAISE NOTICE '  - Non breaking: retrocompatibilità garantita';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ NOTA: Policy usa tenant_id se disponibile, altrimenti parent_id';
  RAISE NOTICE '========================================';
END $$;
