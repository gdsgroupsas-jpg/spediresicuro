-- ============================================================================
-- Migration: Aggiunge p_workspace_id a deduct_wallet_credit + fix doppia tx
--
-- PROBLEMI RISOLTI:
-- 1. p_workspace_id mancante → aggiunto UUID DEFAULT NULL
-- 2. BUG PRE-ESISTENTE: deduct_wallet_credit chiamava decrement_wallet_balance()
--    che crea la SUA wallet_transaction (tipo SHIPMENT_CHARGE), poi ne creava
--    un'altra con il tipo corretto → DOPPIA TRANSAZIONE.
--
-- FIX: La funzione ora gestisce lock + UPDATE direttamente (senza delegare
-- a decrement_wallet_balance), creando UNA sola transazione con il tipo giusto.
-- Il trigger trg_sync_wallet_to_workspace sincronizza workspaces automaticamente.
-- ============================================================================

-- Drop vecchia signature (6 parametri) per evitare ambiguità con la nuova (7 parametri)
DROP FUNCTION IF EXISTS public.deduct_wallet_credit(UUID, NUMERIC, TEXT, TEXT, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.deduct_wallet_credit(
  p_user_id UUID,
  p_amount NUMERIC,
  p_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL,
  p_workspace_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_transaction_id UUID;
  v_current_balance DECIMAL(10,2);
BEGIN
  -- VALIDAZIONE: Importo deve essere positivo
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive. Received: %', p_amount;
  END IF;

  -- VALIDAZIONE: Importo massimo (protezione overflow)
  IF p_amount > 100000.00 THEN
    RAISE EXCEPTION 'Amount exceeds maximum allowed (€100,000). Received: €%', p_amount;
  END IF;

  -- ============================================
  -- 1. LOCK PESSIMISTICO + VERIFICA SALDO
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
  -- 2. UPDATE ATOMICO users
  -- ============================================
  -- Il trigger trg_sync_wallet_to_workspace sincronizza workspaces automaticamente
  UPDATE users
  SET wallet_balance = wallet_balance - p_amount, updated_at = NOW()
  WHERE id = p_user_id;

  -- ============================================
  -- 3. CREA RECORD TRANSAZIONE (una sola, col tipo corretto)
  -- ============================================
  INSERT INTO wallet_transactions (
    user_id,
    workspace_id,
    amount,
    type,
    description,
    reference_id,
    reference_type
  ) VALUES (
    p_user_id,
    p_workspace_id,
    -p_amount,
    p_type,
    COALESCE(p_description, 'Deduzione credito'),
    p_reference_id,
    p_reference_type
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
'Deduzione credito wallet con lock pessimistico, workspace tracking, e singola transazione.
Fix: non delega più a decrement_wallet_balance (evita doppia wallet_transaction).';
