# 🗄️ Schema Database Proposto - Fase 0

**Data:** 2025-01-XX  
**Scopo:** Definire schema per tenant_id, capability flags, reseller_tier

---

## 1. Tabella `account_capabilities`

### 1.1 Struttura

```sql
CREATE TABLE IF NOT EXISTS account_capabilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Riferimento utente
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Nome capability
  capability_name TEXT NOT NULL,
  
  -- Audit trail
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES users(id),
  
  -- Revoca (soft delete)
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id),
  
  -- Metadata
  notes TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Vincolo: un utente può avere una sola capability attiva per nome
  CONSTRAINT unique_active_capability 
    UNIQUE (user_id, capability_name) 
    WHERE revoked_at IS NULL
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_account_capabilities_user_id 
  ON account_capabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_account_capabilities_capability_name 
  ON account_capabilities(capability_name);
CREATE INDEX IF NOT EXISTS idx_account_capabilities_active 
  ON account_capabilities(user_id, capability_name) 
  WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_account_capabilities_revoked 
  ON account_capabilities(revoked_at) 
  WHERE revoked_at IS NOT NULL;

-- Commenti
COMMENT ON TABLE account_capabilities IS 
  'Capability flags granulari per permessi utente. Supporta audit trail e revoca.';
COMMENT ON COLUMN account_capabilities.user_id IS 'ID utente a cui è assegnata la capability';
COMMENT ON COLUMN account_capabilities.capability_name IS 'Nome capability (es: can_manage_pricing, can_create_subusers)';
COMMENT ON COLUMN account_capabilities.revoked_at IS 'NULL = capability attiva, NOT NULL = revocata';
```

### 1.2 Capability Standard

| Capability Name | Descrizione | Default per Role |
|----------------|-------------|------------------|
| `can_manage_pricing` | Può modificare prezzi/listini | `admin`, `superadmin` |
| `can_create_subusers` | Può creare sub-users | `reseller`, `admin`, `superadmin` |
| `can_access_api` | Può accedere alle API | `byoc`, `admin`, `superadmin` |
| `can_manage_wallet` | Può gestire wallet altri utenti | `admin`, `superadmin` |
| `can_view_all_clients` | Può vedere tutti i clienti | `admin`, `superadmin` |
| `can_manage_resellers` | Può gestire reseller | `superadmin` |
| `can_bypass_rls` | Può bypassare RLS (solo superadmin) | `superadmin` |

---

## 2. Campo `tenant_id` in `users`

### 2.1 Aggiunta Campo

```sql
-- Aggiungi tenant_id a users
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'tenant_id'
  ) THEN
    ALTER TABLE users ADD COLUMN tenant_id UUID REFERENCES users(id) ON DELETE SET NULL;
    COMMENT ON COLUMN users.tenant_id IS 
      'ID tenant per isolamento multi-tenant. Reseller: self-tenant (tenant_id = user_id). Sub-User: tenant del reseller (tenant_id = parent_id). BYOC: self-tenant.';
    RAISE NOTICE '✅ Aggiunto campo: tenant_id';
  ELSE
    RAISE NOTICE '⚠️ Campo tenant_id già esistente';
  END IF;
END $$;

-- Indice per performance
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);

-- Indice composito per query comuni
CREATE INDEX IF NOT EXISTS idx_users_tenant_account_type 
  ON users(tenant_id, account_type) 
  WHERE tenant_id IS NOT NULL;
```

### 2.2 Logica Popolamento

| Tipo Utente | `tenant_id` | Logica |
|-------------|-------------|--------|
| **Reseller** | `user_id` (self-tenant) | Reseller è il proprio tenant |
| **Sub-User** | `parent_id` (tenant del reseller) | Sub-User appartiene al tenant del reseller |
| **BYOC** | `user_id` (self-tenant) | BYOC è il proprio tenant |
| **Superadmin** | `user_id` (self-tenant) | Superadmin è il proprio tenant |
| **User Standard** | `user_id` (self-tenant) | User standard è il proprio tenant |

---

## 3. Campo `reseller_tier` in `users`

### 3.1 Aggiunta Campo

```sql
-- Crea enum per reseller_tier
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reseller_tier') THEN
    CREATE TYPE reseller_tier AS ENUM ('small', 'medium', 'enterprise');
    RAISE NOTICE '✅ Creato enum: reseller_tier';
  ELSE
    RAISE NOTICE '⚠️ Enum reseller_tier già esistente';
  END IF;
END $$;

-- Aggiungi reseller_tier a users
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'reseller_tier'
  ) THEN
    ALTER TABLE users ADD COLUMN reseller_tier reseller_tier;
    COMMENT ON COLUMN users.reseller_tier IS 
      'Tier del reseller: small (<10 sub-users), medium (10-100), enterprise (>100). NULL per non-reseller.';
    RAISE NOTICE '✅ Aggiunto campo: reseller_tier';
  ELSE
    RAISE NOTICE '⚠️ Campo reseller_tier già esistente';
  END IF;
END $$;

-- Indice per performance
CREATE INDEX IF NOT EXISTS idx_users_reseller_tier 
  ON users(reseller_tier) 
  WHERE reseller_tier IS NOT NULL;
```

