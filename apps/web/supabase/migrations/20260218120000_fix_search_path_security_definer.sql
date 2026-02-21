-- ============================================
-- Migration: Fix SET search_path su funzioni SECURITY DEFINER
-- Data: 2026-02-18
-- Autore: Claude (audit FASE 2)
--
-- Aggiunge SET search_path = public, pg_temp a TUTTE le funzioni
-- SECURITY DEFINER che lo avevano mancante o incompleto.
-- Questo previene attacchi search_path injection.
--
-- Usa ALTER FUNCTION con TRY/CATCH per ignorare funzioni
-- che non esistono in produzione.
-- ============================================

DO $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- CRITICI: completamente mancante
  BEGIN ALTER FUNCTION public.mark_announcement_read_admin(UUID, UUID) SET search_path = public, pg_temp; v_count := v_count + 1; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.get_user_workspaces(UUID, INTEGER, INTEGER) SET search_path = public, pg_temp; v_count := v_count + 1; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.has_workspace_permission(UUID, TEXT, UUID) SET search_path = public, pg_temp; v_count := v_count + 1; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.is_sub_workspace_of(UUID, UUID, INTEGER) SET search_path = public, pg_temp; v_count := v_count + 1; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.current_workspace() SET search_path = public, pg_temp; v_count := v_count + 1; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.set_current_workspace(UUID) SET search_path = public, pg_temp; v_count := v_count + 1; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.log_workspace_member_changes() SET search_path = public, pg_temp; v_count := v_count + 1; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.soft_delete_workspace() SET search_path = public, pg_temp; v_count := v_count + 1; EXCEPTION WHEN undefined_function THEN NULL; END;

  -- INCOMPLETI: avevano solo 'public', mancava pg_temp
  BEGIN ALTER FUNCTION public.send_workspace_email(UUID, UUID, TEXT[], TEXT[], TEXT[], TEXT, TEXT, TEXT, UUID, BOOLEAN) SET search_path = public, pg_temp; v_count := v_count + 1; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.lookup_workspace_by_email(TEXT) SET search_path = public, pg_temp; v_count := v_count + 1; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.mark_announcement_read(UUID) SET search_path = public, pg_temp; v_count := v_count + 1; EXCEPTION WHEN undefined_function THEN NULL; END;

  -- v1 legacy: avevano solo 'public'
  BEGIN ALTER FUNCTION public.reseller_transfer_credit(UUID, UUID, DECIMAL, TEXT, TEXT) SET search_path = public, pg_temp; v_count := v_count + 1; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.sync_wallet_to_workspace() SET search_path = public, pg_temp; v_count := v_count + 1; EXCEPTION WHEN undefined_function THEN NULL; END;

  -- create_workspace_with_owner
  BEGIN ALTER FUNCTION public.create_workspace_with_owner(UUID, TEXT, TEXT, UUID, UUID, UUID, UUID, UUID, TEXT, INTEGER) SET search_path = public, pg_temp; v_count := v_count + 1; EXCEPTION WHEN undefined_function THEN NULL; END;

  -- Workspace visibility functions
  BEGIN ALTER FUNCTION public.get_visible_workspace_ids(UUID) SET search_path = public, pg_temp; v_count := v_count + 1; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.can_workspace_see(UUID, UUID) SET search_path = public, pg_temp; v_count := v_count + 1; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.get_workspace_hierarchy(UUID) SET search_path = public, pg_temp; v_count := v_count + 1; EXCEPTION WHEN undefined_function THEN NULL; END;

  -- Invitation functions
  BEGIN ALTER FUNCTION public.accept_workspace_invitation(TEXT, UUID) SET search_path = public, pg_temp; v_count := v_count + 1; EXCEPTION WHEN undefined_function THEN NULL; END;
  BEGIN ALTER FUNCTION public.revoke_workspace_invitation(UUID) SET search_path = public, pg_temp; v_count := v_count + 1; EXCEPTION WHEN undefined_function THEN NULL; END;

  RAISE NOTICE 'SET search_path applicato a % funzioni SECURITY DEFINER', v_count;
END $$;
