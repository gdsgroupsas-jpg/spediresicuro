-- ============================================================================
-- Migration: Fix post-audit review wallet RPC
--
-- 1. GRANT mancante per deduct_wallet_credit (DROP+CREATE perde permessi)
-- 2. Idempotency check in add_wallet_credit_with_vat: aggiunge filtro user_id
-- ============================================================================

-- ============================================
-- 1. GRANT per deduct_wallet_credit
--    La migration 20260217120000 ha fatto DROP+CREATE senza ri-assegnare GRANT.
--    service_role bypassa i permessi, ma per coerenza e sicurezza li aggiungiamo.
-- ============================================
GRANT EXECUTE ON FUNCTION public.deduct_wallet_credit(UUID, NUMERIC, TEXT, TEXT, UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_wallet_credit(UUID, NUMERIC, TEXT, TEXT, UUID, TEXT, UUID, TEXT) TO service_role;

-- ============================================
-- 2. FIX idempotency check in add_wallet_credit_with_vat
--    Aggiunge AND user_id = p_user_id per evitare collisioni cross-user.
--    (Coerenza con deduct_wallet_credit che già lo filtra.)
-- ============================================
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
SET search_path = public, pg_temp
AS $$
DECLARE
  v_credit_amount DECIMAL(10,2);
  v_vat_amount DECIMAL(10,2);
  v_net_amount DECIMAL(10,2);
  v_transaction_id UUID;
  v_current_balance DECIMAL(10,2);
BEGIN
  -- Validazione importi
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

  -- Idempotency check (con filtro user_id per evitare collisioni cross-user)
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_transaction_id
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key
      AND user_id = p_user_id;

    IF v_transaction_id IS NOT NULL THEN
      RETURN v_transaction_id;
    END IF;
  END IF;

  -- Lock pessimistico
  SELECT wallet_balance INTO v_current_balance
  FROM users
  WHERE id = p_user_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  -- Validazione: saldo finale non deve superare limite
  IF (v_current_balance + v_credit_amount) > 100000.00 THEN
    RAISE EXCEPTION 'Wallet balance would exceed maximum (100.000). Current: %, Credit: %',
      v_current_balance, v_credit_amount;
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

  RETURN v_transaction_id;

EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'Wallet locked by concurrent operation. User: %. Retry recommended.', p_user_id;
  WHEN OTHERS THEN
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.add_wallet_credit_with_vat IS
'Ricarica wallet con calcolo IVA. Lock pessimistico + validazione importi + workspace tracking.
Fix: idempotency check con filtro user_id per coerenza con deduct_wallet_credit.';

GRANT EXECUTE ON FUNCTION public.add_wallet_credit_with_vat(UUID, DECIMAL, TEXT, DECIMAL, TEXT, UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_wallet_credit_with_vat(UUID, DECIMAL, TEXT, DECIMAL, TEXT, UUID, TEXT, UUID) TO service_role;

-- ============================================
-- 3. Completamento
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 20260217140000 completata';
  RAISE NOTICE '========================================';
  RAISE NOTICE '1. GRANT deduct_wallet_credit → authenticated + service_role';
  RAISE NOTICE '2. add_wallet_credit_with_vat idempotency + user_id filter';
  RAISE NOTICE '========================================';
END $$;
