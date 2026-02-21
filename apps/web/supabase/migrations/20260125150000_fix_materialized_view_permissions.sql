-- =====================================================
-- Migration: Fix Materialized View Permissions
-- Created: 2026-01-25
-- Description: Restrict access to compensation_queue_stats
--              materialized view (contains financial data)
-- =====================================================

-- The linter flagged this materialized view as accessible
-- to anon and authenticated roles. This is a privacy issue
-- as it contains compensation/financial data.

-- Revoke access from public-facing roles
REVOKE ALL ON public.compensation_queue_stats FROM anon;
REVOKE ALL ON public.compensation_queue_stats FROM authenticated;

-- Grant access only to service_role (for admin operations)
GRANT SELECT ON public.compensation_queue_stats TO service_role;

-- Add comment for documentation
COMMENT ON MATERIALIZED VIEW public.compensation_queue_stats IS
  'Aggregated compensation queue statistics. Access restricted to service_role for admin dashboards only.';

-- =====================================================
-- Note: Leaked Password Protection
-- =====================================================
-- The linter also flagged that leaked password protection
-- is disabled. This must be enabled in the Supabase Dashboard:
--
-- 1. Go to: Authentication → Settings → Password Security
-- 2. Enable: "Check passwords against HaveIBeenPwned"
--
-- This cannot be set via migrations, only via dashboard.
-- =====================================================
