-- ============================================
-- TEST P0.2: WALLET IDEMPOTENCY VERIFICATION
-- SpedireSicuro - Security Audit Test Suite
-- ============================================
-- 
-- SCOPO: Verificare che il meccanismo di idempotency del wallet
--        funzioni correttamente per prevenire doppi addebiti.
--
-- PREREQUISITI:
--   - Eseguire prima: verify-audit-migrations.sql
--   - Le migration 040, 044, 045 devono essere applicate
--
-- COME ESEGUIRE:
--   1. Copia tutto in Supabase SQL Editor
--   2. Esegui tutto insieme
--   3. Verifica i risultati (ogni test mostra PASS/FAIL)
--   4. La sezione CLEANUP alla fine rimuove i dati di test
--
-- ============================================

-- ============================================
-- CONFIGURAZIONE TEST (NON MODIFICARE)
-- ============================================
\set TEST_USER_EMAIL 'test-idempotency@spediresicuro.it'
\set TEST_IDEMPOTENCY_KEY 'test-idempotency-key-12345'
\set TEST_AMOUNT 0.01

-- ============================================
-- STEP 0: PREREQUISITE CHECK
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '🔍 ============================================';
  RAISE NOTICE '   TEST P0.2: WALLET IDEMPOTENCY';
  RAISE NOTICE '   ============================================';
  RAISE NOTICE '';
END $$;

-- Check: decrement_wallet_balance exists?
SELECT 
  'PREREQUISITE: decrement_wallet_balance()' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'decrement_wallet_balance')
    THEN '✅ PRESENTE - Procedi con i test'
    ELSE '❌ MANCANTE - Esegui migration 040 prima!'
  END AS status;

-- Check: acquire_idempotency_lock exists?
SELECT 
  'PREREQUISITE: acquire_idempotency_lock()' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'acquire_idempotency_lock')
    THEN '✅ PRESENTE - Procedi con i test'
    ELSE '❌ MANCANTE - Esegui migration 044 prima!'
  END AS status;

-- Check: idempotency_locks table exists?
SELECT 
  'PREREQUISITE: idempotency_locks table' AS check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'idempotency_locks')
    THEN '✅ PRESENTE - Procedi con i test'
    ELSE '❌ MANCANTE - Esegui migration 044 prima!'
  END AS status;

-- ============================================
-- STEP 1: SETUP - CREATE TEST USER
-- ============================================
DO $$
DECLARE
  v_test_user_id UUID;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📦 SETUP: Creazione test user temporaneo...';
  
  -- Verifica se esiste già
  SELECT id INTO v_test_user_id
  FROM users
  WHERE email = 'test-idempotency@spediresicuro.it';
  
  IF v_test_user_id IS NULL THEN
    -- Crea test user con 100€ di credito
    INSERT INTO users (
      id, 
      email, 
      name, 
      wallet_balance, 
      role,
      account_type,
      created_at
    ) VALUES (
      gen_random_uuid(),
      'test-idempotency@spediresicuro.it',
      'Test User Idempotency',
      100.00,
      'user',
      'personal',
      NOW()
    )
    RETURNING id INTO v_test_user_id;
    
    RAISE NOTICE '✅ Test user creato: %', v_test_user_id;
  ELSE
    -- Reset wallet balance
    UPDATE users SET wallet_balance = 100.00 WHERE id = v_test_user_id;
    RAISE NOTICE '✅ Test user esistente, wallet reset a 100€: %', v_test_user_id;
  END IF;
  
  -- Pulisci eventuali lock precedenti
  DELETE FROM idempotency_locks 
  WHERE idempotency_key LIKE 'test-idempotency-%';
  
  RAISE NOTICE '✅ Lock di test precedenti rimossi';
END $$;

-- ============================================
-- STEP 2: TEST BASELINE - Verifica stato iniziale
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 TEST 1: Verifica stato iniziale';
END $$;

