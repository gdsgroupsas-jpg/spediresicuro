-- ============================================
-- MIGRATION 103: Fix compensation constraints + Security Events
-- DATA: 2026-01-12
-- AZIONE: Fix debito tecnico identificato in audit P0
-- ============================================
--
-- PROBLEMI RISOLTI:
-- 1. Mismatch constraint compensation_queue (UPPERCASE vs lowercase)
-- 2. Mancanza tabella security_events per audit trail
--
-- ============================================

-- STEP 1: Aggiorna constraint status per includere nuovi stati
ALTER TABLE compensation_queue DROP CONSTRAINT IF EXISTS compensation_queue_status_check;
ALTER TABLE compensation_queue ADD CONSTRAINT compensation_queue_status_check 
  CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DEAD_LETTER', 'RESOLVED', 'pending', 'processing', 'completed', 'failed', 'dead_letter', 'resolved'));

-- STEP 2: Crea tabella security_events per audit trail completo
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ip_address TEXT,
  user_agent TEXT,
  resource_type TEXT,
  resource_id TEXT,
  action TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  severity TEXT NOT NULL DEFAULT 'INFO' CHECK (severity IN ('INFO', 'WARNING', 'ERROR', 'CRITICAL')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);

-- STEP 3: Abilita RLS su security_events (solo admins possono vedere)
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- STEP 4: Helper function per loggare eventi di sicurezza
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type TEXT,
  p_user_id UUID DEFAULT NULL,
  p_severity TEXT DEFAULT 'INFO',
  p_details JSONB DEFAULT '{}'::jsonb,
  p_ip_address TEXT DEFAULT NULL,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
BEGIN
  INSERT INTO security_events (
    event_type, user_id, severity, details, ip_address, resource_type, resource_id
  ) VALUES (
    p_event_type, p_user_id, p_severity, p_details, p_ip_address, p_resource_type, p_resource_id
  ) RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION log_security_event(TEXT, UUID, TEXT, JSONB, TEXT, TEXT, TEXT) SET search_path = public, pg_temp;

-- STEP 5: Aggiorna retry_compensation per usare valori corretti
CREATE OR REPLACE FUNCTION retry_compensation(p_compensation_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_comp RECORD;
BEGIN
  SELECT * INTO v_comp
  FROM compensation_queue
  WHERE id = p_compensation_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Compensation record not found: %', p_compensation_id;
  END IF;
  
  -- Check se già completato (supporta sia UPPER che lower case)
  IF UPPER(v_comp.status) IN ('COMPLETED', 'RESOLVED', 'DEAD_LETTER', 'FAILED') THEN
    RETURN jsonb_build_object(
      'success', FALSE,
      'reason', 'Already finalized: ' || v_comp.status,
      'status', v_comp.status
    );
  END IF;
  
  v_comp.retry_count := COALESCE(v_comp.retry_count, 0) + 1;
  
  -- Se superato max_retries, vai in DEAD_LETTER
  IF v_comp.retry_count > COALESCE(v_comp.max_retries, 3) THEN
    UPDATE compensation_queue
    SET 
      status = 'DEAD_LETTER',
      dead_letter_reason = 'Max retries exceeded (' || COALESCE(v_comp.max_retries, 3) || ')',
      retry_count = v_comp.retry_count,
      last_retry_at = NOW()
    WHERE id = p_compensation_id;
    
    -- Log security event
    PERFORM log_security_event(
      'compensation_dead_letter',
      v_comp.user_id,
      'WARNING',
      jsonb_build_object('compensation_id', p_compensation_id, 'retry_count', v_comp.retry_count)
    );
    
    RETURN jsonb_build_object(
      'success', FALSE,
      'moved_to_dead_letter', TRUE,
      'retry_count', v_comp.retry_count,
      'reason', 'Max retries exceeded'
    );
  END IF;
  
  UPDATE compensation_queue
  SET 
    retry_count = v_comp.retry_count,
    last_retry_at = NOW()
  WHERE id = p_compensation_id;
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'retry_count', v_comp.retry_count,
    'max_retries', COALESCE(v_comp.max_retries, 3),
    'remaining_retries', COALESCE(v_comp.max_retries, 3) - v_comp.retry_count
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION retry_compensation(UUID) SET search_path = public, pg_temp;

-- STEP 6: Aggiorna mark_compensation_resolved
DROP FUNCTION IF EXISTS mark_compensation_resolved(UUID, TEXT, UUID);
CREATE OR REPLACE FUNCTION mark_compensation_resolved(
  p_compensation_id UUID,
  p_resolution_notes TEXT DEFAULT NULL,
  p_resolved_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE compensation_queue
  SET 
    status = 'RESOLVED',
    resolved_at = NOW()
  WHERE id = p_compensation_id
  AND UPPER(status) IN ('PENDING', 'PROCESSING', 'DEAD_LETTER', 'FAILED');
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Log security event
  PERFORM log_security_event(
    'compensation_resolved',
    p_resolved_by,
    'INFO',
    jsonb_build_object('compensation_id', p_compensation_id, 'notes', p_resolution_notes)
  );
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION mark_compensation_resolved(UUID, TEXT, UUID) SET search_path = public, pg_temp;

-- STEP 7: Aggiorna get_compensation_alerts per supportare entrambi i case
DROP FUNCTION IF EXISTS get_compensation_alerts();
CREATE OR REPLACE FUNCTION get_compensation_alerts()
RETURNS TABLE(
  id UUID,
  user_id UUID,
  original_cost DECIMAL,
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
    c.original_cost,
    c.status,
    COALESCE(c.retry_count, 0)::INTEGER,
    c.created_at,
    NOW() - c.created_at AS days_pending,
    CASE 
      WHEN UPPER(c.status) = 'DEAD_LETTER' THEN 'CRITICAL: Dead letter'
      WHEN c.created_at < NOW() - INTERVAL '7 days' THEN 'WARNING: Pending > 7 days'
      WHEN COALESCE(c.retry_count, 0) >= 2 THEN 'WARNING: Multiple retries'
      ELSE 'INFO'
    END AS alert_type
  FROM compensation_queue c
  WHERE UPPER(c.status) IN ('PENDING', 'PROCESSING', 'DEAD_LETTER', 'FAILED')
  AND (
    UPPER(c.status) = 'DEAD_LETTER'
    OR c.created_at < NOW() - INTERVAL '7 days'
    OR COALESCE(c.retry_count, 0) >= 2
  )
  ORDER BY 
    CASE UPPER(c.status) 
      WHEN 'DEAD_LETTER' THEN 1 
      ELSE 2 
    END,
    c.created_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER FUNCTION get_compensation_alerts() SET search_path = public, pg_temp;

-- ============================================
-- COMPLETAMENTO
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 103 completata';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fix applicati:';
  RAISE NOTICE '  - compensation_queue constraint (DEAD_LETTER, RESOLVED)';
  RAISE NOTICE '  - security_events table creata';
  RAISE NOTICE '  - log_security_event() function';
  RAISE NOTICE '  - retry_compensation() aggiornata';
  RAISE NOTICE '  - mark_compensation_resolved() aggiornata';
  RAISE NOTICE '  - get_compensation_alerts() aggiornata';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 ZERO DEBITO TECNICO';
  RAISE NOTICE '========================================';
END $$;
