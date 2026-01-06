-- ============================================
-- VERIFICA POST-MIGRATION 042
-- Search Path Security per Funzioni SECURITY DEFINER
-- ============================================
--
-- Questo script verifica che tutte le funzioni SECURITY DEFINER
-- nel wallet/admin scope abbiano search_path impostato correttamente.
--
-- Eseguire dopo migration 042_security_definer_search_path.sql
-- ============================================

-- ============================================
-- QUERY 1: Lista funzioni SECURITY DEFINER senza search_path
-- ============================================

SELECT 
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN '✅ SET'
    ELSE '❌ MISSING'
  END AS search_path_status,
  pg_get_functiondef(p.oid) AS full_definition
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
  )
ORDER BY p.proname;

-- ============================================
-- QUERY 2: Verifica dettagliata search_path
-- ============================================

SELECT 
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path = public, pg_temp%' THEN '✅ CORRECT'
    WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN '⚠️ SET (verify value)'
    ELSE '❌ NOT SET'
  END AS search_path_status,
  -- Estrai search_path dalla definizione
  CASE 
    WHEN pg_get_functiondef(p.oid) ~ 'SET search_path\s*=\s*([^;]+)' THEN
      substring(pg_get_functiondef(p.oid) from 'SET search_path\s*=\s*([^;]+)')
    ELSE NULL
  END AS search_path_value
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
ORDER BY p.proname;

-- ============================================
-- QUERY 3: Riepilogo sicurezza
-- ============================================

SELECT 
  COUNT(*) AS total_security_definer_functions,
  COUNT(CASE WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN 1 END) AS functions_with_search_path,
  COUNT(CASE WHEN pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%' THEN 1 END) AS functions_without_search_path,
  CASE 
    WHEN COUNT(CASE WHEN pg_get_functiondef(p.oid) NOT LIKE '%SET search_path%' THEN 1 END) = 0 THEN '✅ ALL SECURE'
    ELSE '❌ VULNERABLE FUNCTIONS FOUND'
  END AS security_status
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
  );

-- ============================================
-- QUERY 4: Verifica namespace (schema) delle funzioni
-- ============================================

SELECT 
  p.proname AS function_name,
  n.nspname AS schema_name,
  CASE 
    WHEN n.nspname = 'public' THEN '✅ CORRECT'
    ELSE '⚠️ UNEXPECTED SCHEMA'
  END AS schema_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosecdef = true
  AND p.proname IN (
    'decrement_wallet_balance',
    'increment_wallet_balance',
    'add_wallet_credit',
    'verify_wallet_integrity',
    'approve_top_up_request'
  )
ORDER BY n.nspname, p.proname;

-- ============================================
-- QUERY 5: Lista completa funzioni SECURITY DEFINER (tutte, non solo wallet)
-- ============================================
-- Utile per audit completo del sistema

SELECT 
  n.nspname AS schema_name,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS arguments,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%SET search_path%' THEN '✅ SET'
    ELSE '❌ MISSING'
  END AS search_path_status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.prosecdef = true  -- SECURITY DEFINER
  AND n.nspname = 'public'  -- Solo schema public
ORDER BY n.nspname, p.proname;







