-- ============================================================================
-- Migration: Wallet RPC v2 — Source of Truth Flip (users → workspaces)
--
-- Crea 5 nuove RPC v2 che lockano su workspaces.wallet_balance:
--   1. add_wallet_credit_v2
--   2. add_wallet_credit_with_vat_v2
--   3. deduct_wallet_credit_v2
--   4. refund_wallet_balance_v2
--   5. reseller_transfer_credit_v2
--
-- + Trigger inverso: workspaces → users (backward compat)
-- + Drop trigger vecchio: users → workspaces
--
-- Le v1 restano disponibili per rollback immediato.
-- ============================================================================

-- ============================================
-- STEP 0: Rimuovi trigger vecchio (users → workspaces)
-- ============================================
DROP TRIGGER IF EXISTS trg_sync_wallet_to_workspace ON users;
DROP FUNCTION IF EXISTS sync_wallet_to_workspace();

-- ============================================
-- STEP 1: Trigger inverso (workspaces → users)
-- Quando workspaces.wallet_balance cambia, sincronizza su users
-- per backward compatibility con codice non ancora migrato.
-- ============================================
CREATE OR REPLACE FUNCTION sync_wallet_to_users()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- IS DISTINCT FROM previene loop infiniti
  IF NEW.wallet_balance IS DISTINCT FROM OLD.wallet_balance THEN
    UPDATE users
    SET wallet_balance = NEW.wallet_balance, updated_at = NOW()
    WHERE primary_workspace_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_wallet_to_users
  AFTER UPDATE OF wallet_balance ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION sync_wallet_to_users();

COMMENT ON FUNCTION sync_wallet_to_users IS
'Trigger inverso: sincronizza workspaces.wallet_balance → users.wallet_balance per backward compat.';

