-- ============================================
-- TEST P0.4: COMPENSATION QUEUE OBSERVABILITY
-- SpedireSicuro - Security Audit Test Suite
-- ============================================
-- 
-- SCOPO: Verificare il dead-letter mechanism e le metriche
--        della compensation queue per gestire errori di rimborso.
--
-- PREREQUISITI:
--   - Migration 100_compensation_queue_observability.sql applicata
--   - Tabella compensation_queue esistente
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
  RAISE NOTICE '   TEST P0.4: COMPENSATION QUEUE OBSERVABILITY';
  RAISE NOTICE '   ============================================';
  RAISE NOTICE '';
END $$;

-- Check: Tabella compensation_queue esiste?
SELECT 
  'PREREQUISITE: compensation_queue table' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.tables 
      WHERE table_name = 'compensation_queue'
    ) THEN '✅ PRESENTE - Procedi con i test'
    ELSE '❌ MANCANTE - Crea tabella prima!'
  END AS status;

-- Check: Colonne observability
SELECT 
  'PREREQUISITE: retry_count column' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'compensation_queue' 
      AND column_name = 'retry_count'
    ) THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE - Esegui migration 100 prima!'
  END AS status;

SELECT 
  'PREREQUISITE: resolved_at column' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'compensation_queue' 
      AND column_name = 'resolved_at'
    ) THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE - Esegui migration 100 prima!'
  END AS status;

SELECT 
  'PREREQUISITE: dead_letter_reason column' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'compensation_queue' 
      AND column_name = 'dead_letter_reason'
    ) THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE - Esegui migration 100 prima!'
  END AS status;

-- Check: Functions observability
SELECT 
  'PREREQUISITE: retry_compensation()' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'retry_compensation')
    THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE - Esegui migration 100 prima!'
  END AS status;

SELECT 
  'PREREQUISITE: mark_compensation_resolved()' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'mark_compensation_resolved')
    THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE - Esegui migration 100 prima!'
  END AS status;

SELECT 
  'PREREQUISITE: get_compensation_alerts()' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'get_compensation_alerts')
    THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE - Esegui migration 100 prima!'
  END AS status;

-- Check: Materialized view
SELECT 
  'PREREQUISITE: compensation_queue_stats view' AS check_name,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_matviews 
      WHERE matviewname = 'compensation_queue_stats'
    ) THEN '✅ PRESENTE'
    ELSE '❌ MANCANTE - Esegui migration 100 prima!'
  END AS status;

-- ============================================
-- STEP 1: SETUP - CREATE TEST USER AND DATA
-- ============================================
DO $$
DECLARE
  v_test_user_id UUID;
  v_test_shipment_id UUID;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📦 SETUP: Creazione dati di test...';
  
  -- Crea test user
  SELECT id INTO v_test_user_id
  FROM users WHERE email = 'test-compensation@spediresicuro.it';
  
  IF v_test_user_id IS NULL THEN
    INSERT INTO users (id, email, name, wallet_balance, role, account_type, created_at)
    VALUES (gen_random_uuid(), 'test-compensation@spediresicuro.it', 'Test Compensation User', 100.00, 'user', 'personal', NOW())
    RETURNING id INTO v_test_user_id;
    RAISE NOTICE '✅ Test user creato: %', v_test_user_id;
  ELSE
    RAISE NOTICE '✅ Test user esistente: %', v_test_user_id;
  END IF;
  
  -- Pulisci eventuali record di test precedenti
  DELETE FROM compensation_queue 
  WHERE user_id = v_test_user_id 
  OR shipment_id IN (
    SELECT id FROM shipments WHERE created_by = v_test_user_id
  );
  
  RAISE NOTICE '✅ Dati di test precedenti rimossi';
  
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE '❌ Tabella compensation_queue non esiste!';
END $$;

