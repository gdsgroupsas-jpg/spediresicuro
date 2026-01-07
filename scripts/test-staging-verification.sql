-- ============================================
-- SCRIPT DI VERIFICA STAGING
-- Enterprise Hardening - Fase 1-2
-- 
-- Esegui questo script su STAGING dopo deploy
-- per verificare che tutto funzioni correttamente
-- ============================================

-- ============================================
-- VERIFICA 1: Database Schema
-- ============================================

DO $$
DECLARE
  v_table_exists BOOLEAN;
  v_column_exists BOOLEAN;
  v_function_exists BOOLEAN;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🔍 VERIFICA STAGING - Database Schema';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Verifica tabella account_capabilities
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'account_capabilities'
  ) INTO v_table_exists;
  
  IF v_table_exists THEN
    RAISE NOTICE '✅ Tabella account_capabilities esiste';
  ELSE
    RAISE EXCEPTION '❌ Tabella account_capabilities NON esiste';
  END IF;

  -- Verifica campo tenant_id
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'tenant_id'
  ) INTO v_column_exists;
  
  IF v_column_exists THEN
    RAISE NOTICE '✅ Campo tenant_id esiste';
  ELSE
    RAISE EXCEPTION '❌ Campo tenant_id NON esiste';
  END IF;

  -- Verifica funzioni
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'has_capability'
  ) INTO v_function_exists;
  
  IF v_function_exists THEN
    RAISE NOTICE '✅ Funzione has_capability() esiste';
  ELSE
    RAISE EXCEPTION '❌ Funzione has_capability() NON esiste';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_user_tenant'
  ) INTO v_function_exists;
  
  IF v_function_exists THEN
    RAISE NOTICE '✅ Funzione get_user_tenant() esiste';
  ELSE
    RAISE EXCEPTION '❌ Funzione get_user_tenant() NON esiste';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Schema verificato con successo';
  RAISE NOTICE '';
END $$;

-- ============================================
-- VERIFICA 2: Dati Popolati
-- ============================================

DO $$
DECLARE
  v_capability_count INTEGER;
  v_users_with_tenant INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🔍 VERIFICA STAGING - Dati Popolati';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Conta capability
  SELECT COUNT(*) INTO v_capability_count
  FROM account_capabilities
  WHERE revoked_at IS NULL;
  
  RAISE NOTICE '📊 Capability attive: %', v_capability_count;
  
  IF v_capability_count = 0 THEN
    RAISE WARNING '⚠️ Nessuna capability trovata - verificare migrazione 083';
  END IF;

  -- Conta utenti con tenant_id
  SELECT COUNT(*) INTO v_users_with_tenant
  FROM users
  WHERE tenant_id IS NOT NULL;
  
  RAISE NOTICE '📊 Utenti con tenant_id: %', v_users_with_tenant;
  
  IF v_users_with_tenant = 0 THEN
    RAISE WARNING '⚠️ Nessun utente con tenant_id - verificare migrazione 086';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Dati verificati';
  RAISE NOTICE '';
END $$;

-- ============================================
-- VERIFICA 3: Funzioni Funzionanti
-- ============================================

DO $$
DECLARE
  v_test_user_id UUID;
  v_test_result BOOLEAN;
  v_tenant_result UUID;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🔍 VERIFICA STAGING - Funzioni';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Trova un utente di test (superadmin o admin)
  SELECT id INTO v_test_user_id
  FROM users
  WHERE account_type IN ('superadmin', 'admin')
  LIMIT 1;

  IF v_test_user_id IS NULL THEN
    RAISE WARNING '⚠️ Nessun utente admin trovato per test';
  ELSE
    -- Test has_capability
    SELECT has_capability(v_test_user_id, 'can_manage_pricing') INTO v_test_result;
    
    IF v_test_result THEN
      RAISE NOTICE '✅ has_capability() funziona correttamente';
    ELSE
      RAISE WARNING '⚠️ has_capability() restituisce FALSE per admin';
    END IF;

    -- Test get_user_tenant
    SELECT get_user_tenant(v_test_user_id) INTO v_tenant_result;
    
    IF v_tenant_result IS NOT NULL THEN
      RAISE NOTICE '✅ get_user_tenant() funziona correttamente';
    ELSE
      RAISE WARNING '⚠️ get_user_tenant() restituisce NULL';
    END IF;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✅ Funzioni verificate';
  RAISE NOTICE '';
END $$;

-- ============================================
-- VERIFICA 4: RLS Policies
-- ============================================

DO $$
DECLARE
  v_policy_exists BOOLEAN;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🔍 VERIFICA STAGING - RLS Policies';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- Verifica policy users_select_reseller
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND policyname = 'users_select_reseller'
  ) INTO v_policy_exists;
  
  IF v_policy_exists THEN
    RAISE NOTICE '✅ RLS policy users_select_reseller esiste';
  ELSE
    RAISE WARNING '❌ RLS policy users_select_reseller NON esiste';
  END IF;

  -- Verifica policy account_capabilities
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'account_capabilities' 
    AND policyname = 'account_capabilities_select'
  ) INTO v_policy_exists;
  
  IF v_policy_exists THEN
    RAISE NOTICE '✅ RLS policy account_capabilities_select esiste';
  ELSE
    RAISE WARNING '❌ RLS policy account_capabilities_select NON esiste';
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '✅ RLS policies verificate';
  RAISE NOTICE '';
END $$;

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ VERIFICA STAGING COMPLETATA';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Prossimi step:';
  RAISE NOTICE '  1. Verificare funzionamento app su staging';
  RAISE NOTICE '  2. Testare login con utenti esistenti';
  RAISE NOTICE '  3. Verificare che fallback funzioni';
  RAISE NOTICE '  4. Monitorare performance';
  RAISE NOTICE '';
END $$;
