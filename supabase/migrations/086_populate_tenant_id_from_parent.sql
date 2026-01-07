-- ============================================
-- MIGRATION: 086_populate_tenant_id_from_parent.sql
-- DESCRIZIONE: Popola tenant_id da parent_id/user_id esistenti
-- DATA: 2025-01 (Enterprise Hardening - Fase 2)
-- 
-- ⚠️ IMPORTANTE: Migrazione dati non breaking.
-- Popola tenant_id da parent_id/user_id esistenti per retrocompatibilità.
-- Mantiene parent_id come fallback se tenant_id è NULL.
-- ============================================

-- ============================================
-- STEP 1: Popola tenant_id per Reseller (self-tenant)
-- ============================================

UPDATE users
SET tenant_id = id
WHERE is_reseller = true
  AND parent_id IS NULL
  AND tenant_id IS NULL;

-- ============================================
-- STEP 2: Popola tenant_id per Sub-User (tenant del reseller)
-- ============================================

UPDATE users
SET tenant_id = parent_id
WHERE parent_id IS NOT NULL
  AND tenant_id IS NULL;

-- ============================================
-- STEP 3: Popola tenant_id per BYOC (self-tenant)
-- ============================================

UPDATE users
SET tenant_id = id
WHERE account_type = 'byoc'
  AND tenant_id IS NULL;

-- ============================================
-- STEP 4: Popola tenant_id per Superadmin (self-tenant)
-- ============================================

UPDATE users
SET tenant_id = id
WHERE account_type = 'superadmin'
  AND tenant_id IS NULL;

-- ============================================
-- STEP 5: Popola tenant_id per User standard (self-tenant)
-- ============================================

UPDATE users
SET tenant_id = id
WHERE tenant_id IS NULL
  AND (account_type IS NULL OR account_type = 'user')
  AND parent_id IS NULL
  AND is_reseller = false;

-- ============================================
-- STEP 6: Verifica migrazione
-- ============================================

DO $$
DECLARE
  v_total_users INTEGER;
  v_users_with_tenant INTEGER;
  v_reseller_count INTEGER;
  v_sub_user_count INTEGER;
  v_byoc_count INTEGER;
  v_null_count INTEGER;
BEGIN
  -- Conta utenti totali
  SELECT COUNT(*) INTO v_total_users FROM users;
  
  -- Conta utenti con tenant_id popolato
  SELECT COUNT(*) INTO v_users_with_tenant 
  FROM users 
  WHERE tenant_id IS NOT NULL;
  
  -- Conta per tipo
  SELECT COUNT(*) INTO v_reseller_count
  FROM users
  WHERE is_reseller = true AND tenant_id IS NOT NULL;
  
  SELECT COUNT(*) INTO v_sub_user_count
  FROM users
  WHERE parent_id IS NOT NULL AND tenant_id IS NOT NULL;
  
  SELECT COUNT(*) INTO v_byoc_count
  FROM users
  WHERE account_type = 'byoc' AND tenant_id IS NOT NULL;
  
  -- Conta utenti con tenant_id ancora NULL (dovrebbero essere pochi o zero)
  SELECT COUNT(*) INTO v_null_count
  FROM users
  WHERE tenant_id IS NULL;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 086 completata con successo';
  RAISE NOTICE '';
  RAISE NOTICE 'Statistiche migrazione:';
  RAISE NOTICE '  - Totale utenti: %', v_total_users;
  RAISE NOTICE '  - Utenti con tenant_id: %', v_users_with_tenant;
  RAISE NOTICE '  - Reseller con tenant_id: %', v_reseller_count;
  RAISE NOTICE '  - Sub-User con tenant_id: %', v_sub_user_count;
  RAISE NOTICE '  - BYOC con tenant_id: %', v_byoc_count;
  RAISE NOTICE '  - Utenti con tenant_id NULL: %', v_null_count;
  RAISE NOTICE '';
  
  IF v_null_count > 0 THEN
    RAISE WARNING '⚠️ % utenti con tenant_id NULL dopo migrazione (usano fallback)', v_null_count;
  ELSE
    RAISE NOTICE '✅ Tutti gli utenti hanno tenant_id popolato';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ NOTA: parent_id mantiene compatibilità come fallback';
  RAISE NOTICE '========================================';
END $$;