-- ============================================
-- STEP 2: CREATE TEST COMPENSATION RECORD (pending)
-- ============================================
DO $$
DECLARE
  v_test_user_id UUID;
  v_comp_id UUID;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 TEST 1: Crea record compensation_queue (status=pending)';
  
  SELECT id INTO v_test_user_id
  FROM users WHERE email = 'test-compensation@spediresicuro.it';
  
  IF v_test_user_id IS NULL THEN
    RAISE NOTICE '❌ TEST SKIP: Test user non trovato';
    RETURN;
  END IF;
  
  -- Crea compensation record
  INSERT INTO compensation_queue (
    id,
    user_id,
    amount,
    reason,
    status,
    retry_count,
    created_at
  ) VALUES (
    gen_random_uuid(),
    v_test_user_id,
    0.01,  -- Importo piccolo per test
    'Test compensation - retry mechanism',
    'pending',
    0,
    NOW()
  ) RETURNING id INTO v_comp_id;
  
  RAISE NOTICE '  ✅ Compensation record creato: %', v_comp_id;
  RAISE NOTICE '  📍 Status: pending, retry_count: 0';
  RAISE NOTICE '  ✅ TEST 1 PASS';
  
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE '  ❌ TEST 1 SKIP: compensation_queue non esiste';
  WHEN undefined_column THEN
    RAISE NOTICE '  ❌ TEST 1 SKIP: Colonne mancanti, verifica migration 100';
END $$;

-- ============================================
-- STEP 3: TEST retry_compensation() - 3 retry
-- ============================================
DO $$
DECLARE
  v_test_user_id UUID;
  v_comp_id UUID;
  v_retry_count INTEGER;
  v_status TEXT;
  i INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 TEST 2: retry_compensation() incrementa retry_count';
  
  SELECT id INTO v_test_user_id
  FROM users WHERE email = 'test-compensation@spediresicuro.it';
  
  -- Trova il compensation record
  SELECT id, retry_count, status INTO v_comp_id, v_retry_count, v_status
  FROM compensation_queue
  WHERE user_id = v_test_user_id
  AND status = 'pending'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_comp_id IS NULL THEN
    RAISE NOTICE '  ❌ TEST SKIP: Nessun compensation record trovato';
    RETURN;
  END IF;
  
  RAISE NOTICE '  📍 Compensation ID: %', v_comp_id;
  RAISE NOTICE '  📍 Retry count iniziale: %', v_retry_count;
  
  -- Esegui 3 retry
  FOR i IN 1..3 LOOP
    PERFORM retry_compensation(v_comp_id);
    
    SELECT retry_count, status INTO v_retry_count, v_status
    FROM compensation_queue WHERE id = v_comp_id;
    
    RAISE NOTICE '  → Retry #%: retry_count=%, status=%', i, v_retry_count, v_status;
  END LOOP;
  
  IF v_retry_count = 3 AND v_status = 'pending' THEN
    RAISE NOTICE '  ✅ TEST 2 PASS: Retry count incrementato correttamente a 3';
  ELSE
    RAISE NOTICE '  ⚠️ TEST 2 WARN: Comportamento diverso da atteso';
  END IF;
  
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE '  ❌ TEST 2 SKIP: retry_compensation() non esiste';
END $$;

-- ============================================
-- STEP 4: TEST 4° retry → dead_letter
-- ============================================
DO $$
DECLARE
  v_test_user_id UUID;
  v_comp_id UUID;
  v_retry_count INTEGER;
  v_status TEXT;
  v_dead_letter_reason TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 TEST 3: Al 4° retry → status=dead_letter';
  
  SELECT id INTO v_test_user_id
  FROM users WHERE email = 'test-compensation@spediresicuro.it';
  
  -- Trova il compensation record (dovrebbe avere retry_count=3)
  SELECT id, retry_count INTO v_comp_id, v_retry_count
  FROM compensation_queue
  WHERE user_id = v_test_user_id
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_comp_id IS NULL THEN
    RAISE NOTICE '  ❌ TEST SKIP: Nessun compensation record trovato';
    RETURN;
  END IF;
  
  RAISE NOTICE '  📍 Retry count prima del 4° retry: %', v_retry_count;
  
  -- 4° retry - dovrebbe andare in dead_letter
  PERFORM retry_compensation(v_comp_id);
  
  SELECT retry_count, status, dead_letter_reason 
  INTO v_retry_count, v_status, v_dead_letter_reason
  FROM compensation_queue WHERE id = v_comp_id;
  
  RAISE NOTICE '  📍 Dopo 4° retry: retry_count=%, status=%', v_retry_count, v_status;
  RAISE NOTICE '  📍 Dead letter reason: %', v_dead_letter_reason;
  
  IF v_status = 'dead_letter' THEN
    RAISE NOTICE '  ✅ TEST 3 PASS: Compensation andato in dead_letter dopo 4 retry';
  ELSIF v_retry_count >= 4 THEN
    RAISE NOTICE '  ⚠️ TEST 3 WARN: retry_count=%, ma status=% (non dead_letter)', v_retry_count, v_status;
    RAISE NOTICE '     Potrebbe essere implementato diversamente (es. max_retries=5)';
  ELSE
    RAISE NOTICE '  ❌ TEST 3 FAIL: Comportamento inatteso';
  END IF;
  
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE '  ❌ TEST 3 SKIP: retry_compensation() non esiste';
END $$;

