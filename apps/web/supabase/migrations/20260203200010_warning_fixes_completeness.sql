-- ============================================
-- MIGRAZIONE: Fix WARNING per completezza 10/10
-- ============================================
-- Fix warning identificati dall'audit:
-- 1. Invitation expiry trigger (auto-expire inviti scaduti)
-- 2. Permission audit trail (log cambio permessi)
-- 3. Price list FK con ON DELETE SET NULL
-- 4. Workspace deletion soft-delete function
-- ============================================

-- ============================================
-- FIX 1: Invitation Expiry - Auto-expire inviti scaduti
-- ============================================

-- Funzione per marcare inviti scaduti
CREATE OR REPLACE FUNCTION public.expire_workspace_invitations()
RETURNS INTEGER AS $$
DECLARE
  v_expired_count INTEGER;
BEGIN
  UPDATE public.workspace_invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();

  GET DIAGNOSTICS v_expired_count = ROW_COUNT;

  IF v_expired_count > 0 THEN
    RAISE NOTICE 'Expired % workspace invitations', v_expired_count;
  END IF;

  RETURN v_expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.expire_workspace_invitations IS
  'Auto-expire pending invitations past their expires_at date. Run via cron.';

-- Trigger che verifica expiry su SELECT (lazy expiry)
CREATE OR REPLACE FUNCTION public.check_invitation_expiry()
RETURNS TRIGGER AS $$
BEGIN
  -- Se l'invito è pending e scaduto, marcalo expired
  IF NEW.status = 'pending' AND NEW.expires_at < NOW() THEN
    NEW.status := 'expired';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger se esiste
DROP TRIGGER IF EXISTS trg_check_invitation_expiry ON public.workspace_invitations;

-- Trigger BEFORE UPDATE per lazy expiry check
CREATE TRIGGER trg_check_invitation_expiry
  BEFORE UPDATE ON public.workspace_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.check_invitation_expiry();

-- ============================================
-- FIX 2: Permission Audit Trail
-- ============================================
-- Trigger per loggare modifiche a workspace_members

CREATE OR REPLACE FUNCTION public.log_workspace_member_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_action TEXT;
  v_old_data JSONB;
  v_new_data JSONB;
