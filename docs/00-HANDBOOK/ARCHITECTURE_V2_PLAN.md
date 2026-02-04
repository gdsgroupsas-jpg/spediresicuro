---
title: Architecture V2 - Organization + Workspace
scope: architecture
audience: engineering
owner: engineering
status: draft
source_of_truth: true
created: 2026-02-03
updated: 2026-02-03
---

# SpedireSicuro 2.0 - Architecture Plan

## Executive Summary

Refactoring architetturale da sistema user-centric a Organization+Workspace model per supportare:

- Multi-tenant con isolamento dati
- Un utente in N workspace (confermato: clienti lavorano per piu aziende)
- Gerarchia 3 livelli: Platform → Reseller → Client
- Wallet a cascata (gia funzionante, da integrare con workspace)
- White-label gratuito (Livello 2)

**Timeline:** 4 settimane
**Completamento target:** 45% → 87%
**Costo:** €0 (solo tempo dev)

---

## Current State vs Target

```
ATTUALE (45%):                      TARGET (87%):

users                               organizations
├── parent_id (flat)                ├── billing, branding
├── wallet_balance                  └── 1:N workspaces
├── account_type
└── is_reseller                     workspaces
                                    ├── wallet_balance
                                    ├── parent_workspace_id (hierarchy)
                                    ├── depth (0-2 max)
                                    └── settings

                                    workspace_members
                                    ├── user_id (global identity)
                                    ├── workspace_id
                                    └── role + permissions
```

---

## Schema Database V2

### Tabella: organizations

```sql
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identity
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL, -- per URL: logistica-milano.spediresicuro.it

  -- Fiscal/Billing
  vat_number TEXT, -- P.IVA
  fiscal_code TEXT, -- Codice Fiscale
  billing_email TEXT NOT NULL,
  billing_address JSONB, -- {via, citta, cap, provincia, paese}

  -- Branding (White-label Livello 2 FREE)
  branding JSONB DEFAULT '{}', -- {logo_url, primary_color, secondary_color, favicon}
  white_label_level INTEGER DEFAULT 1, -- 1=base, 2=subdomain, 3=custom domain
  custom_domain TEXT, -- solo livello 3

  -- Settings
  settings JSONB DEFAULT '{}',

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_organizations_created_by ON organizations(created_by);
```

### Tabella: workspaces

```sql
CREATE TABLE workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Identity
  name TEXT NOT NULL,
  slug TEXT NOT NULL, -- unico dentro organization

  -- Hierarchy (max 3 livelli: 0=platform, 1=reseller, 2=client)
  type TEXT NOT NULL CHECK (type IN ('platform', 'reseller', 'client')),
  depth INTEGER NOT NULL DEFAULT 0 CHECK (depth >= 0 AND depth <= 2),
  parent_workspace_id UUID REFERENCES workspaces(id),

  -- Wallet (per workspace, cascata)
  wallet_balance DECIMAL(12,2) DEFAULT 0.00 CHECK (wallet_balance >= 0),

  -- Pricing
  assigned_price_list_id UUID, -- listino che PAGO (assegnato dal parent)
  selling_price_list_id UUID,  -- listino che VENDO (se reseller)

  -- Courier Config
  assigned_courier_config_id UUID,

  -- Fee (SEMPRE NULL di default - solo Superadmin configura!)
  platform_fee_override DECIMAL(5,2) DEFAULT NULL, -- MAI default automatico!
  parent_imposed_fee DECIMAL(5,2) DEFAULT NULL,    -- MAI default automatico!

  -- Settings
  settings JSONB DEFAULT '{}',

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),

  -- Constraints
  UNIQUE(organization_id, slug),

  -- Enforce hierarchy rules
  CONSTRAINT valid_hierarchy CHECK (
    (depth = 0 AND parent_workspace_id IS NULL) OR
    (depth > 0 AND parent_workspace_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_workspaces_org ON workspaces(organization_id);
CREATE INDEX idx_workspaces_parent ON workspaces(parent_workspace_id);
CREATE INDEX idx_workspaces_type ON workspaces(type);
CREATE INDEX idx_workspaces_depth ON workspaces(depth);
CREATE INDEX idx_workspaces_status ON workspaces(status);

-- Trigger: enforce max depth = 2
CREATE OR REPLACE FUNCTION check_workspace_depth()
RETURNS TRIGGER AS $$
DECLARE
  parent_depth INTEGER;
BEGIN
  IF NEW.parent_workspace_id IS NOT NULL THEN
    SELECT depth INTO parent_depth
    FROM workspaces
    WHERE id = NEW.parent_workspace_id;

    IF parent_depth >= 2 THEN
      RAISE EXCEPTION 'Maximum workspace depth (3 levels) exceeded';
    END IF;

    NEW.depth := parent_depth + 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_workspace_depth
  BEFORE INSERT OR UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION check_workspace_depth();
```

