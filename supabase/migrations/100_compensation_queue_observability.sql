-- ============================================
-- MIGRATION: 100_compensation_queue_observability.sql
-- DESCRIZIONE: Observability + Dead-letter queue per compensation
-- DATA: 2026-01-11
-- CRITICITÀ: P0 - AUDIT FIX (Punto 7)
-- ============================================
--
-- PROBLEMA:
-- Compensation queue non ha:
-- 1. Metriche observability (SLA tracking)
-- 2. Resolved_at timestamp (resolution time)
-- 3. Dead-letter mechanism (retry failures)
-- 4. Alerting queries
--
-- SOLUZIONE:
-- 1. Add resolved_at, retry_count fields
-- 2. Dead-letter status
-- 3. Materialized view per stats
-- 4. Alerting functions
--
-- ============================================

-- ============================================
-- STEP 1: Schema enhancements
-- ============================================

-- Add observability fields
ALTER TABLE compensation_queue
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dead_letter_reason TEXT;

-- Update status enum (add 'resolved' and 'dead_letter')
-- Note: PostgreSQL non supporta ALTER TYPE ADD VALUE IF NOT EXISTS inline
DO $$
BEGIN
  -- Check if 'resolved' value exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'resolved'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'compensation_status')
  ) THEN
    -- Add 'resolved' status (se non esiste già)
    ALTER TYPE compensation_status ADD VALUE IF NOT EXISTS 'resolved';
  END IF;
EXCEPTION
  WHEN others THEN
    -- Ignore se il tipo non esiste (verrà creato dopo)
    NULL;
END $$;

-- If compensation_status type doesn't exist, create it
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'compensation_status') THEN
    CREATE TYPE compensation_status AS ENUM ('pending', 'expired', 'resolved', 'dead_letter');

    -- Alter table to use enum (se colonna status esiste ma è TEXT)
    ALTER TABLE compensation_queue
    ALTER COLUMN status DROP DEFAULT,
    ALTER COLUMN status TYPE compensation_status USING status::compensation_status,
    ALTER COLUMN status SET DEFAULT 'pending'::compensation_status;
  END IF;
END $$;

-- Add 'dead_letter' status if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'dead_letter'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'compensation_status')
  ) THEN
    -- PostgreSQL 9.1+ syntax
    EXECUTE 'ALTER TYPE compensation_status ADD VALUE IF NOT EXISTS ''dead_letter''';
  END IF;
EXCEPTION
  WHEN others THEN
    RAISE NOTICE 'Could not add dead_letter status (may already exist)';
END $$;

-- Indici per performance queries
CREATE INDEX IF NOT EXISTS compensation_queue_status_created_at_idx
ON compensation_queue(status, created_at DESC);

CREATE INDEX IF NOT EXISTS compensation_queue_resolved_at_idx
ON compensation_queue(resolved_at DESC)
WHERE resolved_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS compensation_queue_retry_count_idx
ON compensation_queue(retry_count, last_retry_at DESC)
WHERE retry_count > 0;

COMMENT ON COLUMN compensation_queue.resolved_at IS
'Timestamp quando record è stato risolto (refund completato).
NULL = non ancora risolto.
Usato per SLA tracking e resolution time metrics.';

COMMENT ON COLUMN compensation_queue.retry_count IS
'Numero di tentativi retry automatici.
Max retries: 3 (poi dead_letter).';

COMMENT ON COLUMN compensation_queue.last_retry_at IS
'Timestamp ultimo tentativo retry.
Usato per exponential backoff logic.';

COMMENT ON COLUMN compensation_queue.dead_letter_reason IS
'Motivo spostamento in dead_letter queue.
Es: "Max retries exceeded", "Manual intervention required".';

-- ============================================
-- STEP 2: Function per mark as resolved
-- ============================================

