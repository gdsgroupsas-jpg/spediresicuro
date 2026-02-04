-- ============================================================================
-- Migration: Wallet VAT Awareness + Billing Mode
--
-- Adds:
-- 1. billing_mode to users (prepagato/postpagato)
-- 2. vat_mode and vat_amount to payment_transactions
-- 3. vat_mode and vat_amount to wallet_transactions
-- 4. Helper function to get user's VAT mode from assigned price list
-- ============================================================================

-- 1. Add billing_mode to users table
-- Default is 'prepagato' (prepaid) - only resellers can have 'postpagato' for their clients
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS billing_mode TEXT DEFAULT 'prepagato'
CHECK (billing_mode IN ('prepagato', 'postpagato'));

COMMENT ON COLUMN public.users.billing_mode IS
'Billing mode: prepagato (prepaid wallet) or postpagato (post-paid invoicing). Postpagato is only for reseller clients.';

-- 2. Add VAT fields to payment_transactions
ALTER TABLE public.payment_transactions
ADD COLUMN IF NOT EXISTS vat_mode TEXT CHECK (vat_mode IN ('included', 'excluded')),
ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2) DEFAULT 22.00,
ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS amount_net DECIMAL(10,2);

COMMENT ON COLUMN public.payment_transactions.vat_mode IS
'VAT mode at time of payment: included (B2C) or excluded (B2B)';
COMMENT ON COLUMN public.payment_transactions.vat_rate IS
'VAT rate applied (default 22%)';
COMMENT ON COLUMN public.payment_transactions.vat_amount IS
'VAT amount calculated from the transaction';
COMMENT ON COLUMN public.payment_transactions.amount_net IS
'Net amount (excluding VAT) - this is what gets credited to wallet for vat_mode=excluded';

-- 3. Add VAT fields to wallet_transactions
ALTER TABLE public.wallet_transactions
ADD COLUMN IF NOT EXISTS vat_mode TEXT CHECK (vat_mode IN ('included', 'excluded')),
ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS gross_amount DECIMAL(10,2);

COMMENT ON COLUMN public.wallet_transactions.vat_mode IS
'VAT mode for this credit: included or excluded';
COMMENT ON COLUMN public.wallet_transactions.gross_amount IS
'Original gross amount paid (before VAT extraction for excluded mode)';

