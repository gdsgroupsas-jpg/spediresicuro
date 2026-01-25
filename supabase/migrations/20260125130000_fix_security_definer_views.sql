-- =====================================================
-- Migration: Fix Security Definer Views
-- Created: 2026-01-25
-- Description: Remove SECURITY DEFINER from views to
--              properly enforce RLS policies
-- =====================================================

-- The linter flagged these views as using SECURITY DEFINER,
-- which bypasses RLS and uses creator permissions instead
-- of the querying user's permissions.
--
-- Fix: Recreate views with SECURITY INVOKER using dynamic SQL
-- This approach extracts the current view definition and recreates it

-- Helper function to recreate views with security_invoker
CREATE OR REPLACE FUNCTION fix_view_security_definer(view_name TEXT)
RETURNS VOID AS $$
DECLARE
  view_def TEXT;
BEGIN
  -- Check if view exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_views
    WHERE viewname = view_name AND schemaname = 'public'
  ) THEN
    RAISE NOTICE 'View % does not exist, skipping', view_name;
    RETURN;
  END IF;

  -- Get current view definition
  SELECT pg_get_viewdef(('public.' || view_name)::regclass, true)
  INTO view_def;

  IF view_def IS NULL THEN
    RAISE NOTICE 'Could not get definition for view %, skipping', view_name;
    RETURN;
  END IF;

  -- Drop and recreate with security_invoker = true
  EXECUTE format('DROP VIEW IF EXISTS public.%I CASCADE', view_name);
  EXECUTE format(
    'CREATE VIEW public.%I WITH (security_invoker = true) AS %s',
    view_name,
    view_def
  );

  RAISE NOTICE 'Fixed: % - recreated with security_invoker', view_name;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Could not fix %: %', view_name, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Fix all flagged views
SELECT fix_view_security_definer('audit_logs_summary');
SELECT fix_view_security_definer('v_platform_monthly_pnl');
SELECT fix_view_security_definer('v_platform_daily_pnl');
SELECT fix_view_security_definer('v_reseller_monthly_platform_usage');
SELECT fix_view_security_definer('v_reconciliation_pending');
SELECT fix_view_security_definer('v_platform_margin_alerts');

-- Clean up helper function
DROP FUNCTION IF EXISTS fix_view_security_definer(TEXT);

-- =====================================================
-- Verification query (run manually to confirm)
-- =====================================================
-- SELECT
--   viewname,
--   pg_get_viewdef(viewname::regclass, true) as definition,
--   CASE
--     WHEN viewname::regclass::oid IN (
--       SELECT c.oid FROM pg_class c
--       JOIN pg_reloptions_to_table(c.reloptions) r ON true
--       WHERE r.option_name = 'security_invoker' AND r.option_value = 'true'
--     ) THEN 'INVOKER'
--     ELSE 'DEFINER'
--   END as security_context
-- FROM pg_views
-- WHERE schemaname = 'public'
--   AND viewname IN (
--     'audit_logs_summary',
--     'v_platform_monthly_pnl',
--     'v_platform_daily_pnl',
--     'v_reseller_monthly_platform_usage',
--     'v_reconciliation_pending',
--     'v_platform_margin_alerts'
--   );
