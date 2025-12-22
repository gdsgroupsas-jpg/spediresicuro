-- ============================================
-- MIGRATION: 040_wallet_atomic_operations.sql
-- DESCRIZIONE: Funzioni atomiche per wallet - ZERO race condition
-- DATA: 2025-12-22
-- CRITICITÀ: P0 - SICUREZZA FINANZIARIA
-- ============================================

-- ============================================
-- STEP 1: Funzione atomica per decremento wallet
-- ============================================

CREATE OR REPLACE FUNCTION decrement_wallet_balance(
  p_user_id UUID,
  p_amount DECIMAL(10,2)
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_balance DECIMAL(10,2);
  v_user_email TEXT;
BEGIN
  -- VALIDAZIONE: Importo deve essere positivo
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive. Received: %', p_amount;
  END IF;
  
  -- VALIDAZIONE: Importo massimo (protezione overflow)
  IF p_amount > 100000.00 THEN
    RAISE EXCEPTION 'Amount exceeds maximum allowed (€100,000). Received: €%', p_amount;
  END IF;

  -- LOCK PESSIMISTICO: Blocca riga utente atomicamente
  -- NOWAIT: Fallisce immediatamente se già locked (no deadlock)
  SELECT wallet_balance, email INTO v_current_balance, v_user_email
  FROM users
  WHERE id = p_user_id
  FOR UPDATE NOWAIT;
  
  -- VALIDAZIONE: Utente deve esistere
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;
  
  -- VALIDAZIONE: Saldo sufficiente (CHECK ATOMICO dentro lock)
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance for user % (%). Available: €%, Required: €%', 
      v_user_email,
      p_user_id,
      v_current_balance, 
      p_amount;
  END IF;
  
  -- UPDATE ATOMICO: Decrementa saldo
  -- Usa operatore aritmetico per garantire atomicità
  UPDATE users
  SET 
    wallet_balance = wallet_balance - p_amount,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- VERIFICA: UPDATE riuscito
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to update wallet balance for user %', p_user_id;
  END IF;
  
  -- SUCCESS: Ritorna TRUE
  RETURN TRUE;
  
EXCEPTION
  WHEN lock_not_available THEN
    -- Lock già acquisito da altra transazione
    RAISE EXCEPTION 'Wallet locked by concurrent operation. User: %. Retry recommended.', p_user_id;
  WHEN OTHERS THEN
    -- Propaga qualsiasi altro errore
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION decrement_wallet_balance IS 
'ATOMIC wallet debit with pessimistic locking.
GUARANTEES:
- No race conditions (FOR UPDATE NOWAIT)
- No negative balance (check inside lock)
- Fail-fast on error (explicit exceptions)
- Single source of truth for wallet updates

USAGE: Always use this function to debit wallet. Never UPDATE users.wallet_balance directly.

RETURNS: TRUE on success, EXCEPTION on failure';

-- ============================================
-- STEP 2: Funzione atomica per incremento wallet
-- ============================================

CREATE OR REPLACE FUNCTION increment_wallet_balance(
  p_user_id UUID,
  p_amount DECIMAL(10,2)
)
RETURNS BOOLEAN AS $$
DECLARE
  v_new_balance DECIMAL(10,2);
BEGIN
  -- VALIDAZIONE: Importo deve essere positivo
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive. Received: %', p_amount;
  END IF;
  
  -- VALIDAZIONE: Importo massimo per singola operazione
  IF p_amount > 10000.00 THEN
    RAISE EXCEPTION 'Amount exceeds maximum allowed per operation (€10,000). Received: €%', p_amount;
  END IF;

  -- LOCK PESSIMISTICO: Blocca riga utente
  SELECT wallet_balance INTO v_new_balance
  FROM users
  WHERE id = p_user_id
  FOR UPDATE NOWAIT;
  
  -- VALIDAZIONE: Utente deve esistere
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;
  
  -- VALIDAZIONE: Saldo finale non deve superare limite
  IF (v_new_balance + p_amount) > 100000.00 THEN
    RAISE EXCEPTION 'Wallet balance would exceed maximum (€100,000). Current: €%, Increment: €%', 
      v_new_balance, p_amount;
  END IF;
  
  -- UPDATE ATOMICO: Incrementa saldo
  UPDATE users
  SET 
    wallet_balance = wallet_balance + p_amount,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- SUCCESS
  RETURN TRUE;
  
EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'Wallet locked by concurrent operation. User: %. Retry recommended.', p_user_id;
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION increment_wallet_balance IS 
'ATOMIC wallet credit with pessimistic locking.
GUARANTEES:
- No race conditions (FOR UPDATE NOWAIT)
- Maximum balance enforced (€100,000)
- Fail-fast on error

USAGE: Use for direct wallet credits. For transaction-tracked credits, use add_wallet_credit().';

-- ============================================
-- STEP 3: Aggiorna add_wallet_credit per usare funzione atomica
-- ============================================

CREATE OR REPLACE FUNCTION add_wallet_credit(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  MAX_SINGLE_AMOUNT CONSTANT DECIMAL(10,2) := 10000.00;
BEGIN
  -- Verifica che l'importo sia positivo
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'L''importo deve essere positivo';
  END IF;
  
  -- Verifica limite massimo per singola operazione
  IF p_amount > MAX_SINGLE_AMOUNT THEN
    RAISE EXCEPTION 'Importo massimo consentito per singola operazione: €%.2f. Importo richiesto: €%.2f', 
      MAX_SINGLE_AMOUNT, p_amount;
  END IF;
  
  -- USA FUNZIONE ATOMICA per incrementare wallet
  PERFORM increment_wallet_balance(p_user_id, p_amount);
  
  -- Crea transazione di tracciamento
  INSERT INTO wallet_transactions (
    user_id,
    amount,
    type,
    description,
    created_by
  ) VALUES (
    p_user_id,
    p_amount,
    'deposit',
    COALESCE(p_description, 'Ricarica credito'),
    p_created_by
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION add_wallet_credit IS 
'Adds credit to wallet using atomic increment + transaction tracking.
Updated to use increment_wallet_balance() for atomic safety.';

-- ============================================
-- STEP 4: Constraint di sicurezza addizionale
-- ============================================

-- Assicura che wallet_balance non possa mai andare negativo
-- (doppia protezione oltre al check nella funzione)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_wallet_balance_non_negative'
  ) THEN
    ALTER TABLE users 
    ADD CONSTRAINT users_wallet_balance_non_negative 
    CHECK (wallet_balance >= 0);
    
    RAISE NOTICE '✅ Constraint aggiunto: users_wallet_balance_non_negative';
  ELSE
    RAISE NOTICE '⚠️ Constraint già esistente: users_wallet_balance_non_negative';
  END IF;
END $$;

-- Limite massimo wallet balance (protezione overflow)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'users_wallet_balance_max_limit'
  ) THEN
    ALTER TABLE users 
    ADD CONSTRAINT users_wallet_balance_max_limit 
    CHECK (wallet_balance <= 100000.00);
    
    RAISE NOTICE '✅ Constraint aggiunto: users_wallet_balance_max_limit (€100,000)';
  ELSE
    RAISE NOTICE '⚠️ Constraint già esistente: users_wallet_balance_max_limit';
  END IF;
END $$;

-- ============================================
-- STEP 5: Funzione di verifica integrità wallet
-- ============================================

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
Used for auditing and debugging.';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 040 completata con successo';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Funzioni create:';
  RAISE NOTICE '  - decrement_wallet_balance() [ATOMIC]';
  RAISE NOTICE '  - increment_wallet_balance() [ATOMIC]';
  RAISE NOTICE '  - add_wallet_credit() [UPDATED]';
  RAISE NOTICE '  - verify_wallet_integrity() [AUDIT]';
  RAISE NOTICE '';
  RAISE NOTICE 'Constraints aggiunti:';
  RAISE NOTICE '  - users_wallet_balance_non_negative';
  RAISE NOTICE '  - users_wallet_balance_max_limit (€100,000)';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 WALLET ORA ATOMICAMENTE SICURO';
  RAISE NOTICE '========================================';
END $$;

