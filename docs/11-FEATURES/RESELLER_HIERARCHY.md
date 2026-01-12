# Reseller Hierarchy - SpedireSicuro

## Overview

Questo documento descrive il sistema di gerarchia reseller di SpedireSicuro, che permette ai reseller di creare e gestire sub-users (utenti finali), con isolamento multi-tenant, tier system per limiti e features, e ruoli team per gestione avanzata.

## Target Audience

- [x] Developers
- [x] DevOps
- [x] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- Conoscenza base di sistemi multi-tenant
- Comprensione di gerarchie parent-child
- Familiarità con RLS (Row Level Security)

## Quick Reference

| Sezione | Pagina | Link |
|---------|--------|------|
| Gerarchia Overview | docs/11-FEATURES/RESELLER_HIERARCHY.md | [Overview](#overview) |
| Struttura Database | docs/11-FEATURES/RESELLER_HIERARCHY.md | [Database](#struttura-database) |
| Reseller Tiers | docs/11-FEATURES/RESELLER_HIERARCHY.md | [Tiers](#reseller-tiers) |
| Team Roles | docs/11-FEATURES/RESELLER_HIERARCHY.md | [Roles](#team-roles) |
| RLS Isolation | docs/8-SECURITY/OVERVIEW.md | [RLS](../8-SECURITY/OVERVIEW.md) |

## Content

### Reseller Hierarchy Overview

**Cos'è un Reseller:**
Un reseller è un utente che può creare e gestire sub-users (utenti finali). I reseller operano come "tenant" isolati, vedendo solo i propri sub-users e le loro spedizioni.

**Struttura Gerarchica:**
```
SuperAdmin
  └─ Reseller (parent_id = NULL, is_reseller = true)
      ├─ Sub-User 1 (parent_id = Reseller.id)
      ├─ Sub-User 2 (parent_id = Reseller.id)
      └─ Team Member (parent_reseller_id = Reseller.id, reseller_role = 'team_administrator')
          └─ Sub-User 3 (parent_id = Team Member.id)
```

**Isolamento Multi-Tenant:**
- Reseller vede solo propri sub-users (via RLS)
- Sub-users vedono solo se stessi
- SuperAdmin vede tutto

---

### Struttura Database

#### Campi Utente

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  
  -- Reseller flags
  is_reseller BOOLEAN DEFAULT false,
  reseller_role TEXT, -- 'admin', 'user', 'agent', 'courier', 'team_administrator'
  reseller_tier TEXT, -- 'small', 'medium', 'enterprise'
  
  -- Gerarchia
  parent_id UUID REFERENCES users(id), -- ID reseller (per sub-users)
  parent_reseller_id UUID REFERENCES users(id), -- ID reseller principale (per team members)
  tenant_id UUID REFERENCES users(id), -- ID tenant (con fallback a parent_id)
  
  -- Account type
  account_type TEXT, -- 'user', 'admin', 'superadmin', 'byoc', 'reseller'
  role TEXT, -- Legacy: 'user', 'admin', 'superadmin'
  
  -- ...
);
```

#### Campi Chiave

- **`is_reseller`:** Flag che indica se l'utente è un reseller
- **`parent_id`:** ID del reseller che ha creato questo sub-user (NULL per reseller)
- **`tenant_id`:** ID tenant per isolamento multi-tenant (con fallback a parent_id)
- **`reseller_role`:** Ruolo all'interno del team reseller
- **`reseller_tier`:** Tier del reseller (small/medium/enterprise)

---

### Reseller Tiers

#### Tier System

I reseller sono classificati in 3 tier basati sul numero di sub-users:

- **Small:** < 10 sub-users
- **Medium:** 10-100 sub-users (incluso 100)
- **Enterprise:** > 100 sub-users

#### Limiti per Tier

**Small:**
- Max sub-users: 10
- Features: base
- Descrizione: Reseller piccolo, base features

**Medium:**
- Max sub-users: 100
- Features: base, advanced
- Descrizione: Reseller medio, advanced features

**Enterprise:**
- Max sub-users: unlimited
- Features: base, advanced, unlimited, sla
- Descrizione: Reseller enterprise, all features, SLA dedicato

#### Calcolo Tier

**Funzione TypeScript:**
```typescript
// lib/db/tier-helpers.ts
export function calculateTierFromSubUsers(subUsersCount: number): ResellerTier {
  if (subUsersCount < 10) {
    return "small";
  } else if (subUsersCount <= 100) {
    return "medium";
  } else {
    return "enterprise";
  }
}
```

**Funzione SQL:**
```sql
-- supabase/migrations/089_get_reseller_tier_function.sql
CREATE OR REPLACE FUNCTION get_reseller_tier(p_user_id UUID)
RETURNS reseller_tier AS $$
DECLARE
  v_is_reseller BOOLEAN;
  v_sub_count INTEGER;
BEGIN
  -- Verifica se è reseller
  SELECT is_reseller INTO v_is_reseller
  FROM users
  WHERE id = p_user_id;
  
  IF v_is_reseller IS NULL OR v_is_reseller IS NOT TRUE THEN
    RETURN NULL;
  END IF;
  
  -- Conta sub-users
  SELECT COUNT(*) INTO v_sub_count
  FROM users
  WHERE parent_id = p_user_id
    AND is_reseller = false;
  
  -- Calcola tier
  IF v_sub_count < 10 THEN
    RETURN 'small'::reseller_tier;
  ELSIF v_sub_count <= 100 THEN
    RETURN 'medium'::reseller_tier;
  ELSE
    RETURN 'enterprise'::reseller_tier;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Verifica Limite

```typescript
// lib/db/tier-helpers.ts
export function isTierAtLimit(
  tier: ResellerTier,
  currentSubUsersCount: number
): boolean {
  const limits = getTierLimits(tier);
  
  // Enterprise è sempre unlimited
  if (limits.maxSubUsers === null) {
    return false;
  }
  
  return currentSubUsersCount >= limits.maxSubUsers;
}
```

---

### Team Roles

#### Ruoli Disponibili

- **`admin`:** Amministratore reseller (può gestire tutto, incluso eliminare config default)
- **`user`:** Utente base del team (solo spedizioni)
- **`agent`:** Agente commerciale (gestione clienti)
- **`courier`:** Corriere/Autista (gestione consegne)
- **`team_administrator`:** Amministratore team (gestisce sub-team)

#### Struttura Gerarchica Team

```
reseller_admin (reseller_role = 'admin')
  └─ team_administrator (reseller_role = 'team_administrator')
      ├─ team_agent (reseller_role = 'agent')
      ├─ team_user (reseller_role = 'user')
      └─ team_courier (reseller_role = 'courier')
```

#### Assegnazione Ruoli

**File:** `supabase/migrations/059_reseller_team_structure.sql`

```sql
-- Constraint per reseller_role
ALTER TABLE users ADD CONSTRAINT users_reseller_role_check 
  CHECK (reseller_role IN ('admin', 'user', 'agent', 'courier', 'team_administrator'));
```

---

### Creazione Sub-Users

#### Flow Creazione

1. **Reseller naviga a `/dashboard/reseller-team`**
2. **Clicca "Crea Sub-User"**
3. **Compila form** (email, nome, password opzionale)
4. **Sistema verifica:**
   - Reseller ha permesso (is_reseller = true)
   - Tier non ha raggiunto limite
5. **Sistema crea sub-user** con:
   - `parent_id` = Reseller.id
   - `tenant_id` = Reseller.id (isolamento)
   - `is_reseller` = false
   - `account_type` = 'user'

#### Server Action

**File:** `actions/admin-reseller.ts`

```typescript
export async function createSubUser(data: {
  email: string;
  name: string;
  password?: string;
}): Promise<{
  success: boolean;
  userId?: string;
  error?: string;
}> {
  // 1. Verifica autenticazione
  const session = await auth();
  if (!session?.user?.email) {
    return { success: false, error: 'Non autenticato' };
  }
  
  // 2. Verifica che l'utente sia un Reseller
  const resellerCheck = await isCurrentUserReseller();
  if (!resellerCheck.isReseller || !resellerCheck.userId) {
    return { success: false, error: 'Solo i Reseller possono creare Sub-Users' };
  }
  
  // 3. Verifica limite tier
  const tier = await getResellerTier(resellerCheck.userId);
  const subUsersCount = await countSubUsers(resellerCheck.userId);
  
  if (tier && isTierAtLimit(tier, subUsersCount)) {
    return { 
      success: false, 
      error: `Limite tier raggiunto (${getTierLimits(tier).maxSubUsers} sub-users)` 
    };
  }
  
  // 4. Crea sub-user
  const { data: newUser, error } = await supabaseAdmin
    .from('users')
    .insert({
      email: data.email,
      name: data.name,
      password: hashedPassword,
      parent_id: resellerCheck.userId,
      tenant_id: resellerCheck.userId, // Isolamento
      is_reseller: false,
      account_type: 'user',
    })
    .select()
    .single();
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true, userId: newUser.id };
}
```

---

### RLS (Row Level Security)

#### Policy Users

**File:** `supabase/migrations/019_reseller_system_and_wallet.sql`

```sql
CREATE POLICY users_select_reseller ON users
  FOR SELECT USING (
    -- Super Admin vede tutto
    is_super_admin(auth.uid())
    OR
    -- Utente vede se stesso
    auth.uid()::text = id::text
    OR
    -- Reseller vede i suoi Sub-Users
    (
      is_reseller(auth.uid())
      AND is_sub_user_of(id, auth.uid())
    )
  );
```

#### Funzione is_sub_user_of()

**Verifica ricorsiva gerarchia:**

```sql
CREATE OR REPLACE FUNCTION is_sub_user_of(p_sub_user_id UUID, p_admin_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  -- Controlla se è un sub-user diretto o ricorsivo
  RETURN EXISTS (
    WITH RECURSIVE user_hierarchy AS (
      -- Anchor: sub-user iniziale
      SELECT id, parent_id
      FROM users
      WHERE id = p_sub_user_id
      
      UNION ALL
      
      -- Recursive: risale la gerarchia
      SELECT u.id, u.parent_id
      FROM users u
      INNER JOIN user_hierarchy uh ON u.id = uh.parent_id
      WHERE uh.parent_id IS NOT NULL
    )
    SELECT 1 FROM user_hierarchy WHERE id = p_admin_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### Policy Shipments

```sql
CREATE POLICY shipments_select_reseller ON shipments
  FOR SELECT USING (
    -- Super Admin vede tutto
    is_super_admin(auth.uid())
    OR
    -- Utente vede le proprie spedizioni
    user_id::text = auth.uid()::text
    OR
    -- Reseller vede le spedizioni dei suoi Sub-Users
    (
      is_reseller(auth.uid())
      AND is_sub_user_of(user_id, auth.uid())
    )
  );
```

---

### Tenant Isolation

#### Campo tenant_id

**File:** `supabase/migrations/084_add_tenant_id_to_users.sql`

Il campo `tenant_id` è stato aggiunto per isolamento multi-tenant più robusto, con fallback a `parent_id` per retrocompatibilità.

**Logica:**
- Reseller: `tenant_id = user_id` (self-tenant)
- Sub-User: `tenant_id = parent_id` (tenant del reseller)
- BYOC: `tenant_id = user_id` (self-tenant)
- NULL: usa fallback a `parent_id` o `user_id`

#### Funzione get_user_tenant()

```sql
CREATE OR REPLACE FUNCTION get_user_tenant(p_user_id UUID)
RETURNS UUID AS $$
DECLARE
  v_tenant_id UUID;
  v_parent_id UUID;
BEGIN
  -- 1. Recupera tenant_id e parent_id
  SELECT tenant_id, parent_id
  INTO v_tenant_id, v_parent_id
  FROM users
  WHERE id = p_user_id;
  
  -- 2. Se tenant_id è NULL, usa fallback
  IF v_tenant_id IS NULL THEN
    -- Fallback 1: usa parent_id se esiste (Sub-User)
    IF v_parent_id IS NOT NULL THEN
      RETURN v_parent_id;
    END IF;
    
    -- Fallback 2: usa user_id (self-tenant)
    RETURN p_user_id;
  END IF;
  
  RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Examples

### Creare Sub-User

```typescript
// Server Action
import { createSubUser } from '@/actions/admin-reseller';

const result = await createSubUser({
  email: 'cliente@example.com',
  name: 'Cliente ABC',
  password: 'password123', // Opzionale: genera automaticamente se non fornita
});

if (result.success) {
  console.log(`Sub-user creato: ${result.userId}`);
}
```

### Verificare Tier Reseller

```typescript
// Server Action
import { getResellerTier, getTierLimits } from '@/lib/db/tier-helpers';

const tier = await getResellerTier(resellerId);
if (tier) {
  const limits = getTierLimits(tier);
  console.log(`Tier: ${tier}, Max sub-users: ${limits.maxSubUsers}`);
}
```

### Query Sub-Users

```typescript
// Server Action
import { getSubUsers } from '@/actions/admin-reseller';

const { subUsers } = await getSubUsers();

subUsers.forEach(user => {
  console.log(`${user.name} (${user.email})`);
});
```

### Verificare Limite Tier

```typescript
// Prima di creare sub-user
import { getResellerTier, countSubUsers, isTierAtLimit } from '@/lib/db/tier-helpers';

const tier = await getResellerTier(resellerId);
const subUsersCount = await countSubUsers(resellerId);

if (tier && isTierAtLimit(tier, subUsersCount)) {
  throw new Error('Limite tier raggiunto');
}
```

---

## Common Issues

| Issue | Soluzione |
|-------|-----------|
| Reseller non vede sub-users | Verifica RLS policy, controlla che `is_reseller = true` e `is_sub_user_of()` funzioni |
| Tier non calcolato | Esegui migration 090, verifica che `get_reseller_tier()` sia chiamata |
| Limite tier raggiunto | Verifica `isTierAtLimit()`, considera upgrade a tier superiore |
| Sub-user non isolato | Verifica che `tenant_id` sia popolato correttamente (migration 086) |
| RLS blocca query | Verifica che `auth.uid()` sia impostato, controlla policy `users_select_reseller` |

---

## Related Documentation

- [Security Overview](../8-SECURITY/OVERVIEW.md) - RLS e isolamento multi-tenant
- [Authorization & Acting Context](../8-SECURITY/AUTHORIZATION.md) - Impersonation support
- [Price Lists Feature](PRICE_LISTS.md) - Listini personalizzati per reseller
- [Database Architecture](../2-ARCHITECTURE/DATABASE.md) - Struttura tabelle users

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-12 | 1.0.0 | Initial version - Gerarchia reseller, Tiers, Team Roles, RLS | AI Agent |

---
*Last Updated: 2026-01-12*  
*Status: 🟢 Active*  
*Maintainer: Engineering Team*
