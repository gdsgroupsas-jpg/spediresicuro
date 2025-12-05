-- ============================================
-- SCRIPT: Security Check Rapido
-- ============================================
-- Versione semplificata per controllo veloce
-- ============================================

-- ========== CONTROLLO RAPIDO: TABELLE SENZA RLS ==========
SELECT 
  '❌ RLS NON abilitato' AS stato,
  table_name AS tabella,
  'CRITICO' AS priorita
FROM information_schema.tables t
LEFT JOIN pg_class c ON c.relname = t.table_name
LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND t.table_name NOT IN ('_prisma_migrations', 'schema_migrations')
  AND (c.relrowsecurity IS NULL OR c.relrowsecurity = false)
ORDER BY table_name;

-- ========== CONTROLLO RAPIDO: TABELLE CON RLS MA SENZA POLICY ==========
SELECT 
  '⚠️  RLS senza policy' AS stato,
  t.table_name AS tabella,
  'CRITICO' AS priorita
FROM information_schema.tables t
INNER JOIN pg_class c ON c.relname = t.table_name
INNER JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND t.table_name NOT IN ('_prisma_migrations', 'schema_migrations')
  AND c.relrowsecurity = true
  AND p.policyname IS NULL
ORDER BY table_name;

-- ========== CONTROLLO RAPIDO: TABELLE CRITICHE ==========
SELECT 
  CASE 
    WHEN c.relrowsecurity = true THEN '✅ RLS OK'
    ELSE '❌ RLS MANCANTE'
  END AS rls_stato,
  t.table_name AS tabella,
  COALESCE(policy_count.count, 0) AS num_policy
FROM information_schema.tables t
LEFT JOIN pg_class c ON c.relname = t.table_name
LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
LEFT JOIN (
  SELECT tablename, COUNT(*) as count
  FROM pg_policies
  WHERE schemaname = 'public'
  GROUP BY tablename
) policy_count ON policy_count.tablename = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_type = 'BASE TABLE'
  AND t.table_name IN ('automation_locks', 'admin_actions_log', 'audit_logs', 'shipments', 'users')
ORDER BY t.table_name;

-- ========== CONTROLLO RAPIDO: VISTE ==========
SELECT 
  viewname AS vista,
  CASE 
    WHEN definition ILIKE '%SECURITY DEFINER%' THEN '❌ SECURITY DEFINER'
    ELSE '✅ OK'
  END AS stato
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN ('admin_monthly_stats', 'top_customers', 'god_view_users')
ORDER BY viewname;

-- ========== RIEPILOGO NUMERI ==========
SELECT 
  'Totale tabelle' AS metrica,
  COUNT(*)::text AS valore
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  AND table_name NOT IN ('_prisma_migrations', 'schema_migrations')

UNION ALL

SELECT 
  'Tabelle con RLS' AS metrica,
  COUNT(*)::text AS valore
FROM information_schema.tables t
INNER JOIN pg_class c ON c.relname = t.table_name
INNER JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  AND t.table_name NOT IN ('_prisma_migrations', 'schema_migrations')
  AND c.relrowsecurity = true

UNION ALL

SELECT 
  'Tabelle senza RLS' AS metrica,
  COUNT(*)::text AS valore
FROM information_schema.tables t
LEFT JOIN pg_class c ON c.relname = t.table_name
LEFT JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  AND t.table_name NOT IN ('_prisma_migrations', 'schema_migrations')
  AND (c.relrowsecurity IS NULL OR c.relrowsecurity = false)

UNION ALL

SELECT 
  'Tabelle con RLS ma senza policy' AS metrica,
  COUNT(*)::text AS valore
FROM information_schema.tables t
INNER JOIN pg_class c ON c.relname = t.table_name
INNER JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
LEFT JOIN pg_policies p ON p.schemaname = 'public' AND p.tablename = t.table_name
WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
  AND t.table_name NOT IN ('_prisma_migrations', 'schema_migrations')
  AND c.relrowsecurity = true
  AND p.policyname IS NULL

UNION ALL

SELECT 
  'Policy RLS totali' AS metrica,
  COUNT(*)::text AS valore
FROM pg_policies
WHERE schemaname = 'public';

