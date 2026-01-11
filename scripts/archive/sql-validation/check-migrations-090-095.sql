-- ============================================
-- SQL VERIFICA MIGRATIONS 090-095
-- ============================================
-- SCOPO: Verificare quali migrations sono state applicate
--          al database di Supabase
-- ============================================

-- ============================================
-- SEZIONE 1: VEDI TUTTE LE MIGRATIONS APPLICATE
-- ============================================
SELECT 
  version,
  name,
  applied_at
FROM supabase_migrations.schema_migrations
WHERE version >= '090' AND version <= '095'
ORDER BY version;

-- ============================================
-- SEZIONE 2: RIEPILOGO NUMERICO
-- ============================================
SELECT 
  COUNT(*) as migrations_applied,
  array_agg(version ORDER BY version) as migrations_list
FROM supabase_migrations.schema_migrations
WHERE version >= '090' AND version <= '095';

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

SELECT 
  r.routine_name,
  CASE 
    WHEN pg_catalog.has_function_privilege('authenticated', r.routine_name, 'EXECUTE')
    THEN '⚠️ PERICOLO: authenticated PUÒ ESEGUIRE'
    ELSE '✅ SICURO: SOLO service_role può eseguire'
  END as security_status
FROM information_schema.routines r
WHERE r.routine_name IN (
  'record_platform_provider_cost',
  'log_financial_event',
  'log_wallet_operation'
)
AND r.routine_type = 'FUNCTION';

-- ============================================
-- SEZIONE 6: VERIFICA DATI IN TABELLE NUOVE
-- ============================================
-- Quanti record in platform_provider_costs?
SELECT 
  'platform_provider_costs' as tabella,
  COUNT(*) as numero_record
FROM platform_provider_costs;

-- Quanti record in financial_audit_log?
SELECT 
  'financial_audit_log' as tabella,
  COUNT(*) as numero_record
FROM financial_audit_log;

-- Quanti record in account_capabilities?
SELECT 
  'account_capabilities' as tabella,
  COUNT(*) as numero_record
FROM account_capabilities;

-- ============================================
-- SEZIONE 7: VERIFICA api_source IN shipments
-- ============================================
-- Quante spedizioni hanno api_source valorizzato?
SELECT 
  'shipments con api_source' as descrizione,
  COUNT(*) as numero_spedizioni,
  COUNT(DISTINCT api_source) as valori_distinti
FROM shipments
WHERE api_source IS NOT NULL;

-- Distribuzione api_source
SELECT 
  api_source,
  COUNT(*) as numero_spedizioni
FROM shipments
WHERE api_source IS NOT NULL
GROUP BY api_source
ORDER BY api_source;

-- ============================================
-- SEZIONE 8: CONCLUSIONE E RECOMANDAZIONI
-- ============================================
-- Se tutte le migrations 090-095 sono applicate:
-- ✅ Il database è pronto per PR #38
-- ✅ Rollback meno rischioso (no data loss)
-- ✅ Testare che il codice esistente funziona ancora

-- Se alcune migrations mancano:
-- ⚠️ Non fare merge di PR #38
-- ⚠️ Applicare le migrations mancanti
-- ⚠️ Testare dopo ogni migration

-- Se ci sono dati in tabelle nuove:
-- ⚠️ Verificare che i dati siano corretti
-- ⚠️ Verificare che non ci siano dati duplicati
-- ⚠️ Verificare che i margini siano calcolati correttamente

-- Se security check mostra problemi:
-- 🔴 URGENTE: Applicare migration 095
-- 🔴 Le RPC critiche sono accessibili a authenticated
-- 🔴 VULNERABILITÀ DI SICUREZZA!
