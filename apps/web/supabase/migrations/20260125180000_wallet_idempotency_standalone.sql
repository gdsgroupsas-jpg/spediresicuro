-- ============================================
-- MIGRATION: 20260125180000_wallet_idempotency_standalone.sql
-- DESCRIZIONE: Idempotency standalone per wallet operations
-- DATA: 2026-01-25
-- CRITICITÀ: P0 - AUDIT FIX (Punto 2)
-- ============================================
--
-- PROBLEMA:
-- decrement_wallet_balance() è atomico ma NON idempotent standalone.
-- Se chiamato direttamente (fuori shipment flow) → no protezione doppio addebito.
--
-- SOLUZIONE:
-- 1. Aggiungi idempotency_key opzionale a wallet_transactions
-- 2. UNIQUE index per prevenire duplicati
-- 3. Refactor functions per supportare idempotency_key
-- 4. Backward compatible (idempotency_key opzionale)
--
-- NOTA: Questa migration era stata originariamente creata come 098 ma
-- erroneamente cancellata durante cleanup. Ricreata con timestamp.
--
-- ============================================

-- ============================================
-- STEP 1: Schema update - Add idempotency_key
-- ============================================

-- Add idempotency_key column (nullable per backward compat)
ALTER TABLE wallet_transactions
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- UNIQUE index per prevenire duplicati
-- WHERE clause: solo se idempotency_key non è NULL
CREATE UNIQUE INDEX IF NOT EXISTS wallet_transactions_idempotency_key_idx
ON wallet_transactions(idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- Indice performance per lookup
CREATE INDEX IF NOT EXISTS wallet_transactions_idempotency_key_lookup_idx
ON wallet_transactions(idempotency_key)
WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN wallet_transactions.idempotency_key IS
'Idempotency key for standalone wallet operations.
UNIQUE constraint prevents duplicate transactions.
Optional (NULL) for backward compatibility with old code.';

-- ============================================
-- STEP 2: Refactor decrement_wallet_balance
-- ============================================

-- Drop existing function signatures to avoid conflicts
DROP FUNCTION IF EXISTS decrement_wallet_balance(UUID, DECIMAL);
DROP FUNCTION IF EXISTS decrement_wallet_balance(UUID, DECIMAL, TEXT);

CREATE OR REPLACE FUNCTION decrement_wallet_balance(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_idempotency_key TEXT DEFAULT NULL  -- NEW: optional for backward compat
)
RETURNS JSONB AS $$  -- Changed return type for richer response
DECLARE
  v_current_balance DECIMAL(10,2);
  v_user_email TEXT;
  v_existing_transaction_id UUID;
  v_new_transaction_id UUID;
BEGIN
  -- ============================================
  -- IDEMPOTENCY CHECK (se key fornita)
  -- ============================================
  IF p_idempotency_key IS NOT NULL THEN
    -- Cerca transaction esistente con stesso idempotency_key
    SELECT id INTO v_existing_transaction_id
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key
      AND type = 'SHIPMENT_CHARGE'  -- Solo transazioni debit
      AND user_id = p_user_id
    LIMIT 1;

    IF FOUND THEN
      -- IDEMPOTENT REPLAY: Transaction già eseguita
      RAISE NOTICE 'Idempotent replay: wallet debit already executed for key %. Transaction ID: %',
        p_idempotency_key, v_existing_transaction_id;

      -- Ritorna success con flag idempotent_replay
      RETURN jsonb_build_object(
        'success', true,
        'idempotent_replay', true,
        'transaction_id', v_existing_transaction_id,
        'message', 'Transaction already executed (idempotent replay)'
      );
    END IF;
  END IF;

  -- ============================================
  -- VALIDAZIONE: Importo deve essere positivo
  -- ============================================
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive. Received: %', p_amount;
  END IF;

  -- VALIDAZIONE: Importo massimo (protezione overflow)
  IF p_amount > 100000.00 THEN
    RAISE EXCEPTION 'Amount exceeds maximum allowed (€100,000). Received: €%', p_amount;
  END IF;

  -- ============================================
  -- LOCK PESSIMISTICO: Blocca riga utente
  -- ============================================
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

  -- ============================================
  -- UPDATE ATOMICO: Decrementa saldo
  -- ============================================
  UPDATE users
  SET
    wallet_balance = wallet_balance - p_amount,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- VERIFICA: UPDATE riuscito
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Failed to update wallet balance for user %', p_user_id;
  END IF;

  -- ============================================
  -- INSERT TRANSACTION (con idempotency_key)
  -- ============================================
  INSERT INTO wallet_transactions (
    user_id,
    amount,
    type,
    idempotency_key,
    description
  ) VALUES (
    p_user_id,
    -p_amount,  -- Negativo per debit
    'SHIPMENT_CHARGE',
    p_idempotency_key,  -- Può essere NULL (backward compat)
    CASE
      WHEN p_idempotency_key IS NOT NULL
      THEN 'Wallet debit (idempotent)'
      ELSE 'Wallet debit'
    END
  )
  RETURNING id INTO v_new_transaction_id;

  -- ============================================
  -- SUCCESS: Ritorna risultato con transaction ID
  -- ============================================
  RETURN jsonb_build_object(
    'success', true,
    'idempotent_replay', false,
    'transaction_id', v_new_transaction_id,
    'previous_balance', v_current_balance,
    'new_balance', v_current_balance - p_amount,
    'amount_debited', p_amount
  );

EXCEPTION
  WHEN lock_not_available THEN
    -- Lock già acquisito da altra transazione
    RAISE EXCEPTION 'Wallet locked by concurrent operation. User: %. Retry recommended.', p_user_id;
  WHEN OTHERS THEN
    -- Propaga qualsiasi altro errore
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION decrement_wallet_balance IS
'ATOMIC + IDEMPOTENT wallet debit with pessimistic locking.

IDEMPOTENCY:
- If p_idempotency_key provided: UNIQUE constraint prevents duplicate transactions
- If p_idempotency_key NULL: Backward compatible (no idempotency check)

RETURNS JSONB:
{
  "success": true,
  "idempotent_replay": false,  // true if transaction already existed
  "transaction_id": "uuid",
  "previous_balance": 100.00,
  "new_balance": 90.00,
  "amount_debited": 10.00
}

GUARANTEES:
- No race conditions (FOR UPDATE NOWAIT)
- No negative balance (check inside lock)
- No duplicate debits (UNIQUE idempotency_key)
- Fail-fast on error (explicit exceptions)

USAGE:
- With idempotency: decrement_wallet_balance(user_id, amount, ''my-idempotency-key'')
- Without idempotency: decrement_wallet_balance(user_id, amount) -- backward compat';

-- ============================================
-- STEP 3: Refactor increment_wallet_balance
-- ============================================

-- Drop existing function signatures to avoid conflicts
DROP FUNCTION IF EXISTS increment_wallet_balance(UUID, DECIMAL);
DROP FUNCTION IF EXISTS increment_wallet_balance(UUID, DECIMAL, TEXT);

CREATE OR REPLACE FUNCTION increment_wallet_balance(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_idempotency_key TEXT DEFAULT NULL  -- NEW: optional
)
RETURNS JSONB AS $$
DECLARE
  v_current_balance DECIMAL(10,2);
  v_existing_transaction_id UUID;
  v_new_transaction_id UUID;
BEGIN
  -- ============================================
  -- IDEMPOTENCY CHECK (se key fornita)
  -- ============================================
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_transaction_id
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key
      AND type = 'DEPOSIT'  -- Solo transazioni credit
      AND user_id = p_user_id
    LIMIT 1;

    IF FOUND THEN
      -- IDEMPOTENT REPLAY
      RAISE NOTICE 'Idempotent replay: wallet credit already executed for key %. Transaction ID: %',
        p_idempotency_key, v_existing_transaction_id;

      RETURN jsonb_build_object(
        'success', true,
        'idempotent_replay', true,
        'transaction_id', v_existing_transaction_id,
        'message', 'Transaction already executed (idempotent replay)'
      );
    END IF;
  END IF;

  -- ============================================
  -- VALIDAZIONE
  -- ============================================
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive. Received: %', p_amount;
  END IF;

  IF p_amount > 10000.00 THEN
    RAISE EXCEPTION 'Amount exceeds maximum allowed per operation (€10,000). Received: €%', p_amount;
  END IF;

  -- ============================================
  -- LOCK PESSIMISTICO
  -- ============================================
  SELECT wallet_balance INTO v_current_balance
  FROM users
  WHERE id = p_user_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  -- VALIDAZIONE: Saldo finale non deve superare limite
  IF (v_current_balance + p_amount) > 100000.00 THEN
    RAISE EXCEPTION 'Wallet balance would exceed maximum (€100,000). Current: €%, Increment: €%',
      v_current_balance, p_amount;
  END IF;

  -- ============================================
  -- UPDATE ATOMICO
  -- ============================================
  UPDATE users
  SET
    wallet_balance = wallet_balance + p_amount,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- ============================================
  -- INSERT TRANSACTION
  -- ============================================
  INSERT INTO wallet_transactions (
    user_id,
    amount,
    type,
    idempotency_key,
    description
  ) VALUES (
    p_user_id,
    p_amount,  -- Positivo per credit
    'DEPOSIT',
    p_idempotency_key,
    CASE
      WHEN p_idempotency_key IS NOT NULL
      THEN 'Wallet credit (idempotent)'
      ELSE 'Wallet credit'
    END
  )
  RETURNING id INTO v_new_transaction_id;

  -- ============================================
  -- SUCCESS
  -- ============================================
  RETURN jsonb_build_object(
    'success', true,
    'idempotent_replay', false,
    'transaction_id', v_new_transaction_id,
    'previous_balance', v_current_balance,
    'new_balance', v_current_balance + p_amount,
    'amount_credited', p_amount
  );

EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'Wallet locked by concurrent operation. User: %. Retry recommended.', p_user_id;
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION increment_wallet_balance IS
'ATOMIC + IDEMPOTENT wallet credit with pessimistic locking.
Same idempotency guarantees as decrement_wallet_balance().';

-- ============================================
-- STEP 4: Update add_wallet_credit (wrapper)
-- ============================================

-- Drop ALL existing signatures to avoid "function name is not unique" error
DROP FUNCTION IF EXISTS add_wallet_credit(UUID, DECIMAL);
DROP FUNCTION IF EXISTS add_wallet_credit(UUID, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS add_wallet_credit(UUID, DECIMAL, TEXT, UUID);
DROP FUNCTION IF EXISTS add_wallet_credit(UUID, DECIMAL, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION add_wallet_credit(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL  -- NEW: propagate to increment_wallet_balance
)
RETURNS UUID AS $$
DECLARE
  v_result JSONB;
  v_transaction_id UUID;
  MAX_SINGLE_AMOUNT CONSTANT DECIMAL(10,2) := 10000.00;
BEGIN
  -- Verifica importo
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'L''importo deve essere positivo';
  END IF;

  IF p_amount > MAX_SINGLE_AMOUNT THEN
    RAISE EXCEPTION 'Importo massimo consentito per singola operazione: €%.2f. Importo richiesto: €%.2f',
      MAX_SINGLE_AMOUNT, p_amount;
  END IF;

  -- USA FUNZIONE ATOMICA + IDEMPOTENT
  v_result := increment_wallet_balance(p_user_id, p_amount, p_idempotency_key);

  -- Estrai transaction_id dal result JSONB
  v_transaction_id := (v_result->>'transaction_id')::UUID;

  -- Se idempotent replay, ritorna transaction_id esistente
  IF (v_result->>'idempotent_replay')::BOOLEAN THEN
    RETURN v_transaction_id;
  END IF;

  -- Update description se fornita (solo per nuove transazioni)
  IF p_description IS NOT NULL THEN
    UPDATE wallet_transactions
    SET description = p_description,
        created_by = p_created_by
    WHERE id = v_transaction_id;
  END IF;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION add_wallet_credit IS
'Wrapper for increment_wallet_balance() with description support.
Now supports idempotency via p_idempotency_key parameter.';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 20260125180000 completata';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Schema updates:';
  RAISE NOTICE '  - wallet_transactions.idempotency_key (TEXT, nullable)';
  RAISE NOTICE '  - UNIQUE index: wallet_transactions_idempotency_key_idx';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions refactored (idempotency support):';
  RAISE NOTICE '  - decrement_wallet_balance(user_id, amount, idempotency_key?)';
  RAISE NOTICE '  - increment_wallet_balance(user_id, amount, idempotency_key?)';
  RAISE NOTICE '  - add_wallet_credit(..., idempotency_key?)';
  RAISE NOTICE '';
  RAISE NOTICE 'Return type changed: BOOLEAN -> JSONB';
  RAISE NOTICE '  - Backward compat: check result.success instead of TRUE/FALSE';
  RAISE NOTICE '  - New fields: idempotent_replay, transaction_id, balances';
  RAISE NOTICE '';
  RAISE NOTICE 'WALLET ORA IDEMPOTENT STANDALONE';
  RAISE NOTICE '========================================';
END $$;
