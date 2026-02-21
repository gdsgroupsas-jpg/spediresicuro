-- ============================================
-- Migration: Fix audit findings RPC v2
-- Data: 2026-02-18
-- Autore: Claude (audit FASE 1)
--
-- Fix 3 problemi trovati dall'audit:
-- P1: refund_wallet_balance_v2 — aggiunto NOT FOUND check su replay idempotente
-- P2: reseller_transfer_credit_v2 — aggiunti NOT FOUND checks dopo lock
-- P3: add_wallet_credit_with_vat_v2 — 'deposit' → 'DEPOSIT' per coerenza
-- ============================================

-- ============================================
-- FIX P3: add_wallet_credit_with_vat_v2
-- Type 'deposit' → 'DEPOSIT' per coerenza con le altre RPC v2
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
  -- FIX P3: 'DEPOSIT' maiuscolo per coerenza con le altre RPC v2
  INSERT INTO wallet_transactions (
    user_id, workspace_id, amount, type, description, created_by,
    idempotency_key, vat_mode, vat_rate, vat_amount, gross_amount
  ) VALUES (
    p_user_id, p_workspace_id, v_credit_amount, 'DEPOSIT', p_description, p_created_by,
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

-- ============================================
-- FIX P1: refund_wallet_balance_v2
-- Aggiunto NOT FOUND check su replay idempotente
-- Il SELECT senza lock nel replay è by-design (read-only, transazione già applicata)
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
      -- NOTA: SELECT senza lock è intenzionale — è read-only, la transazione
      -- è già stata applicata. Il balance restituito è informativo.
      SELECT wallet_balance INTO v_current_balance
      FROM workspaces WHERE id = p_workspace_id;

      -- FIX P1: check workspace esiste anche nel replay path
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Workspace not found during idempotent replay: %', p_workspace_id;
      END IF;

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

-- ============================================
-- FIX P2: reseller_transfer_credit_v2
-- Aggiunti NOT FOUND checks dopo lock su entrambi i workspace
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
    -- FIX P2: check workspace esiste
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Reseller workspace not found: %', p_reseller_workspace_id;
    END IF;

    SELECT wallet_balance INTO v_sub_user_balance
    FROM workspaces WHERE id = v_second_ws_id FOR UPDATE NOWAIT;
    -- FIX P2: check workspace esiste
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sub-user workspace not found: %', p_sub_user_workspace_id;
    END IF;
  ELSE
    SELECT wallet_balance INTO v_sub_user_balance
    FROM workspaces WHERE id = v_first_ws_id FOR UPDATE NOWAIT;
    -- FIX P2: check workspace esiste
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Sub-user workspace not found: %', p_sub_user_workspace_id;
    END IF;

    SELECT wallet_balance INTO v_reseller_balance
    FROM workspaces WHERE id = v_second_ws_id FOR UPDATE NOWAIT;
    -- FIX P2: check workspace esiste
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Reseller workspace not found: %', p_reseller_workspace_id;
    END IF;
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

-- ============================================
-- Completamento
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 20260218110000 completata';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FIX P1: refund_wallet_balance_v2 — NOT FOUND check su replay idempotente';
  RAISE NOTICE 'FIX P2: reseller_transfer_credit_v2 — NOT FOUND checks dopo lock';
  RAISE NOTICE 'FIX P3: add_wallet_credit_with_vat_v2 — deposit → DEPOSIT';
  RAISE NOTICE '========================================';
END $$;