SELECT 
  'TEST 1: Balance iniziale' AS test_name,
  wallet_balance AS balance,
  CASE WHEN wallet_balance = 100.00 THEN '✅ PASS' ELSE '❌ FAIL' END AS result
FROM users
WHERE email = 'test-idempotency@spediresicuro.it';

-- ============================================
-- STEP 3: TEST PRIMO ADDEBITO (deve avere successo)
-- ============================================
DO $$
DECLARE
  v_test_user_id UUID;
  v_lock_result RECORD;
  v_balance_before DECIMAL(10,2);
  v_balance_after DECIMAL(10,2);
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 TEST 2: Primo addebito con idempotency key';
  
  -- Get test user
  SELECT id, wallet_balance INTO v_test_user_id, v_balance_before
  FROM users
  WHERE email = 'test-idempotency@spediresicuro.it';
  
  -- Acquire lock
  SELECT * INTO v_lock_result
  FROM acquire_idempotency_lock(
    'test-idempotency-first-debit',
    v_test_user_id,
    10  -- 10 minuti TTL
  );
  
  IF v_lock_result.acquired THEN
    RAISE NOTICE '  ✅ Lock acquisito: acquired=%, status=%', v_lock_result.acquired, v_lock_result.status;
    
    -- Esegui decremento
    PERFORM decrement_wallet_balance(v_test_user_id, 10.00);
    
    -- Complete lock
    PERFORM complete_idempotency_lock('test-idempotency-first-debit', NULL, 'completed');
    
    SELECT wallet_balance INTO v_balance_after FROM users WHERE id = v_test_user_id;
    
    RAISE NOTICE '  💰 Balance: %.2f → %.2f', v_balance_before, v_balance_after;
    
    IF v_balance_after = 90.00 THEN
      RAISE NOTICE '  ✅ TEST 2 PASS: Primo addebito completato correttamente';
    ELSE
      RAISE NOTICE '  ❌ TEST 2 FAIL: Balance atteso 90.00, ottenuto %.2f', v_balance_after;
    END IF;
  ELSE
    RAISE NOTICE '  ❌ TEST 2 FAIL: Lock non acquisito - status=%', v_lock_result.status;
  END IF;
END $$;

-- ============================================
-- STEP 4: TEST SECONDO ADDEBITO (STESSO KEY - DEVE ESSERE BLOCCATO)
-- ============================================
DO $$
DECLARE
  v_test_user_id UUID;
  v_lock_result RECORD;
  v_balance_before DECIMAL(10,2);
  v_balance_after DECIMAL(10,2);
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 TEST 3: Secondo addebito con STESSO idempotency key (DEVE FALLIRE)';
  
  -- Get test user
  SELECT id, wallet_balance INTO v_test_user_id, v_balance_before
  FROM users
  WHERE email = 'test-idempotency@spediresicuro.it';
  
  -- Try to acquire same lock again
  SELECT * INTO v_lock_result
  FROM acquire_idempotency_lock(
    'test-idempotency-first-debit',  -- STESSO KEY del test precedente
    v_test_user_id,
    10
  );
  
  RAISE NOTICE '  🔍 Lock result: acquired=%, status=%', v_lock_result.acquired, v_lock_result.status;
  
  IF NOT v_lock_result.acquired THEN
    RAISE NOTICE '  ✅ Lock NON acquisito (corretto - idempotent replay)';
    
    -- Verifica che il balance NON sia cambiato
    SELECT wallet_balance INTO v_balance_after FROM users WHERE id = v_test_user_id;
    
    IF v_balance_after = v_balance_before THEN
      RAISE NOTICE '  💰 Balance invariato: %.2f (corretto)', v_balance_after;
      RAISE NOTICE '  ✅ TEST 3 PASS: Doppio addebito BLOCCATO correttamente';
      RAISE NOTICE '  ℹ️  Status ricevuto: % (idempotent replay = completed)', v_lock_result.status;
    ELSE
      RAISE NOTICE '  ❌ TEST 3 FAIL: Balance cambiato! %.2f → %.2f', v_balance_before, v_balance_after;
    END IF;
  ELSE
    RAISE NOTICE '  ❌ TEST 3 FAIL: Lock acquisito erroneamente!';
    RAISE NOTICE '  ⚠️  ATTENZIONE: Doppio addebito NON bloccato!';
  END IF;