### 3.2 Logica Popolamento

| Numero Sub-Users | `reseller_tier` | Limiti (esempio) |
|------------------|-----------------|------------------|
| < 10 | `small` | Max 10 sub-users, base features |
| 10 - 100 | `medium` | Max 100 sub-users, advanced features |
| > 100 | `enterprise` | Unlimited sub-users, all features, SLA dedicato |

---

## 4. Funzioni Helper Database

### 4.1 `has_capability(user_id, capability_name)`

```sql
CREATE OR REPLACE FUNCTION has_capability(
  p_user_id UUID,
  p_capability_name TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verifica capability attiva
  RETURN EXISTS (
    SELECT 1 FROM account_capabilities
    WHERE user_id = p_user_id
      AND capability_name = p_capability_name
      AND revoked_at IS NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION has_capability IS 
  'Verifica se un utente ha una capability attiva. Usa per controlli granulari.';
```

### 4.2 `get_user_tenant(user_id)`

```sql
CREATE OR REPLACE FUNCTION get_user_tenant(
  p_user_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_tenant_id UUID;
BEGIN
  -- Recupera tenant_id
  SELECT tenant_id INTO v_tenant_id
  FROM users
  WHERE id = p_user_id;
  
  -- Fallback: se tenant_id è NULL, usa user_id (self-tenant)
  IF v_tenant_id IS NULL THEN
    RETURN p_user_id;
  END IF;
  
  RETURN v_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_tenant IS 
  'Recupera tenant_id di un utente. Fallback a user_id se tenant_id è NULL.';
```

### 4.3 `get_reseller_tier(user_id)`

```sql
CREATE OR REPLACE FUNCTION get_reseller_tier(
  p_user_id UUID
)
RETURNS reseller_tier AS $$
DECLARE
  v_tier reseller_tier;
  v_sub_users_count INTEGER;
BEGIN
  -- Verifica se è reseller
  IF NOT EXISTS (
    SELECT 1 FROM users 
    WHERE id = p_user_id AND is_reseller = true
  ) THEN
    RETURN NULL;
  END IF;
  
  -- Recupera tier esistente
  SELECT reseller_tier INTO v_tier
  FROM users
  WHERE id = p_user_id;
  
  -- Se tier è NULL, calcola da numero sub-users
  IF v_tier IS NULL THEN
    SELECT COUNT(*) INTO v_sub_users_count
    FROM users
    WHERE parent_id = p_user_id;
    
    -- Determina tier
    IF v_sub_users_count < 10 THEN
      RETURN 'small';
    ELSIF v_sub_users_count < 100 THEN
      RETURN 'medium';
    ELSE
      RETURN 'enterprise';
    END IF;
  END IF;
  
  RETURN v_tier;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_reseller_tier IS 
  'Recupera tier di un reseller. Calcola automaticamente se tier è NULL.';
```

---

## 5. Script Migrazione Dati

### 5.1 Popolamento `tenant_id`

```sql
-- Popola tenant_id da parent_id/user_id esistenti
UPDATE users
SET tenant_id = CASE
  -- Reseller: self-tenant
  WHEN is_reseller = true AND parent_id IS NULL THEN id
  -- Sub-User: tenant del reseller
  WHEN parent_id IS NOT NULL THEN parent_id
  -- BYOC: self-tenant
  WHEN account_type = 'byoc' THEN id
  -- Superadmin: self-tenant
  WHEN account_type = 'superadmin' THEN id
  -- User standard: self-tenant
  ELSE id
END
WHERE tenant_id IS NULL;

-- Verifica: tutti gli utenti devono avere tenant_id
DO $$
DECLARE
  v_null_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_null_count
  FROM users
  WHERE tenant_id IS NULL;
  
  IF v_null_count > 0 THEN
    RAISE WARNING '⚠️ % utenti con tenant_id NULL dopo migrazione', v_null_count;
  ELSE
    RAISE NOTICE '✅ Tutti gli utenti hanno tenant_id popolato';
  END IF;
END $$;
```

### 5.2 Popolamento `account_capabilities`

