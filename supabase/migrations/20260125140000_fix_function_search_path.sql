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
-- Fix: ALTER FUNCTION to SET search_path = public

-- Helper function to safely set search_path on a function
CREATE OR REPLACE FUNCTION fix_function_search_path(
  func_name TEXT,
  func_args TEXT DEFAULT ''
) RETURNS VOID AS $$
DECLARE
  full_name TEXT;
BEGIN
  IF func_args = '' THEN
    full_name := 'public.' || func_name || '()';
  ELSE
    full_name := 'public.' || func_name || '(' || func_args || ')';
  END IF;

  BEGIN
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', full_name);
    RAISE NOTICE 'Fixed search_path for: %', full_name;
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'Function % does not exist, skipping', full_name;
    WHEN OTHERS THEN
      RAISE WARNING 'Could not fix %: %', full_name, SQLERRM;
  END;
END;
$$ LANGUAGE plpgsql;

-- Fix all flagged functions
-- Note: Using direct ALTER statements for precision with argument types

-- Auth and user functions
ALTER FUNCTION public.check_user_wallet_balance(uuid, numeric) SET search_path = public;
ALTER FUNCTION public.create_user_profile() SET search_path = public;
ALTER FUNCTION public.deduct_user_wallet_balance(uuid, numeric, text, text) SET search_path = public;
ALTER FUNCTION public.get_current_user_id() SET search_path = public;
ALTER FUNCTION public.get_effective_margin_for_reseller(uuid) SET search_path = public;
ALTER FUNCTION public.get_user_organization_id() SET search_path = public;
ALTER FUNCTION public.get_user_role() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- Business logic functions
ALTER FUNCTION public.calculate_platform_cost(numeric, uuid) SET search_path = public;
ALTER FUNCTION public.calculate_reseller_price(numeric, uuid, uuid) SET search_path = public;

-- Shipment functions
ALTER FUNCTION public.check_user_can_create_shipment(uuid) SET search_path = public;
ALTER FUNCTION public.generate_shipment_reference() SET search_path = public;
ALTER FUNCTION public.normalize_tracking_status(text) SET search_path = public;
ALTER FUNCTION public.on_shipment_status_change() SET search_path = public;
ALTER FUNCTION public.process_shipment_delivery(uuid) SET search_path = public;
ALTER FUNCTION public.update_shipment_tracking_status() SET search_path = public;

-- Transaction functions
ALTER FUNCTION public.get_wallet_balance(uuid) SET search_path = public;
ALTER FUNCTION public.process_scheduled_transaction(uuid) SET search_path = public;
ALTER FUNCTION public.process_wallet_transaction(uuid, numeric, text, text, jsonb) SET search_path = public;
ALTER FUNCTION public.schedule_transaction(uuid, numeric, text, text, timestamp with time zone, jsonb) SET search_path = public;

-- Audit functions
ALTER FUNCTION public.audit_sensitive_changes() SET search_path = public;
ALTER FUNCTION public.log_audit_event(text, text, uuid, jsonb, jsonb, text, text, jsonb) SET search_path = public;

-- Organization functions
ALTER FUNCTION public.check_org_has_reseller(uuid) SET search_path = public;
ALTER FUNCTION public.check_org_owner(uuid) SET search_path = public;
ALTER FUNCTION public.create_organization(text, text) SET search_path = public;
ALTER FUNCTION public.invite_user_to_organization(text, text, uuid) SET search_path = public;
ALTER FUNCTION public.is_organization_admin(uuid) SET search_path = public;
ALTER FUNCTION public.is_organization_member(uuid) SET search_path = public;

-- Notification functions
ALTER FUNCTION public.create_notification(uuid, text, text, text, jsonb) SET search_path = public;
ALTER FUNCTION public.mark_notification_read(uuid) SET search_path = public;
ALTER FUNCTION public.send_notification_to_org(uuid, text, text, text, jsonb) SET search_path = public;

-- RLS helper functions
ALTER FUNCTION public.can_access_organization_data(uuid) SET search_path = public;
ALTER FUNCTION public.can_impersonate() SET search_path = public;
ALTER FUNCTION public.check_reseller_access(uuid) SET search_path = public;
ALTER FUNCTION public.is_admin() SET search_path = public;
ALTER FUNCTION public.is_reseller() SET search_path = public;
ALTER FUNCTION public.is_superadmin() SET search_path = public;

-- Timestamp functions
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- Platform metrics functions
ALTER FUNCTION public.calculate_platform_metrics(date, date) SET search_path = public;
ALTER FUNCTION public.get_platform_daily_stats(date, date) SET search_path = public;
ALTER FUNCTION public.get_reseller_monthly_stats(uuid, date) SET search_path = public;

-- New tracking function
ALTER FUNCTION public.upsert_tracking_event(uuid, text, timestamp with time zone, text, text, text, text, text, jsonb, timestamp with time zone) SET search_path = public;

-- Cleanup helper function
DROP FUNCTION IF EXISTS fix_function_search_path(TEXT, TEXT);

-- =====================================================
-- Verification: Run this query to check remaining issues
-- =====================================================
-- SELECT
--   n.nspname as schema,
--   p.proname as function_name,
--   pg_get_function_identity_arguments(p.oid) as args,
--   CASE WHEN p.proconfig IS NULL THEN 'MUTABLE' ELSE 'FIXED' END as search_path_status
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
--   AND p.prokind = 'f'
--   AND (p.proconfig IS NULL OR NOT 'search_path=public' = ANY(p.proconfig))
-- ORDER BY p.proname;
