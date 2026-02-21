-- ============================================
-- MIGRAZIONE: Creazione tabella workspaces
-- ============================================
-- Parte del refactoring Architecture V2
-- Workspace = Unita operativa (isolamento dati, wallet, team)
--
-- GERARCHIA MAX 3 LIVELLI:
-- depth 0 = platform (SpedireSicuro)
-- depth 1 = reseller
-- depth 2 = client (sub-user del reseller)
--
-- REGOLA CRITICA: NESSUN DEFAULT PER FEE/MARGINI
-- platform_fee_override e parent_imposed_fee sono SEMPRE NULL di default
-- Solo il Superadmin puo configurarli manualmente!
-- ============================================

-- Crea tabella workspaces
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership (ogni workspace appartiene a un'organization)
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  slug TEXT NOT NULL, -- unico dentro organization

  -- Hierarchy (max 3 livelli: 0=platform, 1=reseller, 2=client)
  type TEXT NOT NULL CHECK (type IN ('platform', 'reseller', 'client')),
  depth INTEGER NOT NULL DEFAULT 0 CHECK (depth >= 0 AND depth <= 2),
  parent_workspace_id UUID REFERENCES public.workspaces(id),

  -- Wallet PER WORKSPACE (cascata: sub-user paga reseller paga platform)
  wallet_balance DECIMAL(12,2) DEFAULT 0.00 CHECK (wallet_balance >= 0),

  -- Pricing
  -- Listino che questo workspace PAGA (assegnato dal parent/superadmin)
  assigned_price_list_id UUID,
  -- Listino che questo workspace VENDE ai suoi sub-workspace (solo se reseller)
  selling_price_list_id UUID,

  -- Courier Config
  assigned_courier_config_id UUID,

  -- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  -- REGOLA CRITICA: FEE SEMPRE NULL DI DEFAULT
  -- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  -- Questi campi NON devono MAI avere un valore di default automatico!
  -- Il Superadmin DEVE configurarli manualmente per ogni workspace.
  -- Se sono NULL, il sistema deve rifiutare operazioni che richiedono fee.
  -- !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
  platform_fee_override DECIMAL(5,2) DEFAULT NULL, -- MAI default automatico!
  parent_imposed_fee DECIMAL(5,2) DEFAULT NULL,    -- MAI default automatico!

  -- Settings specifici del workspace
  settings JSONB DEFAULT '{}',

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  UNIQUE(organization_id, slug),

  -- Enforce hierarchy rules:
  -- depth 0 (platform) non ha parent
  -- depth > 0 DEVE avere parent
  CONSTRAINT valid_hierarchy CHECK (
    (depth = 0 AND parent_workspace_id IS NULL) OR
    (depth > 0 AND parent_workspace_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_org ON public.workspaces(organization_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_parent ON public.workspaces(parent_workspace_id) WHERE parent_workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_workspaces_type ON public.workspaces(type);
CREATE INDEX IF NOT EXISTS idx_workspaces_depth ON public.workspaces(depth);
CREATE INDEX IF NOT EXISTS idx_workspaces_status ON public.workspaces(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_workspaces_assigned_pricelist ON public.workspaces(assigned_price_list_id) WHERE assigned_price_list_id IS NOT NULL;

-- Trigger per updated_at
CREATE OR REPLACE FUNCTION public.update_workspaces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER trigger_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_workspaces_updated_at();

-- Trigger per enforce max depth = 2 (3 livelli totali)
CREATE OR REPLACE FUNCTION public.check_workspace_depth()
RETURNS TRIGGER AS $$
DECLARE
  parent_depth INTEGER;
BEGIN
  -- Se ha un parent, calcola depth automaticamente
  IF NEW.parent_workspace_id IS NOT NULL THEN
    SELECT depth INTO parent_depth
    FROM public.workspaces
    WHERE id = NEW.parent_workspace_id;

    IF parent_depth IS NULL THEN
      RAISE EXCEPTION 'Parent workspace not found: %', NEW.parent_workspace_id;
    END IF;

    IF parent_depth >= 2 THEN
      RAISE EXCEPTION 'Maximum workspace depth (3 levels) exceeded. Cannot create sub-workspace under depth %', parent_depth;
    END IF;

    -- Imposta depth automaticamente
    NEW.depth := parent_depth + 1;

    -- Imposta type automaticamente basato su depth
    IF NEW.depth = 1 THEN
      NEW.type := 'reseller';
    ELSIF NEW.depth = 2 THEN
      NEW.type := 'client';
    END IF;
  ELSE
    -- Nessun parent = platform (depth 0)
    NEW.depth := 0;
    NEW.type := 'platform';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_workspace_depth ON public.workspaces;
CREATE TRIGGER enforce_workspace_depth
  BEFORE INSERT OR UPDATE OF parent_workspace_id ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.check_workspace_depth();

-- Funzione per generare slug workspace
CREATE OR REPLACE FUNCTION public.generate_workspace_slug(p_org_id UUID, p_name TEXT)
RETURNS TEXT AS $$
DECLARE
  v_slug TEXT;
  v_counter INTEGER := 0;
  v_base_slug TEXT;
BEGIN
  -- Normalizza
  v_base_slug := lower(trim(p_name));
  v_base_slug := regexp_replace(v_base_slug, '[^a-z0-9\s-]', '', 'g');
  v_base_slug := regexp_replace(v_base_slug, '\s+', '-', 'g');
  v_base_slug := regexp_replace(v_base_slug, '-+', '-', 'g');
  v_base_slug := trim(both '-' from v_base_slug);
  v_base_slug := left(v_base_slug, 50);

  v_slug := v_base_slug;

  -- Verifica unicita dentro organization
  WHILE EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE organization_id = p_org_id AND slug = v_slug
  ) LOOP
    v_counter := v_counter + 1;
    v_slug := v_base_slug || '-' || v_counter;
  END LOOP;

  RETURN v_slug;
END;
$$ LANGUAGE plpgsql;

-- Commenti
COMMENT ON TABLE public.workspaces IS 'Unita operativa: isolamento dati, wallet, team. Max 3 livelli di gerarchia.';
COMMENT ON COLUMN public.workspaces.depth IS '0=platform, 1=reseller, 2=client. Max 2 (3 livelli totali)';
COMMENT ON COLUMN public.workspaces.type IS 'platform/reseller/client - impostato automaticamente da depth';
COMMENT ON COLUMN public.workspaces.wallet_balance IS 'Saldo wallet del workspace. Wallet a cascata: client->reseller->platform';
COMMENT ON COLUMN public.workspaces.assigned_price_list_id IS 'Listino che questo workspace USA per pagare (assegnato dal parent)';
COMMENT ON COLUMN public.workspaces.selling_price_list_id IS 'Listino che questo workspace USA per vendere ai sub-workspace';
COMMENT ON COLUMN public.workspaces.platform_fee_override IS 'SEMPRE NULL di default! Solo Superadmin configura manualmente.';
COMMENT ON COLUMN public.workspaces.parent_imposed_fee IS 'SEMPRE NULL di default! Solo Superadmin configura manualmente.';

-- ============================================
-- FINE MIGRAZIONE workspaces
-- ============================================