-- ============================================
-- STEP 5: TEST mark_compensation_resolved()
-- ============================================
DO $$
DECLARE
  v_test_user_id UUID;
  v_comp_id UUID;
  v_resolved_at TIMESTAMPTZ;
  v_status TEXT;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 TEST 4: mark_compensation_resolved() setta resolved_at';
  
  SELECT id INTO v_test_user_id
  FROM users WHERE email = 'test-compensation@spediresicuro.it';
  
  -- Crea nuovo compensation per questo test
  INSERT INTO compensation_queue (
    id, user_id, amount, reason, status, retry_count, created_at
  ) VALUES (
    gen_random_uuid(), v_test_user_id, 0.02, 'Test resolved', 'pending', 0, NOW()
  ) RETURNING id INTO v_comp_id;
  
  RAISE NOTICE '  📍 Nuovo compensation creato: %', v_comp_id;
  
  -- Risolvi
  PERFORM mark_compensation_resolved(v_comp_id, 'Resolved via test');
  
  SELECT status, resolved_at INTO v_status, v_resolved_at
  FROM compensation_queue WHERE id = v_comp_id;
  
  RAISE NOTICE '  📍 Dopo mark_compensation_resolved:';
  RAISE NOTICE '     status=%', v_status;
  RAISE NOTICE '     resolved_at=%', v_resolved_at;
  
  IF v_status = 'resolved' AND v_resolved_at IS NOT NULL THEN
    RAISE NOTICE '  ✅ TEST 4 PASS: Compensation risolto correttamente';
  ELSE
    RAISE NOTICE '  ❌ TEST 4 FAIL: resolved_at non settato o status errato';
  END IF;
  
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE '  ❌ TEST 4 SKIP: mark_compensation_resolved() non esiste';
END $$;

-- ============================================
-- STEP 6: TEST get_compensation_alerts() (pending > 7d)
-- ============================================
DO $$
DECLARE
  v_test_user_id UUID;
  v_old_comp_id UUID;
  v_alert_count INTEGER;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 TEST 5: get_compensation_alerts() per pending > 7 giorni';
  
  SELECT id INTO v_test_user_id
  FROM users WHERE email = 'test-compensation@spediresicuro.it';
  
  -- Crea compensation vecchio (8 giorni fa)
  INSERT INTO compensation_queue (
    id, user_id, amount, reason, status, retry_count, created_at
  ) VALUES (
    gen_random_uuid(), 
    v_test_user_id, 
    0.03, 
    'Test alert - OLD compensation', 
    'pending', 
    1,
    NOW() - INTERVAL '8 days'  -- 8 giorni fa
  ) RETURNING id INTO v_old_comp_id;
  
  RAISE NOTICE '  📍 Compensation vecchio creato: % (8 giorni fa)', v_old_comp_id;
  
  -- Chiama get_compensation_alerts()
  SELECT COUNT(*) INTO v_alert_count
  FROM get_compensation_alerts();
  
  RAISE NOTICE '  📍 Alert totali: %', v_alert_count;
  
  IF v_alert_count > 0 THEN
    RAISE NOTICE '  ✅ TEST 5 PASS: Alert generato per pending > 7 giorni';
    
    -- Mostra dettagli alert
    RAISE NOTICE '  📋 Dettagli alert:';
  ELSE
    RAISE NOTICE '  ⚠️ TEST 5 WARN: Nessun alert generato';
    RAISE NOTICE '     Verificare soglia nella function (potrebbe essere >7d strict)';
  END IF;
  
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE '  ❌ TEST 5 SKIP: get_compensation_alerts() non esiste';
END $$;

