-- Fix get_user_workspaces: rimuove overload ambiguo e corregge type mismatch
--
-- BUG 1: Due overload (1 param e 3 param) causano errore PGRST203
--         PostgREST non riesce a scegliere quale funzione chiamare
-- BUG 2: La versione 3-param dichiarava permissions JSONB ma la colonna e' TEXT[]
--         Causava errore 42804 "structure of query does not match function result type"
--
-- IMPATTO: /api/workspaces/my restituiva sempre [] (array vuoto) per tutti gli utenti
--          perche' l'RPC falliva silenziosamente
--
-- FIX: Drop entrambe le versioni, ricrea UNA sola con pagination e tipo corretto

-- Drop entrambe le overload
DROP FUNCTION IF EXISTS public.get_user_workspaces(UUID);
DROP FUNCTION IF EXISTS public.get_user_workspaces(UUID, INTEGER, INTEGER);

-- Ricrea con firma univoca, pagination e tipo corretto
CREATE OR REPLACE FUNCTION public.get_user_workspaces(
  p_user_id UUID,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  workspace_id UUID,
  workspace_name TEXT,
  workspace_slug TEXT,
  workspace_type TEXT,
  workspace_depth INTEGER,
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
  role TEXT,
  permissions TEXT[],
  wallet_balance NUMERIC,
  branding JSONB,
  member_status TEXT
) AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User ID required';
  END IF;

  RETURN QUERY
  SELECT
    w.id AS workspace_id,
    w.name AS workspace_name,
    w.slug AS workspace_slug,
    w.type::TEXT AS workspace_type,
    w.depth AS workspace_depth,
    o.id AS organization_id,
    o.name AS organization_name,
    o.slug AS organization_slug,
    wm.role::TEXT AS role,
    wm.permissions AS permissions,
    w.wallet_balance AS wallet_balance,
    o.branding AS branding,
    wm.status::TEXT AS member_status
  FROM public.workspace_members wm
  JOIN public.workspaces w ON w.id = wm.workspace_id
  JOIN public.organizations o ON o.id = w.organization_id
  WHERE wm.user_id = v_user_id
    AND wm.status = 'active'
    AND w.status = 'active'
    AND o.status = 'active'
  ORDER BY w.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_workspaces(UUID, INTEGER, INTEGER) IS
  'Restituisce workspace accessibili per utente. Filtra per status active su member, workspace e org. Supporta pagination.';
