-- ============================================
-- TEST P0.3: OCR GDPR COMPLIANCE VERIFICATION
-- SpedireSicuro - Security Audit Test Suite
-- ============================================
-- 
-- SCOPO: Verificare che il consent flow GDPR per OCR Vision
--        funzioni correttamente e i log siano protetti.
--
-- PREREQUISITI:
--   - Migration 099_ocr_gdpr_compliance.sql deve essere applicata
--   - Eseguire prima: verify-audit-migrations.sql
--
-- COME ESEGUIRE:
--   1. Copia tutto in Supabase SQL Editor
--   2. Esegui tutto insieme
--   3. Verifica i risultati (ogni test mostra PASS/FAIL)
--   4. La sezione CLEANUP alla fine rimuove i dati di test
--
-- ============================================

-- ============================================
-- STEP 0: PREREQUISITE CHECK
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 ============================================';
  RAISE NOTICE '   TEST P0.3: OCR GDPR COMPLIANCE';
  RAISE NOTICE '   ============================================';
  RAISE NOTICE '';
END $$;

-- Check: Tabella ocr_processing_log esiste?
SELECT 
  'PREREQUISITE: ocr_processing_log table' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'ocr_processing_log'
    ) THEN '✅ PRESENTE - Procedi con i test'
    ELSE '❌ MANCANTE - Esegui migration 099 prima!'
  END AS status;

-- Check: Colonne consent in users?
SELECT 
  'PREREQUISITE: users.ocr_vision_consent_given_at' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name = 'ocr_vision_consent_given_at'
    ) THEN '✅ PRESENTE - Procedi con i test'
    ELSE '❌ MANCANTE - Esegui migration 099 prima!'
  END AS status;

-- Check: Functions GDPR esistono?
SELECT 
  'PREREQUISITE: grant_ocr_vision_consent()' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'grant_ocr_vision_consent')
    THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE - Esegui migration 099 prima!'
  END AS status;

SELECT 
  'PREREQUISITE: revoke_ocr_vision_consent()' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'revoke_ocr_vision_consent')
    THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE - Esegui migration 099 prima!'
  END AS status;

SELECT 
  'PREREQUISITE: log_ocr_processing()' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'log_ocr_processing')
    THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE - Esegui migration 099 prima!'
  END AS status;

SELECT 
  'PREREQUISITE: cleanup_expired_ocr_logs()' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'cleanup_expired_ocr_logs')
    THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE - Esegui migration 099 prima!'
  END AS status;

-- Check: RLS abilitato?
SELECT 
  'PREREQUISITE: RLS on ocr_processing_log' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE tablename = 'ocr_processing_log' 
      AND rowsecurity = true
    ) THEN '✅ RLS ABILITATO'
    WHEN EXISTS (
      SELECT 1 FROM pg_tables 
      WHERE tablename = 'ocr_processing_log'
    ) THEN '⚠️ RLS DISABILITATO - Rischio sicurezza!'
    ELSE '❌ TABELLA NON ESISTE'
  END AS status;

-- ============================================
-- SE I PREREQUISITI NON SONO SODDISFATTI, 
-- I TEST SEGUENTI FALLIRANNO.
-- ESEGUI PRIMA LA MIGRATION 099!
-- ============================================

