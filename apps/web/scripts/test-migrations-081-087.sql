-- ============================================
-- SCRIPT DI VERIFICA MIGRAZIONI 081-087
-- Enterprise Hardening - Fase 1-2
-- 
-- Esegui questo script DOPO aver applicato le migrazioni
-- per verificare che tutto sia stato creato correttamente
-- ============================================

DO $$
DECLARE
  v_table_exists BOOLEAN;
  v_function_exists BOOLEAN;
  v_column_exists BOOLEAN;
  v_capability_count INTEGER;
  v_users_with_tenant INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🔍 VERIFICA MIGRAZIONI 081-087';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- ============================================
  -- VERIFICA 081: Tabella account_capabilities
  -- ============================================
  RAISE NOTICE '📋 Verifica 081: account_capabilities table';
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'account_capabilities'
  ) INTO v_table_exists;
  
  IF v_table_exists THEN
    RAISE NOTICE '  ✅ Tabella account_capabilities esiste';
    
    -- Conta capability
    SELECT COUNT(*) INTO v_capability_count
    FROM account_capabilities
    WHERE revoked_at IS NULL;
    
    RAISE NOTICE '  📊 Capability attive: %', v_capability_count;
  ELSE
    RAISE WARNING '  ❌ Tabella account_capabilities NON esiste';
  END IF;
  
  RAISE NOTICE '';

  -- ============================================
  -- VERIFICA 082: Funzione has_capability()
  -- ============================================
  RAISE NOTICE '📋 Verifica 082: has_capability() function';
  
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'has_capability'
  ) INTO v_function_exists;
  
  IF v_function_exists THEN
    RAISE NOTICE '  ✅ Funzione has_capability() esiste';
  ELSE
    RAISE WARNING '  ❌ Funzione has_capability() NON esiste';
  END IF;
  
  RAISE NOTICE '';

  -- ============================================
  -- VERIFICA 084: Campo tenant_id in users
  -- ============================================
  RAISE NOTICE '📋 Verifica 084: tenant_id column in users';
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'tenant_id'
  ) INTO v_column_exists;
  
  IF v_column_exists THEN
    RAISE NOTICE '  ✅ Campo tenant_id esiste';
    
    -- Conta utenti con tenant_id popolato
    SELECT COUNT(*) INTO v_users_with_tenant
    FROM users
    WHERE tenant_id IS NOT NULL;
    
    RAISE NOTICE '  📊 Utenti con tenant_id: %', v_users_with_tenant;
  ELSE
    RAISE WARNING '  ❌ Campo tenant_id NON esiste';
  END IF;
  
  RAISE NOTICE '';

  -- ============================================
  -- VERIFICA 085: Funzione get_user_tenant()
  -- ============================================
  RAISE NOTICE '📋 Verifica 085: get_user_tenant() function';
  
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_user_tenant'
  ) INTO v_function_exists;
  
  IF v_function_exists THEN
    RAISE NOTICE '  ✅ Funzione get_user_tenant() esiste';
  ELSE
    RAISE WARNING '  ❌ Funzione get_user_tenant() NON esiste';
  END IF;
  
  RAISE NOTICE '';

  -- ============================================
  -- VERIFICA 087: RLS Policy aggiornata
  -- ============================================
  RAISE NOTICE '📋 Verifica 087: RLS policy users_select_reseller';
  
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'users' 
    AND policyname = 'users_select_reseller'
  ) INTO v_table_exists;
  
  IF v_table_exists THEN
    RAISE NOTICE '  ✅ RLS policy users_select_reseller esiste';
  ELSE
    RAISE WARNING '  ❌ RLS policy users_select_reseller NON esiste';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Verifica completata';
  RAISE NOTICE '========================================';
END $$;