```sql
-- Popola capability da role/account_type esistenti
INSERT INTO account_capabilities (user_id, capability_name, granted_by)
SELECT 
  id,
  'can_manage_pricing',
  id  -- Self-granted (migrazione)
FROM users
WHERE account_type IN ('admin', 'superadmin')
  OR role IN ('admin', 'superadmin')
ON CONFLICT DO NOTHING;

INSERT INTO account_capabilities (user_id, capability_name, granted_by)
SELECT 
  id,
  'can_create_subusers',
  id
FROM users
WHERE is_reseller = true
  OR account_type IN ('admin', 'superadmin')
  OR role IN ('admin', 'superadmin')
ON CONFLICT DO NOTHING;

INSERT INTO account_capabilities (user_id, capability_name, granted_by)
SELECT 
  id,
  'can_access_api',
  id
FROM users
WHERE account_type IN ('byoc', 'admin', 'superadmin')
ON CONFLICT DO NOTHING;

INSERT INTO account_capabilities (user_id, capability_name, granted_by)
SELECT 
  id,
  'can_manage_wallet',
  id
FROM users
WHERE account_type IN ('admin', 'superadmin')
  OR role IN ('admin', 'superadmin')
ON CONFLICT DO NOTHING;

INSERT INTO account_capabilities (user_id, capability_name, granted_by)
SELECT 
  id,
  'can_view_all_clients',
  id
FROM users
WHERE account_type IN ('admin', 'superadmin')
  OR role IN ('admin', 'superadmin')
ON CONFLICT DO NOTHING;

INSERT INTO account_capabilities (user_id, capability_name, granted_by)
SELECT 
  id,
  'can_manage_resellers',
  id
FROM users
WHERE account_type = 'superadmin'
ON CONFLICT DO NOTHING;

INSERT INTO account_capabilities (user_id, capability_name, granted_by)
SELECT 
  id,
  'can_bypass_rls',
  id
FROM users
WHERE account_type = 'superadmin'
ON CONFLICT DO NOTHING;
```

### 5.3 Popolamento `reseller_tier`

```sql
-- Popola reseller_tier da numero sub-users
UPDATE users u
SET reseller_tier = CASE
  WHEN sub_count < 10 THEN 'small'::reseller_tier
  WHEN sub_count < 100 THEN 'medium'::reseller_tier
  ELSE 'enterprise'::reseller_tier
END
FROM (
  SELECT 
    parent_id,
    COUNT(*) as sub_count
  FROM users
  WHERE parent_id IS NOT NULL
  GROUP BY parent_id
) sub_counts
WHERE u.id = sub_counts.parent_id
  AND u.is_reseller = true
  AND u.reseller_tier IS NULL;
```

---

## 6. RLS Policies Aggiornate

### 6.1 Policy `users_select_reseller` (Aggiornata)

```sql
-- Aggiorna policy per usare tenant_id con fallback
DROP POLICY IF EXISTS users_select_reseller ON users;

CREATE POLICY users_select_reseller ON users
  FOR SELECT USING (
    -- Super Admin vede tutto
    is_super_admin(auth.uid())
    OR
    -- Utente vede se stesso
    auth.uid()::text = id::text
    OR
    -- Reseller vede Sub-Users (via tenant_id o parent_id fallback)
    (
      is_reseller(auth.uid())
      AND (
        -- Nuovo: usa tenant_id
        tenant_id = get_user_tenant(auth.uid())
        OR
        -- Fallback: usa parent_id (retrocompatibilità)
        is_sub_user_of(id, auth.uid())
      )
    )
  );

COMMENT ON POLICY users_select_reseller ON users IS 
  'RLS: Super Admin vede tutto, Reseller vede Sub-Users (via tenant_id o parent_id fallback), User vede solo se stesso';
```

---

## 7. Indici Performance

### 7.1 Indici Esistenti (da mantenere)

- `idx_users_email` - Ricerca per email
- `idx_users_role` - Filtro per role
- `idx_users_parent` - Gerarchia parent_id (mantenere per fallback)

### 7.2 Nuovi Indici

- `idx_users_tenant_id` - Query per tenant
- `idx_users_tenant_account_type` - Query composite
- `idx_users_reseller_tier` - Filtro per tier
- `idx_account_capabilities_user_id` - Query capability
- `idx_account_capabilities_active` - Query capability attive

---

## 8. Compatibilità e Fallback

### 8.1 Strategia Fallback

| Feature | Fallback | Quando Usare |
|---------|----------|--------------|
| `tenant_id` | `parent_id` o `user_id` | Se `tenant_id` è NULL |
| `capability` | `role` o `account_type` | Se capability non trovata |
| `reseller_tier` | Calcolo da sub-users | Se tier è NULL |

### 8.2 Query Compatibili

Tutte le query esistenti continueranno a funzionare grazie ai fallback:
- Query con `parent_id` → funzionano (fallback attivo)
- Query con `role` → funzionano (fallback attivo)
- Query con `account_type` → funzionano (fallback attivo)

---

## 9. Checklist Pre-Deploy

- [ ] Schema database creato
- [ ] Indici creati
- [ ] Funzioni helper create
- [ ] Script migrazione testato su staging
- [ ] RLS policies aggiornate
- [ ] Fallback testati
- [ ] Performance test (indici)
- [ ] Backup database

---

**Status:** ✅ Schema definito, pronto per implementazione
