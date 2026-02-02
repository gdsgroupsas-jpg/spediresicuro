/**
 * Migration: Anne Chat Messages
 *
 * Persiste i messaggi della chat ANNE per sync cross-device.
 * Ogni messaggio = una riga. Supabase Realtime postgres_changes
 * notifica tutti i device connessi quando arriva un nuovo messaggio.
 *
 * Phase 4: Multi-device Sessions
 */

-- Tabella messaggi chat
CREATE TABLE IF NOT EXISTS anne_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'suggestion')),
  content TEXT NOT NULL,
  -- Metadata opzionale (card data, agentState snapshot per il messaggio)
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indice per query per utente (ordinati per tempo)
CREATE INDEX IF NOT EXISTS idx_anne_chat_messages_user_id
  ON anne_chat_messages (user_id, created_at DESC);

-- Indice per cleanup vecchi messaggi
CREATE INDEX IF NOT EXISTS idx_anne_chat_messages_created_at
  ON anne_chat_messages (created_at);

-- RLS: ogni utente vede solo i propri messaggi
ALTER TABLE anne_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY anne_chat_messages_select ON anne_chat_messages
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY anne_chat_messages_insert ON anne_chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY anne_chat_messages_delete ON anne_chat_messages
  FOR DELETE USING (auth.uid() = user_id);

-- Service role puo' fare tutto (per API server-side)
CREATE POLICY anne_chat_messages_service ON anne_chat_messages
  FOR ALL USING (
    current_setting('request.jwt.claims', true)::jsonb->>'role' = 'service_role'
  );

-- Abilita Realtime per questa tabella (necessario per postgres_changes)
ALTER PUBLICATION supabase_realtime ADD TABLE anne_chat_messages;

-- Cleanup automatico: elimina messaggi piu' vecchi di 30 giorni
-- (eseguire via cron o manualmente)
-- DELETE FROM anne_chat_messages WHERE created_at < now() - interval '30 days';
