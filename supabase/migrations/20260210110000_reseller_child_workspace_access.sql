-- Permette ai reseller di vedere e accedere ai workspace figli (client)
--
-- PROBLEMA: get_user_workspaces restituisce solo workspace dove l'utente
--           e' membro diretto (workspace_members). I reseller non sono membri
--           dei workspace client dei loro sub-user, quindi non li vedono
--           e non possono switchare.
--
-- FIX: Estende la query per includere anche i workspace con
--      parent_workspace_id = uno dei workspace di cui il reseller e' owner/admin
--
-- SICUREZZA: Il reseller vede i workspace figli con ruolo 'admin' (non 'owner'),
--            per distinguere dall'accesso diretto. Solo workspace attivi.

DROP FUNCTION IF EXISTS public.get_user_workspaces(UUID, INTEGER, INTEGER);

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
  -- Workspace dove l'utente e' membro diretto
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

  UNION ALL

  -- Workspace figli di workspace dove l'utente e' owner o admin
  -- (reseller che accede ai workspace dei propri clienti)
  SELECT
    cw.id AS workspace_id,
    cw.name AS workspace_name,
    cw.slug AS workspace_slug,
    cw.type::TEXT AS workspace_type,
    cw.depth AS workspace_depth,
    co.id AS organization_id,
    co.name AS organization_name,
    co.slug AS organization_slug,
    'admin'::TEXT AS role,  -- Reseller ha ruolo admin sui workspace figli
    ARRAY[]::TEXT[] AS permissions,
    cw.wallet_balance AS wallet_balance,
    co.branding AS branding,
    'active'::TEXT AS member_status
  FROM public.workspace_members wm
  JOIN public.workspaces pw ON pw.id = wm.workspace_id  -- parent workspace
  JOIN public.workspaces cw ON cw.parent_workspace_id = pw.id  -- child workspace
  JOIN public.organizations co ON co.id = cw.organization_id
  WHERE wm.user_id = v_user_id
    AND wm.status = 'active'
    AND wm.role IN ('owner', 'admin')  -- Solo owner/admin del parent
    AND pw.status = 'active'
    AND cw.status = 'active'
    AND co.status = 'active'
    -- Evita duplicati: escludi se gia' membro diretto
    AND NOT EXISTS (
      SELECT 1 FROM public.workspace_members dm
      WHERE dm.workspace_id = cw.id
        AND dm.user_id = v_user_id
        AND dm.status = 'active'
    )

  ORDER BY workspace_name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_workspaces(UUID, INTEGER, INTEGER) IS
  'Restituisce workspace accessibili per utente: membership diretta + workspace figli per reseller owner/admin. Supporta pagination.';
