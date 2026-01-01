-- ============================================
-- AI AGENT SESSIONS - Persistenza Conversazioni Multi-Turn
-- ============================================
-- Migration: 054 - Agent Sessions Table
-- Description: Tabella per persistenza conversazioni multi-turn AI Agent
-- 
-- CONTEXT:
-- - Supporta conversazioni multi-turn con persistenza stato
-- - RLS policy: utente vede solo le proprie sessioni
-- - Index su user_id e session_id per query veloci
-- 
-- Ref: PROMPT_IMPLEMENTAZIONE_AI_AGENT.md Task 1
-- ============================================

-- ============================================
-- STEP 1: Crea Tabella agent_sessions
-- ============================================

CREATE TABLE IF NOT EXISTS public.agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  conversation_history JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Constraint: session_id deve essere unico per user_id
  CONSTRAINT agent_sessions_user_session_unique UNIQUE (user_id, session_id)
);

-- ============================================
-- STEP 2: Crea Index per Query Veloci
-- ============================================

CREATE INDEX IF NOT EXISTS idx_agent_sessions_user_id 
ON public.agent_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_session_id 
ON public.agent_sessions(session_id);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_updated_at 
ON public.agent_sessions(updated_at DESC);

-- ============================================
-- STEP 3: Trigger per updated_at
-- ============================================

CREATE OR REPLACE FUNCTION update_agent_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER agent_sessions_updated_at_trigger
BEFORE UPDATE ON public.agent_sessions
FOR EACH ROW
EXECUTE FUNCTION update_agent_sessions_updated_at();

-- ============================================
-- STEP 4: RLS Policy - Utente vede solo le proprie sessioni
-- ============================================

ALTER TABLE public.agent_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT - Utente vede solo le proprie sessioni
CREATE POLICY agent_sessions_select_own
ON public.agent_sessions
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: INSERT - Utente può creare solo sessioni proprie
CREATE POLICY agent_sessions_insert_own
ON public.agent_sessions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: UPDATE - Utente può aggiornare solo sessioni proprie
CREATE POLICY agent_sessions_update_own
ON public.agent_sessions
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Policy: DELETE - Utente può cancellare solo sessioni proprie
CREATE POLICY agent_sessions_delete_own
ON public.agent_sessions
FOR DELETE
USING (auth.uid() = user_id);

-- ============================================
-- STEP 5: Commenti per Documentazione
-- ============================================

COMMENT ON TABLE public.agent_sessions IS 'Persistenza conversazioni multi-turn AI Agent';
COMMENT ON COLUMN public.agent_sessions.id IS 'UUID primario sessione';
COMMENT ON COLUMN public.agent_sessions.user_id IS 'ID utente proprietario sessione';
COMMENT ON COLUMN public.agent_sessions.session_id IS 'ID sessione unico (es. traceId)';
COMMENT ON COLUMN public.agent_sessions.conversation_history IS 'Storia conversazione in formato JSONB (array di BaseMessage)';
COMMENT ON COLUMN public.agent_sessions.created_at IS 'Timestamp creazione sessione';
COMMENT ON COLUMN public.agent_sessions.updated_at IS 'Timestamp ultimo aggiornamento (auto-update)';
COMMENT ON COLUMN public.agent_sessions.metadata IS 'Metadati aggiuntivi sessione (JSONB)';

-- ============================================
-- STEP 6: Verifica Creazione
-- ============================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'agent_sessions') THEN
    RAISE NOTICE '✅ Tabella agent_sessions creata con successo';
  ELSE
    RAISE EXCEPTION '❌ Errore creazione tabella agent_sessions';
  END IF;
END $$;