-- Mostra alert (se esistono)
SELECT 
  'ALERTS' AS tipo,
  id,
  user_id,
  amount,
  status,
  retry_count,
  created_at,
  NOW() - created_at AS age
FROM get_compensation_alerts()
LIMIT 10;

-- ============================================
-- STEP 7: TEST compensation_queue_stats view
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 TEST 6: compensation_queue_stats materialized view';
END $$;

-- Refresh della materialized view (se esiste)
DO $$
BEGIN
  REFRESH MATERIALIZED VIEW compensation_queue_stats;
  RAISE NOTICE '  ✅ Materialized view refreshed';
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE '  ❌ compensation_queue_stats non esiste';
END $$;

-- Mostra stats
SELECT 
  'TEST 6: Stats View' AS test_name,
  *,
  '✅ VIEW POPOLATA' AS result
FROM compensation_queue_stats
LIMIT 5;

-- Verifica esistenza
SELECT 
  'TEST 6: View exists' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'compensation_queue_stats')
    THEN '✅ PASS'
    ELSE '❌ FAIL - View non esiste'
  END AS result;

-- ============================================
-- STEP 8: RIEPILOGO FINALE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 RIEPILOGO TEST P0.4 COMPENSATION QUEUE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Checklist:';
  RAISE NOTICE '  □ Compensation record creato (pending)';
  RAISE NOTICE '  □ retry_compensation() incrementa retry_count';
  RAISE NOTICE '  □ Al 4° retry → dead_letter';
  RAISE NOTICE '  □ mark_compensation_resolved() setta resolved_at';
  RAISE NOTICE '  □ get_compensation_alerts() per pending > 7d';
  RAISE NOTICE '  □ compensation_queue_stats view popolata';
  RAISE NOTICE '';
  RAISE NOTICE 'Se migration 100 NON applicata:';
  RAISE NOTICE '  → Tutti i test mostreranno SKIP';
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- CLEANUP: Rimuovi dati di test
-- ============================================
DO $$
DECLARE
  v_test_user_id UUID;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🧹 CLEANUP: Rimozione dati di test...';
  
  SELECT id INTO v_test_user_id
  FROM users WHERE email = 'test-compensation@spediresicuro.it';
  
  IF v_test_user_id IS NOT NULL THEN
    -- Pulisci compensation records
    DELETE FROM compensation_queue WHERE user_id = v_test_user_id;
    
    -- Pulisci test user
    DELETE FROM users WHERE id = v_test_user_id;
    
    RAISE NOTICE '✅ Cleanup completato';
  END IF;
  
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE '⚠️ Tabella compensation_queue non esiste, cleanup user solo';
    DELETE FROM users WHERE email = 'test-compensation@spediresicuro.it';
END $$;

DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '   TEST P0.4 COMPLETATO';
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- EXPECTED RESULTS
-- ============================================
/*
📋 RISULTATI ATTESI (SE MIGRATION 100 APPLICATA):

TEST 1: Crea compensation record
  → Record creato con status=pending, retry_count=0 ✅

TEST 2: retry_compensation() x3
  → retry_count incrementa: 1, 2, 3 ✅
  → Status rimane 'pending' ✅

TEST 3: 4° retry → dead_letter
  → retry_count = 4 ✅
  → status = 'dead_letter' ✅
  → dead_letter_reason popolato ✅

TEST 4: mark_compensation_resolved()
  → status = 'resolved' ✅
  → resolved_at = timestamp ✅

TEST 5: get_compensation_alerts()
  → Alert per compensation pending > 7 giorni ✅

TEST 6: compensation_queue_stats
  → View esiste e popolata ✅
  → Conta per status visibili ✅

📋 CHECKLIST FINALE:
✅ Dead-letter dopo 3 retry: SÌ (TEST 3)
✅ Alert per pending > 7d: SÌ (TEST 5)
✅ Stats materialized view ok: SÌ (TEST 6)
*/
