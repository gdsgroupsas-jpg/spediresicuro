-- ============================================================================
-- Migration: Wallet RPC Dual-Write + wallet_transactions.workspace_id
--
-- STEP 2+4 della migrazione wallet users → workspaces
--
-- Aggiunge p_workspace_id opzionale a tutte le 6 RPC wallet.
-- Quando fornito:
--   a) Aggiorna ANCHE workspaces.wallet_balance (dual-write)
--   b) Inserisce workspace_id in wallet_transactions
--
-- Backward compatible: p_workspace_id DEFAULT NULL, nessun cambio per caller esistenti.
-- Il trigger trg_sync_wallet_to_workspace (STEP 1) fa da safety net:
--   se un caller NON passa workspace_id, il trigger sincronizza comunque.
--
-- NOTA: Backfill wallet_transactions.workspace_id per record storici incluso.
-- ============================================================================

-- ============================================
-- 1. decrement_wallet_balance
-- ============================================
DROP FUNCTION IF EXISTS decrement_wallet_balance(UUID, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS decrement_wallet_balance(UUID, DECIMAL, TEXT, UUID);

CREATE OR REPLACE FUNCTION decrement_wallet_balance(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_idempotency_key TEXT DEFAULT NULL,
  p_workspace_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_balance DECIMAL(10,2);
  v_user_email TEXT;
  v_existing_transaction_id UUID;
  v_new_transaction_id UUID;
BEGIN
  -- IDEMPOTENCY CHECK
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_transaction_id
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key
      AND type = 'SHIPMENT_CHARGE'
      AND user_id = p_user_id
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent_replay', true,
        'transaction_id', v_existing_transaction_id,
        'message', 'Transaction already executed (idempotent replay)'
      );
    END IF;
  END IF;

  -- VALIDAZIONE
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive. Received: %', p_amount;
  END IF;
  IF p_amount > 100000.00 THEN
    RAISE EXCEPTION 'Amount exceeds maximum allowed. Received: %', p_amount;
  END IF;

  -- LOCK PESSIMISTICO
  SELECT wallet_balance, email INTO v_current_balance, v_user_email
  FROM users
  WHERE id = p_user_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance for user % (%). Available: %, Required: %',
      v_user_email, p_user_id, v_current_balance, p_amount;
  END IF;

  -- UPDATE ATOMICO users
  UPDATE users
  SET wallet_balance = wallet_balance - p_amount, updated_at = NOW()
  WHERE id = p_user_id;

  -- DUAL-WRITE: workspace (se fornito)
  IF p_workspace_id IS NOT NULL THEN
    UPDATE workspaces
    SET wallet_balance = wallet_balance - p_amount, updated_at = NOW()
    WHERE id = p_workspace_id;
  END IF;

  -- INSERT TRANSACTION (con workspace_id)
  INSERT INTO wallet_transactions (
    user_id, workspace_id, amount, type, idempotency_key, description
  ) VALUES (
    p_user_id, p_workspace_id, -p_amount, 'SHIPMENT_CHARGE', p_idempotency_key,
    CASE WHEN p_idempotency_key IS NOT NULL THEN 'Wallet debit (idempotent)' ELSE 'Wallet debit' END
  )
  RETURNING id INTO v_new_transaction_id;

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
    RAISE EXCEPTION 'Wallet locked by concurrent operation. User: %. Retry recommended.', p_user_id;
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION decrement_wallet_balance IS
'ATOMIC + IDEMPOTENT wallet debit con dual-write workspace opzionale.';

-- ============================================
-- 2. increment_wallet_balance
-- ============================================
DROP FUNCTION IF EXISTS increment_wallet_balance(UUID, DECIMAL, TEXT);
DROP FUNCTION IF EXISTS increment_wallet_balance(UUID, DECIMAL, TEXT, UUID);

CREATE OR REPLACE FUNCTION increment_wallet_balance(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_idempotency_key TEXT DEFAULT NULL,
  p_workspace_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_balance DECIMAL(10,2);
  v_existing_transaction_id UUID;
  v_new_transaction_id UUID;
BEGIN
  -- IDEMPOTENCY CHECK
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_transaction_id
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key
      AND type = 'DEPOSIT'
      AND user_id = p_user_id
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent_replay', true,
        'transaction_id', v_existing_transaction_id,
        'message', 'Transaction already executed (idempotent replay)'
      );
    END IF;
  END IF;

  -- VALIDAZIONE
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive. Received: %', p_amount;
  END IF;
  IF p_amount > 10000.00 THEN
    RAISE EXCEPTION 'Amount exceeds maximum allowed. Received: %', p_amount;
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
    RAISE EXCEPTION 'Wallet balance would exceed maximum. Current: %, Increment: %',
      v_current_balance, p_amount;
  END IF;

  -- UPDATE ATOMICO users
  UPDATE users
  SET wallet_balance = wallet_balance + p_amount, updated_at = NOW()
  WHERE id = p_user_id;

  -- DUAL-WRITE: workspace (se fornito)
  IF p_workspace_id IS NOT NULL THEN
    UPDATE workspaces
    SET wallet_balance = wallet_balance + p_amount, updated_at = NOW()
    WHERE id = p_workspace_id;
  END IF;

  -- INSERT TRANSACTION (con workspace_id)
  INSERT INTO wallet_transactions (
    user_id, workspace_id, amount, type, idempotency_key, description
  ) VALUES (
    p_user_id, p_workspace_id, p_amount, 'DEPOSIT', p_idempotency_key,
    CASE WHEN p_idempotency_key IS NOT NULL THEN 'Wallet credit (idempotent)' ELSE 'Wallet credit' END
  )
  RETURNING id INTO v_new_transaction_id;

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
'ATOMIC + IDEMPOTENT wallet credit con dual-write workspace opzionale.';

-- ============================================
-- 3. add_wallet_credit (wrapper di increment)
-- ============================================
DROP FUNCTION IF EXISTS add_wallet_credit(UUID, DECIMAL, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS add_wallet_credit(UUID, DECIMAL, TEXT, UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION add_wallet_credit(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_workspace_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_result JSONB;
  v_transaction_id UUID;
  MAX_SINGLE_AMOUNT CONSTANT DECIMAL(10,2) := 10000.00;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Importo deve essere positivo';
  END IF;
  IF p_amount > MAX_SINGLE_AMOUNT THEN
    RAISE EXCEPTION 'Importo massimo consentito: %. Richiesto: %', MAX_SINGLE_AMOUNT, p_amount;
  END IF;

  -- USA FUNZIONE ATOMICA (ora con workspace_id)
  v_result := increment_wallet_balance(p_user_id, p_amount, p_idempotency_key, p_workspace_id);
  v_transaction_id := (v_result->>'transaction_id')::UUID;

  IF (v_result->>'idempotent_replay')::BOOLEAN THEN
    RETURN v_transaction_id;
  END IF;

  -- Update description e created_by se forniti
  IF p_description IS NOT NULL OR p_created_by IS NOT NULL THEN
    UPDATE wallet_transactions
    SET description = COALESCE(p_description, description),
        created_by = COALESCE(p_created_by, created_by)
    WHERE id = v_transaction_id;
  END IF;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION add_wallet_credit IS
'Wrapper per increment_wallet_balance() con description/created_by. Dual-write workspace opzionale.';

-- ============================================
-- 4. add_wallet_credit_with_vat
-- ============================================
DROP FUNCTION IF EXISTS add_wallet_credit_with_vat(UUID, DECIMAL, TEXT, DECIMAL, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS add_wallet_credit_with_vat(UUID, DECIMAL, TEXT, DECIMAL, TEXT, UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.add_wallet_credit_with_vat(
  p_user_id UUID,
  p_gross_amount DECIMAL(10,2),
  p_vat_mode TEXT,
  p_vat_rate DECIMAL(5,2),
  p_description TEXT DEFAULT 'Ricarica wallet',
  p_created_by UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_workspace_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit_amount DECIMAL(10,2);
  v_vat_amount DECIMAL(10,2);
  v_net_amount DECIMAL(10,2);
  v_transaction_id UUID;
BEGIN
  -- Calcolo credito basato su IVA
  SELECT credit_amount, vat_amount, net_amount
  INTO v_credit_amount, v_vat_amount, v_net_amount
  FROM calculate_wallet_credit(p_gross_amount, p_vat_mode, p_vat_rate);

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_transaction_id
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key;

    IF v_transaction_id IS NOT NULL THEN
      RETURN v_transaction_id;
    END IF;
  END IF;

  -- Insert wallet transaction con VAT info e workspace_id
  INSERT INTO wallet_transactions (
    user_id, workspace_id, amount, type, description, created_by,
    idempotency_key, vat_mode, vat_rate, vat_amount, gross_amount
  ) VALUES (
    p_user_id, p_workspace_id, v_credit_amount, 'deposit', p_description, p_created_by,
    p_idempotency_key, p_vat_mode, p_vat_rate, v_vat_amount, p_gross_amount
  )
  RETURNING id INTO v_transaction_id;

  -- Update users wallet_balance
  UPDATE users
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_credit_amount, updated_at = NOW()
  WHERE id = p_user_id;

  -- DUAL-WRITE: workspace (se fornito)
  IF p_workspace_id IS NOT NULL THEN
    UPDATE workspaces
    SET wallet_balance = COALESCE(wallet_balance, 0) + v_credit_amount, updated_at = NOW()
    WHERE id = p_workspace_id;
  END IF;

  RETURN v_transaction_id;
END;
$$;

COMMENT ON FUNCTION public.add_wallet_credit_with_vat IS
'Ricarica wallet con calcolo IVA. Dual-write workspace opzionale.';

-- ============================================
-- 5. refund_wallet_balance
-- ============================================
DROP FUNCTION IF EXISTS refund_wallet_balance(UUID, DECIMAL, TEXT, TEXT, UUID);
DROP FUNCTION IF EXISTS refund_wallet_balance(UUID, DECIMAL, TEXT, TEXT, UUID, UUID);

CREATE OR REPLACE FUNCTION refund_wallet_balance(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_idempotency_key TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_shipment_id UUID DEFAULT NULL,
  p_workspace_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_balance DECIMAL(10,2);
  v_existing_transaction_id UUID;
  v_new_transaction_id UUID;
BEGIN
  -- IDEMPOTENCY CHECK
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_transaction_id
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key
      AND type = 'SHIPMENT_REFUND'
      AND user_id = p_user_id
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent_replay', true,
        'transaction_id', v_existing_transaction_id,
        'message', 'Refund already executed (idempotent replay)'
      );
    END IF;
  END IF;

  -- VALIDAZIONE
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive. Received: %', p_amount;
  END IF;
  IF p_amount > 100000.00 THEN
    RAISE EXCEPTION 'Refund amount exceeds maximum. Received: %', p_amount;
  END IF;

  -- LOCK PESSIMISTICO
  SELECT wallet_balance INTO v_current_balance
  FROM users
  WHERE id = p_user_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  -- UPDATE ATOMICO users
  UPDATE users
  SET wallet_balance = wallet_balance + p_amount, updated_at = NOW()
  WHERE id = p_user_id;

  -- DUAL-WRITE: workspace (se fornito)
  IF p_workspace_id IS NOT NULL THEN
    UPDATE workspaces
    SET wallet_balance = wallet_balance + p_amount, updated_at = NOW()
    WHERE id = p_workspace_id;
  END IF;

  -- INSERT TRANSACTION con tipo SHIPMENT_REFUND e workspace_id
  INSERT INTO wallet_transactions (
    user_id, workspace_id, amount, type, idempotency_key, description,
    reference_id, reference_type
  ) VALUES (
    p_user_id, p_workspace_id, p_amount, 'SHIPMENT_REFUND', p_idempotency_key,
    COALESCE(p_description, 'Rimborso cancellazione spedizione'),
    p_shipment_id::TEXT,
    CASE WHEN p_shipment_id IS NOT NULL THEN 'shipment_cancellation' ELSE NULL END
  )
  RETURNING id INTO v_new_transaction_id;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent_replay', false,
    'transaction_id', v_new_transaction_id,
    'previous_balance', v_current_balance,
    'new_balance', v_current_balance + p_amount,
    'amount_refunded', p_amount
  );

EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'Wallet locked by concurrent operation. User: %. Retry recommended.', p_user_id;
  WHEN OTHERS THEN
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION refund_wallet_balance IS
'ATOMIC + IDEMPOTENT wallet refund con dual-write workspace opzionale.';

-- ============================================
-- 6. reseller_transfer_credit
-- ============================================
DROP FUNCTION IF EXISTS reseller_transfer_credit(UUID, UUID, DECIMAL, TEXT, TEXT);
DROP FUNCTION IF EXISTS reseller_transfer_credit(UUID, UUID, DECIMAL, TEXT, TEXT, UUID, UUID);

CREATE OR REPLACE FUNCTION public.reseller_transfer_credit(
  p_reseller_id UUID,
  p_sub_user_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT DEFAULT 'Trasferimento credito reseller',
  p_idempotency_key TEXT DEFAULT NULL,
  p_reseller_workspace_id UUID DEFAULT NULL,
  p_sub_user_workspace_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_reseller_balance DECIMAL(10,2);
  v_sub_user_balance DECIMAL(10,2);
  v_reseller_email TEXT;
  v_sub_user_email TEXT;
  v_existing_tx_id UUID;
  v_tx_out_id UUID;
  v_tx_in_id UUID;
  v_key_out TEXT;
  v_key_in TEXT;
  v_first_id UUID;
  v_second_id UUID;
BEGIN
  -- VALIDAZIONE INPUT
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Importo deve essere positivo. Ricevuto: %', p_amount;
  END IF;
  IF p_amount > 10000.00 THEN
    RAISE EXCEPTION 'Importo supera il massimo consentito (10.000). Ricevuto: %', p_amount;
  END IF;
  IF p_reseller_id = p_sub_user_id THEN
    RAISE EXCEPTION 'Non puoi trasferire credito a te stesso';
  END IF;

  -- IDEMPOTENCY CHECK
  IF p_idempotency_key IS NOT NULL THEN
    v_key_out := p_idempotency_key || '-out';
    v_key_in := p_idempotency_key || '-in';

    SELECT id INTO v_existing_tx_id
    FROM wallet_transactions
    WHERE idempotency_key = v_key_out
      AND type = 'RESELLER_TRANSFER_OUT'
      AND user_id = p_reseller_id
    LIMIT 1;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true,
        'idempotent_replay', true,
        'transaction_id_out', v_existing_tx_id,
        'message', 'Trasferimento gia eseguito (idempotent replay)'
      );
    END IF;
  ELSE
    v_key_out := NULL;
    v_key_in := NULL;
  END IF;

  -- LOCK DETERMINISTICO (min UUID first)
  IF p_reseller_id < p_sub_user_id THEN
    v_first_id := p_reseller_id;
    v_second_id := p_sub_user_id;
  ELSE
    v_first_id := p_sub_user_id;
    v_second_id := p_reseller_id;
  END IF;

  PERFORM 1 FROM users WHERE id = v_first_id FOR UPDATE NOWAIT;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utente non trovato: %', v_first_id;
  END IF;

  PERFORM 1 FROM users WHERE id = v_second_id FOR UPDATE NOWAIT;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utente non trovato: %', v_second_id;
  END IF;

  -- LEGGI SALDI
  SELECT wallet_balance, email INTO v_reseller_balance, v_reseller_email
  FROM users WHERE id = p_reseller_id;

  SELECT wallet_balance, email INTO v_sub_user_balance, v_sub_user_email
  FROM users WHERE id = p_sub_user_id;

  -- VERIFICA SALDO RESELLER
  IF v_reseller_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo reseller insufficiente (%). Disponibile: %, Richiesto: %',
      v_reseller_email, v_reseller_balance, p_amount;
  END IF;

  -- UPDATE ATOMICO: Debit reseller + Credit sub-user
  UPDATE users
  SET wallet_balance = wallet_balance - p_amount, updated_at = NOW()
  WHERE id = p_reseller_id;

  UPDATE users
  SET wallet_balance = wallet_balance + p_amount, updated_at = NOW()
  WHERE id = p_sub_user_id;

  -- DUAL-WRITE: workspaces (se forniti)
  IF p_reseller_workspace_id IS NOT NULL THEN
    UPDATE workspaces
    SET wallet_balance = wallet_balance - p_amount, updated_at = NOW()
    WHERE id = p_reseller_workspace_id;
  END IF;

  IF p_sub_user_workspace_id IS NOT NULL THEN
    UPDATE workspaces
    SET wallet_balance = wallet_balance + p_amount, updated_at = NOW()
    WHERE id = p_sub_user_workspace_id;
  END IF;

  -- INSERT WALLET TRANSACTIONS (2 record con workspace_id)
  INSERT INTO wallet_transactions (
    user_id, workspace_id, amount, type, idempotency_key, description, created_by
  ) VALUES (
    p_reseller_id, p_reseller_workspace_id, -p_amount, 'RESELLER_TRANSFER_OUT', v_key_out,
    p_description || ' -> ' || COALESCE(v_sub_user_email, p_sub_user_id::TEXT),
    p_reseller_id
  )
  RETURNING id INTO v_tx_out_id;

  INSERT INTO wallet_transactions (
    user_id, workspace_id, amount, type, idempotency_key, description, created_by
  ) VALUES (
    p_sub_user_id, p_sub_user_workspace_id, p_amount, 'RESELLER_TRANSFER_IN', v_key_in,
    p_description || ' <- ' || COALESCE(v_reseller_email, p_reseller_id::TEXT),
    p_reseller_id
  )
  RETURNING id INTO v_tx_in_id;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent_replay', false,
    'transaction_id_out', v_tx_out_id,
    'transaction_id_in', v_tx_in_id,
    'reseller_previous_balance', v_reseller_balance,
    'reseller_new_balance', v_reseller_balance - p_amount,
    'sub_user_previous_balance', v_sub_user_balance,
    'sub_user_new_balance', v_sub_user_balance + p_amount,
    'amount_transferred', p_amount
  );

EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'Wallet bloccato da operazione concorrente. Riprova.';
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent_replay', true,
      'message', 'Trasferimento gia eseguito (concurrent replay)'
    );
  WHEN OTHERS THEN
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.reseller_transfer_credit IS
'Trasferimento atomico credito reseller -> sub-user. Lock deterministico, idempotente. Dual-write workspace opzionale.';

-- ============================================
-- 7. Backfill wallet_transactions.workspace_id per record storici
-- ============================================
UPDATE wallet_transactions wt
SET workspace_id = u.primary_workspace_id
FROM users u
WHERE u.id = wt.user_id
  AND u.primary_workspace_id IS NOT NULL
  AND wt.workspace_id IS NULL;

-- ============================================
-- 8. Grant permissions (per le funzioni aggiornate)
-- ============================================
GRANT EXECUTE ON FUNCTION public.add_wallet_credit_with_vat(UUID, DECIMAL, TEXT, DECIMAL, TEXT, UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_wallet_credit_with_vat(UUID, DECIMAL, TEXT, DECIMAL, TEXT, UUID, TEXT, UUID) TO service_role;

-- ============================================
-- 9. Completamento
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 20260216130000 completata';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RPC aggiornate con dual-write workspace:';
  RAISE NOTICE '  - decrement_wallet_balance(+p_workspace_id)';
  RAISE NOTICE '  - increment_wallet_balance(+p_workspace_id)';
  RAISE NOTICE '  - add_wallet_credit(+p_workspace_id)';
  RAISE NOTICE '  - add_wallet_credit_with_vat(+p_workspace_id)';
  RAISE NOTICE '  - refund_wallet_balance(+p_workspace_id)';
  RAISE NOTICE '  - reseller_transfer_credit(+p_reseller/sub_user_workspace_id)';
  RAISE NOTICE '';
  RAISE NOTICE 'Backfill: wallet_transactions.workspace_id popolato per record storici';
  RAISE NOTICE '========================================';
END $$;