### Tabella: workspace_members

```sql
CREATE TABLE workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Role & Permissions
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'operator', 'viewer')),
  permissions TEXT[] DEFAULT '{}', -- granular: ['shipments:create', 'wallet:view']

  -- Invitation
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended', 'removed')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(workspace_id, user_id)
);

-- Indexes
CREATE INDEX idx_wm_workspace ON workspace_members(workspace_id);
CREATE INDEX idx_wm_user ON workspace_members(user_id);
CREATE INDEX idx_wm_status ON workspace_members(status);
CREATE INDEX idx_wm_role ON workspace_members(role);
```

### Tabella: workspace_invitations

```sql
CREATE TABLE workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- References
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Invitation details
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'operator', 'viewer')),
  permissions TEXT[] DEFAULT '{}',

  -- Token
  token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),

  -- Timestamps
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  invited_by UUID REFERENCES auth.users(id),
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id)
);

-- Indexes
CREATE INDEX idx_wi_workspace ON workspace_invitations(workspace_id);
CREATE INDEX idx_wi_email ON workspace_invitations(email);
CREATE INDEX idx_wi_token ON workspace_invitations(token);
CREATE INDEX idx_wi_status ON workspace_invitations(status);
```

---

## Funzioni RPC Critiche

### is_sub_workspace_of() - CRITICA

```sql
-- Verifica se workspace_a e' sotto workspace_b nella gerarchia
CREATE OR REPLACE FUNCTION is_sub_workspace_of(
  workspace_a UUID,
  workspace_b UUID,
  max_depth INTEGER DEFAULT 10
)
RETURNS BOOLEAN AS $$
DECLARE
  current_id UUID := workspace_a;
  current_depth INTEGER := 0;
BEGIN
  -- Same workspace
  IF workspace_a = workspace_b THEN
    RETURN TRUE;
  END IF;

  -- Walk up the tree
  WHILE current_id IS NOT NULL AND current_depth < max_depth LOOP
    SELECT parent_workspace_id INTO current_id
    FROM workspaces
    WHERE id = current_id;

    IF current_id = workspace_b THEN
      RETURN TRUE;
    END IF;

    current_depth := current_depth + 1;
  END LOOP;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql STABLE;
```

### get_user_workspaces()

```sql
-- Restituisce tutti i workspace accessibili da un utente
CREATE OR REPLACE FUNCTION get_user_workspaces(p_user_id UUID)
RETURNS TABLE (
  workspace_id UUID,
  workspace_name TEXT,
  workspace_type TEXT,
  organization_id UUID,
  organization_name TEXT,
  role TEXT,
  wallet_balance DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    w.id,
    w.name,
    w.type,
    o.id,
    o.name,
    wm.role,
    w.wallet_balance
  FROM workspace_members wm
  JOIN workspaces w ON w.id = wm.workspace_id
  JOIN organizations o ON o.id = w.organization_id
  WHERE wm.user_id = p_user_id
    AND wm.status = 'active'
    AND w.status = 'active'
    AND o.status = 'active'
  ORDER BY w.name;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
```

### current_workspace()

```sql
-- Restituisce workspace_id corrente dalla sessione
-- Usato in RLS policies
CREATE OR REPLACE FUNCTION current_workspace()
RETURNS UUID AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_workspace_id', TRUE), '')::UUID;
END;
$$ LANGUAGE plpgsql STABLE;
```

