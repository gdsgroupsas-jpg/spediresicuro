-- ============================================================================
-- HOTFIX: Rimuovi dual-write manuale dalle RPC wallet
--
-- BUG: Il trigger trg_sync_wallet_to_workspace (STEP 1) GIA' sincronizza
-- users.wallet_balance → workspaces.wallet_balance con valore ASSOLUTO.
-- Le RPC facevano ANCHE un UPDATE relativo (wallet_balance +/- p_amount),
-- causando DOUBLE UPDATE → desync saldo workspace.
--
-- FIX: Rimuovi i blocchi "IF p_workspace_id IS NOT NULL THEN UPDATE workspaces"
-- da tutte le RPC. Il parametro p_workspace_id RESTA per wallet_transactions.
-- Il trigger fa il sync del balance, il parametro serve solo per tracking.
-- ============================================================================

-- ============================================
-- 1. decrement_wallet_balance (rimuovi dual-write)
-- ============================================
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

  -- UPDATE ATOMICO users (trigger sincronizza workspace automaticamente)
  UPDATE users
  SET wallet_balance = wallet_balance - p_amount, updated_at = NOW()
  WHERE id = p_user_id;

  -- INSERT TRANSACTION (workspace_id per tracking, NON per balance)
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
'ATOMIC + IDEMPOTENT wallet debit. Trigger sincronizza workspace.';

-- ============================================
-- 2. increment_wallet_balance (rimuovi dual-write)
-- ============================================
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

  -- UPDATE ATOMICO users (trigger sincronizza workspace automaticamente)
  UPDATE users
  SET wallet_balance = wallet_balance + p_amount, updated_at = NOW()
  WHERE id = p_user_id;

  -- INSERT TRANSACTION (workspace_id per tracking, NON per balance)
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
'ATOMIC + IDEMPOTENT wallet credit. Trigger sincronizza workspace.';

-- ============================================
-- 3. add_wallet_credit (wrapper — nessun dual-write diretto, delega a increment)
-- ============================================
-- Nessuna modifica necessaria: delega a increment_wallet_balance che non ha piu' dual-write.

-- ============================================
-- 4. add_wallet_credit_with_vat (rimuovi dual-write)
-- ============================================
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

  -- Insert wallet transaction con VAT info e workspace_id (per tracking)
  INSERT INTO wallet_transactions (
    user_id, workspace_id, amount, type, description, created_by,
    idempotency_key, vat_mode, vat_rate, vat_amount, gross_amount
  ) VALUES (
    p_user_id, p_workspace_id, v_credit_amount, 'deposit', p_description, p_created_by,
    p_idempotency_key, p_vat_mode, p_vat_rate, v_vat_amount, p_gross_amount
  )
  RETURNING id INTO v_transaction_id;

  -- Update users wallet_balance (trigger sincronizza workspace automaticamente)
  UPDATE users
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_credit_amount, updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_transaction_id;
END;
$$;

COMMENT ON FUNCTION public.add_wallet_credit_with_vat IS
'Ricarica wallet con calcolo IVA. Trigger sincronizza workspace.';

-- ============================================
-- 5. refund_wallet_balance (rimuovi dual-write)
-- ============================================
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

  -- UPDATE ATOMICO users (trigger sincronizza workspace automaticamente)
  UPDATE users
  SET wallet_balance = wallet_balance + p_amount, updated_at = NOW()
  WHERE id = p_user_id;

  -- INSERT TRANSACTION (workspace_id per tracking, NON per balance)
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
'ATOMIC + IDEMPOTENT wallet refund. Trigger sincronizza workspace.';

-- ============================================
-- 6. reseller_transfer_credit (rimuovi dual-write)
-- ============================================
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
  -- (trigger sincronizza i rispettivi workspace automaticamente)
  UPDATE users
  SET wallet_balance = wallet_balance - p_amount, updated_at = NOW()
  WHERE id = p_reseller_id;

  UPDATE users
  SET wallet_balance = wallet_balance + p_amount, updated_at = NOW()
  WHERE id = p_sub_user_id;

  -- INSERT WALLET TRANSACTIONS (2 record con workspace_id per tracking)
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
'Trasferimento atomico credito reseller -> sub-user. Trigger sincronizza workspace.';

-- ============================================
-- 7. Grant permissions
-- ============================================
GRANT EXECUTE ON FUNCTION public.add_wallet_credit_with_vat(UUID, DECIMAL, TEXT, DECIMAL, TEXT, UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_wallet_credit_with_vat(UUID, DECIMAL, TEXT, DECIMAL, TEXT, UUID, TEXT, UUID) TO service_role;

-- ============================================
-- 8. Completamento
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'HOTFIX 20260216140000 completata';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Rimosso dual-write manuale da tutte le 6 RPC.';
  RAISE NOTICE 'Il trigger trg_sync_wallet_to_workspace gestisce la sync.';
  RAISE NOTICE 'p_workspace_id resta per wallet_transactions tracking.';
  RAISE NOTICE '========================================';
END $$;
