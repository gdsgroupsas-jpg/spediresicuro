# 📚 Storia di `account_type` - Evoluzione del Sistema

## 🎯 Origine

Il campo `account_type` è stato introdotto per distinguere i diversi tipi di account nella piattaforma, permettendo un controllo granulare dei permessi e delle funzionalità disponibili.

---

## 📅 Timeline Evoluzione

### **Fase 1: Creazione Iniziale (Migration 008)**

**File:** `supabase/migrations/008_admin_user_system.sql`  
**Data:** 2024  
**Valori iniziali:**

- `'user'` - Utente base
- `'admin'` - Amministratore avanzato
- `'superadmin'` - Super amministratore (gestione completa)

**Scopo:**

- Sistema gerarchico multi-livello admin
- Distinzione tra utenti normali e amministratori
- Supporto per `admin_level` (0-5) e `parent_admin_id`

**Commento originale:**

```sql
COMMENT ON COLUMN users.account_type IS
'Tipo account: user (base), admin (avanzato), superadmin (gestione completa)';
```

---

### **Fase 2: Aggiunta BYOC (Migration 056.5)**

**File:** `supabase/migrations/056.5_add_byoc_to_account_type_enum.sql`  
**Data:** 2026-01  
**Nuovo valore:**

- `'byoc'` - Bring Your Own Carrier (utenti con propri contratti corriere)

**Scopo:**

- Supportare utenti che usano i propri contratti corriere
- Modello di business BYOC (non usano wallet interno per spedizioni)
- Gestione listini fornitore personalizzati

**Commento aggiornato:**

```sql
COMMENT ON COLUMN users.account_type IS
'Tipo account: user (base), admin (avanzato), superadmin (gestione completa), byoc (Bring Your Own Carrier)';
```

---

### **Fase 3: Aggiunta Reseller (Migration 080)**

**File:** `supabase/migrations/080_add_reseller_to_account_type_enum.sql`  
**Data:** 2026-01 (questa PR)  
**Nuovo valore:**

- `'reseller'` - Rivenditore (utenti che rivendono il servizio)

**Scopo:**

- Supportare sistema reseller completo
- Distinzione chiara tra user base e reseller
- Migliore tracciabilità e reporting

**Commento aggiornato:**

```sql
COMMENT ON COLUMN users.account_type IS
'Tipo account: user (base), admin (avanzato), superadmin (gestione completa), byoc (Bring Your Own Carrier), reseller (rivenditore)';
```

---

## 🔄 Valori Attuali dell'Enum

Attualmente l'enum `account_type` supporta **5 valori**:

1. **`'user'`** - Utente base (default)
   - Accesso base alla piattaforma
   - Può creare spedizioni
   - Nessun privilegio amministrativo

2. **`'admin'`** - Amministratore
   - Privilegi avanzati
   - Può gestire configurazioni
   - Può avere `admin_level` 1-5

3. **`'superadmin'`** - Super Amministratore
   - Accesso completo alla piattaforma
   - Può gestire tutti gli utenti
   - `admin_level = 0`
   - Può creare reseller

4. **`'byoc'`** - Bring Your Own Carrier
   - Utenti con propri contratti corriere
   - Non usano wallet interno per spedizioni
   - Pagano solo platform fee

5. **`'reseller'`** - Rivenditore (nuovo)
   - Può creare sub-users
   - Gestisce margini personalizzati
   - Ha `is_reseller = true` e `reseller_role` ('admin' o 'user')

---

## 🏗️ Architettura

### Relazione con altri campi

```sql
users (
  id UUID,
  email TEXT,
  name TEXT,
  role TEXT,              -- Legacy: 'user', 'admin', etc.
  account_type account_type,  -- ENUM: 'user', 'admin', 'superadmin', 'byoc', 'reseller'
  is_reseller BOOLEAN,    -- Flag aggiuntivo per reseller
  reseller_role TEXT,     -- 'admin' o 'user' (solo se is_reseller=true)
  admin_level INTEGER,    -- 0=superadmin, 1-5=admin
  parent_admin_id UUID    -- Gerarchia admin
)
```

