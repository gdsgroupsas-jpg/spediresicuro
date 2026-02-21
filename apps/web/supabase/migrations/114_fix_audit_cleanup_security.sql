-- ============================================================
-- M4: Fix Audit Cleanup Function Security
-- ============================================================
-- This migration fixes:
-- 1. Missing system events cleanup (system.* action prefix)
-- 2. Missing SET search_path for SECURITY DEFINER functions
-- 3. Adds search_path to other SECURITY DEFINER functions
-- ============================================================

-- ============================================================
-- Fix cleanup_audit_logs function
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_audit_logs(
  standard_retention_days INTEGER DEFAULT 90,
  financial_retention_days INTEGER DEFAULT 365,
  system_retention_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  category TEXT,
  deleted_count BIGINT
) AS $$
DECLARE
  standard_deleted BIGINT := 0;
  financial_deleted BIGINT := 0;
  system_deleted BIGINT := 0;
  temp_count BIGINT := 0;
BEGIN
  -- Delete old standard events (user.*, admin.* except impersonation)
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - (standard_retention_days || ' days')::INTERVAL
    AND action LIKE 'user.%'
    AND action NOT IN ('user.login', 'user.login_failed');  -- Keep login history longer
  GET DIAGNOSTICS standard_deleted = ROW_COUNT;

  -- Delete old admin events (except impersonation which is kept longer)
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - (standard_retention_days || ' days')::INTERVAL
    AND action LIKE 'admin.%'
    AND action NOT LIKE 'admin.impersonation%';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  standard_deleted := standard_deleted + temp_count;

  -- Delete old financial events
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - (financial_retention_days || ' days')::INTERVAL
    AND (action LIKE 'wallet.%' OR action LIKE 'shipment.%');
  GET DIAGNOSTICS financial_deleted = ROW_COUNT;

  -- FIX: Delete old system events (system.*)
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - (system_retention_days || ' days')::INTERVAL
    AND action LIKE 'system.%';
  GET DIAGNOSTICS system_deleted = ROW_COUNT;

  -- Delete very old events (absolute limit - 2 years)
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - INTERVAL '2 years';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  -- Add to financial as "catch-all" category
  financial_deleted := financial_deleted + temp_count;

  -- Return results
  RETURN QUERY
  SELECT 'standard'::TEXT, standard_deleted
  UNION ALL
  SELECT 'financial'::TEXT, financial_deleted
  UNION ALL
  SELECT 'system'::TEXT, system_deleted
  UNION ALL
  SELECT 'total'::TEXT, standard_deleted + financial_deleted + system_deleted;
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public;  -- FIX: Prevent search_path injection

-- ============================================================
-- Fix get_audit_log_stats function with search_path
-- ============================================================

CREATE OR REPLACE FUNCTION get_audit_log_stats()
RETURNS TABLE (
  total_logs BIGINT,
  logs_last_24h BIGINT,
  logs_last_7d BIGINT,
  logs_last_30d BIGINT,
  oldest_log TIMESTAMPTZ,
  newest_log TIMESTAMPTZ,
  storage_estimate_mb NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT AS total_logs,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::BIGINT AS logs_last_24h,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::BIGINT AS logs_last_7d,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::BIGINT AS logs_last_30d,
    MIN(created_at) AS oldest_log,
    MAX(created_at) AS newest_log,
    -- Rough estimate: ~500 bytes per log entry
    ROUND((COUNT(*) * 500.0 / 1024 / 1024)::NUMERIC, 2) AS storage_estimate_mb
  FROM public.audit_logs;
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public;  -- FIX: Prevent search_path injection

-- ============================================================
-- Fix log_acting_context_audit function with search_path
-- ============================================================

-- Only recreate if it exists (created by migration 20251221201850)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'log_acting_context_audit'
  ) THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION public.log_acting_context_audit(
        p_action TEXT,
        p_resource_type TEXT,
        p_resource_id UUID,
        p_actor_id UUID,
        p_target_id UUID,
        p_impersonation_active BOOLEAN DEFAULT false,
        p_audit_metadata JSONB DEFAULT ''{}'',
        p_metadata JSONB DEFAULT ''{}''
      )
      RETURNS UUID AS $func$
      DECLARE
        v_log_id UUID;
        v_actor_email TEXT;
        v_target_email TEXT;
      BEGIN
        -- Recupera email per legacy compatibility
        SELECT email INTO v_actor_email FROM public.users WHERE id = p_actor_id;
        SELECT email INTO v_target_email FROM public.users WHERE id = p_target_id;

        -- Inserisci log
        INSERT INTO public.audit_logs (
          action,
          resource_type,
          resource_id,
          user_id,
          user_email,
          actor_id,
          target_id,
          impersonation_active,
          audit_metadata,
          metadata
        ) VALUES (
          p_action,
          p_resource_type,
          p_resource_id,
          p_target_id,
          COALESCE(v_target_email, v_actor_email),
          p_actor_id,
          p_target_id,
          p_impersonation_active,
          p_audit_metadata,
          p_metadata
        )
        RETURNING id INTO v_log_id;

        RETURN v_log_id;
      END;
      $func$ LANGUAGE plpgsql
         SECURITY DEFINER
         SET search_path = public;
    ';
    RAISE NOTICE '✅ log_acting_context_audit updated with search_path';
  ELSE
    RAISE NOTICE '⚠️ log_acting_context_audit not found - skipping';
  END IF;
END $$;

-- ============================================================
-- Update comments
-- ============================================================

COMMENT ON FUNCTION cleanup_audit_logs IS 'Cleans up old audit logs based on retention policy. Includes system events. Run periodically via cron job.';
COMMENT ON FUNCTION get_audit_log_stats IS 'Returns statistics about audit log table size and age. Secured with search_path.';

-- ============================================================
-- MIGRATION COMPLETED
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ MIGRATION 114 COMPLETATA - Audit Cleanup Security Fix';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 Security Fixes:';
  RAISE NOTICE '   - Added SET search_path = public to SECURITY DEFINER functions';
  RAISE NOTICE '   - Prevents search_path injection attacks';
  RAISE NOTICE '';
  RAISE NOTICE '🐛 Bug Fixes:';
  RAISE NOTICE '   - Added system.* events cleanup (was missing)';
  RAISE NOTICE '   - System events retention: 30 days (configurable)';
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;
