-- ============================================
-- VERIFICA POST-MIGRATION 043
-- RLS Hardening su wallet_transactions
-- ============================================
--
-- Questo script verifica che:
-- 1. Non ci siano policy INSERT permissive su wallet_transactions
-- 2. RLS sia abilitato
-- 3. Solo service_role e SECURITY DEFINER functions possano inserire
--
-- Eseguire dopo migration 043_wallet_transactions_rls_hardening.sql
-- ============================================

-- ============================================
-- QUERY 1: Lista tutte le policies su wallet_transactions
-- ============================================

SELECT 
  schemaname,
  tablename,
  policyname,
  cmd AS operation,
  qual AS using_expression,
  with_check AS with_check_expression,
  CASE 
    WHEN cmd = 'INSERT' AND with_check = 'true' THEN '❌ PERMISSIVE'
    WHEN cmd = 'INSERT' THEN '⚠️ REVIEW'
    ELSE '✅ OK'
  END AS security_status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'wallet_transactions'
ORDER BY cmd, policyname;

-- ============================================
-- QUERY 2: Verifica RLS abilitato
-- ============================================

SELECT 
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  CASE 
    WHEN relrowsecurity THEN '✅ RLS ENABLED'
    ELSE '❌ RLS DISABLED'
  END AS status
FROM pg_class
WHERE relname = 'wallet_transactions'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- ============================================
-- QUERY 3: Conta policy INSERT (dovrebbe essere 0)
-- ============================================

SELECT 
  COUNT(*) AS insert_policies_count,
  CASE 
    WHEN COUNT(*) = 0 THEN '✅ NO INSERT POLICIES (SECURE)'
    ELSE '❌ INSERT POLICIES FOUND (VULNERABLE)'
  END AS security_status
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'wallet_transactions'
  AND cmd = 'INSERT';

-- ============================================
-- QUERY 4: Verifica funzioni SECURITY DEFINER che inseriscono in wallet_transactions
-- ============================================

SELECT 
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%INSERT INTO wallet_transactions%' THEN '✅ INSERTS'
    ELSE '⚠️ NO INSERT'
  END AS inserts_wallet_transactions,
  CASE 
    WHEN p.prosecdef THEN '✅ SECURITY DEFINER'
    ELSE '❌ SECURITY INVOKER'
  END AS security_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.proname IN (
    'add_wallet_credit',
    'decrement_wallet_balance',
    'increment_wallet_balance'
  )
ORDER BY p.proname;

-- ============================================
-- QUERY 5: Riepilogo sicurezza completo
-- ============================================

SELECT 
  'wallet_transactions' AS table_name,
  (SELECT relrowsecurity FROM pg_class WHERE relname = 'wallet_transactions' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wallet_transactions' AND cmd = 'INSERT') AS insert_policies_count,
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wallet_transactions' AND cmd = 'SELECT') AS select_policies_count,
  CASE 
    WHEN (SELECT relrowsecurity FROM pg_class WHERE relname = 'wallet_transactions' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
      AND (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wallet_transactions' AND cmd = 'INSERT') = 0
    THEN '✅ SECURE'
    ELSE '❌ VULNERABLE'
  END AS overall_security_status;

-- ============================================
-- QUERY 6: Verifica che service_role possa ancora inserire (test concettuale)
-- ============================================
-- Nota: Questa query non può testare direttamente service_role,
-- ma verifica che non ci siano policy che bloccherebbero service_role

SELECT 
  'Service Role Insert Test' AS test_name,
  CASE 
    WHEN (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public' AND tablename = 'wallet_transactions' AND cmd = 'INSERT') = 0
    THEN '✅ NO INSERT POLICIES - Service role bypasses RLS automatically'
    ELSE '⚠️ INSERT POLICIES EXIST - May affect service_role'
  END AS service_role_status,
  'Service role (supabaseAdmin) bypasses RLS when no policies exist' AS note;





