-- ============================================
-- MIGRAZIONE: Funzioni core per workspaces
-- ============================================
-- Parte del refactoring Architecture V2
--
-- Funzioni critiche:
-- - is_sub_workspace_of(): Verifica gerarchia (CRITICA - era mancante!)
-- - get_user_workspaces(): Lista workspace accessibili
-- - current_workspace(): Workspace corrente dalla sessione
-- - set_current_workspace(): Imposta workspace corrente
-- - create_workspace_with_owner(): Crea workspace con owner atomicamente
-- - has_workspace_permission(): Verifica permessi
-- ============================================

-- ============================================
-- is_sub_workspace_of()
-- ============================================
-- Verifica se workspace_a e' sotto workspace_b nella gerarchia
-- CRITICA: Questa funzione era usata ma NON esisteva!
CREATE OR REPLACE FUNCTION public.is_sub_workspace_of(
  workspace_a UUID,
  workspace_b UUID,
  max_depth INTEGER DEFAULT 10 -- Anti-loop protection
)
RETURNS BOOLEAN AS $$
DECLARE
  current_id UUID := workspace_a;
  current_depth INTEGER := 0;
BEGIN
  -- Stesso workspace = true
  IF workspace_a = workspace_b THEN
    RETURN TRUE;
  END IF;

  -- NULL check
  IF workspace_a IS NULL OR workspace_b IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Walk up the tree
  WHILE current_id IS NOT NULL AND current_depth < max_depth LOOP
    SELECT parent_workspace_id INTO current_id
    FROM public.workspaces
    WHERE id = current_id;

    IF current_id = workspace_b THEN
      RETURN TRUE;
    END IF;

    current_depth := current_depth + 1;
  END LOOP;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.is_sub_workspace_of IS 'Verifica se workspace_a e sotto workspace_b nella gerarchia. Max 10 livelli per anti-loop.';

-- ============================================
-- get_user_workspaces()
-- ============================================
-- Restituisce tutti i workspace accessibili da un utente
CREATE OR REPLACE FUNCTION public.get_user_workspaces(p_user_id UUID DEFAULT NULL)
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
  wallet_balance DECIMAL,
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
    w.type AS workspace_type,
    w.depth AS workspace_depth,
    o.id AS organization_id,
    o.name AS organization_name,
    o.slug AS organization_slug,
    wm.role,
    wm.permissions,
    w.wallet_balance,
    o.branding,
    wm.status AS member_status
  FROM public.workspace_members wm
  JOIN public.workspaces w ON w.id = wm.workspace_id
  JOIN public.organizations o ON o.id = w.organization_id
  WHERE wm.user_id = v_user_id
    AND wm.status = 'active'
    AND w.status = 'active'
    AND o.status = 'active'
  ORDER BY o.name, w.name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_workspaces IS 'Restituisce tutti i workspace accessibili da un utente con dettagli org e branding.';

-- ============================================
-- current_workspace()
-- ============================================
-- Restituisce workspace_id corrente dalla sessione
-- Usato in RLS policies
CREATE OR REPLACE FUNCTION public.current_workspace()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_workspace_id', TRUE), '')::UUID;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION public.current_workspace IS 'Restituisce workspace_id corrente dalla sessione. Usato in RLS.';

