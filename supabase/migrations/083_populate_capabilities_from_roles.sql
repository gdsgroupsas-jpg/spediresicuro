-- ============================================
-- MIGRATION: 083_populate_capabilities_from_roles.sql
-- DESCRIZIONE: Popola account_capabilities da role/account_type esistenti
-- DATA: 2025-01 (Enterprise Hardening - Fase 1)
-- 
-- ⚠️ IMPORTANTE: Migrazione dati non breaking.
-- Popola capability da role/account_type esistenti per retrocompatibilità.
-- Mantiene role/account_type come fallback se capability non trovata.
-- ============================================

-- ============================================
-- STEP 1: Popola capability can_manage_pricing
-- ============================================

INSERT INTO account_capabilities (user_id, capability_name, granted_by, notes)
SELECT 
  id,
  'can_manage_pricing',
  id,  -- Self-granted (migrazione automatica)
  'Migrato automaticamente da role/account_type'
FROM users
WHERE account_type IN ('admin', 'superadmin')
  OR role IN ('admin', 'superadmin')
ON CONFLICT (user_id, capability_name) WHERE revoked_at IS NULL DO NOTHING;

-- ============================================
-- STEP 2: Popola capability can_create_subusers
-- ============================================

INSERT INTO account_capabilities (user_id, capability_name, granted_by, notes)
SELECT 
  id,
  'can_create_subusers',
  id,
  'Migrato automaticamente da is_reseller/role/account_type'
FROM users
WHERE is_reseller = true
  OR account_type IN ('admin', 'superadmin')
  OR role IN ('admin', 'superadmin')
ON CONFLICT (user_id, capability_name) WHERE revoked_at IS NULL DO NOTHING;

-- ============================================
-- STEP 3: Popola capability can_access_api
-- ============================================

INSERT INTO account_capabilities (user_id, capability_name, granted_by, notes)
SELECT 
  id,
  'can_access_api',
  id,
  'Migrato automaticamente da account_type BYOC/admin/superadmin'
FROM users
WHERE account_type IN ('byoc', 'admin', 'superadmin')
ON CONFLICT (user_id, capability_name) WHERE revoked_at IS NULL DO NOTHING;

-- ============================================
-- STEP 4: Popola capability can_manage_wallet
-- ============================================

INSERT INTO account_capabilities (user_id, capability_name, granted_by, notes)
SELECT 
  id,
  'can_manage_wallet',
  id,
  'Migrato automaticamente da role/account_type admin/superadmin'
FROM users
WHERE account_type IN ('admin', 'superadmin')
  OR role IN ('admin', 'superadmin')
ON CONFLICT (user_id, capability_name) WHERE revoked_at IS NULL DO NOTHING;

-- ============================================
-- STEP 5: Popola capability can_view_all_clients
-- ============================================

INSERT INTO account_capabilities (user_id, capability_name, granted_by, notes)
SELECT 
  id,
  'can_view_all_clients',
  id,
  'Migrato automaticamente da role/account_type admin/superadmin'
FROM users
WHERE account_type IN ('admin', 'superadmin')
  OR role IN ('admin', 'superadmin')
ON CONFLICT (user_id, capability_name) WHERE revoked_at IS NULL DO NOTHING;

-- ============================================
-- STEP 6: Popola capability can_manage_resellers
-- ============================================

INSERT INTO account_capabilities (user_id, capability_name, granted_by, notes)
SELECT 
  id,
  'can_manage_resellers',
  id,
  'Migrato automaticamente da account_type superadmin'
FROM users
WHERE account_type = 'superadmin'
ON CONFLICT (user_id, capability_name) WHERE revoked_at IS NULL DO NOTHING;

-- ============================================
-- STEP 7: Popola capability can_bypass_rls
-- ============================================

INSERT INTO account_capabilities (user_id, capability_name, granted_by, notes)
SELECT 
  id,
  'can_bypass_rls',
  id,
  'Migrato automaticamente da account_type superadmin'
FROM users
WHERE account_type = 'superadmin'
ON CONFLICT (user_id, capability_name) WHERE revoked_at IS NULL DO NOTHING;

-- ============================================
-- STEP 8: Verifica migrazione
-- ============================================

DO $$
DECLARE
  v_total_capabilities INTEGER;
  v_superadmin_count INTEGER;
  v_admin_count INTEGER;
  v_reseller_count INTEGER;
BEGIN
  -- Conta capability totali
  SELECT COUNT(*) INTO v_total_capabilities
  FROM account_capabilities
  WHERE revoked_at IS NULL;
  
  -- Conta capability per tipo utente
  SELECT COUNT(DISTINCT user_id) INTO v_superadmin_count
  FROM account_capabilities
  WHERE revoked_at IS NULL
    AND user_id IN (SELECT id FROM users WHERE account_type = 'superadmin');
  
  SELECT COUNT(DISTINCT user_id) INTO v_admin_count
  FROM account_capabilities
  WHERE revoked_at IS NULL
    AND user_id IN (SELECT id FROM users WHERE account_type IN ('admin', 'superadmin') OR role IN ('admin', 'superadmin'));
  
  SELECT COUNT(DISTINCT user_id) INTO v_reseller_count
  FROM account_capabilities
  WHERE revoked_at IS NULL
    AND capability_name = 'can_create_subusers'
    AND user_id IN (SELECT id FROM users WHERE is_reseller = true);
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 083 completata con successo';
  RAISE NOTICE '';
  RAISE NOTICE 'Statistiche migrazione:';
  RAISE NOTICE '  - Totale capability attive: %', v_total_capabilities;
  RAISE NOTICE '  - Superadmin con capability: %', v_superadmin_count;
  RAISE NOTICE '  - Admin con capability: %', v_admin_count;
  RAISE NOTICE '  - Reseller con capability: %', v_reseller_count;
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ NOTA: Role/account_type mantengono compatibilità come fallback';
  RAISE NOTICE '========================================';
END $$;
