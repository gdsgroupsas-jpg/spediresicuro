-- ============================================================================
-- Migration: Fix audit vulnerabilita wallet RPC
--
-- V2 (P1): add_wallet_credit_with_vat manca FOR UPDATE NOWAIT
-- V3 (P1): add_wallet_credit_with_vat manca validazione importi esplicita
-- V4 (P1): deduct_wallet_credit manca p_idempotency_key
-- V6 (P2): add_wallet_credit_with_vat search_path senza pg_temp
-- ============================================================================

-- ============================================
-- 1. FIX add_wallet_credit_with_vat (V2+V3+V6)
--    - Aggiunto FOR UPDATE NOWAIT (lock pessimistico)
--    - Aggiunta validazione importi esplicita
--    - Aggiunto pg_temp a search_path
-- ============================================
DROP FUNCTION IF EXISTS public.add_wallet_credit_with_vat(UUID, DECIMAL, TEXT, DECIMAL, TEXT, UUID, TEXT, UUID);

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
  -- ============================================
  -- VALIDAZIONE IMPORTI (V3)
  -- ============================================
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

  -- Idempotency check
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_transaction_id
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key;

    IF v_transaction_id IS NOT NULL THEN
      RETURN v_transaction_id;
    END IF;
  END IF;

  -- ============================================
  -- LOCK PESSIMISTICO (V2)
  -- ============================================
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

  -- Update users wallet_balance (trigger sincronizza workspace automaticamente)
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
Fix audit V2+V3+V6: aggiunto FOR UPDATE NOWAIT, validazione esplicita, pg_temp in search_path.';

GRANT EXECUTE ON FUNCTION public.add_wallet_credit_with_vat(UUID, DECIMAL, TEXT, DECIMAL, TEXT, UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_wallet_credit_with_vat(UUID, DECIMAL, TEXT, DECIMAL, TEXT, UUID, TEXT, UUID) TO service_role;

-- ============================================
-- 2. FIX deduct_wallet_credit (V4)
--    - Aggiunto p_idempotency_key con check
-- ============================================
DROP FUNCTION IF EXISTS public.deduct_wallet_credit(UUID, NUMERIC, TEXT, TEXT, UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION public.deduct_wallet_credit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_workspace_id UUID DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$
DECLARE
  v_transaction_id UUID;
  v_current_balance DECIMAL(10,2);
  v_existing_transaction_id UUID;
BEGIN
  -- ============================================
  -- IDEMPOTENCY CHECK (V4)
  -- ============================================
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_transaction_id
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key
      AND user_id = p_user_id
    LIMIT 1;

    IF FOUND THEN
      RETURN v_existing_transaction_id;
    END IF;
  END IF;

  -- VALIDAZIONE: Importo deve essere positivo
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive. Received: %', p_amount;
  END IF;

  -- VALIDAZIONE: Importo massimo
  IF p_amount > 100000.00 THEN
    RAISE EXCEPTION 'Amount exceeds maximum allowed. Received: %', p_amount;
  END IF;

  -- ============================================
  -- LOCK PESSIMISTICO + VERIFICA SALDO
  -- ============================================
  SELECT wallet_balance INTO v_current_balance
  FROM users
  WHERE id = p_user_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance for user %. Available: %, Required: %',
      p_user_id, v_current_balance, p_amount;
  END IF;

  -- ============================================
  -- UPDATE ATOMICO users
  -- ============================================
  UPDATE users
  SET wallet_balance = wallet_balance - p_amount, updated_at = NOW()
  WHERE id = p_user_id;

  -- ============================================
  -- CREA RECORD TRANSAZIONE
  -- ============================================
  INSERT INTO wallet_transactions (
    user_id,
    workspace_id,
    amount,
    type,
    description,
    reference_id,
    reference_type,
    idempotency_key
  ) VALUES (
    p_user_id,
    p_workspace_id,
    -p_amount,
    p_type,
    COALESCE(p_description, 'Deduzione credito'),
    p_reference_id,
    p_reference_type,
    p_idempotency_key
  ) RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;

EXCEPTION
  WHEN lock_not_available THEN
    RAISE EXCEPTION 'Wallet locked by concurrent operation. User: %. Retry recommended.', p_user_id;
  WHEN OTHERS THEN
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.deduct_wallet_credit IS
'Deduzione credito wallet con lock pessimistico, idempotency, workspace tracking.
Fix audit V4: aggiunto p_idempotency_key con check.';

-- ============================================
-- 3. Completamento
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 20260217120000 completata';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'V2: add_wallet_credit_with_vat + FOR UPDATE NOWAIT';
  RAISE NOTICE 'V3: add_wallet_credit_with_vat + validazione importi';
  RAISE NOTICE 'V4: deduct_wallet_credit + p_idempotency_key';
  RAISE NOTICE 'V6: add_wallet_credit_with_vat + pg_temp in search_path';
  RAISE NOTICE '========================================';
END $$;
