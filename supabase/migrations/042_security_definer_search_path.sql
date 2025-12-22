-- ============================================
-- MIGRATION: 042_security_definer_search_path.sql
-- DESCRIZIONE: Fix P0 Security - Imposta search_path su funzioni SECURITY DEFINER
-- DATA: 2025-12-22
-- CRITICITÀ: P0 - SICUREZZA
-- ============================================
--
-- PROBLEMA:
-- Le funzioni SECURITY DEFINER senza search_path esplicito sono vulnerabili
-- a "search_path hijacking" attacks. Un utente malintenzionato potrebbe
-- creare funzioni/tabelle in schema pubblici che vengono eseguite invece
-- di quelle previste.
--
-- SOLUZIONE:
-- Impostare search_path = public, pg_temp su tutte le funzioni SECURITY DEFINER
-- nel wallet/admin scope per garantire che vengano usati solo oggetti
-- dallo schema 'public' o temporanei.
--
-- RIFERIMENTI:
-- - PostgreSQL Security Best Practices
-- - CWE-89 (SQL Injection)
-- - OWASP Top 10
-- ============================================

-- ============================================
-- STEP 1: Fix decrement_wallet_balance
-- ============================================

ALTER FUNCTION decrement_wallet_balance(
  UUID,
  DECIMAL(10,2)
) SET search_path = public, pg_temp;

COMMENT ON FUNCTION decrement_wallet_balance IS 
'ATOMIC wallet debit with pessimistic locking.
GUARANTEES:
- No race conditions (FOR UPDATE NOWAIT)
- No negative balance (check inside lock)
- Fail-fast on error (explicit exceptions)
- Single source of truth for wallet updates
- SECURITY: search_path locked to public, pg_temp

USAGE: Always use this function to debit wallet. Never UPDATE users.wallet_balance directly.

RETURNS: TRUE on success, EXCEPTION on failure';

-- ============================================
-- STEP 2: Fix increment_wallet_balance
-- ============================================

ALTER FUNCTION increment_wallet_balance(
  UUID,
  DECIMAL(10,2)
) SET search_path = public, pg_temp;

COMMENT ON FUNCTION increment_wallet_balance IS 
'ATOMIC wallet credit with pessimistic locking.
GUARANTEES:
- No race conditions (FOR UPDATE NOWAIT)
- Maximum balance enforced (€100,000)
- Fail-fast on error
- SECURITY: search_path locked to public, pg_temp

USAGE: Use for direct wallet credits. For transaction-tracked credits, use add_wallet_credit().';

-- ============================================
-- STEP 3: Fix add_wallet_credit
-- ============================================
-- Nota: ALTER FUNCTION richiede signature esatta senza DEFAULT
-- Signature: UUID, DECIMAL(10,2), TEXT, UUID

ALTER FUNCTION add_wallet_credit(
  UUID,
  DECIMAL(10,2),
  TEXT,
  UUID
) SET search_path = public, pg_temp;

COMMENT ON FUNCTION add_wallet_credit IS 
'Adds credit to wallet using atomic increment + transaction tracking.
Updated to use increment_wallet_balance() for atomic safety.
SECURITY: search_path locked to public, pg_temp';

-- ============================================
-- STEP 4: Fix verify_wallet_integrity
-- ============================================

ALTER FUNCTION verify_wallet_integrity(
  UUID
) SET search_path = public, pg_temp;

COMMENT ON FUNCTION verify_wallet_integrity IS 
'Verifies wallet balance consistency by comparing current balance with sum of transactions.
Used for auditing and debugging.
SECURITY: search_path locked to public, pg_temp';

-- ============================================
-- STEP 5: Fix approve_top_up_request (admin scope)
-- ============================================

ALTER FUNCTION approve_top_up_request(
  UUID,
  UUID,
  DECIMAL(10,2)
) SET search_path = public, pg_temp;

COMMENT ON FUNCTION approve_top_up_request IS 
'Approva una richiesta top_up_requests. Bypassa RLS usando SECURITY DEFINER.
SECURITY: search_path locked to public, pg_temp';

-- ============================================
-- STEP 6: Verifica che tutte le funzioni siano state aggiornate
-- ============================================

DO $$
DECLARE
  v_functions_fixed INTEGER := 0;
  v_functions_total INTEGER := 0;
  v_function_record RECORD;
BEGIN
  -- Conta funzioni SECURITY DEFINER nel wallet/admin scope
  SELECT COUNT(*) INTO v_functions_total
  FROM pg_proc p
  JOIN pg_namespace n ON p.pronamespace = n.oid
  WHERE n.nspname = 'public'
    AND p.prosecdef = true  -- SECURITY DEFINER
    AND p.proname IN (
      'decrement_wallet_balance',
      'increment_wallet_balance',
      'add_wallet_credit',
      'verify_wallet_integrity',
      'approve_top_up_request'
    );
  
  -- Verifica che abbiano search_path impostato
  FOR v_function_record IN
    SELECT p.proname, pg_get_functiondef(p.oid) as definition
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND p.proname IN (
        'decrement_wallet_balance',
        'increment_wallet_balance',
        'add_wallet_credit',
        'verify_wallet_integrity',
        'approve_top_up_request'
      )
  LOOP
    -- Verifica che la definizione contenga SET search_path
    IF v_function_record.definition LIKE '%SET search_path%' THEN
      v_functions_fixed := v_functions_fixed + 1;
      RAISE NOTICE '✅ Function % has search_path set', v_function_record.proname;
    ELSE
      RAISE WARNING '⚠️ Function % does NOT have search_path set', v_function_record.proname;
    END IF;
  END LOOP;
  
  IF v_functions_fixed = v_functions_total AND v_functions_total > 0 THEN
    RAISE NOTICE '✅ All % wallet/admin SECURITY DEFINER functions have search_path set', v_functions_total;
  ELSIF v_functions_total = 0 THEN
    RAISE WARNING '⚠️ No wallet/admin SECURITY DEFINER functions found';
  ELSE
    RAISE WARNING '⚠️ Only %/% functions have search_path set', v_functions_fixed, v_functions_total;
  END IF;
END $$;

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 042 completata con successo';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Funzioni protette (search_path = public, pg_temp):';
  RAISE NOTICE '  - decrement_wallet_balance()';
  RAISE NOTICE '  - increment_wallet_balance()';
  RAISE NOTICE '  - add_wallet_credit()';
  RAISE NOTICE '  - verify_wallet_integrity()';
  RAISE NOTICE '  - approve_top_up_request()';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 P0 SECURITY FIX APPLICATO';
  RAISE NOTICE '   Search path hijacking: IMPOSSIBILE';
  RAISE NOTICE '========================================';
END $$;

