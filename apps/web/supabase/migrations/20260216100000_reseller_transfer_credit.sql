-- ============================================================================
-- Migration: Reseller Transfer Credit (Atomico)
--
-- Trasferimento credito atomico reseller -> sub-user.
-- Debita il reseller e accredita il sub-user in una singola transazione SQL.
-- Lock deterministico (min UUID first) per evitare deadlock.
-- Idempotency tramite UNIQUE constraint su wallet_transactions.idempotency_key.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reseller_transfer_credit(
  p_reseller_id UUID,
  p_sub_user_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT DEFAULT 'Trasferimento credito reseller',
  p_idempotency_key TEXT DEFAULT NULL
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
  -- ============================================
  -- VALIDAZIONE INPUT
  -- ============================================
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Importo deve essere positivo. Ricevuto: %', p_amount;
  END IF;

  IF p_amount > 10000.00 THEN
    RAISE EXCEPTION 'Importo supera il massimo consentito (10.000). Ricevuto: %', p_amount;
  END IF;

  IF p_reseller_id = p_sub_user_id THEN
    RAISE EXCEPTION 'Non puoi trasferire credito a te stesso';
  END IF;

  -- ============================================
  -- IDEMPOTENCY CHECK
  -- ============================================
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

  -- ============================================
  -- LOCK DETERMINISTICO (min UUID first per evitare deadlock)
  -- ============================================
  IF p_reseller_id < p_sub_user_id THEN
    v_first_id := p_reseller_id;
    v_second_id := p_sub_user_id;
  ELSE
    v_first_id := p_sub_user_id;
    v_second_id := p_reseller_id;
  END IF;

  -- Lock prima riga
  PERFORM 1 FROM users WHERE id = v_first_id FOR UPDATE NOWAIT;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utente non trovato: %', v_first_id;
  END IF;

  -- Lock seconda riga
  PERFORM 1 FROM users WHERE id = v_second_id FOR UPDATE NOWAIT;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Utente non trovato: %', v_second_id;
  END IF;

  -- ============================================
  -- LEGGI SALDI (dentro il lock)
  -- ============================================
  SELECT wallet_balance, email INTO v_reseller_balance, v_reseller_email
  FROM users WHERE id = p_reseller_id;

  SELECT wallet_balance, email INTO v_sub_user_balance, v_sub_user_email
  FROM users WHERE id = p_sub_user_id;

  -- ============================================
  -- VERIFICA SALDO RESELLER
  -- ============================================
  IF v_reseller_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo reseller insufficiente (%). Disponibile: %, Richiesto: %',
      v_reseller_email, v_reseller_balance, p_amount;
  END IF;

  -- ============================================
  -- UPDATE ATOMICO: Debit reseller + Credit sub-user
  -- ============================================
  UPDATE users
  SET wallet_balance = wallet_balance - p_amount, updated_at = NOW()
  WHERE id = p_reseller_id;

  UPDATE users
  SET wallet_balance = wallet_balance + p_amount, updated_at = NOW()
  WHERE id = p_sub_user_id;

  -- ============================================
  -- INSERT WALLET TRANSACTIONS (2 record)
  -- ============================================

  -- Transazione USCITA reseller
  INSERT INTO wallet_transactions (
    user_id, amount, type, idempotency_key, description, created_by
  ) VALUES (
    p_reseller_id,
    -p_amount,
    'RESELLER_TRANSFER_OUT',
    v_key_out,
    p_description || ' -> ' || COALESCE(v_sub_user_email, p_sub_user_id::TEXT),
    p_reseller_id
  )
  RETURNING id INTO v_tx_out_id;

  -- Transazione ENTRATA sub-user
  INSERT INTO wallet_transactions (
    user_id, amount, type, idempotency_key, description, created_by
  ) VALUES (
    p_sub_user_id,
    p_amount,
    'RESELLER_TRANSFER_IN',
    v_key_in,
    p_description || ' <- ' || COALESCE(v_reseller_email, p_reseller_id::TEXT),
    p_reseller_id
  )
  RETURNING id INTO v_tx_in_id;

  -- ============================================
  -- SUCCESSO
  -- ============================================
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
    -- Idempotency key duplicata (race condition)
    RETURN jsonb_build_object(
      'success', true,
      'idempotent_replay', true,
      'message', 'Trasferimento gia eseguito (concurrent replay)'
    );
  WHEN OTHERS THEN
    RAISE;
END;
$$;

-- Commento funzione
COMMENT ON FUNCTION public.reseller_transfer_credit IS
'Trasferimento atomico credito reseller -> sub-user. Lock deterministico, idempotente.';
