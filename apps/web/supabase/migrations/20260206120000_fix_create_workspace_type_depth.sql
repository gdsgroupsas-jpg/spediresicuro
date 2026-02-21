-- Fix create_workspace_with_owner: aggiunge type e depth
--
-- BUG: L'INSERT non includeva type e depth.
-- type e' NOT NULL senza default → l'RPC falliva.
-- Ora accetta p_type e p_depth opzionali.
-- Se non forniti, li calcola dal parent workspace.
-- Se nessun parent e nessun tipo esplicito → errore.

-- Drop vecchia overload (8 parametri) per evitare ambiguita'
DROP FUNCTION IF EXISTS public.create_workspace_with_owner(UUID, TEXT, TEXT, UUID, UUID, UUID, UUID, UUID);

CREATE OR REPLACE FUNCTION public.create_workspace_with_owner(
  p_organization_id UUID,
  p_name TEXT,
  p_slug TEXT DEFAULT NULL,
  p_parent_workspace_id UUID DEFAULT NULL,
  p_owner_user_id UUID DEFAULT NULL,
  p_assigned_price_list_id UUID DEFAULT NULL,
  p_selling_price_list_id UUID DEFAULT NULL,
  p_assigned_courier_config_id UUID DEFAULT NULL,
  p_type TEXT DEFAULT NULL,
  p_depth INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_workspace_id UUID;
  v_owner_id UUID := COALESCE(p_owner_user_id, auth.uid());
  v_slug TEXT;
  v_type TEXT;
  v_depth INTEGER;
  v_parent_depth INTEGER;
BEGIN
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Owner user ID required';
  END IF;

  -- Calcola type e depth
  IF p_type IS NOT NULL AND p_depth IS NOT NULL THEN
    -- Espliciti: usa direttamente
    v_type := p_type;
    v_depth := p_depth;
  ELSIF p_parent_workspace_id IS NOT NULL THEN
    -- Calcola dal parent
    SELECT depth INTO v_parent_depth
    FROM public.workspaces
    WHERE id = p_parent_workspace_id;

    IF v_parent_depth IS NULL THEN
      RAISE EXCEPTION 'Parent workspace not found: %', p_parent_workspace_id;
    END IF;

    v_depth := v_parent_depth + 1;

    IF v_depth = 1 THEN
      v_type := 'reseller';
    ELSIF v_depth = 2 THEN
      v_type := 'client';
    ELSE
      RAISE EXCEPTION 'Max workspace depth exceeded (max 2, got %)', v_depth;
    END IF;
  ELSE
    -- Nessun parent e nessun tipo: errore di sicurezza
    RAISE EXCEPTION 'type and depth required when no parent workspace provided';
  END IF;

  -- Genera slug se non fornito
  IF p_slug IS NULL OR p_slug = '' THEN
    v_slug := public.generate_workspace_slug(p_organization_id, p_name);
  ELSE
    v_slug := p_slug;
  END IF;

  -- Crea workspace
  -- NOTA: platform_fee_override e parent_imposed_fee sono SEMPRE NULL!
  INSERT INTO public.workspaces (
    organization_id,
    name,
    slug,
    type,
    depth,
    parent_workspace_id,
    assigned_price_list_id,
    selling_price_list_id,
    assigned_courier_config_id,
    platform_fee_override,
    parent_imposed_fee,
    created_by
  ) VALUES (
    p_organization_id,
    p_name,
    v_slug,
    v_type,
    v_depth,
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
    v_owner_id
  );

  RETURN v_workspace_id;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'create_workspace_with_owner FAILED: % - SQLSTATE: %', SQLERRM, SQLSTATE;
  RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_workspace_with_owner(UUID, TEXT, TEXT, UUID, UUID, UUID, UUID, UUID, TEXT, INTEGER) IS
  'Crea workspace con owner ATOMICAMENTE. Accetta type/depth espliciti o li calcola dal parent. FEE SEMPRE NULL.';