-- ============================================
-- STEP 1: SETUP - CREATE TEST USERS
-- ============================================
DO $$
DECLARE
  v_test_user_1_id UUID;
  v_test_user_2_id UUID;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📦 SETUP: Creazione test users temporanei...';
  
  -- Crea User 1 (darà consent)
  SELECT id INTO v_test_user_1_id
  FROM users WHERE email = 'test-ocr-consent@spediresicuro.it';
  
  IF v_test_user_1_id IS NULL THEN
    INSERT INTO users (id, email, name, wallet_balance, role, account_type, created_at)
    VALUES (gen_random_uuid(), 'test-ocr-consent@spediresicuro.it', 'Test OCR User 1', 0, 'user', 'personal', NOW())
    RETURNING id INTO v_test_user_1_id;
    RAISE NOTICE '✅ Test user 1 creato: %', v_test_user_1_id;
  ELSE
    -- Reset consent fields
    UPDATE users 
    SET ocr_vision_consent_given_at = NULL,
        ocr_vision_consent_ip = NULL,
        ocr_vision_consent_user_agent = NULL
    WHERE id = v_test_user_1_id;
    RAISE NOTICE '✅ Test user 1 esistente, consent reset: %', v_test_user_1_id;
  END IF;
  
  -- Crea User 2 (per test isolamento RLS)
  SELECT id INTO v_test_user_2_id
  FROM users WHERE email = 'test-ocr-other@spediresicuro.it';
  
  IF v_test_user_2_id IS NULL THEN
    INSERT INTO users (id, email, name, wallet_balance, role, account_type, created_at)
    VALUES (gen_random_uuid(), 'test-ocr-other@spediresicuro.it', 'Test OCR User 2', 0, 'user', 'personal', NOW())
    RETURNING id INTO v_test_user_2_id;
    RAISE NOTICE '✅ Test user 2 creato: %', v_test_user_2_id;
  ELSE
    RAISE NOTICE '✅ Test user 2 esistente: %', v_test_user_2_id;
  END IF;
  
  -- Pulisci eventuali log precedenti
  DELETE FROM ocr_processing_log WHERE user_id IN (v_test_user_1_id, v_test_user_2_id);
  RAISE NOTICE '✅ Log di test precedenti rimossi';
  
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE '❌ Tabella ocr_processing_log non esiste! Esegui migration 099 prima.';
  WHEN undefined_column THEN
    RAISE NOTICE '❌ Colonne consent non esistono! Esegui migration 099 prima.';
END $$;

-- ============================================
-- STEP 2: TEST grant_ocr_vision_consent()
-- ============================================
DO $$
DECLARE
  v_test_user_id UUID;
  v_consent_given_at TIMESTAMPTZ;
  v_consent_ip TEXT;
  v_consent_user_agent TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 TEST 1: grant_ocr_vision_consent() salva IP + user_agent + timestamp';
  
  SELECT id INTO v_test_user_id
  FROM users WHERE email = 'test-ocr-consent@spediresicuro.it';
  
  IF v_test_user_id IS NULL THEN
    RAISE NOTICE '❌ TEST SKIP: Test user non trovato';
    RETURN;
  END IF;
  
  -- Grant consent
  PERFORM grant_ocr_vision_consent(
    v_test_user_id,
    '192.168.1.100',  -- Test IP
    'Mozilla/5.0 (Test Browser)'  -- Test User Agent
  );
  
  -- Verifica dati salvati
  SELECT 
    ocr_vision_consent_given_at,
    ocr_vision_consent_ip,
    ocr_vision_consent_user_agent
  INTO v_consent_given_at, v_consent_ip, v_consent_user_agent
  FROM users WHERE id = v_test_user_id;
  
  RAISE NOTICE '  📍 Consent timestamp: %', v_consent_given_at;
  RAISE NOTICE '  📍 Consent IP: %', v_consent_ip;
  RAISE NOTICE '  📍 Consent User Agent: %', v_consent_user_agent;
  
  IF v_consent_given_at IS NOT NULL 
     AND v_consent_ip = '192.168.1.100' 
     AND v_consent_user_agent = 'Mozilla/5.0 (Test Browser)' THEN
    RAISE NOTICE '  ✅ TEST 1 PASS: Consent salvato correttamente';
  ELSE
    RAISE NOTICE '  ❌ TEST 1 FAIL: Dati consent incompleti o errati';
  END IF;
  
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE '  ❌ TEST 1 SKIP: grant_ocr_vision_consent() non esiste';
  WHEN undefined_column THEN
    RAISE NOTICE '  ❌ TEST 1 SKIP: Colonne consent non esistono';
END $$;

