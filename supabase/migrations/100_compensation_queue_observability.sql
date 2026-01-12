-- ============================================
-- MIGRATION: 100_compensation_queue_observability.sql
-- DESCRIZIONE: Compensation queue con dead-letter e observability
-- DATA: 2026-01-12
-- CRITICITÀ: P0.4 - OBSERVABILITY
-- ============================================
--
-- SCOPO:
-- Aggiunge observability alla compensation queue:
-- - Dead-letter mechanism dopo N retry
-- - Colonne per tracking (retry_count, resolved_at, dead_letter_reason)
-- - Alert per pending > 7 giorni
-- - Materialized view per statistiche
--
-- ============================================

-- ============================================
-- STEP 1: Crea/aggiorna tabella compensation_queue
-- ============================================
CREATE TABLE IF NOT EXISTS compensation_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
  
  -- Dettagli compensazione
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'processing', 'resolved', 'dead_letter')),
  
  -- Retry tracking
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  last_retry_at TIMESTAMPTZ,
  last_error TEXT,
  
  -- Dead letter
  dead_letter_reason TEXT,
  moved_to_dead_letter_at TIMESTAMPTZ,
  
  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES users(id),
  resolution_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Aggiungi colonne se tabella esisteva già
DO $$
BEGIN
  -- retry_count
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'compensation_queue' AND column_name = 'retry_count'
  ) THEN
    ALTER TABLE compensation_queue ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;
  END IF;
  
  -- max_retries
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'compensation_queue' AND column_name = 'max_retries'
  ) THEN
    ALTER TABLE compensation_queue ADD COLUMN max_retries INTEGER NOT NULL DEFAULT 3;
  END IF;
  
  -- resolved_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'compensation_queue' AND column_name = 'resolved_at'
  ) THEN
    ALTER TABLE compensation_queue ADD COLUMN resolved_at TIMESTAMPTZ;
  END IF;
  
  -- dead_letter_reason
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'compensation_queue' AND column_name = 'dead_letter_reason'
  ) THEN
    ALTER TABLE compensation_queue ADD COLUMN dead_letter_reason TEXT;
  END IF;
  
  -- last_retry_at
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'compensation_queue' AND column_name = 'last_retry_at'
  ) THEN
    ALTER TABLE compensation_queue ADD COLUMN last_retry_at TIMESTAMPTZ;
  END IF;
  
  -- last_error
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'compensation_queue' AND column_name = 'last_error'
  ) THEN
    ALTER TABLE compensation_queue ADD COLUMN last_error TEXT;
  END IF;
  
  RAISE NOTICE '✅ Colonne observability verificate/aggiunte';
END $$;

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_compensation_queue_status ON compensation_queue(status);
CREATE INDEX IF NOT EXISTS idx_compensation_queue_user_id ON compensation_queue(user_id);
CREATE INDEX IF NOT EXISTS idx_compensation_queue_created_at ON compensation_queue(created_at);
CREATE INDEX IF NOT EXISTS idx_compensation_queue_pending_old 
  ON compensation_queue(created_at) 
  WHERE status = 'pending';

-- ============================================
-- STEP 2: Function retry_compensation
-- ============================================
CREATE OR REPLACE FUNCTION retry_compensation(p_compensation_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_comp RECORD;
BEGIN
  -- Lock e fetch
  SELECT * INTO v_comp
  FROM compensation_queue
  WHERE id = p_compensation_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compensation record not found: %', p_compensation_id;
  END IF;
  
  -- Se già risolto o dead_letter, non fare nulla
  IF v_comp.status IN ('resolved', 'dead_letter') THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'reason', 'Already ' || v_comp.status,
      'status', v_comp.status
    );
  END IF;
  
  -- Incrementa retry count
  v_comp.retry_count := v_comp.retry_count + 1;
  
  -- Se superato max_retries, vai in dead_letter
  IF v_comp.retry_count > v_comp.max_retries THEN
    UPDATE compensation_queue
    SET 
      status = 'dead_letter',
      dead_letter_reason = 'Max retries exceeded (' || v_comp.max_retries || ')',
      moved_to_dead_letter_at = NOW(),
      retry_count = v_comp.retry_count,
      last_retry_at = NOW(),
      updated_at = NOW()
    WHERE id = p_compensation_id;
    
    RETURN jsonb_build_object(
      'success', FALSE,
      'moved_to_dead_letter', TRUE,
      'retry_count', v_comp.retry_count,
      'reason', 'Max retries exceeded'
    );
  END IF;
  
  -- Aggiorna retry count
  UPDATE compensation_queue
  SET 
    retry_count = v_comp.retry_count,
    last_retry_at = NOW(),
    updated_at = NOW()
  WHERE id = p_compensation_id;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'retry_count', v_comp.retry_count,
    'max_retries', v_comp.max_retries,
    'remaining_retries', v_comp.max_retries - v_comp.retry_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION retry_compensation(UUID) SET search_path = public, pg_temp;

COMMENT ON FUNCTION retry_compensation IS 
'Incrementa retry_count. Se > max_retries, sposta in dead_letter.';

