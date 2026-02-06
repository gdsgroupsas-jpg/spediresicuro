-- ============================================
-- MIGRATION: 20260206100000_wallet_refund_function.sql
-- DESCRIZIONE: Funzione dedicata per rimborsi wallet con tipo SHIPMENT_REFUND
-- DATA: 2026-02-06
-- CRITICITA: P0 - Tracciabilita contabile completa
-- ============================================
--
-- PROBLEMA:
-- increment_wallet_balance() registra i rimborsi come type='DEPOSIT'.
-- Questo rende impossibile distinguere ricariche da rimborsi nello storico.
-- Per trasparenza verso il cliente e audit contabile, serve un tipo dedicato.
--
-- SOLUZIONE:
-- 1. Nuova funzione refund_wallet_balance() con tipo SHIPMENT_REFUND
-- 2. Registra reference_id (shipment_id) e reference_type per tracciabilita
-- 3. Idempotenza via idempotency_key (stessa garanzia di decrement)
-- 4. Descrizione automatica con dettagli rimborso
--
-- ============================================

-- ============================================
-- STEP 1: Nuova funzione refund_wallet_balance
-- ============================================

DROP FUNCTION IF EXISTS refund_wallet_balance(UUID, DECIMAL, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION refund_wallet_balance(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_idempotency_key TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_shipment_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_current_balance DECIMAL(10,2);
  v_existing_transaction_id UUID;
  v_new_transaction_id UUID;
BEGIN
  -- ============================================
  -- IDEMPOTENCY CHECK
  -- ============================================
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_transaction_id
    FROM wallet_transactions
    WHERE idempotency_key = p_idempotency_key
      AND type = 'SHIPMENT_REFUND'
      AND user_id = p_user_id
    LIMIT 1;

    IF FOUND THEN
      RAISE NOTICE 'Idempotent replay: refund already executed for key %. Transaction ID: %',
        p_idempotency_key, v_existing_transaction_id;

      RETURN jsonb_build_object(
        'success', true,
        'idempotent_replay', true,
        'transaction_id', v_existing_transaction_id,
        'message', 'Refund already executed (idempotent replay)'
      );
    END IF;
  END IF;

  -- ============================================
  -- VALIDAZIONE
  -- ============================================
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Refund amount must be positive. Received: %', p_amount;
  END IF;

  IF p_amount > 100000.00 THEN
    RAISE EXCEPTION 'Refund amount exceeds maximum allowed. Received: %', p_amount;
  END IF;

  -- ============================================
  -- LOCK PESSIMISTICO
  -- ============================================
  SELECT wallet_balance INTO v_current_balance
  FROM users
  WHERE id = p_user_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found: %', p_user_id;
  END IF;

  -- ============================================
  -- UPDATE ATOMICO: Incrementa saldo
  -- ============================================
  UPDATE users
  SET
    wallet_balance = wallet_balance + p_amount,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- ============================================
  -- INSERT TRANSACTION con tipo SHIPMENT_REFUND
  -- ============================================
  INSERT INTO wallet_transactions (
    user_id,
    amount,
    type,
    idempotency_key,
    description,
    reference_id,
    reference_type
  ) VALUES (
    p_user_id,
    p_amount,  -- Positivo: e un accredito
    'SHIPMENT_REFUND',
    p_idempotency_key,
    COALESCE(p_description, 'Rimborso cancellazione spedizione'),
    p_shipment_id::TEXT,
    CASE WHEN p_shipment_id IS NOT NULL THEN 'shipment_cancellation' ELSE NULL END
  )
  RETURNING id INTO v_new_transaction_id;

  -- ============================================
  -- SUCCESS
  -- ============================================
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
'ATOMIC + IDEMPOTENT wallet refund per cancellazione spedizioni.

Crea transazione con tipo SHIPMENT_REFUND (non DEPOSIT) per:
- Trasparenza storico movimenti cliente
- Audit contabile (distingue ricariche da rimborsi)
- Reference tracking (shipment_id collegato)

RETURNS JSONB (stesso formato di increment/decrement):
{
  "success": true,
  "idempotent_replay": false,
  "transaction_id": "uuid",
  "previous_balance": 92.00,
  "new_balance": 100.00,
  "amount_refunded": 8.00
}';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Migration 20260206100000 completata';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Nuova funzione: refund_wallet_balance()';
  RAISE NOTICE '  - Tipo: SHIPMENT_REFUND';
  RAISE NOTICE '  - Idempotenza: via idempotency_key';
  RAISE NOTICE '  - Reference: shipment_id collegato';
  RAISE NOTICE '========================================';
END $$;