### Logica di determinazione ruolo

Il sistema usa una **logica combinata** per determinare il ruolo effettivo:

1. **Prima priorità:** `account_type` (più specifico)
2. **Seconda priorità:** `is_reseller` (per compatibilità)
3. **Terza priorità:** `role` (legacy)

**Esempio:**

```typescript
// Reseller identificato da:
account_type === 'reseller' || is_reseller === true;

// Super Admin identificato da:
account_type === 'superadmin' || (role === 'admin' && admin_level === 0);
```

---

## 📊 Migrazioni che hanno toccato account_type

1. **008_admin_user_system.sql** - Creazione iniziale
2. **018_FINAL_UNIFIED_ANNE_COMPLETE.sql** - Verifica e fix
3. **021_verify_fix_account_type_config.sql** - Verifica e correzione
4. **056.5_add_byoc_to_account_type_enum.sql** - Aggiunta BYOC
5. **080_add_reseller_to_account_type_enum.sql** - Aggiunta Reseller (questa PR)

---

## 🔍 Differenza tra `role` e `account_type`

### `role` (Legacy)

- Campo TEXT (non enum)
- Valori: 'user', 'admin', 'agent', 'manager', etc.
- Usato principalmente per compatibilità
- Meno specifico

### `account_type` (Moderno)

- Campo ENUM (type-safe)
- Valori: 'user', 'admin', 'superadmin', 'byoc', 'reseller'
- Più specifico e granulare
- Supporta modelli di business diversi (BYOC, Reseller)

**Best Practice:**

- ✅ Usa `account_type` per nuova logica
- ✅ Usa `role` solo per compatibilità legacy
- ✅ Combina `account_type` + `is_reseller` per reseller

---

## 🎯 Uso nel Codice

### Verifica Ruolo

```typescript
// ✅ CORRETTO: Usa account_type
const isSuperAdmin = user.account_type === 'superadmin';

// ✅ CORRETTO: Reseller (logica combinata)
const isReseller = user.account_type === 'reseller' || user.is_reseller === true;

// ❌ SBAGLIATO: Non usare solo role
const isAdmin = user.role === 'admin'; // Non specifico!
```

### RBAC (lib/rbac.ts)

Il sistema RBAC usa `account_type` come fonte primaria:

```typescript
export type AccountType = 'user' | 'admin' | 'reseller' | 'superadmin' | 'byoc';

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  reseller: [
    'view_dashboard',
    'create_shipment',
    'view_shipments',
    'manage_users',
    'manage_integrations',
    'view_analytics',
    'manage_wallet',
  ],
  // ...
};
```

---

## 📝 Note Importanti

1. **PostgreSQL ENUM Limitation:**
   - Non puoi usare un nuovo valore enum nella stessa transazione in cui viene aggiunto
   - Deve essere aggiunto in una migration separata prima di essere usato

2. **Default Value:**
   - `account_type` ha default `'user'`
   - Gli utenti creati senza specificare account_type sono automaticamente 'user'

3. **Compatibilità:**
   - Il sistema mantiene compatibilità con `role` per codice legacy
   - Nuovo codice dovrebbe usare `account_type`

4. **Reseller:**
   - I reseller devono avere `account_type='reseller'` E `is_reseller=true`
   - `reseller_role` determina se è admin o user reseller

---

## 🔮 Possibili Evoluzioni Future

- **`'enterprise'`** - Account enterprise con funzionalità avanzate
- **`'trial'`** - Account trial temporaneo
- **`'suspended'`** - Account sospeso (invece di eliminare)

---

## 📚 Riferimenti

- Migration originale: `supabase/migrations/008_admin_user_system.sql`
- Migration BYOC: `supabase/migrations/056.5_add_byoc_to_account_type_enum.sql`
- Migration Reseller: `supabase/migrations/080_add_reseller_to_account_type_enum.sql`
- RBAC System: `lib/rbac.ts`
- Utility Badge: `lib/utils/role-badges.tsx`
