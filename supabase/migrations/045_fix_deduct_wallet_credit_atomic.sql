-- ============================================
-- MIGRATION: 045_fix_deduct_wallet_credit_atomic.sql
-- DESCRIZIONE: Fix P0 - deduct_wallet_credit atomica
-- DATA: 2025-12-23
-- CRITICITÀ: P0 - SICUREZZA FINANZIARIA
-- AUDIT: WALLET_AUDIT_REPORT.md - Finding #1
-- ============================================
--
-- PROBLEMA RISOLTO:
-- La funzione deduct_wallet_credit() originale (migration 019) aveva:
-- 1. Race condition: SELECT senza FOR UPDATE lock
-- 2. Si affidava al trigger trigger_update_wallet_balance
--    (rimosso in migration 041)
-- 
-- RISULTATO PRE-FIX:
-- - Il check balance poteva passare per 2 richieste concorrenti
-- - Dopo migration 041, wallet_balance NON veniva più aggiornato
-- - wallet_transactions veniva creata ma saldo invariato
--
-- SOLUZIONE:
-- Riscrivere deduct_wallet_credit() per usare decrement_wallet_balance()
-- che è atomica (FOR UPDATE NOWAIT) e aggiorna wallet_balance direttamente.
--
-- ============================================

-- ============================================
-- STEP 1: Verifica che decrement_wallet_balance esista
-- ============================================

DO $$
DECLARE
  v_has_decrement BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'decrement_wallet_balance'
  ) INTO v_has_decrement;
  
  IF NOT v_has_decrement THEN
    RAISE EXCEPTION 'CRITICAL: decrement_wallet_balance() not found. Run migration 040 first.';
  END IF;
  
  RAISE NOTICE '✅ Prerequisite verified: decrement_wallet_balance() exists';
END $$;

-- ============================================
-- STEP 2: Sostituisci deduct_wallet_credit con versione atomica
-- ============================================

CREATE OR REPLACE FUNCTION deduct_wallet_credit(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
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
  -- 1. DECREMENTO ATOMICO (con lock pessimistico)
  -- ============================================
  -- Usa decrement_wallet_balance() che:
  -- - Acquisisce FOR UPDATE NOWAIT lock
  -- - Verifica saldo sufficiente DENTRO il lock
  -- - Aggiorna wallet_balance atomicamente
  -- - Lancia eccezione se fallisce (no silent failure)
  
  PERFORM decrement_wallet_balance(p_user_id, p_amount);
  
  -- ============================================
  -- 2. CREA RECORD TRANSAZIONE (audit trail)
  -- ============================================
  -- Solo se decrement_wallet_balance() ha successo
  -- (altrimenti l'eccezione ferma l'esecuzione)
  
  INSERT INTO wallet_transactions (
    user_id,
    amount,
    type,
    description,
    reference_id,
    reference_type
  ) VALUES (
    p_user_id,
    -p_amount, -- Negativo per indicare deduzione
    p_type,
    COALESCE(p_description, 'Deduzione credito'),
    p_reference_id,
    p_reference_type
  ) RETURNING id INTO v_transaction_id;
  
  -- SUCCESS: Ritorna ID transazione
  RETURN v_transaction_id;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Propaga qualsiasi errore (da decrement_wallet_balance o INSERT)
    RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Imposta search_path per sicurezza (CVE mitigation)
ALTER FUNCTION deduct_wallet_credit(
  UUID,
  DECIMAL(10,2),
  TEXT,
  TEXT,
  UUID,
  TEXT
) SET search_path = public, pg_temp;

COMMENT ON FUNCTION deduct_wallet_credit IS 
'ATOMIC wallet debit with transaction logging.

GUARANTEES:
- No race conditions (uses decrement_wallet_balance with FOR UPDATE NOWAIT)
- No negative balance (check inside lock)
- Transaction record created only on success
- Fail-fast on any error

USAGE:
  SELECT deduct_wallet_credit(
    ''user-uuid'',
    10.00,
    ''shipment_cost'',
    ''Shipment #12345'',
    ''shipment-uuid'',
    ''shipment''
  );

ERRORS:
- Insufficient balance: raises exception with details
- Lock contention: raises exception (retry recommended)
- User not found: raises exception

FIX HISTORY:
- 2025-12-23: Rewritten to use decrement_wallet_balance() (atomic)
- Previous version had race condition and relied on removed trigger';

-- ============================================
-- STEP 3: Verifica integrità funzione
-- ============================================

DO $$
DECLARE
  v_prosrc TEXT;
  v_uses_atomic BOOLEAN;
BEGIN
  -- Verifica che la nuova funzione usi decrement_wallet_balance
  SELECT prosrc INTO v_prosrc
  FROM pg_proc
  WHERE proname = 'deduct_wallet_credit';
  
  v_uses_atomic := v_prosrc LIKE '%decrement_wallet_balance%';
  
  IF NOT v_uses_atomic THEN
    RAISE EXCEPTION 'CRITICAL: deduct_wallet_credit() does not use decrement_wallet_balance(). Migration failed.';
  END IF;
  
  RAISE NOTICE '✅ Verified: deduct_wallet_credit() now uses atomic decrement_wallet_balance()';
END $$;

-- ============================================
-- STEP 4: Log di completamento
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 045 completata con successo';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Funzione aggiornata:';
  RAISE NOTICE '  - deduct_wallet_credit() [ATOMIC]';
  RAISE NOTICE '';
  RAISE NOTICE 'Modifiche:';
  RAISE NOTICE '  - Ora usa decrement_wallet_balance() interno';
  RAISE NOTICE '  - Lock pessimistico (FOR UPDATE NOWAIT)';
  RAISE NOTICE '  - Check balance dentro lock (no TOCTOU)';
  RAISE NOTICE '  - search_path impostato per sicurezza';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 RACE CONDITION ELIMINATA';
  RAISE NOTICE '🔒 TRIGGER DEPENDENCY RIMOSSA';
  RAISE NOTICE '========================================';
END $$;

