-- ============================================================
-- M4: Audit Logs Retention Policy
-- ============================================================
-- This migration adds:
-- 1. Retention policy function for audit_logs cleanup
-- 2. Index for efficient date-based queries
-- 3. Stats and summary functions
--
-- COMPATIBLE: Works with both old schema (user_id only) and
-- new schema (actor_id, target_id, impersonation_active)
-- ============================================================

-- Add index for efficient retention queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at
ON audit_logs (created_at);

-- Add composite index for action + date queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_created_at
ON audit_logs (action, created_at);

-- ============================================================
-- Retention Policy Function
-- ============================================================
-- Retention periods:
-- - Standard events (user.*, admin.*): 90 days
-- - Financial events (wallet.*, shipment.*): 365 days
-- - System events: 30 days
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
  temp_count BIGINT := 0;
BEGIN
  -- Delete old standard events (user.*, admin.* except impersonation)
  DELETE FROM audit_logs
  WHERE created_at < NOW() - (standard_retention_days || ' days')::INTERVAL
    AND action LIKE 'user.%'
    AND action NOT IN ('user.login', 'user.login_failed');  -- Keep login history longer
  GET DIAGNOSTICS standard_deleted = ROW_COUNT;

  -- Delete old admin events (except impersonation which is kept longer)
  DELETE FROM audit_logs
  WHERE created_at < NOW() - (standard_retention_days || ' days')::INTERVAL
    AND action LIKE 'admin.%'
    AND action NOT LIKE 'admin.impersonation%';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  standard_deleted := standard_deleted + temp_count;

  -- Delete old financial events
  DELETE FROM audit_logs
  WHERE created_at < NOW() - (financial_retention_days || ' days')::INTERVAL
    AND (action LIKE 'wallet.%' OR action LIKE 'shipment.%');
  GET DIAGNOSTICS financial_deleted = ROW_COUNT;

  -- Delete very old events (absolute limit)
  DELETE FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '2 years';
  GET DIAGNOSTICS temp_count = ROW_COUNT;
  financial_deleted := financial_deleted + temp_count;

  -- Return results
  RETURN QUERY
  SELECT 'standard'::TEXT, standard_deleted
  UNION ALL
  SELECT 'financial'::TEXT, financial_deleted
  UNION ALL
  SELECT 'total'::TEXT, standard_deleted + financial_deleted;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- View for Audit Log Summary (Schema-Compatible)
-- ============================================================
-- Uses user_id if actor_id doesn't exist for backwards compatibility

DO $$
DECLARE
  has_actor_id BOOLEAN;
  has_impersonation BOOLEAN;
BEGIN
  -- Check if new columns exist
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'audit_logs'
    AND column_name = 'actor_id'
  ) INTO has_actor_id;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'audit_logs'
    AND column_name = 'impersonation_active'
  ) INTO has_impersonation;

  -- Drop existing view if exists
  DROP VIEW IF EXISTS audit_logs_summary;

  -- Create view based on available schema
  IF has_actor_id AND has_impersonation THEN
    -- New schema with actor_id and impersonation
    EXECUTE '
      CREATE VIEW audit_logs_summary AS
      SELECT
        DATE_TRUNC(''day'', created_at) AS log_date,
        action,
        resource_type,
        COUNT(*) AS event_count,
        COUNT(DISTINCT actor_id) AS unique_actors,
        COUNT(*) FILTER (WHERE impersonation_active = true) AS impersonation_events
      FROM audit_logs
      WHERE created_at > NOW() - INTERVAL ''30 days''
      GROUP BY DATE_TRUNC(''day'', created_at), action, resource_type
      ORDER BY log_date DESC, event_count DESC
    ';
    RAISE NOTICE '✅ Created audit_logs_summary view with actor_id support';
  ELSE
    -- Legacy schema with user_id only
    EXECUTE '
      CREATE VIEW audit_logs_summary AS
      SELECT
        DATE_TRUNC(''day'', created_at) AS log_date,
        action,
        resource_type,
        COUNT(*) AS event_count,
        COUNT(DISTINCT user_id) AS unique_actors,
        0::BIGINT AS impersonation_events
      FROM audit_logs
      WHERE created_at > NOW() - INTERVAL ''30 days''
      GROUP BY DATE_TRUNC(''day'', created_at), action, resource_type
      ORDER BY log_date DESC, event_count DESC
    ';
    RAISE NOTICE '✅ Created audit_logs_summary view with user_id (legacy) support';
  END IF;
END $$;

-- ============================================================
-- Helper Function: Get Audit Log Stats
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
  FROM audit_logs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Comments
-- ============================================================

COMMENT ON FUNCTION cleanup_audit_logs IS 'Cleans up old audit logs based on retention policy. Run periodically via cron job.';
COMMENT ON VIEW audit_logs_summary IS 'Summary of audit log activity over the last 30 days';
COMMENT ON FUNCTION get_audit_log_stats IS 'Returns statistics about audit log table size and age';

-- ============================================================
-- Grant permissions
-- ============================================================

-- Only service role can run cleanup
REVOKE ALL ON FUNCTION cleanup_audit_logs FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cleanup_audit_logs TO service_role;

-- Stats can be viewed by authenticated users (for admin dashboard)
GRANT EXECUTE ON FUNCTION get_audit_log_stats TO authenticated;
GRANT SELECT ON audit_logs_summary TO authenticated;

-- ============================================================
-- MIGRATION COMPLETED
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ MIGRATION 113 COMPLETATA - Audit Retention Policy';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Creati:';
  RAISE NOTICE '   - cleanup_audit_logs() function';
  RAISE NOTICE '   - get_audit_log_stats() function';
  RAISE NOTICE '   - audit_logs_summary view';
  RAISE NOTICE '   - idx_audit_logs_created_at index';
  RAISE NOTICE '   - idx_audit_logs_action_created_at index';
  RAISE NOTICE '';
  RAISE NOTICE '⚙️ Configurazione retention:';
  RAISE NOTICE '   - Standard events: 90 days';
  RAISE NOTICE '   - Financial events: 365 days';
  RAISE NOTICE '   - Absolute limit: 2 years';
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;
