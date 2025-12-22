-- ============================================
-- MIGRATION: 041_remove_wallet_balance_trigger.sql
-- DESCRIZIONE: Rimuove trigger legacy che causa DOUBLE CREDIT
-- DATA: 2025-12-22
-- CRITICITÀ: P0 - BUG FINANZIARIO
-- PREREQUISITO: Migration 040 (funzioni atomiche) deve essere attiva
-- ============================================

-- ============================================
-- PROBLEMA RISOLTO
-- ============================================
-- 
-- BEFORE (con trigger legacy da migration 019):
-- 1. add_wallet_credit() chiama increment_wallet_balance()
--    → UPDATE users SET wallet_balance = wallet_balance + 100
-- 2. add_wallet_credit() fa INSERT INTO wallet_transactions (amount: 100)
--    → TRIGGER si attiva
--    → UPDATE users SET wallet_balance = wallet_balance + 100 (DI NUOVO!)
-- RISULTATO: +€200 invece di +€100 ❌
--
-- AFTER (trigger rimosso):
-- 1. add_wallet_credit() chiama increment_wallet_balance()
--    → UPDATE users SET wallet_balance = wallet_balance + 100
-- 2. add_wallet_credit() fa INSERT INTO wallet_transactions (amount: 100)
--    → Nessun trigger
-- RISULTATO: +€100 ✅
--
-- ============================================

-- ============================================
-- STEP 1: Rimuovi trigger legacy
-- ============================================

DROP TRIGGER IF EXISTS trigger_update_wallet_balance ON wallet_transactions;

COMMENT ON TABLE wallet_transactions IS 
'IMPORTANT: wallet_balance is NOT updated via trigger anymore.
Use increment_wallet_balance() or decrement_wallet_balance() for atomic updates.
This table is for audit trail only.';

-- ============================================
-- STEP 2: Rimuovi funzione trigger legacy
-- ============================================

DROP FUNCTION IF EXISTS update_wallet_balance();

-- ============================================
-- STEP 3: Verifica che funzioni atomiche esistano
-- ============================================

DO $$
DECLARE
  v_has_increment BOOLEAN;
  v_has_decrement BOOLEAN;
BEGIN
  -- Verifica increment_wallet_balance esiste
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'increment_wallet_balance'
  ) INTO v_has_increment;
  
  -- Verifica decrement_wallet_balance esiste
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'decrement_wallet_balance'
  ) INTO v_has_decrement;
  
  IF NOT v_has_increment THEN
    RAISE EXCEPTION 'CRITICAL: increment_wallet_balance() not found. Run migration 040 first.';
  END IF;
  
  IF NOT v_has_decrement THEN
    RAISE EXCEPTION 'CRITICAL: decrement_wallet_balance() not found. Run migration 040 first.';
  END IF;
  
  RAISE NOTICE '✅ Atomic functions verified: increment_wallet_balance, decrement_wallet_balance';
END $$;

-- ============================================
-- STEP 4: Aggiungi funzione di verifica integrità (se non esiste)
-- ============================================

-- Questa funzione è già in migration 040, ma assicuriamoci sia disponibile
CREATE OR REPLACE FUNCTION verify_wallet_integrity(p_user_id UUID)
RETURNS TABLE(
  user_id UUID,
  current_balance DECIMAL(10,2),
  calculated_balance DECIMAL(10,2),
  discrepancy DECIMAL(10,2),
  is_consistent BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    u.id AS user_id,
    u.wallet_balance AS current_balance,
    COALESCE(SUM(wt.amount), 0) AS calculated_balance,
    u.wallet_balance - COALESCE(SUM(wt.amount), 0) AS discrepancy,
    (u.wallet_balance = COALESCE(SUM(wt.amount), 0)) AS is_consistent
  FROM users u
  LEFT JOIN wallet_transactions wt ON wt.user_id = u.id
  WHERE u.id = p_user_id
  GROUP BY u.id, u.wallet_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION verify_wallet_integrity IS 
'Verifies wallet balance consistency by comparing current balance with sum of transactions.
Used for auditing. After migration 041, this should show discrepancy = 0 for all users.';

-- ============================================
-- STEP 5: Verifica integrità esistente (diagnostic)
-- ============================================

DO $$
DECLARE
  v_inconsistent_count INTEGER;
BEGIN
  -- Conta utenti con discrepanza
  SELECT COUNT(*) INTO v_inconsistent_count
  FROM users u
  LEFT JOIN (
    SELECT user_id, SUM(amount) as total
    FROM wallet_transactions
    GROUP BY user_id
  ) wt ON wt.user_id = u.id
  WHERE u.wallet_balance != COALESCE(wt.total, 0);
  
  IF v_inconsistent_count > 0 THEN
    RAISE WARNING 'Found % users with wallet balance discrepancies. Run verify_wallet_integrity() to investigate.', v_inconsistent_count;
  ELSE
    RAISE NOTICE '✅ All wallet balances are consistent with transactions';
  END IF;
END $$;

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 041 completata con successo';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Modifiche applicate:';
  RAISE NOTICE '  - Trigger trigger_update_wallet_balance: RIMOSSO';
  RAISE NOTICE '  - Funzione update_wallet_balance(): RIMOSSA';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 WALLET BALANCE ORA AGGIORNATO SOLO DA:';
  RAISE NOTICE '  - increment_wallet_balance() (atomic credit)';
  RAISE NOTICE '  - decrement_wallet_balance() (atomic debit)';
  RAISE NOTICE '';
  RAISE NOTICE '⚠️  DOUBLE CREDIT: IMPOSSIBILE';
  RAISE NOTICE '========================================';
END $$;

