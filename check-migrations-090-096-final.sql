-- ============================================
-- SQL VERIFICA MIGRATIONS 090-096 (FINAL)
-- ============================================
-- SCOPO: Verificare quali migrations sono state applicate
--          al database di Supabase
-- PATTERN: Segue il pattern della codebase (test-migrations-081-087.sql)
-- ============================================

DO $$
DECLARE
  v_migrations_count INTEGER;
  v_table_exists BOOLEAN;
  v_column_exists BOOLEAN;
  v_view_exists BOOLEAN;
  v_function_exists BOOLEAN;
  v_record_count INTEGER;
  v_api_source_count INTEGER;
  v_api_source_distinct INTEGER;
  api_source_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '==================================================';
  RAISE NOTICE '🔍 VERIFICA MIGRATIONS 090-096';
  RAISE NOTICE '==================================================';
  RAISE NOTICE '';

  -- ============================================
  -- SEZIONE 1: MIGRATIONS APPLICATE
  -- ============================================
  RAISE NOTICE '📋 SEZIONE 1: Migrations Applicate';
  RAISE NOTICE '----------------------------------------';
  
  SELECT COUNT(*) INTO v_migrations_count
  FROM supabase_migrations.schema_migrations
  WHERE version >= '090' AND version <= '096';
  
  RAISE NOTICE 'Migrations applicate: % / 7', v_migrations_count;
  
  IF v_migrations_count = 7 THEN
    RAISE NOTICE '✅ TUTTE LE MIGRATIONS SONO APPLICATE!';
  ELSIF v_migrations_count >= 5 THEN
    RAISE NOTICE '⚠️ LA MAGGIOR PARTE DELLE MIGRATIONS È APPLICATA';
  ELSE
    RAISE WARNING '❌ MIGRATIONS 090-096 NON ANCORA APPLICATE';
  END IF;
  
  RAISE NOTICE '';

  -- ============================================
  -- SEZIONE 2: VERIFICA TABELLE/OGGETTI
  -- ============================================
  RAISE NOTICE '📋 SEZIONE 2: Verifica Tabelle/Oggetti';
  RAISE NOTICE '----------------------------------------';

  -- Tabella platform_provider_costs (Migration 090)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'platform_provider_costs'
  ) INTO v_table_exists;
  
  IF v_table_exists THEN
    RAISE NOTICE '✅ platform_provider_costs: ESISTE';
  ELSE
    RAISE WARNING '❌ platform_provider_costs: NON ESISTE';
  END IF;

  -- Colonna api_source in shipments (Migration 091)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'shipments' 
    AND column_name = 'api_source'
  ) INTO v_column_exists;
  
  IF v_column_exists THEN
    RAISE NOTICE '✅ shipments.api_source: ESISTE';
  ELSE
    RAISE WARNING '❌ shipments.api_source: NON ESISTE';
  END IF;

  -- Vista v_platform_daily_pnl (Migration 092)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_schema = 'public'
    AND table_name = 'v_platform_daily_pnl'
  ) INTO v_view_exists;
  
  IF v_view_exists THEN
    RAISE NOTICE '✅ v_platform_daily_pnl: ESISTE';
  ELSE
    RAISE WARNING '❌ v_platform_daily_pnl: NON ESISTE';
  END IF;

  -- Tabella financial_audit_log (Migration 093)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'financial_audit_log'
  ) INTO v_table_exists;
  
  IF v_table_exists THEN
    RAISE NOTICE '✅ financial_audit_log: ESISTE';
  ELSE
    RAISE WARNING '❌ financial_audit_log: NON ESISTE';
  END IF;

  -- Tabella cost_validations (Migration 096)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'cost_validations'
  ) INTO v_table_exists;
  
  IF v_table_exists THEN
    RAISE NOTICE '✅ cost_validations: ESISTE';
  ELSE
    RAISE WARNING '❌ cost_validations: NON ESISTE';
  END IF;

  -- Colonna tenant_id in users (Migration 084)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'users' 
    AND column_name = 'tenant_id'
  ) INTO v_column_exists;
  
  IF v_column_exists THEN
    RAISE NOTICE '✅ users.tenant_id: ESISTE';
  ELSE
    RAISE WARNING '❌ users.tenant_id: NON ESISTE';
  END IF;

  -- Tabella account_capabilities (Migration 081)
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'account_capabilities'
  ) INTO v_table_exists;
  
  IF v_table_exists THEN
    RAISE NOTICE '✅ account_capabilities: ESISTE';
  ELSE
    RAISE WARNING '❌ account_capabilities: NON ESISTE';
  END IF;

  RAISE NOTICE '';

  -- ============================================
  -- SEZIONE 3: VERIFICA FUNZIONI RPC
  -- ============================================
  RAISE NOTICE '📋 SEZIONE 3: Verifica Funzioni RPC';
  RAISE NOTICE '----------------------------------------';

  -- Funzione record_platform_provider_cost (Migration 090)
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'record_platform_provider_cost'
  ) INTO v_function_exists;
  
  IF v_function_exists THEN
    RAISE NOTICE '✅ record_platform_provider_cost: ESISTE';
  ELSE
    RAISE WARNING '❌ record_platform_provider_cost: NON ESISTE';
  END IF;

  -- Funzione log_financial_event (Migration 093)
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'log_financial_event'
  ) INTO v_function_exists;
  
  IF v_function_exists THEN
    RAISE NOTICE '✅ log_financial_event: ESISTE';
  ELSE
    RAISE WARNING '❌ log_financial_event: NON ESISTE';
  END IF;

  -- Funzione log_wallet_operation (Migration 093)
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'log_wallet_operation'
  ) INTO v_function_exists;
  
  IF v_function_exists THEN
    RAISE NOTICE '✅ log_wallet_operation: ESISTE';
  ELSE
    RAISE WARNING '❌ log_wallet_operation: NON ESISTE';
  END IF;

  -- Funzione has_capability (Migration 082)
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'has_capability'
  ) INTO v_function_exists;
  
  IF v_function_exists THEN
    RAISE NOTICE '✅ has_capability: ESISTE';
  ELSE
    RAISE WARNING '❌ has_capability: NON ESISTE';
  END IF;

  -- Funzione get_user_tenant (Migration 085)
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_user_tenant'
  ) INTO v_function_exists;
  
  IF v_function_exists THEN
    RAISE NOTICE '✅ get_user_tenant: ESISTE';
  ELSE
    RAISE WARNING '❌ get_user_tenant: NON ESISTE';
  END IF;

  RAISE NOTICE '';

  -- ============================================
  -- SEZIONE 4: VERIFICA DATI IN TABELLE
  -- ============================================
  RAISE NOTICE '📋 SEZIONE 4: Verifica Dati in Tabelle';
  RAISE NOTICE '----------------------------------------';

  -- Quanti record in platform_provider_costs?
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_provider_costs') THEN
    SELECT COUNT(*) INTO v_record_count FROM platform_provider_costs;
    RAISE NOTICE 'platform_provider_costs: % recordi', v_record_count;
  ELSE
    RAISE NOTICE 'platform_provider_costs: tabella non esiste';
  END IF;

  -- Quanti record in financial_audit_log?
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_audit_log') THEN
    SELECT COUNT(*) INTO v_record_count FROM financial_audit_log;
    RAISE NOTICE 'financial_audit_log: % recordi', v_record_count;
  ELSE
    RAISE NOTICE 'financial_audit_log: tabella non esiste';
  END IF;

  -- Quanti record in account_capabilities?
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'account_capabilities') THEN
    SELECT COUNT(*) INTO v_record_count FROM account_capabilities;
    RAISE NOTICE 'account_capabilities: % recordi', v_record_count;
  ELSE
    RAISE NOTICE 'account_capabilities: tabella non esiste';
  END IF;

  -- Quanti record in cost_validations? (Migration 096)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cost_validations') THEN
    SELECT COUNT(*) INTO v_record_count FROM cost_validations;
    RAISE NOTICE 'cost_validations: % recordi', v_record_count;
  ELSE
    RAISE NOTICE 'cost_validations: tabella non esiste';
  END IF;

  RAISE NOTICE '';

  -- ============================================
  -- SEZIONE 5: VERIFICA api_source IN shipments
  -- ============================================
  RAISE NOTICE '📋 SEZIONE 5: Verifica api_source in shipments';
  RAISE NOTICE '----------------------------------------';

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public'
    AND table_name = 'shipments' 
    AND column_name = 'api_source'
  ) THEN
    SELECT COUNT(*) INTO v_api_source_count
    FROM shipments
    WHERE api_source IS NOT NULL;
    
    SELECT COUNT(DISTINCT api_source) INTO v_api_source_distinct
    FROM shipments
    WHERE api_source IS NOT NULL;
    
    RAISE NOTICE 'Spedizioni con api_source: %', v_api_source_count;
    RAISE NOTICE 'Valori api_source distinti: %', v_api_source_distinct;
    
    IF v_api_source_count > 0 THEN
      RAISE NOTICE 'Distribuzione api_source:';
      FOR api_source_record IN
        SELECT api_source, COUNT(*) as cnt
        FROM shipments
        WHERE api_source IS NOT NULL
        GROUP BY api_source
        ORDER BY api_source
      LOOP
        RAISE NOTICE '  - %: %', api_source_record.api_source, api_source_record.cnt;
      END LOOP;
    END IF;
  ELSE
    RAISE NOTICE 'Colonna api_source non esiste in shipments';
  END IF;

  RAISE NOTICE '';

  -- ============================================
  -- SEZIONE 6: RIEPILOGO FINALE
  -- ============================================
  RAISE NOTICE '==================================================';
  RAISE NOTICE '📊 RIEPILOGO FINALE';
  RAISE NOTICE '==================================================';
  RAISE NOTICE '';
  
  SELECT COUNT(*) INTO v_migrations_count
  FROM supabase_migrations.schema_migrations
  WHERE version >= '090' AND version <= '096';
  
  RAISE NOTICE 'Migrations applicate: % / 7', v_migrations_count;
  RAISE NOTICE '';
  
  IF v_migrations_count = 7 THEN
    RAISE NOTICE '✅ TUTTE LE MIGRATIONS SONO APPLICATE!';
    RAISE NOTICE '';
    RAISE NOTICE 'Database pronto per PR #38';
    RAISE NOTICE 'Rollback meno rischioso (no data loss)';
    RAISE NOTICE '';
    RAISE NOTICE 'PROSSIMO PASSO:';
    RAISE NOTICE '1. Verificare che il codice esistente funziona ancora';
    RAISE NOTICE '2. Testare su staging';
    RAISE NOTICE '3. Preparare contingency plan';
    RAISE NOTICE '4. Fare merge di PR #38';
  ELSIF v_migrations_count >= 5 THEN
    RAISE NOTICE '⚠️ LA MAGGIOR PARTE DELLE MIGRATIONS È APPLICATA';
    RAISE NOTICE '';
    RAISE NOTICE 'PROSSIMO PASSO:';
    RAISE NOTICE '1. Identificare quali migrations mancano';
    RAISE NOTICE '2. Applicare le migrations mancanti';
    RAISE NOTICE '3. Rieseguire questo script';
  ELSE
    RAISE WARNING '❌ MIGRATIONS 090-096 NON ANCORA APPLICATE';
    RAISE NOTICE '';
    RAISE NOTICE 'PROSSIMO PASSO:';
    RAISE NOTICE '1. Applicare migrations 090-096 in ordine';
    RAISE NOTICE '2. Rieseguire questo script';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '==================================================';
  RAISE NOTICE '✅ Verifica completata';
  RAISE NOTICE '==================================================';
END $$;
