-- ============================================
-- FIX: Corregge trigger audit workspace_members
-- ============================================
-- Bug originale in 20260203200010_warning_fixes_completeness.sql:
-- 1. Usava 'audit_metadata' invece di 'metadata'
-- 2. resource_id era cast a TEXT ma la colonna e' UUID
-- 3. Mancavano campi NOT NULL: severity, message
-- ============================================

CREATE OR REPLACE FUNCTION public.log_workspace_member_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_message TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_action := 'WORKSPACE_MEMBER_ADDED';
    v_message := 'Member added to workspace';
    v_old_data := NULL;
    v_new_data := jsonb_build_object(
      'workspace_id', NEW.workspace_id,
      'user_id', NEW.user_id,
      'role', NEW.role,
      'status', NEW.status,
      'permissions', NEW.permissions
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role != NEW.role THEN
      v_action := 'WORKSPACE_MEMBER_ROLE_CHANGED';
      v_message := 'Member role changed from ' || OLD.role || ' to ' || NEW.role;
    ELSIF OLD.status != NEW.status THEN
      v_action := 'WORKSPACE_MEMBER_STATUS_CHANGED';
      v_message := 'Member status changed from ' || OLD.status || ' to ' || NEW.status;
    ELSIF OLD.permissions::TEXT != NEW.permissions::TEXT THEN
      v_action := 'WORKSPACE_MEMBER_PERMISSIONS_CHANGED';
      v_message := 'Member permissions updated';
    ELSE
      RETURN NEW;
    END IF;

    v_old_data := jsonb_build_object(
      'role', OLD.role,
      'status', OLD.status,
      'permissions', OLD.permissions
    );
    v_new_data := jsonb_build_object(
      'role', NEW.role,
      'status', NEW.status,
      'permissions', NEW.permissions
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'WORKSPACE_MEMBER_REMOVED';
    v_message := 'Member removed from workspace';
    v_old_data := jsonb_build_object(
      'workspace_id', OLD.workspace_id,
      'user_id', OLD.user_id,
      'role', OLD.role
    );
    v_new_data := NULL;
  END IF;

  INSERT INTO public.audit_logs (
    action,
    resource_type,
    resource_id,
    user_id,
    workspace_id,
    metadata,
    severity,
    message  -- ADDED
  ) VALUES (
    v_action,
    'workspace_member',
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.user_id, OLD.user_id),
    COALESCE(NEW.workspace_id, OLD.workspace_id),
    jsonb_build_object(
      'old_data', v_old_data,
      'new_data', v_new_data,
      'changed_at', NOW()
    ),
    'info',
    v_message  -- ADDED
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix anche soft_delete_workspace
CREATE OR REPLACE FUNCTION public.soft_delete_workspace(
  p_workspace_id UUID,
  p_deleted_by UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
  v_active_shipments INTEGER;
  v_pending_transactions INTEGER;
  v_deleter_id UUID := COALESCE(p_deleted_by, auth.uid());
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_workspace_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Workspace not found or already deleted';
  END IF;

  SELECT COUNT(*) INTO v_active_shipments
  FROM public.shipments
  WHERE workspace_id = p_workspace_id
    AND deleted = false
    AND status NOT IN ('delivered', 'cancelled', 'returned');

  IF v_active_shipments > 0 THEN
    RAISE EXCEPTION 'Cannot delete workspace with % active shipments', v_active_shipments;
  END IF;

  SELECT COUNT(*) INTO v_pending_transactions
  FROM public.wallet_transactions
  WHERE workspace_id = p_workspace_id
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_pending_transactions > 0 THEN
    RAISE WARNING 'Workspace has % recent transactions (last 24h)', v_pending_transactions;
  END IF;

  UPDATE public.workspaces
  SET status = 'deleted', updated_at = NOW()
  WHERE id = p_workspace_id;

  UPDATE public.workspace_members
  SET status = 'removed', updated_at = NOW()
  WHERE workspace_id = p_workspace_id AND status = 'active';

  UPDATE public.workspace_invitations
  SET status = 'cancelled'
  WHERE workspace_id = p_workspace_id AND status = 'pending';

  INSERT INTO public.audit_logs (
    action, resource_type, resource_id, user_id, workspace_id, metadata, severity, message
  ) VALUES (
    'WORKSPACE_DELETED',
    'workspace',
    p_workspace_id,
    v_deleter_id,
    p_workspace_id,
    jsonb_build_object(
      'deleted_at', NOW(),
      'active_shipments_at_deletion', v_active_shipments,
      'recent_transactions', v_pending_transactions
    ),
    'warning',
    'Workspace soft-deleted'  -- ADDED
  );

  RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'soft_delete_workspace FAILED: %', SQLERRM;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
