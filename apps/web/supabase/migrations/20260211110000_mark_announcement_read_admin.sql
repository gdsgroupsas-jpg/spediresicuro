-- ============================================================
-- RPC: mark_announcement_read_admin
--
-- Versione admin di mark_announcement_read che accetta p_user_id
-- esplicito. Utilizzata dal service_role (supabaseAdmin) nelle
-- API routes dove auth.uid() non è disponibile.
--
-- Sicurezza:
-- - SECURITY DEFINER: eseguita con permessi owner
-- - Solo callable da service_role (REVOKE da authenticated)
-- - Atomic: usa array_append con guard NOT ANY per idempotenza
-- - Nessun leak: non restituisce dati sensibili
-- ============================================================

CREATE OR REPLACE FUNCTION mark_announcement_read_admin(
  p_announcement_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifica che l'annuncio esista
  IF NOT EXISTS (
    SELECT 1 FROM workspace_announcements WHERE id = p_announcement_id
  ) THEN
    RETURN false;
  END IF;

  -- Atomic append (idempotente: non duplica se già presente)
  UPDATE workspace_announcements
  SET read_by = array_append(read_by, p_user_id)
  WHERE id = p_announcement_id
    AND NOT (p_user_id = ANY(read_by));

  RETURN true;
END;
$$;

-- Solo service_role può chiamare questa funzione
REVOKE ALL ON FUNCTION mark_announcement_read_admin(UUID, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_announcement_read_admin(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION mark_announcement_read_admin(UUID, UUID) TO service_role;
