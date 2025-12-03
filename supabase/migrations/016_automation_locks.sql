/**
 * Automation Locks System
 * 
 * Migration: 016 - Sistema di lock per evitare conflitti tra agent e uso manuale
 * Description: Previene loop infiniti quando agent e utente accedono contemporaneamente
 * 
 * ⚠️ IMPORTANTE: Questo sistema previene conflitti tra:
 * - Agent automation (sync automatico)
 * - Uso manuale Spedisci.Online da parte dell'utente
 */

-- ============================================
-- STEP 1: Crea Tabella automation_locks
-- ============================================

CREATE TABLE IF NOT EXISTS public.automation_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Riferimento configurazione
  config_id UUID NOT NULL REFERENCES public.courier_configs(id) ON DELETE CASCADE,
  
  -- Tipo lock
  lock_type TEXT NOT NULL CHECK (lock_type IN ('agent', 'manual', 'maintenance')),
  -- 'agent': Lock da agent automation
  -- 'manual': Lock da uso manuale (utente sta usando Spedisci.Online)
  -- 'maintenance': Lock per manutenzione
  
  -- Stato
  is_active BOOLEAN DEFAULT true,
  locked_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL, -- Lock scade automaticamente
  
  -- Metadata
  locked_by TEXT, -- Email utente o 'system' per agent
  reason TEXT, -- Motivo lock (opzionale)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  released_at TIMESTAMPTZ, -- Quando è stato rilasciato
  
  -- Vincoli
  CONSTRAINT valid_expires_at CHECK (expires_at > locked_at)
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_automation_locks_config ON public.automation_locks(config_id);
CREATE INDEX IF NOT EXISTS idx_automation_locks_active ON public.automation_locks(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_automation_locks_expires ON public.automation_locks(expires_at) WHERE is_active = true;

-- Unique constraint: solo un lock attivo per configurazione
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_locks_unique_active 
  ON public.automation_locks(config_id) 
  WHERE is_active = true;

-- Commenti per documentazione
COMMENT ON TABLE public.automation_locks IS 
  'Sistema di lock per prevenire conflitti tra agent automation e uso manuale Spedisci.Online';
COMMENT ON COLUMN public.automation_locks.lock_type IS 
  'Tipo lock: agent (automation), manual (utente), maintenance (manutenzione)';
COMMENT ON COLUMN public.automation_locks.expires_at IS 
  'Timestamp quando lock scade automaticamente (previene deadlock)';

-- ============================================
-- STEP 2: Funzione per acquisire lock atomico
-- ============================================

CREATE OR REPLACE FUNCTION acquire_automation_lock(
  p_config_id UUID,
  p_lock_type TEXT,
  p_locked_by TEXT DEFAULT 'system',
  p_reason TEXT DEFAULT NULL,
  p_duration_minutes INTEGER DEFAULT 30
)
RETURNS UUID AS $$
DECLARE
  v_lock_id UUID;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Calcola expires_at
  v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;
  
  -- Pulisci lock scaduti
  UPDATE public.automation_locks
  SET is_active = false, released_at = NOW()
  WHERE config_id = p_config_id
    AND is_active = true
    AND expires_at < NOW();
  
  -- Prova ad acquisire lock
  INSERT INTO public.automation_locks (
    config_id,
    lock_type,
    locked_by,
    reason,
    expires_at
  )
  VALUES (
    p_config_id,
    p_lock_type,
    p_locked_by,
    p_reason,
    v_expires_at
  )
  ON CONFLICT (config_id) WHERE is_active = true
  DO NOTHING
  RETURNING id INTO v_lock_id;
  
  -- Se v_lock_id è NULL, lock già esistente
  IF v_lock_id IS NULL THEN
    RAISE EXCEPTION 'Lock già attivo per questa configurazione';
  END IF;
  
  RETURN v_lock_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 3: Funzione per rilasciare lock
-- ============================================

CREATE OR REPLACE FUNCTION release_automation_lock(
  p_config_id UUID,
  p_lock_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_released INTEGER;
BEGIN
  -- Rilascia lock specifico o tutti i lock attivi per config
  IF p_lock_id IS NOT NULL THEN
    UPDATE public.automation_locks
    SET is_active = false, released_at = NOW()
    WHERE id = p_lock_id
      AND config_id = p_config_id
      AND is_active = true;
  ELSE
    UPDATE public.automation_locks
    SET is_active = false, released_at = NOW()
    WHERE config_id = p_config_id
      AND is_active = true;
  END IF;
  
  GET DIAGNOSTICS v_released = ROW_COUNT;
  
  RETURN v_released > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 4: Funzione per verificare lock attivo
-- ============================================

CREATE OR REPLACE FUNCTION check_automation_lock(
  p_config_id UUID
)
RETURNS TABLE (
  has_lock BOOLEAN,
  lock_type TEXT,
  locked_by TEXT,
  locked_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  minutes_remaining INTEGER
) AS $$
BEGIN
  -- Pulisci lock scaduti
  UPDATE public.automation_locks
  SET is_active = false, released_at = NOW()
  WHERE config_id = p_config_id
    AND is_active = true
    AND expires_at < NOW();
  
  -- Ritorna info lock attivo
  RETURN QUERY
  SELECT 
    true as has_lock,
    al.lock_type,
    al.locked_by,
    al.locked_at,
    al.expires_at,
    EXTRACT(EPOCH FROM (al.expires_at - NOW()))::INTEGER / 60 as minutes_remaining
  FROM public.automation_locks al
  WHERE al.config_id = p_config_id
    AND al.is_active = true
    AND al.expires_at > NOW()
  LIMIT 1;
  
  -- Se nessun lock, ritorna false
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ, NULL::INTEGER;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 5: Funzione per estendere lock
-- ============================================

CREATE OR REPLACE FUNCTION extend_automation_lock(
  p_config_id UUID,
  p_lock_id UUID,
  p_additional_minutes INTEGER DEFAULT 30
)
RETURNS BOOLEAN AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  UPDATE public.automation_locks
  SET expires_at = expires_at + (p_additional_minutes || ' minutes')::INTERVAL
  WHERE id = p_lock_id
    AND config_id = p_config_id
    AND is_active = true
    AND expires_at > NOW();
  
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  
  RETURN v_updated > 0;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- STEP 6: Trigger per pulizia automatica
-- ============================================

CREATE OR REPLACE FUNCTION cleanup_expired_locks()
RETURNS void AS $$
BEGIN
  UPDATE public.automation_locks
  SET is_active = false, released_at = NOW()
  WHERE is_active = true
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RIEPILOGO
-- ============================================

DO $$
BEGIN
  RAISE NOTICE '✅ Migration 016 completata:';
  RAISE NOTICE '  - Creata tabella automation_locks';
  RAISE NOTICE '  - Creata funzione acquire_automation_lock()';
  RAISE NOTICE '  - Creata funzione release_automation_lock()';
  RAISE NOTICE '  - Creata funzione check_automation_lock()';
  RAISE NOTICE '  - Creata funzione extend_automation_lock()';
  RAISE NOTICE '  - Sistema di lock per prevenire conflitti agent/manuale';
END $$;