-- ============================================
-- set_current_workspace()
-- ============================================
-- Imposta workspace corrente (chiamato da middleware/API)
CREATE OR REPLACE FUNCTION public.set_current_workspace(p_workspace_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_member BOOLEAN;
  v_is_superadmin BOOLEAN;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Superadmin puo accedere a qualsiasi workspace
  SELECT EXISTS(
    SELECT 1 FROM auth.users
    WHERE id = v_user_id
    AND raw_user_meta_data->>'account_type' = 'superadmin'
  ) INTO v_is_superadmin;

  IF NOT v_is_superadmin THEN
    -- Verifica membership per utenti normali
    SELECT EXISTS(
      SELECT 1 FROM public.workspace_members
      WHERE workspace_id = p_workspace_id
        AND user_id = v_user_id
        AND status = 'active'
    ) INTO v_is_member;

    IF NOT v_is_member THEN
      RAISE EXCEPTION 'User is not a member of workspace %', p_workspace_id;
    END IF;
  END IF;

  -- Imposta nella sessione
  PERFORM set_config('app.current_workspace_id', p_workspace_id::TEXT, TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.set_current_workspace IS 'Imposta workspace corrente nella sessione. Verifica membership.';

-- ============================================
-- create_workspace_with_owner()
-- ============================================
-- Crea workspace con owner atomicamente
-- IMPORTANTE: Non imposta MAI fee di default!
CREATE OR REPLACE FUNCTION public.create_workspace_with_owner(
  p_organization_id UUID,
  p_name TEXT,
  p_slug TEXT DEFAULT NULL,
  p_parent_workspace_id UUID DEFAULT NULL,
  p_owner_user_id UUID DEFAULT NULL,
  p_assigned_price_list_id UUID DEFAULT NULL,
  p_selling_price_list_id UUID DEFAULT NULL,
  p_assigned_courier_config_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_workspace_id UUID;
  v_owner_id UUID := COALESCE(p_owner_user_id, auth.uid());
  v_slug TEXT;
BEGIN
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Owner user ID required';
  END IF;

  -- Genera slug se non fornito
  IF p_slug IS NULL OR p_slug = '' THEN
    v_slug := public.generate_workspace_slug(p_organization_id, p_name);
  ELSE
    v_slug := p_slug;
  END IF;

  -- Crea workspace
  -- NOTA: platform_fee_override e parent_imposed_fee sono NULL!
  -- Il Superadmin deve configurarli manualmente dopo la creazione.
  INSERT INTO public.workspaces (
    organization_id,
    name,
    slug,
    parent_workspace_id,
    assigned_price_list_id,
    selling_price_list_id,
    assigned_courier_config_id,
    -- FEE SEMPRE NULL - REGOLA CRITICA!
    platform_fee_override,
    parent_imposed_fee,
    created_by
  ) VALUES (
    p_organization_id,
    p_name,
    v_slug,
    p_parent_workspace_id,
    p_assigned_price_list_id,
    p_selling_price_list_id,
    p_assigned_courier_config_id,
    NULL, -- MAI default!
    NULL, -- MAI default!
    v_owner_id
  )
  RETURNING id INTO v_workspace_id;

  -- Aggiungi owner come member attivo
  INSERT INTO public.workspace_members (
    workspace_id,
    user_id,
    role,
    status,
    accepted_at,
    invited_by
  ) VALUES (
    v_workspace_id,
    v_owner_id,
    'owner',
    'active',
    NOW(),
    v_owner_id -- Self-invited
  );

  RETURN v_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_workspace_with_owner IS 'Crea workspace con owner atomicamente. FEE SEMPRE NULL - Superadmin configura dopo!';

-- ============================================
-- has_workspace_permission()
-- ============================================
-- Verifica se utente ha un permesso specifico nel workspace
CREATE OR REPLACE FUNCTION public.has_workspace_permission(
  p_workspace_id UUID,
  p_permission TEXT,
  p_user_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_member RECORD;
  v_is_superadmin BOOLEAN;
BEGIN
  v_user_id := COALESCE(p_user_id, auth.uid());

  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Superadmin ha tutti i permessi
  SELECT EXISTS(
    SELECT 1 FROM auth.users
    WHERE id = v_user_id
    AND raw_user_meta_data->>'account_type' = 'superadmin'
  ) INTO v_is_superadmin;

  IF v_is_superadmin THEN
    RETURN TRUE;
  END IF;

  -- Trova membership
  SELECT role, permissions INTO v_member
  FROM public.workspace_members
  WHERE workspace_id = p_workspace_id
    AND user_id = v_user_id
    AND status = 'active';

  IF v_member IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Owner e Admin hanno tutti i permessi
  IF v_member.role IN ('owner', 'admin') THEN
    RETURN TRUE;
  END IF;

  -- Verifica permesso specifico
  -- Formato permesso: 'resource:action' (es: 'shipments:create')
  IF p_permission = ANY(v_member.permissions) THEN
    RETURN TRUE;
  END IF;

  -- Permessi impliciti per role
  CASE v_member.role
    WHEN 'operator' THEN
      -- Operator puo: creare spedizioni, vedere wallet
      RETURN p_permission IN (
        'shipments:create', 'shipments:view', 'shipments:track',
        'wallet:view', 'contacts:view', 'contacts:create'
      );
    WHEN 'viewer' THEN
      -- Viewer puo solo vedere
      RETURN p_permission LIKE '%:view';
    ELSE
      RETURN FALSE;
  END CASE;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION public.has_workspace_permission IS 'Verifica se utente ha permesso nel workspace. Superadmin/owner/admin hanno tutto.';

-- ============================================
-- get_workspace_hierarchy()
-- ============================================
-- Restituisce la catena gerarchica di un workspace
CREATE OR REPLACE FUNCTION public.get_workspace_hierarchy(p_workspace_id UUID)
RETURNS TABLE (
  workspace_id UUID,
  workspace_name TEXT,
  workspace_type TEXT,
  depth INTEGER,
  wallet_balance DECIMAL,
  assigned_price_list_id UUID,
  platform_fee_override DECIMAL,
  parent_imposed_fee DECIMAL
) AS $$
WITH RECURSIVE hierarchy AS (
  -- Base: workspace richiesto
  SELECT
    w.id,
    w.name,
    w.type,
    w.depth,
    w.wallet_balance,
    w.assigned_price_list_id,
    w.platform_fee_override,
    w.parent_imposed_fee,
    w.parent_workspace_id
  FROM public.workspaces w
  WHERE w.id = p_workspace_id

  UNION ALL

  -- Ricorsione: parent
  SELECT
    w.id,
    w.name,
    w.type,
    w.depth,
    w.wallet_balance,
    w.assigned_price_list_id,
    w.platform_fee_override,
    w.parent_imposed_fee,
    w.parent_workspace_id
  FROM public.workspaces w
  JOIN hierarchy h ON w.id = h.parent_workspace_id
)
SELECT
  h.id AS workspace_id,
  h.name AS workspace_name,
  h.type AS workspace_type,
  h.depth,
  h.wallet_balance,
  h.assigned_price_list_id,
  h.platform_fee_override,
  h.parent_imposed_fee
FROM hierarchy h
ORDER BY h.depth ASC; -- Platform first, then reseller, then client
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION public.get_workspace_hierarchy IS 'Restituisce la catena gerarchica dal workspace al platform.';

-- ============================================
-- FINE MIGRAZIONE funzioni core
-- ============================================