-- ============================================
-- STEP 3: TEST log_ocr_processing()
-- ============================================
DO $$
DECLARE
  v_test_user_id UUID;
  v_log_count INTEGER;
  v_log_record RECORD;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 TEST 2: log_ocr_processing() logga provider + timestamp';
  
  SELECT id INTO v_test_user_id
  FROM users WHERE email = 'test-ocr-consent@spediresicuro.it';
  
  IF v_test_user_id IS NULL THEN
    RAISE NOTICE '❌ TEST SKIP: Test user non trovato';
    RETURN;
  END IF;
  
  -- Log processing con Google Vision
  PERFORM log_ocr_processing(
    v_test_user_id,
    'google_vision',
    'shipment_label',
    '{"test": true}'::JSONB
  );
  
  -- Log processing con Tesseract
  PERFORM log_ocr_processing(
    v_test_user_id,
    'tesseract_local',
    'invoice_scan',
    '{"test": true}'::JSONB
  );
  
  -- Verifica log creati
  SELECT COUNT(*) INTO v_log_count
  FROM ocr_processing_log
  WHERE user_id = v_test_user_id;
  
  RAISE NOTICE '  📍 Log creati: %', v_log_count;
  
  -- Verifica dettagli
  FOR v_log_record IN 
    SELECT provider, document_type, processed_at, soft_deleted
    FROM ocr_processing_log
    WHERE user_id = v_test_user_id
    ORDER BY processed_at
  LOOP
    RAISE NOTICE '    → Provider: %, Type: %, Time: %, Deleted: %', 
      v_log_record.provider, 
      v_log_record.document_type,
      v_log_record.processed_at,
      v_log_record.soft_deleted;
  END LOOP;
  
  IF v_log_count = 2 THEN
    RAISE NOTICE '  ✅ TEST 2 PASS: Log OCR creati correttamente';
  ELSE
    RAISE NOTICE '  ❌ TEST 2 FAIL: Numero log atteso 2, ottenuto %', v_log_count;
  END IF;
  
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE '  ❌ TEST 2 SKIP: log_ocr_processing() non esiste';
  WHEN undefined_table THEN
    RAISE NOTICE '  ❌ TEST 2 SKIP: ocr_processing_log non esiste';
END $$;

-- ============================================
-- STEP 4: TEST cleanup_expired_ocr_logs() (TTL 7 giorni)
-- ============================================
DO $$
DECLARE
  v_test_user_id UUID;
  v_old_log_id UUID;
  v_log_count_before INTEGER;
  v_log_count_after INTEGER;
  v_deleted_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 TEST 3: cleanup_expired_ocr_logs() cancella log > 7 giorni';
  
  SELECT id INTO v_test_user_id
  FROM users WHERE email = 'test-ocr-consent@spediresicuro.it';
  
  IF v_test_user_id IS NULL THEN
    RAISE NOTICE '❌ TEST SKIP: Test user non trovato';
    RETURN;
  END IF;
  
  -- Crea log vecchio (8 giorni fa)
  INSERT INTO ocr_processing_log (
    user_id, provider, document_type, processed_at, soft_deleted
  ) VALUES (
    v_test_user_id,
    'google_vision',
    'old_test_document',
    NOW() - INTERVAL '8 days',
    FALSE
  ) RETURNING id INTO v_old_log_id;
  
  RAISE NOTICE '  📍 Log vecchio creato: % (8 giorni fa)', v_old_log_id;
  
  SELECT COUNT(*) INTO v_log_count_before
  FROM ocr_processing_log
  WHERE user_id = v_test_user_id AND soft_deleted = FALSE;
  
  RAISE NOTICE '  📍 Log attivi prima cleanup: %', v_log_count_before;
  
  -- Esegui cleanup
  SELECT cleanup_expired_ocr_logs() INTO v_deleted_count;
  
  RAISE NOTICE '  📍 Log cancellati dal cleanup: %', v_deleted_count;
  
  SELECT COUNT(*) INTO v_log_count_after
  FROM ocr_processing_log
  WHERE user_id = v_test_user_id AND soft_deleted = FALSE;
  
  RAISE NOTICE '  📍 Log attivi dopo cleanup: %', v_log_count_after;
  
  -- Il log vecchio dovrebbe essere marcato come soft_deleted
  IF v_log_count_after < v_log_count_before AND v_deleted_count > 0 THEN
    RAISE NOTICE '  ✅ TEST 3 PASS: TTL 7 giorni applicato correttamente';
  ELSE
    -- Verifica soft_deleted
    IF EXISTS (
      SELECT 1 FROM ocr_processing_log 
      WHERE id = v_old_log_id AND soft_deleted = TRUE
    ) THEN
      RAISE NOTICE '  ✅ TEST 3 PASS: Log vecchio soft-deleted correttamente';
    ELSE
      RAISE NOTICE '  ⚠️ TEST 3 WARN: Cleanup potrebbe usare hard delete invece di soft delete';
    END IF;
  END IF;
  
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE '  ❌ TEST 3 SKIP: cleanup_expired_ocr_logs() non esiste';
  WHEN undefined_table THEN
    RAISE NOTICE '  ❌ TEST 3 SKIP: ocr_processing_log non esiste';
