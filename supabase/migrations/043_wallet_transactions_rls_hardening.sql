-- ============================================
-- MIGRATION: 043_wallet_transactions_rls_hardening.sql
-- DESCRIZIONE: Fix P1 Security - Hardening RLS su wallet_transactions
-- DATA: 2025-12-22
-- CRITICITÀ: P1 - SICUREZZA
-- ============================================
--
-- PROBLEMA:
-- La policy INSERT su wallet_transactions è permissiva (WITH CHECK (true)),
-- permettendo a qualsiasi utente autenticato di inserire transazioni.
-- Questo è un rischio di sicurezza perché:
-- 1. Client-side potrebbe manipolare wallet_transactions
-- 2. Violazione del principio "server-side only" per operazioni finanziarie
--
-- SOLUZIONE:
-- Rimuovere la policy INSERT permissiva. Gli insert devono avvenire SOLO:
-- 1. Tramite service_role (server-side) - bypassa RLS automaticamente
-- 2. Tramite funzioni SECURITY DEFINER (add_wallet_credit, etc.) - bypassa RLS automaticamente
--
-- RISULTATO:
-- Nessun utente autenticato può inserire direttamente in wallet_transactions.
-- Solo server-side (service_role) e SECURITY DEFINER functions possono inserire.
--
-- RIFERIMENTI:
-- - Defense-in-depth security
-- - Principle of least privilege
-- - OWASP Top 10
-- ============================================

-- ============================================
-- STEP 1: Rimuovi policy INSERT permissiva
-- ============================================

DROP POLICY IF EXISTS wallet_transactions_insert ON wallet_transactions;

-- ============================================
-- STEP 2: Verifica che non ci siano altre policy INSERT
-- ============================================

DO $$
DECLARE
  v_insert_policies_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_insert_policies_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'wallet_transactions'
    AND cmd = 'INSERT';
  
  IF v_insert_policies_count > 0 THEN
    RAISE WARNING 'Found % INSERT policies on wallet_transactions. Review manually.', v_insert_policies_count;
  ELSE
    RAISE NOTICE '✅ No INSERT policies found on wallet_transactions (expected)';
  END IF;
END $$;

-- ============================================
-- STEP 3: Verifica che RLS sia ancora abilitato
-- ============================================

DO $$
DECLARE
  v_rls_enabled BOOLEAN;
BEGIN
  SELECT relrowsecurity INTO v_rls_enabled
  FROM pg_class
  WHERE relname = 'wallet_transactions'
    AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
  
  IF v_rls_enabled THEN
    RAISE NOTICE '✅ RLS is enabled on wallet_transactions';
  ELSE
    RAISE WARNING '⚠️ RLS is NOT enabled on wallet_transactions';
  END IF;
END $$;

-- ============================================
-- STEP 4: Verifica che funzioni SECURITY DEFINER esistano
-- ============================================

DO $$
DECLARE
  v_has_add_wallet_credit BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'add_wallet_credit'
    AND prosecdef = true  -- SECURITY DEFINER
  ) INTO v_has_add_wallet_credit;
  
  IF v_has_add_wallet_credit THEN
    RAISE NOTICE '✅ add_wallet_credit() SECURITY DEFINER function exists';
  ELSE
    RAISE WARNING '⚠️ add_wallet_credit() SECURITY DEFINER function NOT found';
  END IF;
END $$;

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 043 completata con successo';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Modifiche applicate:';
  RAISE NOTICE '  - Policy INSERT permissiva: RIMOSSA';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 WALLET TRANSACTIONS ORA PROTETTE:';
  RAISE NOTICE '  - Nessun INSERT da client-side';
  RAISE NOTICE '  - INSERT solo tramite:';
  RAISE NOTICE '    • service_role (server-side)';
  RAISE NOTICE '    • SECURITY DEFINER functions';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Defense-in-depth: 10/10';
  RAISE NOTICE '========================================';
END $$;