END $$;

-- ============================================
-- STEP 5: TEST NUOVO KEY (DIVERSO - DEVE FUNZIONARE)
-- ============================================
DO $$
DECLARE
  v_test_user_id UUID;
  v_lock_result RECORD;
  v_balance_before DECIMAL(10,2);
  v_balance_after DECIMAL(10,2);
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 TEST 4: Nuovo addebito con DIVERSO idempotency key (DEVE FUNZIONARE)';
  
  -- Get test user
  SELECT id, wallet_balance INTO v_test_user_id, v_balance_before
  FROM users
  WHERE email = 'test-idempotency@spediresicuro.it';
  
  -- Acquire new lock with different key
  SELECT * INTO v_lock_result
  FROM acquire_idempotency_lock(
    'test-idempotency-second-debit',  -- NUOVO KEY
    v_test_user_id,
    10
  );
  
  IF v_lock_result.acquired THEN
    RAISE NOTICE '  ✅ Lock acquisito (nuovo key)';
    
    -- Esegui decremento
    PERFORM decrement_wallet_balance(v_test_user_id, 5.00);
    PERFORM complete_idempotency_lock('test-idempotency-second-debit', NULL, 'completed');
    
    SELECT wallet_balance INTO v_balance_after FROM users WHERE id = v_test_user_id;
    
    RAISE NOTICE '  💰 Balance: %.2f → %.2f', v_balance_before, v_balance_after;
    
    IF v_balance_after = 85.00 THEN
      RAISE NOTICE '  ✅ TEST 4 PASS: Nuovo addebito completato';
    ELSE
      RAISE NOTICE '  ❌ TEST 4 FAIL: Balance atteso 85.00, ottenuto %.2f', v_balance_after;
    END IF;
  ELSE
    RAISE NOTICE '  ❌ TEST 4 FAIL: Lock non acquisito (inatteso)';
  END IF;
END $$;

-- ============================================
-- STEP 6: TEST INCREMENT_WALLET_BALANCE
-- ============================================
DO $$
DECLARE
  v_test_user_id UUID;
  v_balance_before DECIMAL(10,2);
  v_balance_after DECIMAL(10,2);
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 TEST 5: increment_wallet_balance() funziona correttamente';
  
  -- Get test user
  SELECT id, wallet_balance INTO v_test_user_id, v_balance_before
  FROM users
  WHERE email = 'test-idempotency@spediresicuro.it';
  
  -- Increment
  PERFORM increment_wallet_balance(v_test_user_id, 20.00);
  
  SELECT wallet_balance INTO v_balance_after FROM users WHERE id = v_test_user_id;
  
  RAISE NOTICE '  💰 Balance: %.2f → %.2f', v_balance_before, v_balance_after;
  
  IF v_balance_after = 105.00 THEN
    RAISE NOTICE '  ✅ TEST 5 PASS: Incremento completato';
  ELSE
    RAISE NOTICE '  ❌ TEST 5 FAIL: Balance atteso 105.00, ottenuto %.2f', v_balance_after;
  END IF;
END $$;

