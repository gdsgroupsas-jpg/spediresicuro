-- ============================================
-- MIGRAZIONE: Fix Atomicità e RLS per 10/10
-- ============================================
-- Fix critici identificati dall'audit di sicurezza:
-- 1. Transazione esplicita in create_workspace_with_owner
-- 2. RLS su organizations table
-- ============================================

-- ============================================
-- FIX 1: create_workspace_with_owner con EXCEPTION handler
-- ============================================
-- La funzione è già atomica (PL/pgSQL), ma aggiungiamo
-- EXCEPTION handler per logging esplicito e rollback garantito

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

EXCEPTION WHEN OTHERS THEN
  -- Log error e re-raise per garantire rollback
  RAISE WARNING 'create_workspace_with_owner FAILED: % - SQLSTATE: %', SQLERRM, SQLSTATE;
  RAISE; -- Re-raise per rollback automatico della transazione
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_workspace_with_owner IS
  'Crea workspace con owner ATOMICAMENTE. FEE SEMPRE NULL - Superadmin configura dopo! Ha EXCEPTION handler per rollback garantito.';

-- ============================================
-- FIX 2: RLS su organizations table
-- ============================================
-- Attualmente organizations non ha RLS, quindi admin può vedere org di altri.
-- Aggiungiamo policies per isolamento.

-- Abilita RLS se non già abilitato
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies se esistono
DROP POLICY IF EXISTS "Superadmin full access organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can view own organizations" ON public.organizations;
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON public.organizations;

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

-- User: SELECT org a cui appartiene (via workspace membership)
CREATE POLICY "Users can view organizations they belong to" ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    -- Può vedere org se è member di almeno un workspace di quella org
    id IN (
      SELECT w.organization_id
      FROM public.workspaces w
      JOIN public.workspace_members wm ON wm.workspace_id = w.id
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
        AND w.status = 'active'
    )
  );

-- ============================================
-- FIX 3: RLS consistency check - workspace_members INSERT
-- ============================================
-- Aggiunge verifica esplicita che workspace_members.status = 'active'
-- è già presente nel WHERE, quindi questo è solo documentazione

COMMENT ON TABLE public.workspace_members IS
  'Membership utente-workspace. RLS policies verificano SEMPRE status = active per evitare race condition.';

-- ============================================
-- FINE FIX SICUREZZA
-- ============================================