### set_current_workspace()

```sql
-- Imposta workspace corrente (chiamato da middleware)
CREATE OR REPLACE FUNCTION set_current_workspace(p_workspace_id UUID)
RETURNS VOID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_is_member BOOLEAN;
BEGIN
  -- Verifica membership
  SELECT EXISTS(
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = v_user_id
      AND status = 'active'
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RAISE EXCEPTION 'User is not a member of workspace %', p_workspace_id;
  END IF;

  PERFORM set_config('app.current_workspace_id', p_workspace_id::TEXT, TRUE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### create_workspace_with_owner()

```sql
-- Crea workspace con owner atomicamente
CREATE OR REPLACE FUNCTION create_workspace_with_owner(
  p_organization_id UUID,
  p_name TEXT,
  p_slug TEXT,
  p_type TEXT,
  p_parent_workspace_id UUID DEFAULT NULL,
  p_owner_user_id UUID DEFAULT NULL,
  p_assigned_price_list_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_workspace_id UUID;
  v_owner_id UUID := COALESCE(p_owner_user_id, auth.uid());
BEGIN
  -- Crea workspace
  INSERT INTO workspaces (
    organization_id,
    name,
    slug,
    type,
    parent_workspace_id,
    assigned_price_list_id,
    created_by
  ) VALUES (
    p_organization_id,
    p_name,
    p_slug,
    p_type,
    p_parent_workspace_id,
    p_assigned_price_list_id,
    v_owner_id
  )
  RETURNING id INTO v_workspace_id;

  -- Aggiungi owner come member
  INSERT INTO workspace_members (
    workspace_id,
    user_id,
    role,
    status,
    accepted_at
  ) VALUES (
    v_workspace_id,
    v_owner_id,
    'owner',
    'active',
    NOW()
  );

  RETURN v_workspace_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## RLS Policies

### Organizations RLS

```sql
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

-- Superadmin vede tutto
CREATE POLICY "Superadmin full access" ON organizations
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

-- Member vede propria organization
CREATE POLICY "Member can view own org" ON organizations
  FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT DISTINCT w.organization_id
      FROM workspace_members wm
      JOIN workspaces w ON w.id = wm.workspace_id
      WHERE wm.user_id = auth.uid()
        AND wm.status = 'active'
    )
  );
```

### Workspaces RLS

```sql
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- Superadmin vede tutto
CREATE POLICY "Superadmin full access" ON workspaces
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );

-- Member vede propri workspace + sub-workspace (se reseller)
CREATE POLICY "Member can view accessible workspaces" ON workspaces
  FOR SELECT
  TO authenticated
  USING (
    -- Direct membership
    id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR
    -- Parent workspace membership (reseller vede clienti)
    parent_workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
        AND status = 'active'
        AND role IN ('owner', 'admin')
    )
  );
```

### Shipments RLS (Refactored)

```sql
-- Aggiungere workspace_id a shipments (migration)
ALTER TABLE shipments ADD COLUMN workspace_id UUID REFERENCES workspaces(id);

-- Nuova RLS policy
CREATE POLICY "Workspace members can access shipments" ON shipments
  FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR
    -- Superadmin
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND raw_user_meta_data->>'account_type' = 'superadmin'
    )
  );
```

---

## Wallet a Cascata (Integrazione)

Il wallet a cascata GIA FUNZIONA. Integriamo con workspace:

```sql
-- Nuova funzione: decrement_workspace_wallet_cascade
CREATE OR REPLACE FUNCTION decrement_workspace_wallet_cascade(
  p_workspace_id UUID,
  p_amount DECIMAL,
  p_shipment_id UUID,
  p_idempotency_key TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_workspace RECORD;
  v_parent_workspace RECORD;
  v_child_price DECIMAL;
  v_parent_price DECIMAL;
  v_result JSONB := '[]'::JSONB;
BEGIN
  -- Lock workspace
  SELECT * INTO v_workspace
  FROM workspaces
  WHERE id = p_workspace_id
  FOR UPDATE NOWAIT;

  -- Verifica saldo
  IF v_workspace.wallet_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient wallet balance. Required: %, Available: %',
      p_amount, v_workspace.wallet_balance;
  END IF;

  -- Addebita workspace corrente
  UPDATE workspaces
  SET wallet_balance = wallet_balance - p_amount,
      updated_at = NOW()
  WHERE id = p_workspace_id;

  -- Log transaction
  INSERT INTO wallet_transactions (
    workspace_id,
    amount,
    type,
    reference_id,
    description
  ) VALUES (
    p_workspace_id,
    -p_amount,
    'SHIPMENT_CHARGE',
    p_shipment_id,
    'Addebito spedizione'
  );

  v_result := v_result || jsonb_build_object(
    'workspace_id', p_workspace_id,
    'amount', p_amount,
    'type', 'debit'
  );

  -- Se ha parent, addebita anche parent (con prezzo parent)
  IF v_workspace.parent_workspace_id IS NOT NULL THEN
    -- Calcola prezzo per il parent (dal listino assegnato al workspace)
    -- Il parent paga il prezzo del SUO listino supplier
    SELECT * INTO v_parent_workspace
    FROM workspaces
    WHERE id = v_workspace.parent_workspace_id
    FOR UPDATE NOWAIT;

    -- Qui calcoleremmo il prezzo dal listino del parent
    -- Per ora usiamo una stima (da implementare)
    v_parent_price := p_amount * 0.8; -- placeholder

    IF v_parent_workspace.wallet_balance < v_parent_price THEN
      RAISE EXCEPTION 'Parent workspace insufficient balance';
    END IF;

    UPDATE workspaces
    SET wallet_balance = wallet_balance - v_parent_price,
        updated_at = NOW()
    WHERE id = v_parent_workspace.id;

    INSERT INTO wallet_transactions (
      workspace_id,
      amount,
      type,
      reference_id,
      description
    ) VALUES (
      v_parent_workspace.id,
      -v_parent_price,
      'SHIPMENT_CHARGE_CASCADE',
      p_shipment_id,
      'Addebito cascata da sub-workspace'
    );

    v_result := v_result || jsonb_build_object(
      'workspace_id', v_parent_workspace.id,
      'amount', v_parent_price,
      'type', 'cascade_debit'
    );
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;
```

---

## Migration Path

### Fase 1: Creare nuove tabelle (non-breaking)

```sql
-- Migration: 20260203_001_create_organizations.sql
-- Migration: 20260203_002_create_workspaces.sql
-- Migration: 20260203_003_create_workspace_members.sql
-- Migration: 20260203_004_create_workspace_invitations.sql
```

### Fase 2: Migrare dati esistenti

```sql
-- Per ogni reseller esistente:
-- 1. Crea organization
-- 2. Crea workspace (type=reseller)
-- 3. Crea workspace_member (role=owner)

-- Per ogni client esistente:
-- 1. Trova parent reseller
-- 2. Usa stessa organization del parent O crea nuova
-- 3. Crea workspace (type=client, parent=reseller_workspace)
-- 4. Crea workspace_member (role=owner)
```

### Fase 3: Aggiungere workspace_id alle tabelle operative

```sql
-- shipments, wallet_transactions, price_lists, etc.
ALTER TABLE shipments ADD COLUMN workspace_id UUID;
-- Popolare da user_id esistente
-- Poi: ALTER TABLE shipments ALTER COLUMN workspace_id SET NOT NULL;
```

### Fase 4: Attivare RLS nuove

```sql
-- Disattivare vecchie policy
-- Attivare nuove policy workspace-based
```

---

## UI Components

### WorkspaceSwitcher.tsx

```tsx
// Location: components/workspace/WorkspaceSwitcher.tsx

interface Workspace {
  id: string;
  name: string;
  type: 'platform' | 'reseller' | 'client';
  organization: {
    id: string;
    name: string;
    branding?: {
      logo_url?: string;
      primary_color?: string;
    };
  };
  role: 'owner' | 'admin' | 'operator' | 'viewer';
  wallet_balance: number;
}

export function WorkspaceSwitcher() {
  const { workspaces, currentWorkspace, switchWorkspace } = useWorkspace();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <div className="flex items-center gap-2">
          {currentWorkspace.organization.branding?.logo_url && (
            <img src={currentWorkspace.organization.branding.logo_url} className="h-6 w-6" />
          )}
          <span>{currentWorkspace.name}</span>
          <ChevronDown className="h-4 w-4" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {workspaces.map((ws) => (
          <DropdownMenuItem
            key={ws.id}
            onClick={() => switchWorkspace(ws.id)}
            className={ws.id === currentWorkspace.id ? 'bg-accent' : ''}
          >
            <div className="flex justify-between w-full">
              <span>{ws.name}</span>
              <Badge variant="outline">{ws.role}</Badge>
            </div>
            <span className="text-sm text-muted-foreground">
              {formatCurrency(ws.wallet_balance)}
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Plus className="h-4 w-4 mr-2" />
          Crea organizzazione
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

### useWorkspace Hook

```tsx
// Location: hooks/useWorkspace.ts

export function useWorkspace() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);

  // Carica workspace al mount
  useEffect(() => {
    loadWorkspaces();
  }, []);

  // Leggi workspace_id da cookie/localStorage
  useEffect(() => {
    const savedId = localStorage.getItem('current_workspace_id');
    if (savedId && workspaces.length > 0) {
      const ws = workspaces.find((w) => w.id === savedId);
      if (ws) setCurrentWorkspace(ws);
    }
  }, [workspaces]);

  const switchWorkspace = async (workspaceId: string) => {
    // Chiamata API per validare accesso
    await setCurrentWorkspaceAPI(workspaceId);

    // Salva in localStorage
    localStorage.setItem('current_workspace_id', workspaceId);

    // Aggiorna state
    const ws = workspaces.find((w) => w.id === workspaceId);
    setCurrentWorkspace(ws);

    // Forza refresh pagina per RLS
    router.refresh();
  };

  return { workspaces, currentWorkspace, switchWorkspace };
}
```

---

## Timeline Dettagliata

### SETTIMANA 1 (3-7 Feb)

- [ ] Migration: organizations table
- [ ] Migration: workspaces table
- [ ] Migration: workspace_members table
- [ ] Migration: workspace_invitations table
- [ ] Function: is_sub_workspace_of()
- [ ] Function: get_user_workspaces()
- [ ] Function: current_workspace()
- [ ] Function: set_current_workspace()

### SETTIMANA 2 (10-14 Feb)

- [ ] RLS: organizations
- [ ] RLS: workspaces
- [ ] RLS: workspace_members
- [ ] Function: create_workspace_with_owner()
- [ ] Function: invite_to_workspace()
- [ ] Function: accept_workspace_invitation()
- [ ] Migration: Add workspace_id to shipments
- [ ] Migration: Add workspace_id to wallet_transactions

### SETTIMANA 3 (17-21 Feb)

- [ ] Refactor: getSafeAuth() per workspace context
- [ ] Refactor: Middleware per workspace routing
- [ ] Refactor: API routes per workspace
- [ ] Refactor: Server actions per workspace
- [ ] Migration: Populate workspace_id from existing data
- [ ] RLS: shipments (workspace-based)
- [ ] RLS: wallet_transactions (workspace-based)

### SETTIMANA 4 (24-28 Feb)

- [ ] UI: WorkspaceSwitcher component
- [ ] UI: Workspace settings page
- [ ] UI: Invite members flow
- [ ] UI: Create workspace flow
- [ ] Testing: Unit tests
- [ ] Testing: Integration tests
- [ ] Testing: RLS tests
- [ ] Documentation: Update handbook

---

## Success Metrics

| Metric                 | Before    | After    | Target |
| ---------------------- | --------- | -------- | ------ |
| Multi-tenant isolation | Partial   | Complete | 100%   |
| User in N workspaces   | No        | Yes      | Yes    |
| Workspace switcher     | No        | Yes      | Yes    |
| RLS coverage           | 40%       | 90%      | 90%    |
| Hierarchy depth        | Unlimited | Max 3    | Max 3  |
| White-label support    | No        | Lvl 2    | Lvl 2  |

---

## Rollback Plan

Se qualcosa va storto:

1. **Fase 1-2**: Nuove tabelle non rompono nulla, basta non usarle
2. **Fase 3**: workspace_id nullable, vecchio codice continua a funzionare
3. **Fase 4**: Feature flag per UI, disattivabile

```typescript
// Feature flag
const ENABLE_WORKSPACES = process.env.NEXT_PUBLIC_ENABLE_WORKSPACES === 'true';
```

---

## Open Questions

1. ~~Wallet per workspace o per organization?~~ **DECISO: Per workspace (cascata)**
2. ~~Gerarchia max depth?~~ **DECISO: 3 livelli (0-2)**
3. ~~White-label gratuito?~~ **DECISO: Livello 2 free**
4. ~~Migrazione utenti esistenti~~ **DECISO: 1 Reseller = 1 Organization + 1 Workspace**
5. ~~Fee/Margini default?~~ **DECISO: NESSUN DEFAULT - Solo impostazione manuale Superadmin**

---

## REGOLA CRITICA: NO FEE/MARGINI DI DEFAULT

```
!!! ATTENZIONE - REGOLA INVIOLABILE !!!