-- ============================================
-- STEP 2: deduct_wallet_credit_v2
-- Lock su workspaces (non users). p_workspace_id OBBLIGATORIO.
-- ============================================
CREATE OR REPLACE FUNCTION public.deduct_wallet_credit_v2(
  p_workspace_id UUID,
  p_user_id UUID,
  p_amount NUMERIC,
  p_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_balance DECIMAL(10,2);
  v_transaction_id UUID;
BEGIN
  -- Validazione
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'p_workspace_id is required for deduct_wallet_credit_v2';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive. Received: %', p_amount;
  END IF;

  IF p_amount > 100000.00 THEN
    RAISE EXCEPTION 'Amount exceeds maximum allowed (100.000). Received: %', p_amount;
  END IF;

  -- IDEMPOTENCY CHECK
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_transaction_id
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key
      AND user_id = p_user_id;

    IF v_transaction_id IS NOT NULL THEN
      RETURN v_transaction_id;
    END IF;
  END IF;

  -- Lock pessimistico su WORKSPACES (source of truth)
  SELECT wallet_balance INTO v_current_balance
  FROM workspaces
  WHERE id = p_workspace_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace not found: %', p_workspace_id;
  END IF;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance. Available: %, Required: %', v_current_balance, p_amount;
  END IF;

  -- INSERT wallet_transactions (workspace_id OBBLIGATORIO)
  INSERT INTO wallet_transactions (
    user_id, workspace_id, amount, type, description,
    reference_id, reference_type, idempotency_key
  ) VALUES (
    p_user_id, p_workspace_id, -p_amount, p_type,
    COALESCE(p_description, 'Deduzione credito'),
    p_reference_id, p_reference_type, p_idempotency_key
  )
  RETURNING id INTO v_transaction_id;

  -- UPDATE workspaces.wallet_balance (source of truth)
  -- Il trigger trg_sync_wallet_to_users sincronizza su users
  UPDATE workspaces
  SET wallet_balance = wallet_balance - p_amount, updated_at = NOW()
  WHERE id = p_workspace_id;

  RETURN v_transaction_id;

EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'Wallet locked by concurrent operation. Workspace: %. Retry recommended.', p_workspace_id;
  WHEN OTHERS THEN
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.deduct_wallet_credit_v2 IS
'v2: Deduce credito dal wallet workspace. Lock su workspaces (source of truth). p_workspace_id obbligatorio.';

GRANT EXECUTE ON FUNCTION public.deduct_wallet_credit_v2(UUID, UUID, NUMERIC, TEXT, TEXT, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_wallet_credit_v2(UUID, UUID, NUMERIC, TEXT, TEXT, UUID, TEXT, TEXT) TO service_role;

-- ============================================
-- STEP 3: add_wallet_credit_v2
-- Wrapper semplice per crediti senza calcolo IVA.
-- Lock su workspaces.
-- ============================================
CREATE OR REPLACE FUNCTION public.add_wallet_credit_v2(
  p_workspace_id UUID,
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_balance DECIMAL(10,2);
  v_transaction_id UUID;
BEGIN
  -- Validazione
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'p_workspace_id is required for add_wallet_credit_v2';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive. Received: %', p_amount;
  END IF;

  IF p_amount > 10000.00 THEN
    RAISE EXCEPTION 'Amount exceeds maximum allowed (10.000). Received: %', p_amount;
  END IF;

  -- IDEMPOTENCY CHECK
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_transaction_id
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key
      AND user_id = p_user_id;

    IF v_transaction_id IS NOT NULL THEN
      RETURN v_transaction_id;
    END IF;
  END IF;

  -- Lock pessimistico su WORKSPACES (source of truth)
  SELECT wallet_balance INTO v_current_balance
  FROM workspaces
  WHERE id = p_workspace_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace not found: %', p_workspace_id;
  END IF;

  -- Validazione saldo massimo
  IF (v_current_balance + p_amount) > 100000.00 THEN
    RAISE EXCEPTION 'Wallet balance would exceed maximum (100.000). Current: %, Credit: %',
      v_current_balance, p_amount;
  END IF;

  -- INSERT wallet_transactions
  INSERT INTO wallet_transactions (
    user_id, workspace_id, amount, type, description,
    created_by, idempotency_key
  ) VALUES (
    p_user_id, p_workspace_id, p_amount, 'DEPOSIT',
    COALESCE(p_description, 'Credito wallet'),
    p_created_by, p_idempotency_key
  )
  RETURNING id INTO v_transaction_id;

  -- UPDATE workspaces.wallet_balance (source of truth)
  UPDATE workspaces
  SET wallet_balance = wallet_balance + p_amount, updated_at = NOW()
  WHERE id = p_workspace_id;

  RETURN v_transaction_id;

EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'Wallet locked by concurrent operation. Workspace: %. Retry recommended.', p_workspace_id;
  WHEN OTHERS THEN
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.add_wallet_credit_v2 IS
'v2: Aggiunge credito al wallet workspace (senza IVA). Lock su workspaces (source of truth). p_workspace_id obbligatorio.';

GRANT EXECUTE ON FUNCTION public.add_wallet_credit_v2(UUID, UUID, DECIMAL, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_wallet_credit_v2(UUID, UUID, DECIMAL, TEXT, UUID, TEXT) TO service_role;

-- ============================================
-- STEP 4: add_wallet_credit_with_vat_v2
-- Come add_wallet_credit_v2 ma con calcolo IVA.
-- Lock su workspaces.
-- ============================================
CREATE OR REPLACE FUNCTION public.add_wallet_credit_with_vat_v2(
  p_workspace_id UUID,
  p_user_id UUID,
  p_gross_amount DECIMAL(10,2),
  p_vat_mode TEXT,
  p_vat_rate DECIMAL(5,2),
  p_description TEXT DEFAULT 'Ricarica wallet',
  p_created_by UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_credit_amount DECIMAL(10,2);
  v_vat_amount DECIMAL(10,2);
  v_net_amount DECIMAL(10,2);
  v_transaction_id UUID;
  v_current_balance DECIMAL(10,2);
BEGIN
  -- Validazione
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'p_workspace_id is required for add_wallet_credit_with_vat_v2';
  END IF;

  IF p_gross_amount <= 0 THEN
    RAISE EXCEPTION 'Gross amount must be positive. Received: %', p_gross_amount;
  END IF;

  IF p_gross_amount > 10000.00 THEN
    RAISE EXCEPTION 'Gross amount exceeds maximum allowed (10.000). Received: %', p_gross_amount;
  END IF;

  -- Calcolo credito basato su IVA
  SELECT credit_amount, vat_amount, net_amount
  INTO v_credit_amount, v_vat_amount, v_net_amount
  FROM calculate_wallet_credit(p_gross_amount, p_vat_mode, p_vat_rate);

  -- IDEMPOTENCY CHECK (con filtro user_id per coerenza)
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_transaction_id
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key
      AND user_id = p_user_id;

    IF v_transaction_id IS NOT NULL THEN
      RETURN v_transaction_id;
    END IF;
  END IF;

  -- Lock pessimistico su WORKSPACES (source of truth)
  SELECT wallet_balance INTO v_current_balance
  FROM workspaces
  WHERE id = p_workspace_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace not found: %', p_workspace_id;
  END IF;

  -- Validazione: saldo finale non deve superare limite
  IF (v_current_balance + v_credit_amount) > 100000.00 THEN
    RAISE EXCEPTION 'Wallet balance would exceed maximum (100.000). Current: %, Credit: %',
      v_current_balance, v_credit_amount;
  END IF;

  -- INSERT wallet_transactions con VAT info e workspace_id
  INSERT INTO wallet_transactions (
    user_id, workspace_id, amount, type, description, created_by,
    idempotency_key, vat_mode, vat_rate, vat_amount, gross_amount
  ) VALUES (
    p_user_id, p_workspace_id, v_credit_amount, 'deposit', p_description, p_created_by,
    p_idempotency_key, p_vat_mode, p_vat_rate, v_vat_amount, p_gross_amount
  )
  RETURNING id INTO v_transaction_id;

  -- UPDATE workspaces.wallet_balance (source of truth)
  UPDATE workspaces
  SET wallet_balance = wallet_balance + v_credit_amount, updated_at = NOW()
  WHERE id = p_workspace_id;

  RETURN v_transaction_id;

EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'Wallet locked by concurrent operation. Workspace: %. Retry recommended.', p_workspace_id;
  WHEN OTHERS THEN
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.add_wallet_credit_with_vat_v2 IS
'v2: Ricarica wallet con calcolo IVA. Lock su workspaces (source of truth). p_workspace_id obbligatorio.';

GRANT EXECUTE ON FUNCTION public.add_wallet_credit_with_vat_v2(UUID, UUID, DECIMAL, TEXT, DECIMAL, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_wallet_credit_with_vat_v2(UUID, UUID, DECIMAL, TEXT, DECIMAL, TEXT, UUID, TEXT) TO service_role;

-- ============================================
-- STEP 5: refund_wallet_balance_v2
-- Rimborso spedizione. Lock su workspaces.
-- ============================================
CREATE OR REPLACE FUNCTION public.refund_wallet_balance_v2(
  p_workspace_id UUID,
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_idempotency_key TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_shipment_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_current_balance DECIMAL(10,2);
  v_new_balance DECIMAL(10,2);
  v_transaction_id UUID;
BEGIN
  -- Validazione
  IF p_workspace_id IS NULL THEN
    RAISE EXCEPTION 'p_workspace_id is required for refund_wallet_balance_v2';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive. Received: %', p_amount;
  END IF;

  IF p_amount > 100000.00 THEN
    RAISE EXCEPTION 'Refund amount exceeds maximum (100.000). Received: %', p_amount;
  END IF;

  -- IDEMPOTENCY CHECK
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_transaction_id
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key
      AND type = 'SHIPMENT_REFUND'
      AND user_id = p_user_id;

    IF v_transaction_id IS NOT NULL THEN
      -- Replay idempotente: restituisci risultato senza ri-eseguire
      SELECT wallet_balance INTO v_current_balance
      FROM workspaces WHERE id = p_workspace_id;

      RETURN jsonb_build_object(
        'success', true,
        'idempotent_replay', true,
        'transaction_id', v_transaction_id,
        'current_balance', v_current_balance
      );
    END IF;
  END IF;

  -- Lock pessimistico su WORKSPACES (source of truth)
  SELECT wallet_balance INTO v_current_balance
  FROM workspaces
  WHERE id = p_workspace_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Workspace not found: %', p_workspace_id;
  END IF;

  -- Validazione saldo massimo
  IF (v_current_balance + p_amount) > 100000.00 THEN
    RAISE EXCEPTION 'Wallet balance would exceed maximum (100.000). Current: %, Refund: %',
      v_current_balance, p_amount;
  END IF;

  -- INSERT wallet_transactions
  INSERT INTO wallet_transactions (
    user_id, workspace_id, amount, type, description,
    reference_id, reference_type, idempotency_key
  ) VALUES (
    p_user_id, p_workspace_id, p_amount, 'SHIPMENT_REFUND',
    COALESCE(p_description, 'Rimborso spedizione'),
    p_shipment_id, 'shipment_cancellation', p_idempotency_key
  )
  RETURNING id INTO v_transaction_id;

  -- UPDATE workspaces.wallet_balance (source of truth)
  v_new_balance := v_current_balance + p_amount;
  UPDATE workspaces
  SET wallet_balance = v_new_balance, updated_at = NOW()
  WHERE id = p_workspace_id;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent_replay', false,
    'transaction_id', v_transaction_id,
    'previous_balance', v_current_balance,
    'new_balance', v_new_balance,
    'amount_refunded', p_amount
  );

EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'Wallet locked by concurrent operation. Workspace: %. Retry recommended.', p_workspace_id;
  WHEN OTHERS THEN
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.refund_wallet_balance_v2 IS
'v2: Rimborso spedizione su wallet workspace. Lock su workspaces (source of truth). p_workspace_id obbligatorio.';

GRANT EXECUTE ON FUNCTION public.refund_wallet_balance_v2(UUID, UUID, DECIMAL, TEXT, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_wallet_balance_v2(UUID, UUID, DECIMAL, TEXT, TEXT, UUID) TO service_role;

-- ============================================
-- STEP 6: reseller_transfer_credit_v2
-- Trasferimento credito reseller → sub-user.
-- Lock deterministico su 2 workspaces.
-- ============================================
CREATE OR REPLACE FUNCTION public.reseller_transfer_credit_v2(
  p_reseller_workspace_id UUID,
  p_sub_user_workspace_id UUID,
  p_reseller_id UUID,
  p_sub_user_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT DEFAULT 'Trasferimento credito reseller',
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reseller_balance DECIMAL(10,2);
  v_sub_user_balance DECIMAL(10,2);
  v_new_reseller_balance DECIMAL(10,2);
  v_new_sub_user_balance DECIMAL(10,2);
  v_transaction_id_out UUID;
  v_transaction_id_in UUID;
  v_first_ws_id UUID;
  v_second_ws_id UUID;
BEGIN
  -- Validazione
  IF p_reseller_workspace_id IS NULL OR p_sub_user_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Both workspace IDs are required for reseller_transfer_credit_v2';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be positive. Received: %', p_amount;
  END IF;

  IF p_amount > 10000.00 THEN
    RAISE EXCEPTION 'Transfer amount exceeds maximum (10.000). Received: %', p_amount;
  END IF;

  IF p_reseller_workspace_id = p_sub_user_workspace_id THEN
    RAISE EXCEPTION 'Cannot transfer credit to the same workspace';
  END IF;

  -- IDEMPOTENCY CHECK (composite keys)
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_transaction_id_out
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key || '-out'
      AND user_id = p_reseller_id;

    IF v_transaction_id_out IS NOT NULL THEN
      SELECT id INTO v_transaction_id_in
      FROM wallet_transactions
      WHERE idempotency_key = p_idempotency_key || '-in'
        AND user_id = p_sub_user_id;

      -- Replay idempotente
      SELECT wallet_balance INTO v_reseller_balance
      FROM workspaces WHERE id = p_reseller_workspace_id;
      SELECT wallet_balance INTO v_sub_user_balance
      FROM workspaces WHERE id = p_sub_user_workspace_id;

      RETURN jsonb_build_object(
        'success', true,
        'idempotent_replay', true,
        'transaction_id_out', v_transaction_id_out,
        'transaction_id_in', v_transaction_id_in,
        'reseller_new_balance', v_reseller_balance,
        'sub_user_new_balance', v_sub_user_balance
      );
    END IF;
  END IF;

  -- Lock deterministico: workspace con UUID minore prima (previene deadlock)
  IF p_reseller_workspace_id < p_sub_user_workspace_id THEN
    v_first_ws_id := p_reseller_workspace_id;
    v_second_ws_id := p_sub_user_workspace_id;
  ELSE
    v_first_ws_id := p_sub_user_workspace_id;
    v_second_ws_id := p_reseller_workspace_id;
  END IF;

  -- Lock primo workspace
  IF v_first_ws_id = p_reseller_workspace_id THEN
    SELECT wallet_balance INTO v_reseller_balance
    FROM workspaces WHERE id = v_first_ws_id FOR UPDATE NOWAIT;
    SELECT wallet_balance INTO v_sub_user_balance
    FROM workspaces WHERE id = v_second_ws_id FOR UPDATE NOWAIT;
  ELSE
    SELECT wallet_balance INTO v_sub_user_balance
    FROM workspaces WHERE id = v_first_ws_id FOR UPDATE NOWAIT;
    SELECT wallet_balance INTO v_reseller_balance
    FROM workspaces WHERE id = v_second_ws_id FOR UPDATE NOWAIT;
  END IF;

  -- Verifica saldo reseller
  IF v_reseller_balance < p_amount THEN
    RAISE EXCEPTION 'Credito reseller insufficiente. Disponibile: %, Richiesto: %',
      v_reseller_balance, p_amount;
  END IF;

  -- Verifica saldo massimo sub-user
  IF (v_sub_user_balance + p_amount) > 100000.00 THEN
    RAISE EXCEPTION 'Sub-user balance would exceed maximum (100.000). Current: %, Transfer: %',
      v_sub_user_balance, p_amount;
  END IF;

  -- INSERT transazione OUT (reseller)
  INSERT INTO wallet_transactions (
    user_id, workspace_id, amount, type, description, idempotency_key
  ) VALUES (
    p_reseller_id, p_reseller_workspace_id, -p_amount, 'RESELLER_TRANSFER_OUT',
    p_description,
    CASE WHEN p_idempotency_key IS NOT NULL THEN p_idempotency_key || '-out' ELSE NULL END
  )
  RETURNING id INTO v_transaction_id_out;

  -- INSERT transazione IN (sub-user)
  INSERT INTO wallet_transactions (
    user_id, workspace_id, amount, type, description, idempotency_key
  ) VALUES (
    p_sub_user_id, p_sub_user_workspace_id, p_amount, 'RESELLER_TRANSFER_IN',
    p_description,
    CASE WHEN p_idempotency_key IS NOT NULL THEN p_idempotency_key || '-in' ELSE NULL END
  )
  RETURNING id INTO v_transaction_id_in;

  -- UPDATE entrambi i workspaces (source of truth)
  v_new_reseller_balance := v_reseller_balance - p_amount;
  v_new_sub_user_balance := v_sub_user_balance + p_amount;

  UPDATE workspaces
  SET wallet_balance = v_new_reseller_balance, updated_at = NOW()
  WHERE id = p_reseller_workspace_id;

  UPDATE workspaces
  SET wallet_balance = v_new_sub_user_balance, updated_at = NOW()
  WHERE id = p_sub_user_workspace_id;

  RETURN jsonb_build_object(
    'success', true,
    'idempotent_replay', false,
    'transaction_id_out', v_transaction_id_out,
    'transaction_id_in', v_transaction_id_in,
    'reseller_previous_balance', v_reseller_balance,
    'reseller_new_balance', v_new_reseller_balance,
    'sub_user_previous_balance', v_sub_user_balance,
    'sub_user_new_balance', v_new_sub_user_balance,
    'amount_transferred', p_amount
  );

EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'Wallet locked by concurrent operation. Retry recommended.';
  WHEN OTHERS THEN
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.reseller_transfer_credit_v2 IS
'v2: Trasferimento credito reseller → sub-user. Lock deterministico su 2 workspaces (source of truth).';

GRANT EXECUTE ON FUNCTION public.reseller_transfer_credit_v2(UUID, UUID, UUID, UUID, DECIMAL, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reseller_transfer_credit_v2(UUID, UUID, UUID, UUID, DECIMAL, TEXT, TEXT) TO service_role;

-- ============================================
-- STEP 7: Completamento
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 20260218100000 completata';
  RAISE NOTICE '========================================';
  RAISE NOTICE '1. Rimosso trigger users→workspaces (trg_sync_wallet_to_workspace)';
  RAISE NOTICE '2. Creato trigger workspaces→users (trg_sync_wallet_to_users)';
  RAISE NOTICE '3. Creata deduct_wallet_credit_v2 (lock su workspaces)';
  RAISE NOTICE '4. Creata add_wallet_credit_v2 (lock su workspaces)';
  RAISE NOTICE '5. Creata add_wallet_credit_with_vat_v2 (lock su workspaces)';
  RAISE NOTICE '6. Creata refund_wallet_balance_v2 (lock su workspaces)';
  RAISE NOTICE '7. Creata reseller_transfer_credit_v2 (lock su 2 workspaces)';
  RAISE NOTICE '========================================';
END $$;