-- ============================================
-- STEP 7: TEST SALDO INSUFFICIENTE
-- ============================================
DO $$
DECLARE
  v_test_user_id UUID;
  v_balance_before DECIMAL(10,2);
  v_balance_after DECIMAL(10,2);
  v_error_raised BOOLEAN := FALSE;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 TEST 6: Decremento con saldo insufficiente (DEVE FALLIRE)';
  
  -- Get test user
  SELECT id, wallet_balance INTO v_test_user_id, v_balance_before
  FROM users
  WHERE email = 'test-idempotency@spediresicuro.it';
  
  -- Prova a decrementare più del saldo disponibile
  BEGIN
    PERFORM decrement_wallet_balance(v_test_user_id, 999999.00);
  EXCEPTION
    WHEN OTHERS THEN
      v_error_raised := TRUE;
      RAISE NOTICE '  ✅ Eccezione sollevata (corretto): %', SQLERRM;
  END;
  
  SELECT wallet_balance INTO v_balance_after FROM users WHERE id = v_test_user_id;
  
  IF v_error_raised AND v_balance_after = v_balance_before THEN
    RAISE NOTICE '  💰 Balance invariato: %.2f (corretto)', v_balance_after;
    RAISE NOTICE '  ✅ TEST 6 PASS: Saldo insufficiente gestito correttamente';
  ELSE
    RAISE NOTICE '  ❌ TEST 6 FAIL: Errore non gestito o balance cambiato';
  END IF;
END $$;

-- ============================================
-- STEP 8: VERIFICA LOCK STATUS
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '📊 TEST 7: Verifica stato lock nella tabella';
END $$;

SELECT 
  'TEST 7: Lock status' AS test_name,
  idempotency_key,
  status,
  CASE 
    WHEN status = 'completed' THEN '✅ CORRETTO'
    ELSE '⚠️ STATO: ' || status
  END AS result
FROM idempotency_locks
WHERE idempotency_key LIKE 'test-idempotency-%'
ORDER BY created_at;

-- ============================================
-- STEP 9: RIEPILOGO FINALE
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 RIEPILOGO TEST P0.2 WALLET IDEMPOTENCY';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Se tutti i test mostrano ✅:';
  RAISE NOTICE '  → Idempotency funziona correttamente';
  RAISE NOTICE '  → Doppio addebito IMPOSSIBILE';
  RAISE NOTICE '  → Sistema sicuro';
  RAISE NOTICE '';
  RAISE NOTICE 'Se qualche test mostra ❌:';
  RAISE NOTICE '  → Verificare migration applicate';
  RAISE NOTICE '  → Controllare errori sopra';
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

-- Pulisci lock di test
DELETE FROM idempotency_locks 
WHERE idempotency_key LIKE 'test-idempotency-%';

-- Pulisci transazioni di test (se esistono)
DELETE FROM wallet_transactions
WHERE user_id IN (
  SELECT id FROM users WHERE email = 'test-idempotency@spediresicuro.it'
);

-- Pulisci test user
DELETE FROM users
WHERE email = 'test-idempotency@spediresicuro.it';

DO $$
BEGIN
  RAISE NOTICE '✅ Cleanup completato';
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '   TEST P0.2 COMPLETATO';
  RAISE NOTICE '========================================';
END $$;

-- ============================================
-- EXPECTED RESULTS
-- ============================================
/*
📋 RISULTATI ATTESI:

TEST 1: Balance iniziale
  → wallet_balance = 100.00 ✅

TEST 2: Primo addebito con idempotency key
  → Lock acquisito ✅
  → Balance: 100.00 → 90.00 ✅

TEST 3: Secondo addebito con STESSO key
  → Lock NON acquisito (acquired = false) ✅
  → Status = 'completed' (idempotent replay) ✅
  → Balance invariato a 90.00 ✅

TEST 4: Nuovo addebito con DIVERSO key
  → Lock acquisito ✅
  → Balance: 90.00 → 85.00 ✅

TEST 5: increment_wallet_balance
  → Balance: 85.00 → 105.00 ✅

TEST 6: Saldo insufficiente
  → Eccezione sollevata ✅
  → Balance invariato ✅

TEST 7: Lock status
  → Tutti i lock con status = 'completed' ✅

📋 CHECKLIST FINALE:
✅ Doppio addebito bloccato: SÌ (TEST 3)
✅ idempotent_replay funziona: SÌ (status = 'completed')
✅ Balance decrementato UNA sola volta: SÌ
*/
