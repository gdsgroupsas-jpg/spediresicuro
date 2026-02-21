-- =====================================================
-- Migration: Fix Function Search Path
-- Created: 2026-01-25
-- Description: Set search_path on all functions to prevent
--              potential security issues with mutable search_path
-- =====================================================

-- The linter flagged these functions as having mutable search_path.
-- Without an explicit search_path, a function could potentially
-- invoke malicious objects placed in the search path.
--
-- Fix: Dynamically alter all public functions to set search_path

DO $$
DECLARE
  func_record RECORD;
  alter_sql TEXT;
BEGIN
  -- Loop through all functions in public schema that don't have search_path set
  FOR func_record IN
    SELECT
      p.proname as func_name,
      pg_get_function_identity_arguments(p.oid) as func_args,
      p.oid
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'  -- Only functions, not procedures
      AND (p.proconfig IS NULL
           OR NOT EXISTS (
             SELECT 1 FROM unnest(p.proconfig) c
             WHERE c LIKE 'search_path=%'
           ))
  LOOP
    BEGIN
      -- Build and execute ALTER statement
      IF func_record.func_args = '' THEN
        alter_sql := format(
          'ALTER FUNCTION public.%I() SET search_path = public',
          func_record.func_name
        );
      ELSE
        alter_sql := format(
          'ALTER FUNCTION public.%I(%s) SET search_path = public',
          func_record.func_name,
          func_record.func_args
        );
      END IF;

      EXECUTE alter_sql;
      RAISE NOTICE 'Fixed: %.%(%)', 'public', func_record.func_name, func_record.func_args;

    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not fix %.%(%): %', 'public', func_record.func_name, func_record.func_args, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Completed fixing function search_path';
END;
$$;

-- =====================================================
-- Verification: Run this query to check remaining issues
-- =====================================================
-- SELECT
--   n.nspname as schema,
--   p.proname as function_name,
--   pg_get_function_identity_arguments(p.oid) as args,
--   CASE
--     WHEN EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
--     THEN 'FIXED'
--     ELSE 'MUTABLE'
--   END as search_path_status
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
--   AND p.prokind = 'f'
-- ORDER BY p.proname;