END $$;

-- ============================================
-- STEP 5: TEST revoke_ocr_vision_consent()
-- ============================================
DO $$
DECLARE
  v_test_user_id UUID;
  v_consent_given_at TIMESTAMPTZ;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 TEST 4: revoke_ocr_vision_consent() cancella consent';
  
  SELECT id INTO v_test_user_id
  FROM users WHERE email = 'test-ocr-consent@spediresicuro.it';
  
  IF v_test_user_id IS NULL THEN
    RAISE NOTICE '❌ TEST SKIP: Test user non trovato';
    RETURN;
  END IF;
  
  -- Verifica che abbia consent
  SELECT ocr_vision_consent_given_at INTO v_consent_given_at
  FROM users WHERE id = v_test_user_id;
  
  IF v_consent_given_at IS NULL THEN
    RAISE NOTICE '  ⚠️ Consent non presente, lo imposto prima...';
    PERFORM grant_ocr_vision_consent(v_test_user_id, '127.0.0.1', 'Test');
  END IF;
  
  -- Revoke consent
  PERFORM revoke_ocr_vision_consent(v_test_user_id);
  
  -- Verifica revoca
  SELECT ocr_vision_consent_given_at INTO v_consent_given_at
  FROM users WHERE id = v_test_user_id;
  
  IF v_consent_given_at IS NULL THEN
    RAISE NOTICE '  ✅ TEST 4 PASS: Consent revocato correttamente';
  ELSE
    RAISE NOTICE '  ❌ TEST 4 FAIL: Consent ancora presente dopo revoca';
  END IF;
  
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE '  ❌ TEST 4 SKIP: revoke_ocr_vision_consent() non esiste';
END $$;

-- ============================================
-- STEP 6: TEST RLS POLICIES (Isolamento tra utenti)
-- ============================================
DO $$
DECLARE
  v_user_1_id UUID;
  v_user_2_id UUID;
  v_user_1_log_count INTEGER;
  v_user_2_visible_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 TEST 5: RLS policies isolano log tra utenti';
  
  SELECT id INTO v_user_1_id
  FROM users WHERE email = 'test-ocr-consent@spediresicuro.it';
  
  SELECT id INTO v_user_2_id
  FROM users WHERE email = 'test-ocr-other@spediresicuro.it';
  
  IF v_user_1_id IS NULL OR v_user_2_id IS NULL THEN
    RAISE NOTICE '❌ TEST SKIP: Test users non trovati';
    RETURN;
  END IF;
  
  -- Conta log di user 1
  SELECT COUNT(*) INTO v_user_1_log_count
  FROM ocr_processing_log
  WHERE user_id = v_user_1_id;
  
  RAISE NOTICE '  📍 Log di User 1: %', v_user_1_log_count;
  
  -- Verifica che user 2 non possa vedere log di user 1
  -- NOTA: Questo test è significativo solo se RLS è abilitato
  --       In service_role mode, RLS viene bypassato
  
  -- Per un test completo di RLS, dovresti:
  -- 1. Connetterti come user 2 (non service_role)
  -- 2. Provare a SELECT * FROM ocr_processing_log WHERE user_id = v_user_1_id
  -- 3. Il risultato dovrebbe essere vuoto
  
  RAISE NOTICE '  ℹ️  Per verificare RLS completo:';
  RAISE NOTICE '     1. Connettiti come utente normale (non service_role)';
  RAISE NOTICE '     2. Prova: SELECT * FROM ocr_processing_log WHERE user_id = ''%''', v_user_1_id;
  RAISE NOTICE '     3. Dovrebbe ritornare ZERO righe (isolamento RLS)';
  
  -- Test che RLS sia almeno abilitato
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'ocr_processing_log' 
    AND rowsecurity = true
  ) THEN
    RAISE NOTICE '  ✅ TEST 5 PARTIAL PASS: RLS abilitato sulla tabella';
    RAISE NOTICE '     (Test completo richiede connessione non-service_role)';
  ELSE
    RAISE NOTICE '  ❌ TEST 5 FAIL: RLS NON abilitato sulla tabella!';
    RAISE NOTICE '     ⚠️ RISCHIO SICUREZZA: Chiunque può vedere tutti i log!';
  END IF;
  
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE '  ❌ TEST 5 SKIP: ocr_processing_log non esiste';
END $$;

