-- ============================================
-- SQL VERIFICA MIGRATIONS 090-096 (VERIFICA REALE)
-- ============================================
-- SCOPO: Verificare se le migrations sono state applicate REALMENTE
--          anche se non registrate in supabase_migrations.schema_migrations
-- ============================================
-- Questo script verifica l'esistenza REALE degli oggetti nel database,
-- non solo la registrazione nelle migrations
-- ============================================

-- ============================================
-- SEZIONE 1: MIGRATIONS REGISTRATE
-- ============================================
SELECT 
  'SEZIONE 1: Migrations Registrate' as sezione,
  COUNT(*) as migrations_registrate,
  7 as migrations_totali,
  CASE 
    WHEN COUNT(*) = 7 THEN '✅ TUTTE REGISTRATE'
    WHEN COUNT(*) >= 5 THEN '⚠️ MAGGIOR PARTE REGISTRATE'
    ELSE '❌ POCO REGISTRATE'
  END as stato_registrazione,
  array_agg(version ORDER BY version) as migrations_registrate_list
FROM supabase_migrations.schema_migrations
WHERE version >= '090' AND version <= '096';

-- ============================================
-- SEZIONE 2: VERIFICA REALE OGGETTI (INDIPENDENTE DA REGISTRAZIONE)
-- ============================================
-- Questo verifica se gli oggetti ESISTONO REALMENTE nel database
SELECT 
  'SEZIONE 2: Verifica Reale Oggetti' as sezione,
  'platform_provider_costs' as oggetto,
  'TABLE' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_provider_costs')
    THEN '✅ ESISTE (Migration 090 applicata)'
    ELSE '❌ NON ESISTE (Migration 090 NON applicata)'
  END as stato_reale
UNION ALL
SELECT 
  'SEZIONE 2: Verifica Reale Oggetti' as sezione,
  'shipments.api_source' as oggetto,
  'COLUMN' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shipments' AND column_name = 'api_source')
    THEN '✅ ESISTE (Migration 091 applicata)'
    ELSE '❌ NON ESISTE (Migration 091 NON applicata)'
  END as stato_reale
UNION ALL
SELECT 
  'SEZIONE 2: Verifica Reale Oggetti' as sezione,
  'v_platform_daily_pnl' as oggetto,
  'VIEW' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'v_platform_daily_pnl')
    THEN '✅ ESISTE (Migration 092 applicata)'
    ELSE '❌ NON ESISTE (Migration 092 NON applicata)'
  END as stato_reale
UNION ALL
SELECT 
  'SEZIONE 2: Verifica Reale Oggetti' as sezione,
  'financial_audit_log' as oggetto,
  'TABLE' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_audit_log')
    THEN '✅ ESISTE (Migration 093 applicata)'
    ELSE '❌ NON ESISTE (Migration 093 NON applicata)'
  END as stato_reale
UNION ALL
SELECT 
  'SEZIONE 2: Verifica Reale Oggetti' as sezione,
  'cost_validations' as oggetto,
  'TABLE' as tipo,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cost_validations')
    THEN '✅ ESISTE (Migration 096 applicata)'
    ELSE '❌ NON ESISTE (Migration 096 NON applicata)'
  END as stato_reale;

-- ============================================
-- SEZIONE 3: VERIFICA REALE FUNZIONI RPC
-- ============================================
SELECT 
  'SEZIONE 3: Verifica Reale Funzioni RPC' as sezione,
  'record_platform_provider_cost' as funzione,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_platform_provider_cost')
    THEN '✅ ESISTE (Migration 090 applicata)'
    ELSE '❌ NON ESISTE (Migration 090 NON applicata)'
  END as stato_reale
UNION ALL
SELECT 
  'SEZIONE 3: Verifica Reale Funzioni RPC' as sezione,
  'log_financial_event' as funzione,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_financial_event')
    THEN '✅ ESISTE (Migration 093 applicata)'
    ELSE '❌ NON ESISTE (Migration 093 NON applicata)'
  END as stato_reale
UNION ALL
SELECT 
  'SEZIONE 3: Verifica Reale Funzioni RPC' as sezione,
  'log_wallet_operation' as funzione,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_wallet_operation')
    THEN '✅ ESISTE (Migration 093 applicata)'
    ELSE '❌ NON ESISTE (Migration 093 NON applicata)'
  END as stato_reale;

-- ============================================
-- SEZIONE 4: CONFRONTO REGISTRAZIONE vs REALTÀ
-- ============================================
SELECT 
  'SEZIONE 4: Confronto' as sezione,
  'Migrations registrate' as tipo,
  (SELECT COUNT(*)::TEXT FROM supabase_migrations.schema_migrations WHERE version >= '090' AND version <= '096') as valore,
  'Se 0, migrations applicate manualmente senza registrazione' as nota
UNION ALL
SELECT 
  'SEZIONE 4: Confronto' as sezione,
  'Oggetti reali esistenti' as tipo,
  (
    SELECT COUNT(*)::TEXT
    FROM (
      SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_provider_costs')
      UNION ALL
      SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shipments' AND column_name = 'api_source')
      UNION ALL
      SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'v_platform_daily_pnl')
      UNION ALL
      SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_audit_log')
      UNION ALL
      SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cost_validations')
    ) as oggetti
  ) as valore,
  'Se > 0, migrations applicate anche se non registrate' as nota;

-- ============================================
-- SEZIONE 5: RIEPILOGO FINALE REALE
-- ============================================
SELECT 
  'RIEPILOGO FINALE REALE' as sezione,
  (
    SELECT COUNT(*)::TEXT
    FROM (
      SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_provider_costs')
      UNION ALL
      SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shipments' AND column_name = 'api_source')
      UNION ALL
      SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'v_platform_daily_pnl')
      UNION ALL
      SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_audit_log')
      UNION ALL
      SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cost_validations')
    ) as oggetti
  ) as oggetti_reali_esistenti,
  '5' as oggetti_totali_attesi,
  CASE 
    WHEN (
      SELECT COUNT(*)
      FROM (
        SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_provider_costs')
        UNION ALL
        SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shipments' AND column_name = 'api_source')
        UNION ALL
        SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'v_platform_daily_pnl')
        UNION ALL
        SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_audit_log')
        UNION ALL
        SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cost_validations')
      ) as oggetti
    ) = 5 THEN '✅ TUTTI GLI OGGETTI ESISTONO! Database pronto per PR #38 (anche se non registrati)'
    WHEN (
      SELECT COUNT(*)
      FROM (
        SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'platform_provider_costs')
        UNION ALL
        SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'shipments' AND column_name = 'api_source')
        UNION ALL
        SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'v_platform_daily_pnl')
        UNION ALL
        SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'financial_audit_log')
        UNION ALL
        SELECT 1 WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cost_validations')
      ) as oggetti
    ) >= 3 THEN '⚠️ LA MAGGIOR PARTE DEGLI OGGETTI ESISTE. Verificare quali mancano.'
    ELSE '❌ POCHI OGGETTI ESISTONO. Migrations probabilmente NON applicate.'
  END as raccomandazione_finale;
