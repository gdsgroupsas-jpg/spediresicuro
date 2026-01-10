-- ============================================
-- SQL VERIFICA MIGRATIONS 090-096 (FIXED)
-- ============================================
-- SCOPO: Verificare quali migrations sono state applicate
--          al database di Supabase
-- FIX: Rimossa colonna 'applied_at' che non esiste
-- ============================================

-- ============================================
-- SEZIONE 1: VEDI TUTTE LE MIGRATIONS APPLICATE
-- ============================================
SELECT 
  version,
  name
FROM supabase_migrations.schema_migrations
WHERE version >= '090' AND version <= '096'
ORDER BY version;

-- ============================================
-- SEZIONE 2: RIEPILOGO NUMERICO
-- ============================================
SELECT 
  COUNT(*) as migrations_applied,
  array_agg(version ORDER BY version) as migrations_list
FROM supabase_migrations.schema_migrations
WHERE version >= '090' AND version <= '096';

-- ============================================
-- SEZIONE 3: VERIFICA TABELLE/OGGETTI CREATI
-- ============================================
-- Tabella platform_provider_costs (Migration 090)
SELECT 
  'platform_provider_costs' as oggetto,
  'TABLE' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_provider_costs')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato;

-- Colonna api_source in shipments (Migration 091)
SELECT 
  'shipments.api_source' as oggetto,
  'COLUMN' as tipo,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'shipments' AND column_name = 'api_source'
    )
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato;

-- Vista v_platform_daily_pnl (Migration 092)
SELECT 
  'v_platform_daily_pnl' as oggetto,
  'VIEW' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_platform_daily_pnl')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato;

-- Tabella financial_audit_log (Migration 093)
SELECT 
  'financial_audit_log' as oggetto,
  'TABLE' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'financial_audit_log')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato;

-- Tabella cost_validations (Migration 096)
SELECT 
  'cost_validations' as oggetto,
  'TABLE' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_validations')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato;

-- Colonna tenant_id in users (Migration 084)
SELECT 
  'users.tenant_id' as oggetto,
  'COLUMN' as tipo,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' AND column_name = 'tenant_id'
    )
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato;

-- Tabella account_capabilities (Migration 081)
SELECT 
  'account_capabilities' as oggetto,
  'TABLE' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'account_capabilities')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato;

-- ============================================
-- SEZIONE 4: VERIFICA FUNZIONI RPC CRITICHE
-- ============================================

-- Funzione record_platform_provider_cost (Migration 090)
SELECT 
  'record_platform_provider_cost' as funzione,
  'RPC' as tipo,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'record_platform_provider_cost'
      AND routine_type = 'FUNCTION'
    )
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato;

-- Funzione log_financial_event (Migration 093)
SELECT 
  'log_financial_event' as funzione,
  'RPC' as tipo,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'log_financial_event'
      AND routine_type = 'FUNCTION'
    )
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato;

-- Funzione log_wallet_operation (Migration 093)
SELECT 
  'log_wallet_operation' as funzione,
  'RPC' as tipo,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'log_wallet_operation'
      AND routine_type = 'FUNCTION'
    )
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato;

-- Funzione has_capability (Migration 082)
SELECT 
  'has_capability' as funzione,
  'RPC' as tipo,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'has_capability'
      AND routine_type = 'FUNCTION'
    )
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato;

-- Funzione get_user_tenant (Migration 085)
SELECT 
  'get_user_tenant' as funzione,
  'RPC' as tipo,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.routines 
      WHERE routine_name = 'get_user_tenant'
      AND routine_type = 'FUNCTION'
    )
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato;

-- ============================================
-- SEZIONE 5: VERIFICA SECURITY (Migration 095)
-- ============================================
-- Controlla se le RPC critiche hanno permessi ONLY service_role
-- NOTA: Questa query potrebbe non funzionare su tutti i Supabase
-- Se fallisce, ignora questa sezione

