-- ============================================================================
-- MIGRAZIONE: Fix ricorsione RLS — funzioni helper senza join a workspaces
-- ============================================================================
-- Problema: get_user_accessible_workspace_ids() fa SELECT su workspaces,
-- che ha RLS con policy che fa JOIN su workspace_members → ricorsione.
--
-- Soluzione: evitare di accedere a workspaces nella funzione helper.
-- Per i sub-workspace, cercare direttamente in workspace_members
-- i workspace dove l'utente è owner/admin, poi cercare workspace_members
-- per i workspace con parent_workspace_id in quella lista.
--
-- NOTA: workspace_members NON ha RLS sulle proprie righe quando la funzione
-- è SECURITY DEFINER (bypassa RLS su workspace_members ma NON su workspaces).
-- ============================================================================

-- Sostituisce get_user_accessible_workspace_ids: usa solo workspace_members
-- Usa la colonna workspace_id della membership + parent_workspace_id da workspaces
-- MA NON TOCCA workspaces con RLS — usa solo workspace_members e workspaces
-- tramite lookup diretto senza RLS (SECURITY DEFINER bypassa RLS del chiamante).

-- APPROCCIO ALTERNATIVO: restituisce solo workspace con membership diretta
-- (senza gerarchia reseller) per evitare completamente il join su workspaces.
-- La gerarchia viene già gestita dall'application layer (workspaceQuery).
-- Per il RLS difensivo è sufficiente l'isolamento base.

CREATE OR REPLACE FUNCTION public.get_user_accessible_workspace_ids(p_user_id UUID)
RETURNS UUID[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
DECLARE
  v_direct_ws UUID[];
  v_parent_ws UUID[];
  v_result UUID[];
BEGIN
  -- Membership diretta (bypassa RLS su workspace_members grazie a SECURITY DEFINER)
  SELECT ARRAY(
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = p_user_id
      AND status = 'active'
  ) INTO v_direct_ws;

  -- Sub-workspace: cerca workspace dove parent_workspace_id è uno dei workspace
  -- dove l'utente è owner/admin. Usiamo SET LOCAL row_security = off per
  -- bypassare RLS su workspaces all'interno della funzione SECURITY DEFINER.
  -- Nota: questo funziona solo se la funzione è owned da un ruolo con BYPASSRLS
  -- o se il DB supporta SET row_security = off in SECURITY DEFINER.
  -- Fallback sicuro: restituisce solo workspace diretti se workspaces ha RLS problematica.
  BEGIN
    -- Tenta di leggere sub-workspace bypassando RLS
    SELECT ARRAY(
      SELECT wm2.workspace_id
      FROM workspace_members wm1
      JOIN workspace_members wm2 ON wm2.workspace_id IN (
        -- workspace dove parent è un workspace dove utente è owner/admin
        -- Questo subquery tocca solo workspace_members, non workspaces
        SELECT wm1.workspace_id
        FROM workspace_members wm1
        WHERE wm1.user_id = p_user_id
          AND wm1.status = 'active'
          AND wm1.role IN ('owner', 'admin')
      )
      WHERE wm2.user_id != p_user_id  -- sub-workspace hanno altri owner
      LIMIT 0  -- Placeholder: lasciamo solo membership diretta per sicurezza
    ) INTO v_parent_ws;
  EXCEPTION WHEN OTHERS THEN
    v_parent_ws := '{}';
  END;

  -- Combina: diretti + sub-workspace
  v_result := v_direct_ws;

  RETURN v_result;
END;
$$;

-- ============================================================================
-- VERSIONE SEMPLIFICATA: solo membership diretta (sicura, senza ricorsione)
-- Il reseller vede i propri workspace. La gerarchia è gestita dall'app layer.
-- ============================================================================

-- Aggiorna get_user_accessible_workspace_ids alla versione sicura
CREATE OR REPLACE FUNCTION public.get_user_accessible_workspace_ids(p_user_id UUID)
RETURNS UUID[]
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public, pg_temp
STABLE
AS $$
  -- Solo membership diretta (evita join su workspaces per prevenire ricorsione RLS)
  -- Nota: questo è il secondo layer difensivo; la gerarchia reseller→sub-client
  -- è già gestita dall'application layer (workspaceQuery + getWorkspaceAuth).
  SELECT ARRAY(
    SELECT workspace_id
    FROM workspace_members
    WHERE user_id = p_user_id
      AND status = 'active'
  );
$$;

-- ============================================================================
-- FINE MIGRAZIONE: Fix ricorsione — get_user_accessible_workspace_ids semplificata
-- ============================================================================
