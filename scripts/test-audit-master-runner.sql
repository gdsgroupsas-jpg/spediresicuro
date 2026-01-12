-- ============================================
-- MASTER TEST RUNNER - AUDIT P0 VERIFICATION
-- SpedireSicuro - Security Audit Test Suite
-- ============================================
-- 
-- SCOPO: Eseguire tutti i test di audit in sequenza e generare
--        un report finale con checklist.
--
-- FILE DI TEST:
--   1. test-p0.2-wallet-idempotency.sql
--   2. test-p0.3-ocr-gdpr-compliance.sql
--   3. test-p0.4-compensation-queue.sql
--   4. test-p0.1-kill-switches.sql
--
-- COME ESEGUIRE:
--   1. Esegui prima: verify-audit-migrations.sql
--   2. Poi esegui questo file
--   3. Oppure esegui i singoli file di test
--
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🚀 ============================================';
  RAISE NOTICE '   SPEDIRESICURO SECURITY AUDIT TEST SUITE';
  RAISE NOTICE '   ============================================';
  RAISE NOTICE '';
  RAISE NOTICE '📋 SCOPE:';
  RAISE NOTICE '   P0.1 - Kill-Switches Configuration';
  RAISE NOTICE '   P0.2 - Wallet Idempotency';
  RAISE NOTICE '   P0.3 - OCR GDPR Compliance';
  RAISE NOTICE '   P0.4 - Compensation Queue Observability';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️ PREREQUISITI:';
  RAISE NOTICE '   - Migration 040-045 (Wallet Atomic)';
  RAISE NOTICE '   - Migration 098 (Wallet Idempotency Standalone)';
  RAISE NOTICE '   - Migration 099 (OCR GDPR)';
  RAISE NOTICE '   - Migration 100 (Compensation Queue)';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 Verifico prerequisiti...';
  RAISE NOTICE '';
END $$;

-- ============================================
-- PREREQUISITE CHECK - WALLET FUNCTIONS
-- ============================================
SELECT 
  'P0.2 Prerequisites' AS section,
  'decrement_wallet_balance()' AS requirement,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decrement_wallet_balance')
    THEN '✅ OK'
    ELSE '❌ MISSING'
  END AS status;

SELECT 
  'P0.2 Prerequisites' AS section,
  'acquire_idempotency_lock()' AS requirement,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'acquire_idempotency_lock')
    THEN '✅ OK'
    ELSE '❌ MISSING'
  END AS status;

SELECT 
  'P0.2 Prerequisites' AS section,
  'idempotency_locks table' AS requirement,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'idempotency_locks')
    THEN '✅ OK'
    ELSE '❌ MISSING'
  END AS status;

-- ============================================
-- PREREQUISITE CHECK - OCR GDPR
-- ============================================
SELECT 
  'P0.3 Prerequisites' AS section,
  'ocr_processing_log table' AS requirement,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ocr_processing_log')
    THEN '✅ OK'
    ELSE '❌ MISSING - Run migration 099'
  END AS status;

SELECT 
  'P0.3 Prerequisites' AS section,
  'grant_ocr_vision_consent()' AS requirement,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'grant_ocr_vision_consent')
    THEN '✅ OK'
    ELSE '❌ MISSING - Run migration 099'
  END AS status;

-- ============================================
-- PREREQUISITE CHECK - COMPENSATION QUEUE
-- ============================================
SELECT 
  'P0.4 Prerequisites' AS section,
  'compensation_queue table' AS requirement,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compensation_queue')
    THEN '✅ OK'
    ELSE '❌ MISSING - Run migration 100'
  END AS status;

SELECT 
  'P0.4 Prerequisites' AS section,
  'retry_compensation()' AS requirement,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'retry_compensation')
    THEN '✅ OK'
    ELSE '❌ MISSING - Run migration 100'
  END AS status;

SELECT 
  'P0.4 Prerequisites' AS section,
  'compensation_queue_stats view' AS requirement,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'compensation_queue_stats')
    THEN '✅ OK'
    ELSE '❌ MISSING - Run migration 100'
  END AS status;

-- ============================================
-- PREREQUISITE CHECK - SECURITY EVENTS
-- ============================================
SELECT 
  'P0.1 Prerequisites' AS section,
  'security_events table' AS requirement,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_events')
    THEN '✅ OK'
    ELSE '⚠️ OPTIONAL - Create if needed'
  END AS status;

-- ============================================
-- SUMMARY MATRIX
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 PREREQUISITE SUMMARY MATRIX';
  RAISE NOTICE '========================================';
END $$;

WITH prerequisites AS (
  SELECT 
    'P0.2 Wallet Idempotency' AS feature,
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decrement_wallet_balance') AND
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'acquire_idempotency_lock') AND
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'idempotency_locks') AS ready
  UNION ALL
  SELECT 
    'P0.3 OCR GDPR' AS feature,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ocr_processing_log') AND
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'grant_ocr_vision_consent') AS ready
  UNION ALL
  SELECT 
    'P0.4 Compensation Queue' AS feature,
    EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compensation_queue') AND
    EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'retry_compensation') AS ready
  UNION ALL
  SELECT 
    'P0.1 Kill-Switches' AS feature,
    TRUE AS ready  -- Always testable (env vars check)
)
SELECT 
  feature,
  CASE WHEN ready THEN '✅ READY TO TEST' ELSE '❌ PREREQUISITES MISSING' END AS status
FROM prerequisites
ORDER BY feature;

-- ============================================
-- NEXT STEPS
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📋 NEXT STEPS';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Se tutti i prerequisiti sono ✅:';
  RAISE NOTICE '  Esegui i singoli file di test:';
  RAISE NOTICE '';
  RAISE NOTICE '  1. scripts/test-p0.2-wallet-idempotency.sql';
  RAISE NOTICE '  2. scripts/test-p0.3-ocr-gdpr-compliance.sql';
  RAISE NOTICE '  3. scripts/test-p0.4-compensation-queue.sql';
  RAISE NOTICE '  4. scripts/test-p0.1-kill-switches.sql';
  RAISE NOTICE '';
  RAISE NOTICE 'Se ci sono ❌:';
  RAISE NOTICE '  Applica le migration mancanti con:';
  RAISE NOTICE '  $ supabase db push';
  RAISE NOTICE '';
  RAISE NOTICE '  O esegui manualmente i file SQL:';
  RAISE NOTICE '  - 098_wallet_idempotency_standalone.sql';
  RAISE NOTICE '  - 099_ocr_gdpr_compliance.sql';
  RAISE NOTICE '  - 100_compensation_queue_observability.sql';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
END $$;
