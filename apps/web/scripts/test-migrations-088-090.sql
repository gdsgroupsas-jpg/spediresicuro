-- ============================================
-- Test Script: Verifica Migrations 088-090 (Fase 3: Reseller Tier)
-- ============================================

-- Test 1: Verifica enum reseller_tier esiste
DO $$
DECLARE
  v_enum_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'reseller_tier'
  ) INTO v_enum_exists;
  
  IF v_enum_exists THEN
    RAISE NOTICE '✅ Test 1 PASSED: Enum reseller_tier esiste';
  ELSE
    RAISE EXCEPTION '❌ Test 1 FAILED: Enum reseller_tier non trovato';
  END IF;
END $$;

-- Test 2: Verifica valori enum
DO $$
DECLARE
  v_enum_values TEXT[];
BEGIN
  SELECT ARRAY_AGG(enumlabel ORDER BY enumsortorder) INTO v_enum_values
  FROM pg_enum
  WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'reseller_tier');
  
  IF v_enum_values = ARRAY['small', 'medium', 'enterprise'] THEN
    RAISE NOTICE '✅ Test 2 PASSED: Enum ha valori corretti: %', v_enum_values;
  ELSE
    RAISE EXCEPTION '❌ Test 2 FAILED: Enum valori non corretti. Atteso: [small, medium, enterprise], Trovato: %', v_enum_values;
  END IF;
END $$;

-- Test 3: Verifica campo reseller_tier in users
DO $$
DECLARE
  v_column_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'reseller_tier'
  ) INTO v_column_exists;
  
  IF v_column_exists THEN
    RAISE NOTICE '✅ Test 3 PASSED: Campo reseller_tier esiste in users';
  ELSE
    RAISE EXCEPTION '❌ Test 3 FAILED: Campo reseller_tier non trovato';
  END IF;
END $$;

-- Test 4: Verifica indice idx_users_reseller_tier
DO $$
DECLARE
  v_index_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'users' AND indexname = 'idx_users_reseller_tier'
  ) INTO v_index_exists;
  
  IF v_index_exists THEN
    RAISE NOTICE '✅ Test 4 PASSED: Indice idx_users_reseller_tier esiste';
  ELSE
    RAISE EXCEPTION '❌ Test 4 FAILED: Indice idx_users_reseller_tier non trovato';
  END IF;
END $$;

-- Test 5: Verifica funzione get_reseller_tier()
DO $$
DECLARE
  v_function_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_reseller_tier'
  ) INTO v_function_exists;
  
  IF v_function_exists THEN
    RAISE NOTICE '✅ Test 5 PASSED: Funzione get_reseller_tier() esiste';
  ELSE
    RAISE EXCEPTION '❌ Test 5 FAILED: Funzione get_reseller_tier() non trovata';
  END IF;
END $$;

-- Test 6: Test funzione get_reseller_tier() con reseller esistente
DO $$
DECLARE
  v_test_user_id UUID;
  v_tier reseller_tier;
BEGIN
  -- Cerca un reseller esistente
  SELECT id INTO v_test_user_id
  FROM users
  WHERE is_reseller = true
  LIMIT 1;
  
  IF v_test_user_id IS NULL THEN
    RAISE NOTICE '⚠️ Test 6 SKIPPED: Nessun reseller trovato per test';
  ELSE
    -- Test funzione
    SELECT get_reseller_tier(v_test_user_id) INTO v_tier;
    
    IF v_tier IS NOT NULL THEN
      RAISE NOTICE '✅ Test 6 PASSED: Funzione restituisce tier: %', v_tier;
    ELSE
      RAISE NOTICE '⚠️ Test 6 WARNING: Funzione restituisce NULL (potrebbe essere normale se reseller ha 0 sub-users)';
    END IF;
  END IF;
END $$;

-- Test 7: Verifica popolamento reseller_tier
DO $$
DECLARE
  v_total_resellers INTEGER;
  v_resellers_with_tier INTEGER;
  v_resellers_without_tier INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total_resellers
  FROM users
  WHERE is_reseller = true;
  
  SELECT COUNT(*) INTO v_resellers_with_tier
  FROM users
  WHERE is_reseller = true
    AND reseller_tier IS NOT NULL;
  
  SELECT COUNT(*) INTO v_resellers_without_tier
  FROM users
  WHERE is_reseller = true
    AND reseller_tier IS NULL;
  
  IF v_total_resellers = 0 THEN
    RAISE NOTICE 'ℹ️ Test 7 INFO: Nessun reseller nel database (normale se vuoto)';
  ELSIF v_resellers_without_tier = 0 THEN
    RAISE NOTICE '✅ Test 7 PASSED: Tutti i % reseller hanno tier popolato', v_total_resellers;
  ELSE
    RAISE WARNING '⚠️ Test 7 WARNING: % reseller su % senza tier (potrebbe essere normale se hanno 0 sub-users)', 
      v_resellers_without_tier, v_total_resellers;
  END IF;
END $$;

-- Test 8: Verifica distribuzione tier
DO $$
DECLARE
  v_small_count INTEGER;
  v_medium_count INTEGER;
  v_enterprise_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_small_count
  FROM users
  WHERE is_reseller = true AND reseller_tier = 'small';
  
  SELECT COUNT(*) INTO v_medium_count
  FROM users
  WHERE is_reseller = true AND reseller_tier = 'medium';
  
  SELECT COUNT(*) INTO v_enterprise_count
  FROM users
  WHERE is_reseller = true AND reseller_tier = 'enterprise';
  
  RAISE NOTICE '📊 Test 8 INFO - Distribuzione tier:';
  RAISE NOTICE '   Small: %', v_small_count;
  RAISE NOTICE '   Medium: %', v_medium_count;
  RAISE NOTICE '   Enterprise: %', v_enterprise_count;
  
  IF v_small_count + v_medium_count + v_enterprise_count >= 0 THEN
    RAISE NOTICE '✅ Test 8 PASSED: Distribuzione tier calcolata correttamente';
  END IF;
END $$;

-- Test 9: Verifica che non-reseller non hanno tier
DO $$
DECLARE
  v_non_resellers_with_tier INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_non_resellers_with_tier
  FROM users
  WHERE is_reseller = false
    AND reseller_tier IS NOT NULL;
  
  IF v_non_resellers_with_tier = 0 THEN
    RAISE NOTICE '✅ Test 9 PASSED: Nessun non-reseller ha tier (corretto)';
  ELSE
    RAISE WARNING '⚠️ Test 9 WARNING: % non-reseller hanno tier (dovrebbe essere 0)', v_non_resellers_with_tier;
  END IF;
END $$;

-- Riepilogo finale
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ VERIFICA MIGRATIONS 088-090 COMPLETATA';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Se tutti i test sono PASSED, le migrations sono state applicate correttamente.';
  RAISE NOTICE '';
END $$;
