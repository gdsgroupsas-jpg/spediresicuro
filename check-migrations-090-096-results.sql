-- ============================================
-- SQL VERIFICA MIGRATIONS 090-096 (RESULTS VERSION)
-- ============================================
-- SCOPO: Verificare quali migrations sono state applicate
--          al database di Supabase
-- VERSIONE: Usa SELECT invece di RAISE NOTICE per mostrare risultati in tab Results
-- ============================================

-- ============================================
-- SEZIONE 1: MIGRATIONS APPLICATE
-- ============================================
SELECT 
  'SEZIONE 1: Migrations Applicate' as sezione,
  COUNT(*) as migrations_applicate,
  7 as migrations_totali,
  CASE 
    WHEN COUNT(*) = 7 THEN '✅ TUTTE LE MIGRATIONS SONO APPLICATE!'
    WHEN COUNT(*) >= 5 THEN '⚠️ LA MAGGIOR PARTE DELLE MIGRATIONS È APPLICATA'
    ELSE '❌ MIGRATIONS 090-096 NON ANCORA APPLICATE'
  END as stato,
  array_agg(version ORDER BY version) as migrations_list
FROM supabase_migrations.schema_migrations
WHERE version >= '090' AND version <= '096';

-- ============================================
-- SEZIONE 2: VERIFICA TABELLE/OGGETTI
-- ============================================
SELECT 
  'SEZIONE 2: Verifica Tabelle/Oggetti' as sezione,
  'platform_provider_costs' as oggetto,
  'TABLE' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_provider_costs')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato
UNION ALL
SELECT 
  'SEZIONE 2: Verifica Tabelle/Oggetti' as sezione,
  'shipments.api_source' as oggetto,
  'COLUMN' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shipments' AND column_name = 'api_source')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato
UNION ALL
SELECT 
  'SEZIONE 2: Verifica Tabelle/Oggetti' as sezione,
  'v_platform_daily_pnl' as oggetto,
  'VIEW' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'v_platform_daily_pnl')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato
UNION ALL
SELECT 
  'SEZIONE 2: Verifica Tabelle/Oggetti' as sezione,
  'financial_audit_log' as oggetto,
  'TABLE' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_audit_log')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato
UNION ALL
SELECT 
  'SEZIONE 2: Verifica Tabelle/Oggetti' as sezione,
  'cost_validations' as oggetto,
  'TABLE' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cost_validations')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato
UNION ALL
SELECT 
  'SEZIONE 2: Verifica Tabelle/Oggetti' as sezione,
  'users.tenant_id' as oggetto,
  'COLUMN' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'tenant_id')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato
UNION ALL
SELECT 
  'SEZIONE 2: Verifica Tabelle/Oggetti' as sezione,
  'account_capabilities' as oggetto,
  'TABLE' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'account_capabilities')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato;

-- ============================================
-- SEZIONE 3: VERIFICA FUNZIONI RPC
-- ============================================
SELECT 
  'SEZIONE 3: Verifica Funzioni RPC' as sezione,
  'record_platform_provider_cost' as funzione,
  'RPC' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_platform_provider_cost')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato
UNION ALL
SELECT 
  'SEZIONE 3: Verifica Funzioni RPC' as sezione,
  'log_financial_event' as funzione,
  'RPC' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_financial_event')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato
UNION ALL
SELECT 
  'SEZIONE 3: Verifica Funzioni RPC' as sezione,
  'log_wallet_operation' as funzione,
  'RPC' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_wallet_operation')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato
UNION ALL
SELECT 
  'SEZIONE 3: Verifica Funzioni RPC' as sezione,
  'has_capability' as funzione,
  'RPC' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'has_capability')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato
UNION ALL
SELECT 
  'SEZIONE 3: Verifica Funzioni RPC' as sezione,
  'get_user_tenant' as funzione,
  'RPC' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_user_tenant')
    THEN '✅ ESISTE'
    ELSE '❌ NON ESISTE'
  END as stato;

-- ============================================
-- SEZIONE 4: VERIFICA DATI IN TABELLE
-- ============================================
SELECT 
  'SEZIONE 4: Verifica Dati' as sezione,
  'platform_provider_costs' as tabella,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_provider_costs')
    THEN (SELECT COUNT(*)::TEXT FROM platform_provider_costs)
    ELSE 'tabella non esiste'
  END as numero_recordi
UNION ALL
SELECT 
  'SEZIONE 4: Verifica Dati' as sezione,
  'financial_audit_log' as tabella,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_audit_log')
    THEN (SELECT COUNT(*)::TEXT FROM financial_audit_log)
    ELSE 'tabella non esiste'
  END as numero_recordi
UNION ALL
SELECT 
  'SEZIONE 4: Verifica Dati' as sezione,
  'account_capabilities' as tabella,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'account_capabilities')
    THEN (SELECT COUNT(*)::TEXT FROM account_capabilities)
    ELSE 'tabella non esiste'
  END as numero_recordi
UNION ALL
SELECT 
  'SEZIONE 4: Verifica Dati' as sezione,
  'cost_validations' as tabella,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cost_validations')
    THEN (SELECT COUNT(*)::TEXT FROM cost_validations)
    ELSE 'tabella non esiste'
  END as numero_recordi;

-- ============================================
-- SEZIONE 5: VERIFICA api_source IN shipments
-- ============================================
-- Nota: La distribuzione api_source viene mostrata solo se la colonna esiste
-- Per vedere la distribuzione dettagliata, eseguire query separata dopo aver verificato che la colonna esista
SELECT 
  'SEZIONE 5: Verifica api_source' as sezione,
  'Colonna api_source esiste?' as descrizione,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shipments' AND column_name = 'api_source')
    THEN '✅ SÌ'
    ELSE '❌ NO'
  END as valore,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shipments' AND column_name = 'api_source')
    THEN 'Eseguire query separata per vedere distribuzione'
    ELSE 'Colonna non esiste - migration 091 non applicata'
  END as valori_distinti;

-- ============================================
-- SEZIONE 6: RIEPILOGO FINALE
-- ============================================
SELECT 
  'RIEPILOGO FINALE' as sezione,
  COUNT(*)::TEXT as migrations_applicate,
  '7' as migrations_totali,
  CASE 
    WHEN COUNT(*) = 7 THEN '✅ TUTTE LE MIGRATIONS SONO APPLICATE! Database pronto per PR #38'
    WHEN COUNT(*) >= 5 THEN '⚠️ LA MAGGIOR PARTE DELLE MIGRATIONS È APPLICATA. Applicare le migrations mancanti.'
    ELSE '❌ MIGRATIONS 090-096 NON ANCORA APPLICATE. Applicare tutte le migrations in ordine.'
  END as raccomandazione,
  array_to_string(array_agg(version ORDER BY version), ', ') as migrations_list
FROM supabase_migrations.schema_migrations
WHERE version >= '090' AND version <= '096';