-- 4. Function to get user's VAT mode from their assigned price list
CREATE OR REPLACE FUNCTION public.get_user_vat_mode(p_user_id UUID)
RETURNS TABLE (
  vat_mode TEXT,
  vat_rate DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_price_list_id UUID;
  v_vat_mode TEXT;
  v_vat_rate DECIMAL(5,2);
BEGIN
  -- Get user's assigned price list
  SELECT u.assigned_price_list_id INTO v_price_list_id
  FROM users u
  WHERE u.id = p_user_id;

  -- If no price list assigned, default to 'excluded' (B2B default)
  IF v_price_list_id IS NULL THEN
    RETURN QUERY SELECT 'excluded'::TEXT, 22.00::DECIMAL(5,2);
    RETURN;
  END IF;

  -- Get VAT mode from price list
  SELECT
    COALESCE(pl.vat_mode, 'excluded'), -- NULL means legacy = excluded
    COALESCE(pl.vat_rate, 22.00)
  INTO v_vat_mode, v_vat_rate
  FROM price_lists pl
  WHERE pl.id = v_price_list_id;

  -- If price list not found, default to excluded
  IF v_vat_mode IS NULL THEN
    v_vat_mode := 'excluded';
    v_vat_rate := 22.00;
  END IF;

  RETURN QUERY SELECT v_vat_mode, v_vat_rate;
END;
$$;

COMMENT ON FUNCTION public.get_user_vat_mode(UUID) IS
'Gets the VAT mode and rate for a user based on their assigned price list. Returns excluded/22% as default.';

-- 5. Function to calculate wallet credit based on VAT mode
-- For 'included': credit = payment amount (user pays €100, gets €100 credit)
-- For 'excluded': credit = payment / (1 + vat_rate) (user pays €100, gets €81.97 credit)
CREATE OR REPLACE FUNCTION public.calculate_wallet_credit(
  p_payment_amount DECIMAL(10,2),
  p_vat_mode TEXT,
  p_vat_rate DECIMAL(5,2) DEFAULT 22.00
)
RETURNS TABLE (
  credit_amount DECIMAL(10,2),
  vat_amount DECIMAL(10,2),
  net_amount DECIMAL(10,2)
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_net DECIMAL(10,2);
  v_vat DECIMAL(10,2);
  v_credit DECIMAL(10,2);
BEGIN
  IF p_vat_mode = 'included' THEN
    -- IVA INCLUSA: €100 payment = €100 credit
    -- The VAT is embedded in the price, user gets full credit
    v_credit := p_payment_amount;
    v_net := ROUND(p_payment_amount / (1 + p_vat_rate / 100), 2);
    v_vat := p_payment_amount - v_net;
  ELSE
    -- IVA ESCLUSA: €100 payment = €81.97 credit (100/1.22)
    -- User pays VAT but only net amount goes to wallet
    v_net := ROUND(p_payment_amount / (1 + p_vat_rate / 100), 2);
    v_vat := p_payment_amount - v_net;
    v_credit := v_net;
  END IF;

  RETURN QUERY SELECT v_credit, v_vat, v_net;
END;
$$;

COMMENT ON FUNCTION public.calculate_wallet_credit(DECIMAL, TEXT, DECIMAL) IS
'Calculates wallet credit based on VAT mode. For included: full amount. For excluded: net amount after VAT.';

-- 6. Enhanced wallet credit function with VAT support
CREATE OR REPLACE FUNCTION public.add_wallet_credit_with_vat(
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
SET search_path = public
AS $$
DECLARE
  v_credit_amount DECIMAL(10,2);
  v_vat_amount DECIMAL(10,2);
  v_net_amount DECIMAL(10,2);
  v_transaction_id UUID;
BEGIN
  -- Calculate credit based on VAT mode
  SELECT credit_amount, vat_amount, net_amount
  INTO v_credit_amount, v_vat_amount, v_net_amount
  FROM calculate_wallet_credit(p_gross_amount, p_vat_mode, p_vat_rate);

  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_transaction_id
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key;

    IF v_transaction_id IS NOT NULL THEN
      RETURN v_transaction_id; -- Already processed
    END IF;
  END IF;

  -- Insert wallet transaction with VAT info
  INSERT INTO wallet_transactions (
    user_id,
    amount,
    type,
    description,
    created_by,
    idempotency_key,
    vat_mode,
    vat_rate,
    vat_amount,
    gross_amount
  ) VALUES (
    p_user_id,
    v_credit_amount,
    'deposit',
    p_description,
    p_created_by,
    p_idempotency_key,
    p_vat_mode,
    p_vat_rate,
    v_vat_amount,
    p_gross_amount
  )
  RETURNING id INTO v_transaction_id;

  -- Update user's wallet balance
  UPDATE users
  SET wallet_balance = COALESCE(wallet_balance, 0) + v_credit_amount,
      updated_at = NOW()
  WHERE id = p_user_id;

  RETURN v_transaction_id;
END;
$$;

COMMENT ON FUNCTION public.add_wallet_credit_with_vat IS
'Adds wallet credit with VAT awareness. For IVA INCLUSA: full amount credited. For IVA ESCLUSA: net amount credited.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_user_vat_mode(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_vat_mode(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.calculate_wallet_credit(DECIMAL, TEXT, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_wallet_credit(DECIMAL, TEXT, DECIMAL) TO service_role;
GRANT EXECUTE ON FUNCTION public.add_wallet_credit_with_vat(UUID, DECIMAL, TEXT, DECIMAL, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_wallet_credit_with_vat(UUID, DECIMAL, TEXT, DECIMAL, TEXT, UUID, TEXT) TO service_role;