-- ============================================
-- STEP 3: Function mark_compensation_resolved
-- ============================================
CREATE OR REPLACE FUNCTION mark_compensation_resolved(
  p_compensation_id UUID,
  p_resolution_notes TEXT DEFAULT NULL,
  p_resolved_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE compensation_queue
  SET 
    status = 'resolved',
    resolved_at = NOW(),
    resolved_by = p_resolved_by,
    resolution_notes = p_resolution_notes,
    updated_at = NOW()
  WHERE id = p_compensation_id
  AND status IN ('pending', 'processing', 'dead_letter');
  
  IF NOT FOUND THEN
    RAISE WARNING 'Compensation % not found or already resolved', p_compensation_id;
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION mark_compensation_resolved(UUID, TEXT, UUID) SET search_path = public, pg_temp;

COMMENT ON FUNCTION mark_compensation_resolved IS 
'Marca una compensation come risolta. Setta resolved_at e notes.';

-- ============================================
-- STEP 4: Function get_compensation_alerts
-- ============================================
CREATE OR REPLACE FUNCTION get_compensation_alerts()
RETURNS TABLE(
  id UUID,
  user_id UUID,
  amount DECIMAL(10,2),
  reason TEXT,
  status TEXT,
  retry_count INTEGER,
  created_at TIMESTAMPTZ,
  days_pending INTERVAL,
  alert_type TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id,
    c.user_id,
    c.amount,
    c.reason,
    c.status,
    c.retry_count,
    c.created_at,
    NOW() - c.created_at AS days_pending,
    CASE 
      WHEN c.status = 'dead_letter' THEN 'CRITICAL: Dead letter'
      WHEN c.created_at < NOW() - INTERVAL '7 days' THEN 'WARNING: Pending > 7 days'
      WHEN c.retry_count >= 2 THEN 'WARNING: Multiple retries'
      ELSE 'INFO'
    END AS alert_type
  FROM compensation_queue c
  WHERE c.status IN ('pending', 'processing', 'dead_letter')
  AND (
    c.status = 'dead_letter'
    OR c.created_at < NOW() - INTERVAL '7 days'
    OR c.retry_count >= 2
  )
  ORDER BY 
    CASE c.status 
      WHEN 'dead_letter' THEN 1 
      ELSE 2 
    END,
    c.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION get_compensation_alerts() SET search_path = public, pg_temp;

COMMENT ON FUNCTION get_compensation_alerts IS 
'Ritorna alert per compensation che richiedono attenzione:
- Dead letter (CRITICAL)
- Pending > 7 giorni (WARNING)
- Multiple retries (WARNING)';

-- ============================================
-- STEP 5: Materialized view compensation_queue_stats
-- ============================================
CREATE MATERIALIZED VIEW IF NOT EXISTS compensation_queue_stats AS
SELECT 
  status,
  COUNT(*) AS total_count,
  SUM(amount) AS total_amount,
  AVG(retry_count)::DECIMAL(5,2) AS avg_retry_count,
  MIN(created_at) AS oldest_record,
  MAX(created_at) AS newest_record,
  COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '7 days') AS older_than_7_days
FROM compensation_queue
GROUP BY status
ORDER BY 
  CASE status 
    WHEN 'dead_letter' THEN 1
    WHEN 'pending' THEN 2
    WHEN 'processing' THEN 3
    WHEN 'resolved' THEN 4
  END;

-- Indice per refresh veloce
CREATE UNIQUE INDEX IF NOT EXISTS compensation_queue_stats_status_idx 
ON compensation_queue_stats(status);

COMMENT ON MATERIALIZED VIEW compensation_queue_stats IS 
'Statistiche aggregate sulla compensation queue. Refresh con:
REFRESH MATERIALIZED VIEW CONCURRENTLY compensation_queue_stats;';

-- ============================================
-- STEP 6: Function per refresh stats
-- ============================================
CREATE OR REPLACE FUNCTION refresh_compensation_stats()
RETURNS VOID AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY compensation_queue_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION refresh_compensation_stats() SET search_path = public, pg_temp;

-- ============================================
-- COMPLETAMENTO
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 100 completata con successo';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tabella aggiornata:';
  RAISE NOTICE '  - compensation_queue (colonne observability)';
  RAISE NOTICE '';
  RAISE NOTICE 'Funzioni create:';
  RAISE NOTICE '  - retry_compensation() [dead-letter mechanism]';
  RAISE NOTICE '  - mark_compensation_resolved()';
  RAISE NOTICE '  - get_compensation_alerts()';
  RAISE NOTICE '  - refresh_compensation_stats()';
  RAISE NOTICE '';
  RAISE NOTICE 'View create:';
  RAISE NOTICE '  - compensation_queue_stats (materialized)';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 COMPENSATION OBSERVABILITY: ATTIVO';
  RAISE NOTICE '   - Dead-letter dopo 3 retry (default)';
  RAISE NOTICE '   - Alert per pending > 7 giorni';
  RAISE NOTICE '========================================';
END $$;