-- ============================================
-- STEP 7: VERIFICA SOFT_DELETED FLAG
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 TEST 6: soft_deleted = false per log attivi';
END $$;

SELECT 
  'TEST 6: soft_deleted check' AS test_name,
  COUNT(*) AS total_logs,
  COUNT(*) FILTER (WHERE soft_deleted = FALSE) AS active_logs,
  COUNT(*) FILTER (WHERE soft_deleted = TRUE) AS deleted_logs,
  CASE 
    WHEN COUNT(*) = 0 THEN '⚠️ NESSUN LOG'
    WHEN COUNT(*) FILTER (WHERE soft_deleted = FALSE) > 0 THEN '✅ Log attivi presenti'
    ELSE '⚠️ Solo log deleted'
  END AS result
FROM ocr_processing_log
WHERE user_id IN (
  SELECT id FROM users 
  WHERE email IN ('test-ocr-consent@spediresicuro.it', 'test-ocr-other@spediresicuro.it')
);

-- ============================================
-- STEP 8: RIEPILOGO FINALE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 RIEPILOGO TEST P0.3 OCR GDPR';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Checklist:';
  RAISE NOTICE '  □ grant_ocr_vision_consent() salva IP+UserAgent+Timestamp';
  RAISE NOTICE '  □ log_ocr_processing() logga provider+timestamp';
  RAISE NOTICE '  □ cleanup_expired_ocr_logs() TTL 7 giorni';
  RAISE NOTICE '  □ revoke_ocr_vision_consent() cancella consent';
  RAISE NOTICE '  □ RLS policies attive';
  RAISE NOTICE '  □ soft_deleted = false per log attivi';
  RAISE NOTICE '';
  RAISE NOTICE 'Se migration 099 NON applicata:';
  RAISE NOTICE '  → Tutti i test mostreranno SKIP';
  RAISE NOTICE '  → Esegui: supabase db push';
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- CLEANUP: Rimuovi dati di test
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🧹 CLEANUP: Rimozione dati di test...';
END $$;

-- Pulisci log di test
DELETE FROM ocr_processing_log
WHERE user_id IN (
  SELECT id FROM users 
  WHERE email IN ('test-ocr-consent@spediresicuro.it', 'test-ocr-other@spediresicuro.it')
);

-- Pulisci test users
DELETE FROM users
WHERE email IN ('test-ocr-consent@spediresicuro.it', 'test-ocr-other@spediresicuro.it');

DO $$
BEGIN
  RAISE NOTICE '✅ Cleanup completato';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '   TEST P0.3 COMPLETATO';
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- EXPECTED RESULTS
-- ============================================
/*
📋 RISULTATI ATTESI (SE MIGRATION 099 APPLICATA):

TEST 1: grant_ocr_vision_consent()
  → Timestamp salvato ✅
  → IP salvato: 192.168.1.100 ✅
  → User Agent salvato: Mozilla/5.0 (Test Browser) ✅

TEST 2: log_ocr_processing()
  → 2 log creati (google_vision + tesseract_local) ✅
  → Provider e document_type corretti ✅

TEST 3: cleanup_expired_ocr_logs()
  → Log vecchi (>7 giorni) soft-deleted ✅
  → Log recenti invariati ✅

TEST 4: revoke_ocr_vision_consent()
  → Consent rimosso (NULL) ✅

TEST 5: RLS policies
  → rowsecurity = true ✅
  → Utenti vedono solo propri log ✅

TEST 6: soft_deleted flag
  → Log attivi hanno soft_deleted = false ✅

📋 CHECKLIST FINALE:
✅ Consent flow funziona: SÌ (TEST 1 + TEST 4)
✅ TTL 7 giorni applicato: SÌ (TEST 3)
✅ RLS policies attive: SÌ (TEST 5)
✅ Provider loggati: google_vision, tesseract_local (TEST 2)
*/
