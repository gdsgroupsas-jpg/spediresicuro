-- ============================================
-- MIGRAZIONE: Creazione tabella workspace_members
-- ============================================
-- Parte del refactoring Architecture V2
-- workspace_members = Chi puo accedere al workspace e con quali permessi
--
-- UN UTENTE PUO APPARTENERE A N WORKSPACE (confermato: clienti lavorano per piu aziende)
-- Ogni membership ha un ruolo e permessi granulari
-- ============================================

-- Crea tabella workspace_members
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Role & Permissions
  -- owner: controllo totale, non rimuovibile
  -- admin: gestione completa tranne eliminare owner
  -- operator: operazioni quotidiane (spedizioni, tracking)
  -- viewer: solo lettura
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),

  -- Permessi granulari (override del role base)
  -- Es: ['shipments:create', 'shipments:delete', 'wallet:view', 'wallet:manage', 'members:invite']
  permissions TEXT[] DEFAULT '{}',

  -- Invitation tracking
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ, -- NULL = invito pending

  -- Status
  -- pending: invito inviato, non accettato
  -- active: membro attivo
  -- suspended: sospeso temporaneamente
  -- removed: rimosso (soft delete per audit)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'removed')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Un utente puo essere membro di un workspace una sola volta
  UNIQUE(workspace_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wm_workspace ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_wm_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_wm_status ON public.workspace_members(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_wm_role ON public.workspace_members(role);
CREATE INDEX IF NOT EXISTS idx_wm_user_active ON public.workspace_members(user_id, status) WHERE status = 'active';

-- Trigger per updated_at
CREATE OR REPLACE FUNCTION public.update_workspace_members_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_workspace_members_updated_at ON public.workspace_members;
CREATE TRIGGER trigger_workspace_members_updated_at
  BEFORE UPDATE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.update_workspace_members_updated_at();

-- Trigger: ogni workspace DEVE avere almeno un owner
-- Previene rimozione dell'ultimo owner
CREATE OR REPLACE FUNCTION public.check_workspace_has_owner()
RETURNS TRIGGER AS $$
DECLARE
  owner_count INTEGER;
BEGIN
  -- Solo se stiamo cambiando role o status di un owner
  IF OLD.role = 'owner' AND (NEW.role != 'owner' OR NEW.status != 'active') THEN
    SELECT COUNT(*) INTO owner_count
    FROM public.workspace_members
    WHERE workspace_id = OLD.workspace_id
      AND role = 'owner'
      AND status = 'active'
      AND id != OLD.id; -- Escludi il record corrente

    IF owner_count = 0 THEN
      RAISE EXCEPTION 'Cannot remove or demote the last owner of workspace %', OLD.workspace_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_workspace_owner ON public.workspace_members;
CREATE TRIGGER enforce_workspace_owner
  BEFORE UPDATE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.check_workspace_has_owner();

-- Prevent delete of last owner (use status='removed' instead)
CREATE OR REPLACE FUNCTION public.prevent_delete_last_owner()
RETURNS TRIGGER AS $$
DECLARE
  owner_count INTEGER;
BEGIN
  IF OLD.role = 'owner' AND OLD.status = 'active' THEN
    SELECT COUNT(*) INTO owner_count
    FROM public.workspace_members
    WHERE workspace_id = OLD.workspace_id
      AND role = 'owner'
      AND status = 'active'
      AND id != OLD.id;

    IF owner_count = 0 THEN
      RAISE EXCEPTION 'Cannot delete the last owner of workspace %. Use status=removed instead.', OLD.workspace_id;
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS prevent_delete_workspace_owner ON public.workspace_members;
CREATE TRIGGER prevent_delete_workspace_owner
  BEFORE DELETE ON public.workspace_members
  FOR EACH ROW EXECUTE FUNCTION public.prevent_delete_last_owner();

-- Commenti
COMMENT ON TABLE public.workspace_members IS 'Membership utenti nei workspace. Un utente puo appartenere a N workspace.';
COMMENT ON COLUMN public.workspace_members.role IS 'owner=controllo totale, admin=gestione, operator=operazioni, viewer=lettura';
COMMENT ON COLUMN public.workspace_members.permissions IS 'Permessi granulari: shipments:create, wallet:view, members:invite, etc.';
COMMENT ON COLUMN public.workspace_members.status IS 'pending=invito, active=attivo, suspended=sospeso, removed=rimosso';

-- ============================================
-- FINE MIGRAZIONE workspace_members
-- ============================================
