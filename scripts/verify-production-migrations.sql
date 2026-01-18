-- =====================================================
-- Script: verify-production-migrations.sql
-- Descrizione: Verifica quali migration sono state applicate in production
-- Data: 2026-01-18
-- =====================================================

-- ⚠️ ESEGUIRE SU PRODUCTION DATABASE
-- psql -h <supabase-host> -U postgres.<project-ref> -d postgres -f scripts/verify-production-migrations.sql

\echo '==================================================='
\echo 'MIGRATION VERIFICATION REPORT'
\echo 'Database: ' :DBNAME
\echo 'User: ' :USER
\echo 'Date: ' :DATE
\echo '==================================================='
\echo ''

-- 1. Controlla quali migration 110-112 sono state applicate
\echo '1. MIGRATION 110-112 STATUS'
\echo '---------------------------------------------------'
SELECT
  version,
  TO_CHAR(inserted_at, 'YYYY-MM-DD HH24:MI:SS') AS applied_at
FROM supabase_migrations.schema_migrations
WHERE version LIKE '110%' OR version LIKE '111%' OR version LIKE '112%'
ORDER BY version, inserted_at;

\echo ''
\echo '2. LAST 10 APPLIED MIGRATIONS'
\echo '---------------------------------------------------'
SELECT
  version,
  TO_CHAR(inserted_at, 'YYYY-MM-DD HH24:MI:SS') AS applied_at
FROM supabase_migrations.schema_migrations
ORDER BY inserted_at DESC
LIMIT 10;

\echo ''
\echo '3. MIGRATION 110a - VAT SEMANTICS (Schema Check)'
\echo '---------------------------------------------------'
\echo 'Expected columns: vat_mode, vat_included in price_lists'
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'price_lists'
  AND column_name IN ('vat_mode', 'vat_included')
ORDER BY ordinal_position;

\echo ''
\echo '4. MIGRATION 110b - ADMIN OVERVIEW STATS (Function Check)'
\echo '---------------------------------------------------'
\echo 'Expected function: get_admin_overview_stats()'
SELECT
  proname AS function_name,
  pg_get_function_arguments(p.oid) AS arguments,
  pg_get_function_result(p.oid) AS return_type,
  prosecdef AS is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND proname LIKE '%admin_overview%'
ORDER BY proname;

\echo ''
\echo '5. MIGRATION 110c - INVOICE XML (Table Check)'
\echo '---------------------------------------------------'
\echo 'Expected: invoice_xml column in invoices table'
SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'invoices'
  AND column_name LIKE '%xml%'
ORDER BY column_name;

\echo ''
\echo '6. MIGRATION 111a - VAT MODE MIGRATION (Data Check)'
\echo '---------------------------------------------------'
\echo 'Expected: vat_mode populated in price_lists'
SELECT
  vat_mode,
  COUNT(*) AS count
FROM price_lists
GROUP BY vat_mode
ORDER BY vat_mode;

\echo ''
\echo '7. MIGRATION 112 - RESELLER PRICING POLICIES (Table Check)'
\echo '---------------------------------------------------'
\echo 'Expected: reseller_pricing_policies table exists'
SELECT
  table_name,
  (SELECT COUNT(*) FROM reseller_pricing_policies) AS row_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'reseller_pricing_policies';

\echo ''
\echo '8. DUPLICATE MIGRATION RISK ANALYSIS'
\echo '---------------------------------------------------'
\echo 'Checking if multiple versions of same migration were applied'
SELECT
  SUBSTRING(version FROM 1 FOR 3) AS migration_number,
  COUNT(*) AS times_applied,
  STRING_AGG(version, ', ' ORDER BY version) AS versions
FROM supabase_migrations.schema_migrations
WHERE version ~ '^[0-9]{3}_'
GROUP BY SUBSTRING(version FROM 1 FOR 3)
HAVING COUNT(*) > 1
ORDER BY migration_number DESC
LIMIT 10;

\echo ''
\echo '==================================================='
\echo 'END OF REPORT'
\echo '==================================================='
\echo ''
\echo 'INTERPRETATION GUIDE:'
\echo '- Section 1: Shows which 110-112 migrations were applied'
\echo '- Section 3-7: Verify schema changes from each migration'
\echo '- Section 8: Identifies if duplicate migrations were applied'
\echo ''
\echo 'NEXT STEPS:'
\echo '1. If Section 1 shows multiple 110_* versions → CONFLICT DETECTED'
\echo '2. If Sections 3-7 show missing schema → Migration NOT applied correctly'
\echo '3. If Section 8 shows results → Duplicate migrations applied (BAD)'
\echo ''
