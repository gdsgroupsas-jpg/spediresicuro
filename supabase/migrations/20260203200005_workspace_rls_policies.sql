-- ============================================
-- MIGRAZIONE: RLS Policies per Organization/Workspace
-- ============================================
-- Parte del refactoring Architecture V2
--
-- Principi RLS:
-- 1. Superadmin vede TUTTO
-- 2. Member vede solo propri workspace + sub-workspace (se admin/owner)
-- 3. Isolamento totale tra organization/workspace diversi
-- ============================================

-- ============================================
-- RLS per ORGANIZATIONS
-- ============================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Superadmin full access organizations" ON public.organizations;
DROP POLICY IF EXISTS "Member can view own org" ON public.organizations;
DROP POLICY IF EXISTS "Member can update own org" ON public.organizations;

-- Superadmin: accesso totale
CREATE POLICY "Superadmin full access organizations" ON public.organizations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

-- Member: puo vedere organization se e' membro di almeno un workspace
CREATE POLICY "Member can view own org" ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT DISTINCT w.organization_id
      FROM public.workspace_members wm
      JOIN public.workspaces w ON w.id = wm.workspace_id
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );

-- Member: puo aggiornare organization solo se owner/admin di un workspace
CREATE POLICY "Member can update own org" ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT DISTINCT w.organization_id
      FROM public.workspace_members wm
      JOIN public.workspaces w ON w.id = wm.workspace_id
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    id IN (
      SELECT DISTINCT w.organization_id
      FROM public.workspace_members wm
      JOIN public.workspaces w ON w.id = wm.workspace_id
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin')
    )
  );

-- ============================================
-- RLS per WORKSPACES
-- ============================================
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Superadmin full access workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Member can view accessible workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owner admin can update workspace" ON public.workspaces;

-- Superadmin: accesso totale
CREATE POLICY "Superadmin full access workspaces" ON public.workspaces
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

-- Member: puo vedere workspace dove e' membro + sub-workspace (se owner/admin)
CREATE POLICY "Member can view accessible workspaces" ON public.workspaces
  FOR SELECT
  TO authenticated
  USING (
    -- Membership diretta
    id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR
    -- Sub-workspace: se sono owner/admin del parent, vedo anche i figli
    parent_workspace_id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- Owner/Admin: puo aggiornare il proprio workspace
CREATE POLICY "Owner admin can update workspace" ON public.workspaces
  FOR UPDATE
  TO authenticated
  USING (
    id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );

-- ============================================
-- RLS per WORKSPACE_MEMBERS
-- ============================================
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Superadmin full access members" ON public.workspace_members;
DROP POLICY IF EXISTS "Member can view workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Owner admin can manage members" ON public.workspace_members;
DROP POLICY IF EXISTS "User can view own memberships" ON public.workspace_members;

-- Superadmin: accesso totale
CREATE POLICY "Superadmin full access members" ON public.workspace_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

-- Member: puo vedere altri membri del proprio workspace
CREATE POLICY "Member can view workspace members" ON public.workspace_members
  FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid() AND wm.status = 'active'
    )
  );

-- Owner/Admin: puo gestire membri
CREATE POLICY "Owner admin can manage members" ON public.workspace_members
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin')
    )
  );

-- User: puo sempre vedere le proprie membership
CREATE POLICY "User can view own memberships" ON public.workspace_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- ============================================
-- RLS per WORKSPACE_INVITATIONS
-- ============================================
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Superadmin full access invitations" ON public.workspace_invitations;
DROP POLICY IF EXISTS "Owner admin can manage invitations" ON public.workspace_invitations;
DROP POLICY IF EXISTS "Invitee can view own invitations" ON public.workspace_invitations;

-- Superadmin: accesso totale
CREATE POLICY "Superadmin full access invitations" ON public.workspace_invitations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

-- Owner/Admin: puo gestire inviti del workspace
CREATE POLICY "Owner admin can manage invitations" ON public.workspace_invitations
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT wm.workspace_id FROM public.workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND wm.role IN ('owner', 'admin')
    )
  );

-- Invitee: puo vedere inviti a propria email (per accettarli)
CREATE POLICY "Invitee can view own invitations" ON public.workspace_invitations
  FOR SELECT
  TO authenticated
  USING (
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND status = 'pending'
  );

-- ============================================
-- FINE MIGRAZIONE RLS policies
-- ============================================
