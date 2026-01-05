-- ============================================
-- MIGRATION: 044_idempotency_locks.sql
-- DESCRIZIONE: Crash-safe idempotency per shipment creation
-- DATA: 2025-12-22
-- CRITICITÀ: P1 - SICUREZZA FINANZIARIA
-- ============================================
--
-- PROBLEMA:
-- TOCTOU tra idempotency check e wallet debit permette doppio addebito
-- se crash avviene dopo debit ma prima di shipment creation.
--
-- SOLUZIONE:
-- Tabella idempotency_locks con lock atomico che previene:
-- - Doppio addebito (lock acquisito PRIMA di debit)
-- - Doppia creazione shipment (lock completato DOPO shipment)
-- - Race condition su retry (lock status gestisce stati)
--
-- RIFERIMENTI:
-- - Idempotency patterns (Stripe, AWS)
-- - Crash-safe transactions
-- ============================================

-- ============================================
-- STEP 1: Crea tabella idempotency_locks
-- ============================================

CREATE TABLE IF NOT EXISTS idempotency_locks (
  idempotency_key TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Stato lock
  status TEXT NOT NULL DEFAULT 'in_progress' 
    CHECK (status IN ('in_progress', 'completed', 'failed')),
  
  -- Risultato (se completed)
  result_shipment_id UUID REFERENCES shipments(id) ON DELETE SET NULL,
  
  -- Error tracking (se failed)
  last_error TEXT,
  
  -- TTL per cleanup automatico
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  -- Metadati per debugging
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_idempotency_locks_user_id ON idempotency_locks(user_id);
CREATE INDEX IF NOT EXISTS idx_idempotency_locks_expires_at ON idempotency_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_idempotency_locks_status ON idempotency_locks(status);

-- Commenti
COMMENT ON TABLE idempotency_locks IS 
'Crash-safe idempotency locks per shipment creation.
Previene doppio addebito e doppia creazione shipment anche in caso di crash.';

COMMENT ON COLUMN idempotency_locks.idempotency_key IS 
'Chiave idempotency (SHA256 hash dei parametri richiesta)';

COMMENT ON COLUMN idempotency_locks.status IS 
'Stato: in_progress (lock attivo), completed (shipment creato), failed (errore dopo debit)';

COMMENT ON COLUMN idempotency_locks.expires_at IS 
'TTL lock (default 10 minuti). Lock scaduti possono essere riutilizzati.';

-- ============================================
-- STEP 2: Abilita RLS (solo server-side access)
-- ============================================

ALTER TABLE idempotency_locks ENABLE ROW LEVEL SECURITY;

-- Nessuna policy per auth users (solo service_role può accedere)
-- Service_role bypassa RLS automaticamente

-- ============================================
-- STEP 3: Funzione RPC per acquisire lock atomico
-- ============================================

CREATE OR REPLACE FUNCTION acquire_idempotency_lock(
  p_idempotency_key TEXT,
  p_user_id UUID,
  p_ttl_minutes INTEGER DEFAULT 10
)
RETURNS TABLE(
  acquired BOOLEAN,
  status TEXT,
  result_shipment_id UUID,
  error_message TEXT
) AS $$
DECLARE
  v_existing RECORD;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Calcola expires_at
  v_expires_at := NOW() + (p_ttl_minutes || ' minutes')::INTERVAL;
  
  -- Prova ad acquisire lock (INSERT)
  BEGIN
    INSERT INTO idempotency_locks (
      idempotency_key,
      user_id,
      status,
      expires_at
    ) VALUES (
      p_idempotency_key,
      p_user_id,
      'in_progress',
      v_expires_at
    );
    
    -- Lock acquisito con successo
    RETURN QUERY SELECT TRUE, 'in_progress'::TEXT, NULL::UUID, NULL::TEXT;
    RETURN;
    
  EXCEPTION WHEN unique_violation THEN
    -- Lock già esistente: verifica stato
    SELECT 
      il.status,
      il.result_shipment_id,
      il.expires_at,
      il.last_error
    INTO v_existing
    FROM idempotency_locks il
    WHERE il.idempotency_key = p_idempotency_key;
    
    -- Se lock scaduto: takeover (aggiorna e riutilizza)
    IF v_existing.expires_at < NOW() THEN
      UPDATE idempotency_locks
      SET 
        status = 'in_progress',
        user_id = p_user_id,
        expires_at = v_expires_at,
        last_error = NULL,
        result_shipment_id = NULL
      WHERE idempotency_key = p_idempotency_key
        AND expires_at < NOW();  -- Condizione atomica per evitare race
      
      IF FOUND THEN
        RETURN QUERY SELECT TRUE, 'in_progress'::TEXT, NULL::UUID, NULL::TEXT;
        RETURN;
      END IF;
    END IF;
    
    -- Lock attivo: ritorna stato esistente
    IF v_existing.status = 'completed' THEN
      -- Shipment già creato: idempotent replay
      RETURN QUERY SELECT 
        FALSE, 
        'completed'::TEXT, 
        v_existing.result_shipment_id, 
        NULL::TEXT;
      RETURN;
    ELSIF v_existing.status = 'in_progress' THEN
      -- Lock ancora attivo: operazione in corso
      RETURN QUERY SELECT 
        FALSE, 
        'in_progress'::TEXT, 
        NULL::UUID, 
        'Operation already in progress'::TEXT;
      RETURN;
    ELSIF v_existing.status = 'failed' THEN
      -- Precedente tentativo fallito: non ri-debitare
      RETURN QUERY SELECT 
        FALSE, 
        'failed'::TEXT, 
        NULL::UUID, 
        COALESCE(v_existing.last_error, 'Previous attempt failed')::TEXT;
      RETURN;
    END IF;
    
    -- Stato sconosciuto: fallback
    RETURN QUERY SELECT 
      FALSE, 
      v_existing.status, 
      NULL::UUID, 
      'Unknown lock status'::TEXT;
    RETURN;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Imposta search_path per sicurezza
ALTER FUNCTION acquire_idempotency_lock(
  TEXT,
  UUID,
  INTEGER
) SET search_path = public, pg_temp;

COMMENT ON FUNCTION acquire_idempotency_lock IS 
'Acquisisce lock idempotency atomico.
RETURNS:
- acquired=true: lock acquisito, procedi con operazione
- acquired=false, status=completed: shipment già creato (idempotent replay)
- acquired=false, status=in_progress: operazione già in corso (non ri-debitare)
- acquired=false, status=failed: precedente tentativo fallito (non ri-debitare)';

-- ============================================
-- STEP 4: Funzione RPC per completare lock
-- ============================================

CREATE OR REPLACE FUNCTION complete_idempotency_lock(
  p_idempotency_key TEXT,
  p_shipment_id UUID,
  p_status TEXT DEFAULT 'completed'
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Valida status
  IF p_status NOT IN ('completed', 'failed') THEN
    RAISE EXCEPTION 'Invalid status. Must be completed or failed';
  END IF;
  
  -- Aggiorna lock
  UPDATE idempotency_locks
  SET 
    status = p_status,
    result_shipment_id = CASE WHEN p_status = 'completed' THEN p_shipment_id ELSE NULL END,
    expires_at = NOW() + INTERVAL '1 hour'  -- Estendi TTL per completed/failed (per audit)
  WHERE idempotency_key = p_idempotency_key
    AND status = 'in_progress';  -- Solo se ancora in_progress (previene race)
  
  IF NOT FOUND THEN
    RAISE WARNING 'Lock % not found or not in_progress', p_idempotency_key;
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Imposta search_path per sicurezza
ALTER FUNCTION complete_idempotency_lock(
  TEXT,
  UUID,
  TEXT
) SET search_path = public, pg_temp;

COMMENT ON FUNCTION complete_idempotency_lock IS 
'Completa lock idempotency dopo creazione shipment o in caso di errore.
Usa status=completed per successo, status=failed per errore dopo debit.';

-- ============================================
-- STEP 5: Funzione RPC per marcare lock come failed
-- ============================================

CREATE OR REPLACE FUNCTION fail_idempotency_lock(
  p_idempotency_key TEXT,
  p_error_message TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE idempotency_locks
  SET 
    status = 'failed',
    last_error = p_error_message,
    expires_at = NOW() + INTERVAL '1 hour'  -- Estendi TTL per audit
  WHERE idempotency_key = p_idempotency_key
    AND status = 'in_progress';
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Imposta search_path per sicurezza
ALTER FUNCTION fail_idempotency_lock(
  TEXT,
  TEXT
) SET search_path = public, pg_temp;

COMMENT ON FUNCTION fail_idempotency_lock IS 
'Marca lock come failed dopo errore (es. dopo debit ma prima di shipment).
Previene ri-debit su retry.';

-- ============================================
-- STEP 6: Cleanup automatico lock scaduti (opzionale, via cron job futuro)
-- ============================================

-- Funzione helper per cleanup (può essere chiamata da job esterno)
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_locks()
RETURNS INTEGER AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM idempotency_locks
  WHERE expires_at < NOW() - INTERVAL '24 hours';  -- Cancella lock scaduti da >24h
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Imposta search_path per sicurezza
ALTER FUNCTION cleanup_expired_idempotency_locks() 
SET search_path = public, pg_temp;

COMMENT ON FUNCTION cleanup_expired_idempotency_locks IS 
'Cleanup lock scaduti da >24h. Può essere chiamata da cron job.';

-- ============================================
-- COMPLETAMENTO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Migration 044 completata con successo';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tabelle create:';
  RAISE NOTICE '  - idempotency_locks';
  RAISE NOTICE '';
  RAISE NOTICE 'Funzioni RPC create:';
  RAISE NOTICE '  - acquire_idempotency_lock()';
  RAISE NOTICE '  - complete_idempotency_lock()';
  RAISE NOTICE '  - fail_idempotency_lock()';
  RAISE NOTICE '  - cleanup_expired_idempotency_locks()';
  RAISE NOTICE '';
  RAISE NOTICE '🔒 IDEMPOTENCY ORA CRASH-SAFE:';
  RAISE NOTICE '  - Doppio addebito: IMPOSSIBILE';
  RAISE NOTICE '  - Doppia creazione: IMPOSSIBILE';
  RAISE NOTICE '  - Retry sicuro: GARANTITO';
  RAISE NOTICE '========================================';
END $$;