BEGIN
  -- Determina azione
  IF TG_OP = 'INSERT' THEN
    v_action := 'WORKSPACE_MEMBER_ADDED';
    v_old_data := NULL;
    v_new_data := jsonb_build_object(
      'workspace_id', NEW.workspace_id,
      'user_id', NEW.user_id,
      'role', NEW.role,
      'status', NEW.status,
      'permissions', NEW.permissions
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Verifica cosa è cambiato
    IF OLD.role != NEW.role THEN
      v_action := 'WORKSPACE_MEMBER_ROLE_CHANGED';
    ELSIF OLD.status != NEW.status THEN
      v_action := 'WORKSPACE_MEMBER_STATUS_CHANGED';
    ELSIF OLD.permissions::TEXT != NEW.permissions::TEXT THEN
      v_action := 'WORKSPACE_MEMBER_PERMISSIONS_CHANGED';
    ELSE
      -- Nessun cambio rilevante, skip
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
    v_old_data := jsonb_build_object(
      'workspace_id', OLD.workspace_id,
      'user_id', OLD.user_id,
      'role', OLD.role
    );
    v_new_data := NULL;
  END IF;

  -- Inserisci audit log
  INSERT INTO public.audit_logs (
    action,
    resource_type,
    resource_id,
    user_id,
    workspace_id,
    audit_metadata
  ) VALUES (
    v_action,
    'workspace_member',
    COALESCE(NEW.id, OLD.id)::TEXT,
    COALESCE(NEW.user_id, OLD.user_id),
    COALESCE(NEW.workspace_id, OLD.workspace_id),
    jsonb_build_object(
      'old_data', v_old_data,
      'new_data', v_new_data,
      'changed_at', NOW()
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger se esiste
DROP TRIGGER IF EXISTS trg_audit_workspace_members ON public.workspace_members;

-- Trigger per audit automatico
CREATE TRIGGER trg_audit_workspace_members
  AFTER INSERT OR UPDATE OR DELETE ON public.workspace_members
  FOR EACH ROW
  EXECUTE FUNCTION public.log_workspace_member_changes();

COMMENT ON FUNCTION public.log_workspace_member_changes IS
  'Auto-log all workspace member changes (role, status, permissions) to audit_logs.';

-- ============================================
-- FIX 3: Price List FK - ON DELETE SET NULL
-- ============================================
-- Se il listino assegnato viene cancellato, imposta NULL invece di bloccare

-- Drop FK esistente se esiste
ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_assigned_price_list_id_fkey;

-- Ricrea con ON DELETE SET NULL
ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_assigned_price_list_id_fkey
  FOREIGN KEY (assigned_price_list_id)
  REFERENCES public.price_lists(id)
  ON DELETE SET NULL;

-- Stesso per selling_price_list_id
ALTER TABLE public.workspaces
  DROP CONSTRAINT IF EXISTS workspaces_selling_price_list_id_fkey;

ALTER TABLE public.workspaces
  ADD CONSTRAINT workspaces_selling_price_list_id_fkey
  FOREIGN KEY (selling_price_list_id)
  REFERENCES public.price_lists(id)
  ON DELETE SET NULL;

-- ============================================
-- FIX 4: Workspace Soft Delete Function
-- ============================================
-- Funzione per eliminare workspace in modo sicuro

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
  -- Verifica che workspace esista e sia attivo
  IF NOT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_workspace_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Workspace not found or already deleted';
  END IF;

  -- Verifica che non ci siano spedizioni attive
  SELECT COUNT(*) INTO v_active_shipments
  FROM public.shipments
  WHERE workspace_id = p_workspace_id
    AND deleted = false
    AND status NOT IN ('delivered', 'cancelled', 'returned');

  IF v_active_shipments > 0 THEN
    RAISE EXCEPTION 'Cannot delete workspace with % active shipments', v_active_shipments;
  END IF;

  -- Verifica che non ci siano transazioni pending
  SELECT COUNT(*) INTO v_pending_transactions
  FROM public.wallet_transactions
  WHERE workspace_id = p_workspace_id
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_pending_transactions > 0 THEN
    RAISE WARNING 'Workspace has % recent transactions (last 24h)', v_pending_transactions;
    -- Non blocca, solo warning
  END IF;

  -- Soft delete: imposta status = 'deleted'
  UPDATE public.workspaces
  SET
    status = 'deleted',
    updated_at = NOW()
  WHERE id = p_workspace_id;

  -- Disattiva tutti i membri
  UPDATE public.workspace_members
  SET
    status = 'removed',
    updated_at = NOW()
  WHERE workspace_id = p_workspace_id
    AND status = 'active';

  -- Cancella inviti pending
  UPDATE public.workspace_invitations
  SET
    status = 'cancelled'
  WHERE workspace_id = p_workspace_id
    AND status = 'pending';

  -- Log audit
  INSERT INTO public.audit_logs (
    action,
    resource_type,
    resource_id,
    user_id,
    workspace_id,
    audit_metadata
  ) VALUES (
    'WORKSPACE_DELETED',
    'workspace',
    p_workspace_id::TEXT,
    v_deleter_id,
    p_workspace_id,
    jsonb_build_object(
      'deleted_at', NOW(),
      'active_shipments_at_deletion', v_active_shipments,
      'recent_transactions', v_pending_transactions
    )
  );

  RETURN TRUE;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'soft_delete_workspace FAILED: %', SQLERRM;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.soft_delete_workspace IS
  'Soft-delete workspace: verifica no active shipments, disattiva membri, log audit.';

-- ============================================
-- FIX 5: get_user_workspaces con pagination
-- ============================================
-- Aggiunge LIMIT/OFFSET alla RPC esistente

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
  permissions JSONB,
  wallet_balance NUMERIC,
  branding JSONB,
  member_status TEXT
) AS $$
BEGIN
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
  WHERE wm.user_id = p_user_id
    AND wm.status = 'active'
    AND w.status = 'active'
    AND o.status = 'active'
  ORDER BY w.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_user_workspaces(UUID, INTEGER, INTEGER) IS
  'Get user workspaces with pagination support (p_limit, p_offset).';

-- ============================================
-- FINE FIX WARNING
-- ============================================