NESSUNA fee, margine, markup, o commissione deve essere impostata
automaticamente dal sistema.

TUTTO deve essere configurato MANUALMENTE dal Superadmin.

Valori di default per campi fee/margine: NULL (non 0, non 5%, NULL)
```

### Campi interessati:

| Campo                              | Default | Comportamento                       |
| ---------------------------------- | ------- | ----------------------------------- |
| `workspaces.platform_fee_override` | NULL    | Nessuna fee finche non impostata    |
| `workspaces.parent_imposed_fee`    | NULL    | Nessuna fee finche non impostata    |
| `organizations.default_margin`     | NULL    | Nessun margine finche non impostato |
| `price_lists.margin_percentage`    | NULL    | Nessun markup automatico            |

### Logica di calcolo prezzo:

```sql
-- PRIMA (SBAGLIATO - aveva default):
final_price = base_price * (1 + COALESCE(margin, 0.05))  -- NO!

-- DOPO (CORRETTO - no default):
IF margin IS NULL THEN
  RAISE EXCEPTION 'Margine non configurato per questo listino';
END IF;
final_price = base_price * (1 + margin);
```

### Validazione in creazione workspace:

```sql
-- Quando si crea un workspace reseller/client:
-- NON impostare fee automatiche
-- Superadmin DEVE configurarle manualmente dopo

