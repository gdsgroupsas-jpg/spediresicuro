-- ============================================================
-- Migration: Fix Sub-Users Orfani (senza workspace)
--
-- Problema: createSubUser() creava solo il record utente
-- senza creare workspace, membership, o organizzazione.
-- Alcuni sub-user esistenti non hanno workspace.
--
-- Fix: Per ogni sub-user con parent_reseller_id ma senza
-- primary_workspace_id, crea un workspace client (depth 2)
-- sotto il workspace del reseller parent, e aggiunge il
-- reseller come admin nel workspace del client.
-- ============================================================

DO $$
DECLARE
  rec RECORD;
  v_reseller_ws_id UUID;
  v_org_id UUID;
  v_new_ws_id UUID;
BEGIN
  -- Trova tutti i sub-user senza workspace
  FOR rec IN
    SELECT u.id AS user_id,
           u.name AS user_name,
           u.email AS user_email,
           COALESCE(u.parent_reseller_id, u.parent_id) AS reseller_id
    FROM users u
    WHERE u.primary_workspace_id IS NULL
      AND (u.parent_reseller_id IS NOT NULL OR u.parent_id IS NOT NULL)
      AND u.is_reseller = false
      AND u.account_type = 'user'
  LOOP
    RAISE NOTICE 'Processing orphan sub-user: % (%)', rec.user_email, rec.user_id;

    -- Trova il workspace del reseller parent
    SELECT primary_workspace_id INTO v_reseller_ws_id
    FROM users
    WHERE id = rec.reseller_id;

    IF v_reseller_ws_id IS NULL THEN
      RAISE NOTICE '  SKIP: reseller % has no workspace', rec.reseller_id;
      CONTINUE;
    END IF;

    -- Trova organization_id dal workspace del reseller
    SELECT organization_id INTO v_org_id
    FROM workspaces
    WHERE id = v_reseller_ws_id;

    IF v_org_id IS NULL THEN
      RAISE NOTICE '  SKIP: workspace % has no organization', v_reseller_ws_id;
      CONTINUE;
    END IF;

    -- Crea workspace client per il sub-user
    v_new_ws_id := public.create_workspace_with_owner(
      p_organization_id := v_org_id,
      p_name := rec.user_name || ' Workspace',
      p_parent_workspace_id := v_reseller_ws_id,
      p_owner_user_id := rec.user_id,
      p_type := 'client',
      p_depth := 2
    );

    IF v_new_ws_id IS NULL THEN
      RAISE NOTICE '  ERROR: failed to create workspace for %', rec.user_email;
      CONTINUE;
    END IF;

    RAISE NOTICE '  Created workspace % for %', v_new_ws_id, rec.user_email;

    -- Imposta primary_workspace_id sul sub-user
    UPDATE users
    SET primary_workspace_id = v_new_ws_id
    WHERE id = rec.user_id;

    -- Aggiorna anche parent_reseller_id se mancante (fix legacy)
    UPDATE users
    SET parent_reseller_id = rec.reseller_id
    WHERE id = rec.user_id
      AND parent_reseller_id IS NULL
      AND parent_id IS NOT NULL;

    -- Aggiungi il reseller come admin nel workspace del client
    INSERT INTO workspace_members (
      workspace_id,
      user_id,
      role,
      status,
      accepted_at,
      invited_by
    ) VALUES (
      v_new_ws_id,
      rec.reseller_id,
      'admin',
      'active',
      NOW(),
      rec.reseller_id
    )
    ON CONFLICT (workspace_id, user_id) DO NOTHING;

    RAISE NOTICE '  Added reseller % as admin in workspace %', rec.reseller_id, v_new_ws_id;

  END LOOP;

  RAISE NOTICE 'Migration complete: all orphan sub-users processed';
END;
$$;
