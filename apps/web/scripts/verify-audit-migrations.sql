-- ============================================
-- VERIFICA MIGRATION AUDIT FIXES (098, 099, 100)
-- Esegui su Supabase SQL Editor
-- ============================================

-- ============================================
-- SEZIONE 1: VERIFICA MIGRATION 098 (Wallet Idempotency)
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🔍 VERIFICA MIGRATION 098 - Wallet Idempotency';
  RAISE NOTICE '========================================';
END $$;

-- Check 1.1: Colonna idempotency_key esiste?
SELECT 
  '098 - wallet_transactions.idempotency_key' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'wallet_transactions' 
      AND column_name = 'idempotency_key'
    ) THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE'
  END AS status;

-- Check 1.2: UNIQUE index esiste?
SELECT 
  '098 - UNIQUE index idempotency_key' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE tablename = 'wallet_transactions' 
      AND indexname = 'wallet_transactions_idempotency_key_idx'
    ) THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE'
  END AS status;

-- Check 1.3: Function decrement_wallet_balance ritorna JSONB?
SELECT 
  '098 - decrement_wallet_balance returns JSONB' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_type t ON p.prorettype = t.oid
      WHERE p.proname = 'decrement_wallet_balance'
      AND t.typname = 'jsonb'
    ) THEN '✅ JSONB (nuovo)'
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_type t ON p.prorettype = t.oid
      WHERE p.proname = 'decrement_wallet_balance'
      AND t.typname = 'bool'
    ) THEN '⚠️ BOOLEAN (vecchio)'
    ELSE '❌ FUNZIONE NON TROVATA'
  END AS status;

-- ============================================
-- SEZIONE 2: VERIFICA MIGRATION 099 (GDPR OCR)
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '🔍 VERIFICA MIGRATION 099 - GDPR OCR';
  RAISE NOTICE '========================================';
END $$;

-- Check 2.1: Colonne consent in users?
SELECT 
  '099 - users.ocr_vision_consent_given_at' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'ocr_vision_consent_given_at'
    ) THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE'
  END AS status;

-- Check 2.2: Tabella ocr_processing_log esiste?
SELECT 
  '099 - tabella ocr_processing_log' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'ocr_processing_log'
    ) THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE'
  END AS status;

-- Check 2.3: RLS abilitato su ocr_processing_log?
SELECT 
  '099 - RLS su ocr_processing_log' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE tablename = 'ocr_processing_log' 
      AND rowsecurity = true
    ) THEN '✅ ABILITATO'
    WHEN EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE tablename = 'ocr_processing_log'
    ) THEN '⚠️ TABELLA ESISTE MA RLS DISABILITATO'
    ELSE '❌ TABELLA NON ESISTE'
  END AS status;

-- Check 2.4: Functions GDPR esistono?
SELECT 
  '099 - grant_ocr_vision_consent()' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'grant_ocr_vision_consent')
    THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE'
  END AS status;

SELECT 
  '099 - revoke_ocr_vision_consent()' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'revoke_ocr_vision_consent')
    THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE'
  END AS status;

SELECT 
  '099 - cleanup_expired_ocr_logs()' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_expired_ocr_logs')
    THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE'
  END AS status;

-- ============================================
-- SEZIONE 3: VERIFICA MIGRATION 100 (Compensation Observability)
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '🔍 VERIFICA MIGRATION 100 - Compensation Queue';
  RAISE NOTICE '========================================';
END $$;

-- Check 3.1: Colonne observability in compensation_queue?
SELECT 
  '100 - compensation_queue.resolved_at' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'compensation_queue' 
      AND column_name = 'resolved_at'
    ) THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE'
  END AS status;

SELECT 
  '100 - compensation_queue.retry_count' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'compensation_queue' 
      AND column_name = 'retry_count'
    ) THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE'
  END AS status;

SELECT 
  '100 - compensation_queue.dead_letter_reason' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'compensation_queue' 
      AND column_name = 'dead_letter_reason'
    ) THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE'
  END AS status;

-- Check 3.2: Materialized view esiste?
SELECT 
  '100 - compensation_queue_stats (view)' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_matviews 
      WHERE matviewname = 'compensation_queue_stats'
    ) THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE'
  END AS status;

-- Check 3.3: Functions observability esistono?
SELECT 
  '100 - mark_compensation_resolved()' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'mark_compensation_resolved')
    THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE'
  END AS status;

SELECT 
  '100 - retry_compensation()' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'retry_compensation')
    THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE'
  END AS status;

SELECT 
  '100 - get_compensation_alerts()' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_compensation_alerts')
    THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE'
  END AS status;

-- ============================================
-- SEZIONE 4: RIEPILOGO FINALE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 RIEPILOGO VERIFICA';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Se vedi tutti ✅ → Migration applicate correttamente';
  RAISE NOTICE 'Se vedi ❌ → Devi applicare le migration mancanti';
  RAISE NOTICE '';
  RAISE NOTICE 'Per applicare migration mancanti:';
  RAISE NOTICE '  supabase db push';
  RAISE NOTICE 'oppure esegui manualmente i file SQL:';
  RAISE NOTICE '  098_wallet_idempotency_standalone.sql';
  RAISE NOTICE '  099_ocr_gdpr_compliance.sql';
  RAISE NOTICE '  100_compensation_queue_observability.sql';
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- BONUS: Test rapido funzionalità (opzionale)
-- ============================================

-- Test wallet idempotency (dry run - non modifica nulla)
-- SELECT decrement_wallet_balance(
--   '00000000-0000-0000-0000-000000000000'::UUID, 
--   0.01, 
--   'test-idempotency-check'
-- );

-- Test compensation alerts (safe - solo lettura)
-- SELECT * FROM get_compensation_alerts();

-- Test OCR stats (safe - solo lettura)  
-- SELECT * FROM compensation_queue_stats;