CREATE OR REPLACE FUNCTION create_workspace_with_owner(...)
RETURNS UUID AS $$
BEGIN
  INSERT INTO workspaces (
    ...
    platform_fee_override,  -- NULL, non un default!
    parent_imposed_fee,     -- NULL, non un default!
    ...
  ) VALUES (
    ...
    NULL,  -- Superadmin configura dopo
    NULL,  -- Superadmin configura dopo
    ...
  );
END;
$$;
```

### UI Admin per configurazione fee:

```
Dashboard Admin > Workspace > Impostazioni > Fee e Margini

┌─────────────────────────────────────────────────────────────┐
│  Configurazione Fee - Workspace "Logistica Milano"          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Platform Fee:        [___________] %   ⚠️ Non configurato  │
│  Parent Imposed Fee:  [___________] %   ⚠️ Non configurato  │
│                                                              │
│  ⚠️ ATTENZIONE: Senza fee configurate, le spedizioni       │
│     useranno il prezzo base senza margini.                  │
│                                                              │
│  [Salva Configurazione]                                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Audit Log per modifiche fee:

Ogni modifica a fee/margini viene loggata:

```sql
INSERT INTO audit_logs (
  action,
  resource_type,
  resource_id,
  actor_id,
  audit_metadata
) VALUES (
  'FEE_CONFIGURED',
  'workspace',
  workspace_id,
  superadmin_id,
  jsonb_build_object(
    'field', 'platform_fee_override',
    'old_value', NULL,
    'new_value', 0.05,
    'configured_by', 'superadmin'
  )
);
```

---

_Document created: 2026-02-03_
_Status: DRAFT - In discussione_
_Owner: Engineering Team_
