-- ============================================
-- MIGRATION: 110_admin_overview_stats_function.sql
-- DESCRIPTION: RPC for admin overview KPI (exclude deleted/cancelled + test)
-- DATE: 2026-01-18
-- ============================================

CREATE OR REPLACE FUNCTION get_admin_overview_stats(include_test BOOLEAN DEFAULT false)
RETURNS TABLE (
  total_shipments BIGINT,
  shipments_today BIGINT,
  shipments_this_week BIGINT,
  shipments_this_month BIGINT,
  shipments_pending BIGINT,
  shipments_in_transit BIGINT,
  shipments_delivered BIGINT,
  shipments_failed BIGINT,
  total_revenue NUMERIC,
  revenue_today NUMERIC,
  revenue_this_week NUMERIC,
  revenue_this_month NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_today_start TIMESTAMPTZ;
  v_week_start TIMESTAMPTZ;
  v_month_start TIMESTAMPTZ;
BEGIN
  v_today_start := date_trunc('day', NOW());
  v_week_start := v_today_start - INTERVAL '7 days';
  v_month_start := v_today_start - INTERVAL '30 days';

  RETURN QUERY
  WITH test_users AS (
    SELECT id
    FROM users
    WHERE
      email ILIKE 'test@%' OR
      email ILIKE 'test-%@spediresicuro.it' OR
      email ILIKE '%@test.%' OR
      email ILIKE '%test%@%test%' OR
      email ILIKE 'e2e-%' OR
      email ILIKE 'smoke-test-%' OR
      email ILIKE 'integration-test-%' OR
      COALESCE(name, '') ILIKE 'test %' OR
      COALESCE(name, '') ILIKE '%test user%' OR
      COALESCE(name, '') ILIKE '%e2e test%' OR
      COALESCE(name, '') ILIKE '%smoke test%' OR
      COALESCE(name, '') ILIKE '%integration test%' OR
      COALESCE(name, '') ILIKE 'test'
  ),
  base AS (
    SELECT s.*
    FROM shipments s
    WHERE
      (s.deleted IS NULL OR s.deleted = false)
      AND s.deleted_at IS NULL
      AND s.status NOT IN ('cancelled', 'deleted')
      AND (
        include_test
        OR (
          (s.tracking_number IS NULL OR s.tracking_number NOT ILIKE '%TEST%')
          AND NOT EXISTS (SELECT 1 FROM test_users tu WHERE tu.id = s.user_id)
          AND NOT EXISTS (SELECT 1 FROM test_users tu WHERE tu.id = s.created_by)
        )
      )
  )
  SELECT
    COUNT(*)::BIGINT AS total_shipments,
    COUNT(*) FILTER (WHERE created_at >= v_today_start)::BIGINT AS shipments_today,
    COUNT(*) FILTER (WHERE created_at >= v_week_start)::BIGINT AS shipments_this_week,
    COUNT(*) FILTER (WHERE created_at >= v_month_start)::BIGINT AS shipments_this_month,
    COUNT(*) FILTER (WHERE status IN ('pending', 'draft'))::BIGINT AS shipments_pending,
    COUNT(*) FILTER (WHERE status IN ('in_transit', 'shipped'))::BIGINT AS shipments_in_transit,
    COUNT(*) FILTER (WHERE status = 'delivered')::BIGINT AS shipments_delivered,
    COUNT(*) FILTER (WHERE status = 'failed')::BIGINT AS shipments_failed,
    COALESCE(SUM(COALESCE(final_price, 0)), 0)::NUMERIC AS total_revenue,
    COALESCE(SUM(COALESCE(final_price, 0)) FILTER (WHERE created_at >= v_today_start), 0)::NUMERIC AS revenue_today,
    COALESCE(SUM(COALESCE(final_price, 0)) FILTER (WHERE created_at >= v_week_start), 0)::NUMERIC AS revenue_this_week,
    COALESCE(SUM(COALESCE(final_price, 0)) FILTER (WHERE created_at >= v_month_start), 0)::NUMERIC AS revenue_this_month
  FROM base;
END;
$$;

COMMENT ON FUNCTION get_admin_overview_stats(BOOLEAN) IS 'Admin overview KPI (shipments + revenue).
Excludes deleted/cancelled by default; when include_test=false also excludes test users and tracking numbers.';