-- Verifica se authenticated può eseguire le RPC
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.routines r
    WHERE r.routine_name IN (
      'record_platform_provider_cost',
      'log_financial_event',
      'log_wallet_operation'
    )
    AND r.routine_type = 'FUNCTION'
  ) THEN
    RAISE NOTICE 'Le funzioni RPC critiche esistono. Verificare manualmente i permessi.';
    RAISE NOTICE 'In Supabase Dashboard → Database → Functions, controlla "Security Definer".';
    RAISE NOTICE 'Se è "postgres" o "auth.uid()", allora authenticated PUÒ eseguire.';
    RAISE NOTICE 'Se è "auth.uid()" con security definer, allora SOLO service_role può eseguire.';
  ELSE
    RAISE NOTICE 'Le funzioni RPC critiche NON esistono.';
  END IF;
END $$;

-- ============================================
-- SEZIONE 6: VERIFICA DATI IN TABELLE NUOVE
-- ============================================

-- Quanti record in platform_provider_costs?
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'platform_provider_costs') THEN
    RAISE NOTICE 'platform_provider_costs: % recordi trovati', (SELECT COUNT(*) FROM platform_provider_costs);
  ELSE
    RAISE NOTICE 'platform_provider_costs: tabella non esiste';
  END IF;
END $$;

-- Quanti record in financial_audit_log?
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'financial_audit_log') THEN
    RAISE NOTICE 'financial_audit_log: % recordi trovati', (SELECT COUNT(*) FROM financial_audit_log);
  ELSE
    RAISE NOTICE 'financial_audit_log: tabella non esiste';
  END IF;
END $$;

-- Quanti record in account_capabilities?
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'account_capabilities') THEN
    RAISE NOTICE 'account_capabilities: % recordi trovati', (SELECT COUNT(*) FROM account_capabilities);
  ELSE
    RAISE NOTICE 'account_capabilities: tabella non esiste';
  END IF;
END $$;

-- Quanti record in cost_validations? (Migration 096)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cost_validations') THEN
    RAISE NOTICE 'cost_validations: % recordi trovati', (SELECT COUNT(*) FROM cost_validations);
  ELSE
    RAISE NOTICE 'cost_validations: tabella non esiste';
  END IF;
END $$;

-- ============================================
-- SEZIONE 7: VERIFICA api_source IN shipments
-- ============================================
-- Quante spedizioni hanno api_source valorizzato?
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'shipments' AND column_name = 'api_source'
  ) THEN
    RAISE NOTICE 'Spedizioni con api_source: %', (SELECT COUNT(*) FROM shipments WHERE api_source IS NOT NULL);
    RAISE NOTICE 'Valori api_source distinti: %', (SELECT COUNT(DISTINCT api_source) FROM shipments WHERE api_source IS NOT NULL);
    
    -- Distribuzione api_source
    RAISE NOTICE 'Distribuzione api_source:';
    FOR row IN EXECUTE 'SELECT api_source, COUNT(*) as cnt FROM shipments WHERE api_source IS NOT NULL GROUP BY api_source ORDER BY api_source' LOOP
      RAISE NOTICE '  - %: %', row.api_source, row.cnt;
    END LOOP;
  ELSE
    RAISE NOTICE 'Colonna api_source non esiste in shipments';
  END IF;
END $$;

-- ============================================
-- SEZIONE 8: RIEPILOGO FINALE
-- ============================================
DO $$
DECLARE
  migrations_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO migrations_count
  FROM supabase_migrations.schema_migrations
  WHERE version >= '090' AND version <= '096';
  
  RAISE NOTICE '';
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'RIEPILOGO MIGRATIONS 090-096';
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Migrations applicate: % / 7', migrations_count;
  
  IF migrations_count = 7 THEN
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
  ELSIF migrations_count >= 5 THEN
    RAISE NOTICE '⚠️ LA MAGGIOR PARTE DELLE MIGRATIONS È APPLICATA';
    RAISE NOTICE '';
    RAISE NOTICE 'PROSSIMO PASSO:';
    RAISE NOTICE '1. Identificare quali migrations mancano';
    RAISE NOTICE '2. Applicare le migrations mancanti';
    RAISE NOTICE '3. Rieseguire questo script';
  ELSE
    RAISE NOTICE '❌ MIGRATIONS 090-096 NON ANCORA APPLICATE';
    RAISE NOTICE '';
    RAISE NOTICE 'PROSSIMO PASSO:';
    RAISE NOTICE '1. Applicare migrations 090-096 in ordine';
    RAISE NOTICE '2. Rieseguire questo script';
  END IF;
  
  RAISE NOTICE '==================================================';
END $$;