CREATE OR REPLACE FUNCTION mark_compensation_resolved(
  p_compensation_id UUID,
  p_resolution_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated_rows INTEGER;
BEGIN
  UPDATE compensation_queue
  SET
    status = 'resolved',
    resolved_at = NOW(),
    resolution_notes = COALESCE(p_resolution_notes, resolution_notes),
    updated_at = NOW()
  WHERE id = p_compensation_id
    AND status = 'pending'; -- Solo se ancora pending

  GET DIAGNOSTICS v_updated_rows = ROW_COUNT;

  IF v_updated_rows = 0 THEN
    RAISE WARNING 'Compensation record % not found or already resolved', p_compensation_id;
    RETURN FALSE;
  END IF;

  RAISE NOTICE 'Compensation % marked as resolved', p_compensation_id;
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION mark_compensation_resolved IS
'Mark compensation record as resolved (refund successful).
Called after manual/automatic refund completion.
Returns FALSE if record not found or already resolved.';

-- ============================================
-- STEP 3: Function per retry logic
-- ============================================

CREATE OR REPLACE FUNCTION retry_compensation(
  p_compensation_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_record RECORD;
  v_max_retries CONSTANT INTEGER := 3;
  v_can_retry BOOLEAN;
BEGIN
  -- Fetch record con lock
  SELECT * INTO v_record
  FROM compensation_queue
  WHERE id = p_compensation_id
  FOR UPDATE NOWAIT;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Record not found'
    );
  END IF;

  -- Check se può fare retry
  v_can_retry := v_record.status = 'pending'
                 AND v_record.retry_count < v_max_retries;

  IF NOT v_can_retry THEN
    -- Max retries raggiunto → dead_letter
    IF v_record.retry_count >= v_max_retries THEN
      UPDATE compensation_queue
      SET
        status = 'dead_letter',
        dead_letter_reason = 'Max retries exceeded (' || v_max_retries || ')',
        updated_at = NOW()
      WHERE id = p_compensation_id;

      RETURN jsonb_build_object(
        'success', false,
        'error', 'Max retries exceeded',
        'moved_to_dead_letter', true
      );
    END IF;

    RETURN jsonb_build_object(
      'success', false,
      'error', 'Cannot retry (status: ' || v_record.status || ')'
    );
  END IF;

  -- Incrementa retry_count
  UPDATE compensation_queue
  SET
    retry_count = retry_count + 1,
    last_retry_at = NOW(),
    updated_at = NOW()
  WHERE id = p_compensation_id;

  RETURN jsonb_build_object(
    'success', true,
    'retry_count', v_record.retry_count + 1,
    'can_retry_again', (v_record.retry_count + 1) < v_max_retries
  );

EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Record locked by another process'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION retry_compensation IS
'Attempt retry for compensation record.
Max retries: 3. After max → moved to dead_letter queue.
Returns JSONB with success flag and retry metadata.';

-- ============================================
-- STEP 4: Materialized view per stats (performance)
-- ============================================

CREATE MATERIALIZED VIEW IF NOT EXISTS compensation_queue_stats AS
SELECT
  -- Status counts
  COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
  COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_count,
  COUNT(*) FILTER (WHERE status = 'expired') AS expired_count,
  COUNT(*) FILTER (WHERE status = 'dead_letter') AS dead_letter_count,

  -- Pending age buckets (SLA tracking)
  COUNT(*) FILTER (
    WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '7 days'
  ) AS pending_over_7d,

  COUNT(*) FILTER (
    WHERE status = 'pending'
    AND created_at BETWEEN NOW() - INTERVAL '7 days' AND NOW() - INTERVAL '1 day'
  ) AS pending_1d_to_7d,

  COUNT(*) FILTER (
    WHERE status = 'pending'
    AND created_at > NOW() - INTERVAL '1 day'
  ) AS pending_under_1d,

  -- Financial exposure
  SUM(original_cost) FILTER (WHERE status = 'pending') AS pending_total_amount,
  SUM(original_cost) FILTER (WHERE status = 'resolved') AS resolved_total_amount,

  -- Resolution time stats (last 30 days)
  AVG(
    EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600
  ) FILTER (
    WHERE status = 'resolved'
    AND resolved_at > NOW() - INTERVAL '30 days'
  ) AS avg_resolution_hours_30d,

  PERCENTILE_CONT(0.5) WITHIN GROUP (
    ORDER BY EXTRACT(EPOCH FROM (resolved_at - created_at)) / 3600
  ) FILTER (
    WHERE status = 'resolved'
    AND resolved_at > NOW() - INTERVAL '30 days'
  ) AS median_resolution_hours_30d,

  -- Timestamp
  NOW() AS last_updated

FROM compensation_queue;

-- Index per refresh performance
CREATE UNIQUE INDEX IF NOT EXISTS compensation_queue_stats_uniq
ON compensation_queue_stats(last_updated);

COMMENT ON MATERIALIZED VIEW compensation_queue_stats IS
'Pre-computed stats per compensation queue.
Refresh: ogni 5 minuti (CRON job).
Performance optimization per dashboard queries.';

-- ============================================
-- STEP 5: Function per refresh stats
-- ============================================

CREATE OR REPLACE FUNCTION refresh_compensation_stats()
RETURNS BOOLEAN AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY compensation_queue_stats;
  RAISE NOTICE 'Compensation stats refreshed';
  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Failed to refresh compensation stats: %', SQLERRM;
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION refresh_compensation_stats IS
'Refresh materialized view compensation_queue_stats.
Called by CRON job ogni 5 minuti.';

-- ============================================
-- STEP 6: Alerting query (example)
-- ============================================

CREATE OR REPLACE FUNCTION get_compensation_alerts()
RETURNS TABLE(
  severity TEXT,
  message TEXT,
  count BIGINT,
  metadata JSONB
) AS $$
BEGIN
  -- Alert 1: Pending > 7 giorni (SLA breach)
  RETURN QUERY
  SELECT
    'CRITICAL'::TEXT AS severity,
    'Records pending oltre 7 giorni (SLA breach)'::TEXT AS message,
    COUNT(*)::BIGINT AS count,
    jsonb_build_object(
      'oldest_record', MIN(created_at),
      'total_amount', SUM(original_cost)
    ) AS metadata
  FROM compensation_queue
  WHERE status = 'pending'
    AND created_at < NOW() - INTERVAL '7 days'
  HAVING COUNT(*) > 0;

  -- Alert 2: Dead letter queue non vuoto
  RETURN QUERY
  SELECT
    'WARNING'::TEXT AS severity,
    'Dead letter queue ha records (manual review richiesto)'::TEXT AS message,
    COUNT(*)::BIGINT AS count,
    jsonb_build_object(
      'total_amount', SUM(original_cost),
      'reasons', jsonb_agg(DISTINCT dead_letter_reason)
    ) AS metadata
  FROM compensation_queue
  WHERE status = 'dead_letter'
  HAVING COUNT(*) > 0;

  -- Alert 3: Alto numero pending 24h-7d (warning zone)
  RETURN QUERY
  SELECT
    'WARNING'::TEXT AS severity,
    'Alto numero records in warning zone (24h-7d)'::TEXT AS message,
    COUNT(*)::BIGINT AS count,
    jsonb_build_object(
      'approaching_sla', COUNT(*),
      'total_amount', SUM(original_cost)
    ) AS metadata
  FROM compensation_queue
  WHERE status = 'pending'
    AND created_at BETWEEN NOW() - INTERVAL '7 days' AND NOW() - INTERVAL '1 day'
  HAVING COUNT(*) > 5;  -- Threshold: >5 records
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_compensation_alerts IS
'Generate alerts per compensation queue.
Used by monitoring dashboard + external alerting (Grafana, Datadog, etc.).';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 100 completata con successo';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Schema enhancements:';
  RAISE NOTICE '  - compensation_queue: resolved_at, retry_count, dead_letter_reason';
  RAISE NOTICE '  - Status enum: resolved, dead_letter';
  RAISE NOTICE '';
  RAISE NOTICE 'Functions created:';
  RAISE NOTICE '  - mark_compensation_resolved(id, notes?)';
  RAISE NOTICE '  - retry_compensation(id) → JSONB';
  RAISE NOTICE '  - refresh_compensation_stats() → scheduled CRON';
  RAISE NOTICE '  - get_compensation_alerts() → alerting';
  RAISE NOTICE '';
  RAISE NOTICE 'Materialized view:';
  RAISE NOTICE '  - compensation_queue_stats (refresh ogni 5min)';
  RAISE NOTICE '';
  RAISE NOTICE '🔍 COMPENSATION QUEUE OBSERVABILITY READY';
  RAISE NOTICE '========================================';
END $$;
