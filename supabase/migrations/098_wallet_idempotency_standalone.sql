-- ============================================
-- MIGRATION: 098_wallet_idempotency_standalone.sql
-- DESCRIZIONE: Wallet idempotency con idempotency_key in wallet_transactions
-- DATA: 2026-01-12
-- CRITICITÀ: P0.2 - SICUREZZA FINANZIARIA
-- ============================================
--
-- SCOPO:
-- Aggiunge idempotency_key a wallet_transactions per prevenire
-- doppi addebiti/accrediti anche a livello di transazione.
--
-- NOTA: Questa migration è complementare a 044_idempotency_locks.sql
-- che gestisce idempotency a livello di shipment creation.
--
-- ============================================

-- ============================================
-- STEP 1: Aggiungi colonna idempotency_key
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'wallet_transactions' 
    AND column_name = 'idempotency_key'
  ) THEN
    ALTER TABLE wallet_transactions 
    ADD COLUMN idempotency_key TEXT;
    
    RAISE NOTICE '✅ Colonna idempotency_key aggiunta a wallet_transactions';
  ELSE
    RAISE NOTICE '⚠️ Colonna idempotency_key già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 2: Crea indice UNIQUE per idempotency
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'wallet_transactions' 
    AND indexname = 'wallet_transactions_idempotency_key_idx'
  ) THEN
    -- Indice UNIQUE parziale (solo per valori non null)
    CREATE UNIQUE INDEX wallet_transactions_idempotency_key_idx 
    ON wallet_transactions(idempotency_key) 
    WHERE idempotency_key IS NOT NULL;
    
    RAISE NOTICE '✅ Indice UNIQUE idempotency_key creato';
  ELSE
    RAISE NOTICE '⚠️ Indice già esistente';
  END IF;
END $$;

-- ============================================
-- STEP 3: Aggiorna decrement_wallet_balance con idempotency
-- ============================================
CREATE OR REPLACE FUNCTION decrement_wallet_balance(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_balance DECIMAL(10,2);
  v_user_email TEXT;
  v_existing_tx RECORD;
BEGIN
  -- ============================================
  -- CHECK IDEMPOTENCY FIRST (se key fornita)
  -- ============================================
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, amount, created_at INTO v_existing_tx
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;
    
    IF FOUND THEN
      -- Transazione già esistente: idempotent replay
      RETURN jsonb_build_object(
        'success', TRUE,
        'idempotent_replay', TRUE,
        'transaction_id', v_existing_tx.id,
        'amount', v_existing_tx.amount,
        'message', 'Transaction already processed (idempotent replay)'
      );
    END IF;
  END IF;

  -- VALIDAZIONE: Importo deve essere positivo
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive. Received: %', p_amount;
  END IF;
  
  -- VALIDAZIONE: Importo massimo (protezione overflow)
  IF p_amount > 100000.00 THEN
    RAISE EXCEPTION 'Amount exceeds maximum allowed (€100,000). Received: €%', p_amount;
  END IF;

  -- LOCK PESSIMISTICO: Blocca riga utente atomicamente
  SELECT wallet_balance, email INTO v_current_balance, v_user_email
  FROM users
  WHERE id = p_user_id
  FOR UPDATE NOWAIT;
  
  -- VALIDAZIONE: Utente deve esistere
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;
  
  -- VALIDAZIONE: Saldo sufficiente
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance for user % (%). Available: €%, Required: €%', 
      v_user_email,
      p_user_id,
      v_current_balance, 
      p_amount;
  END IF;
  
  -- UPDATE ATOMICO: Decrementa saldo
  UPDATE users
  SET 
    wallet_balance = wallet_balance - p_amount,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  -- Ritorna successo
  RETURN jsonb_build_object(
    'success', TRUE,
    'idempotent_replay', FALSE,
    'new_balance', v_current_balance - p_amount,
    'amount_debited', p_amount
  );
  
EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'Wallet locked by concurrent operation. User: %. Retry recommended.', p_user_id;
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Imposta search_path per sicurezza
ALTER FUNCTION decrement_wallet_balance(UUID, DECIMAL(10,2), TEXT) 
SET search_path = public, pg_temp;

COMMENT ON FUNCTION decrement_wallet_balance(UUID, DECIMAL(10,2), TEXT) IS 
'ATOMIC wallet debit with optional idempotency key.
If idempotency_key is provided and already exists, returns idempotent_replay=true.
Otherwise, performs atomic debit with pessimistic locking.';

-- ============================================
-- STEP 4: Aggiorna increment_wallet_balance con idempotency
-- ============================================
CREATE OR REPLACE FUNCTION increment_wallet_balance(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_balance DECIMAL(10,2);
  v_existing_tx RECORD;
BEGIN
  -- CHECK IDEMPOTENCY FIRST
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id, amount, created_at INTO v_existing_tx
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key
    LIMIT 1;
    
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', TRUE,
        'idempotent_replay', TRUE,
        'transaction_id', v_existing_tx.id,
        'message', 'Transaction already processed (idempotent replay)'
      );
    END IF;
  END IF;

  -- VALIDAZIONE
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive. Received: %', p_amount;
  END IF;
  
  IF p_amount > 10000.00 THEN
    RAISE EXCEPTION 'Amount exceeds maximum allowed per operation (€10,000). Received: €%', p_amount;
  END IF;

  -- LOCK PESSIMISTICO
  SELECT wallet_balance INTO v_current_balance
  FROM users
  WHERE id = p_user_id
  FOR UPDATE NOWAIT;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;
  
  IF (v_current_balance + p_amount) > 100000.00 THEN
    RAISE EXCEPTION 'Wallet balance would exceed maximum (€100,000). Current: €%, Increment: €%', 
      v_current_balance, p_amount;
  END IF;
  
  -- UPDATE ATOMICO
  UPDATE users
  SET 
    wallet_balance = wallet_balance + p_amount,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'idempotent_replay', FALSE,
    'new_balance', v_current_balance + p_amount,
    'amount_credited', p_amount
  );
  
EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'Wallet locked by concurrent operation. User: %. Retry recommended.', p_user_id;
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION increment_wallet_balance(UUID, DECIMAL(10,2), TEXT) 
SET search_path = public, pg_temp;

-- ============================================
-- COMPLETAMENTO
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 098 completata con successo';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Modifiche:';
  RAISE NOTICE '  - wallet_transactions.idempotency_key (colonna)';
  RAISE NOTICE '  - UNIQUE index su idempotency_key';
  RAISE NOTICE '  - decrement_wallet_balance() con idempotency';
  RAISE NOTICE '  - increment_wallet_balance() con idempotency';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 WALLET IDEMPOTENCY: ATTIVO';
  RAISE NOTICE '========================================';
END $$;
