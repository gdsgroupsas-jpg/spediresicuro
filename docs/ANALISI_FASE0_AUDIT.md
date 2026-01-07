# 📊 Fase 0: Audit Codice Esistente

**Data:** 2025-01-XX  
**Scopo:** Mappare tutti i punti critici prima di implementare tenant_id, capability flags, reseller tier

---

## 1. Query che usano `parent_id`

### 1.1 Actions (`actions/`)

| File | Funzione | Query | Uso |
|------|----------|-------|-----|
| `admin-reseller.ts` | `getSubUsers()` | `.eq('parent_id', resellerCheck.userId)` | Recupera sub-users di un reseller |
| `admin-reseller.ts` | `getSubUsersStats()` | `.eq('parent_id', resellerCheck.userId)` | Statistiche sub-users |
| `admin-reseller.ts` | `createSubUser()` | `parent_id: resellerCheck.userId` | Crea sub-user collegato |
| `admin-reseller.ts` | `rechargeSubUserWallet()` | Verifica `subUser.parent_id !== resellerCheck.userId` | Controllo sicurezza |
| `admin-reseller.ts` | `getSubUserShipments()` | `.eq('parent_id', resellerCheck.userId)` | Spedizioni sub-users |

### 1.2 Lib Helpers (`lib/`)

| File | Funzione | Query | Uso |
|------|----------|-------|-----|
| `user-helpers.ts` | `getUserChildren()` | `.eq('parent_id', parentId)` | Helper generico per children |

### 1.3 API Routes (`app/api/`)

| File | Route | Query | Uso |
|------|-------|-------|-----|
| `spedizioni/cancellate/route.ts` | GET | `.eq('parent_id', userId)` | Spedizioni cancellate sub-users |

### 1.4 Database Functions (Supabase)

| Function | File Migration | Logica |
|----------|----------------|--------|
| `is_sub_user_of()` | `019_reseller_system_and_wallet.sql` | Verifica ricorsiva gerarchia parent_id |

**Totale punti critici `parent_id`: 8+**

---

## 2. RLS Policies che usano `parent_id` o gerarchia

### 2.1 Users Table

| Policy | File | Logica |
|--------|------|--------|
| `users_select_reseller` | `019_reseller_system_and_wallet.sql` | Reseller vede Sub-Users via `is_sub_user_of(id, auth.uid())` |

### 2.2 Altre Tabelle

Le RLS policies per altre tabelle (shipments, price_lists, ecc.) usano principalmente:
- `account_type` checks
- `is_reseller` checks
- `role` checks

**Non usano direttamente `parent_id`**, ma potrebbero beneficiare di `tenant_id`.

---

## 3. Controlli basati su `role`

### 3.1 Pattern Comuni

| Pattern | File Esempio | Uso |
|---------|--------------|-----|
| `role === 'admin'` | `app/api/admin/overview/route.ts` | Controllo admin |
| `role === 'superadmin'` | `app/api/shipments/create/route.ts` | Controllo superadmin |
| `role IN ('admin', 'superadmin')` | `supabase/migrations/001_complete_schema.sql` | RLS policies |

**Totale controlli `role`: 20+**

---

## 4. Controlli basati su `account_type`

### 4.1 Pattern Comuni

| Pattern | File Esempio | Uso |
|---------|--------------|-----|
| `account_type === 'superadmin'` | `actions/wallet.ts` | Controllo superadmin |
| `account_type === 'admin'` | `actions/price-lists.ts` | Controllo admin |
| `account_type === 'byoc'` | `actions/spedisci-online-rates.ts` | Controllo BYOC |
| `account_type === 'reseller'` | `supabase/migrations/080_add_reseller_to_account_type_enum.sql` | Controllo reseller |
| `account_type IN ('admin', 'superadmin')` | `actions/supplier-price-list-config.ts` | Controllo admin/superadmin |

**Totale controlli `account_type`: 50+**

---

## 5. Controlli basati su `is_reseller`

### 5.1 Pattern Comuni

| Pattern | File Esempio | Uso |
|---------|--------------|-----|
| `is_reseller === true` | `actions/admin-reseller.ts` | Verifica reseller |
| `is_reseller = true` (SQL) | `supabase/migrations/019_reseller_system_and_wallet.sql` | RLS policies |

**Totale controlli `is_reseller`: 15+**

---

## 6. Schema Database Attuale

### 6.1 Tabella `users`

```sql
-- Campi rilevanti per il nostro scopo
id UUID PRIMARY KEY
email TEXT UNIQUE
role TEXT DEFAULT 'user'  -- 'user', 'admin', 'superadmin'
account_type account_type  -- ENUM: 'user', 'admin', 'superadmin', 'byoc', 'reseller'
parent_id UUID REFERENCES users(id)  -- Gerarchia reseller
is_reseller BOOLEAN DEFAULT false
reseller_role TEXT  -- 'admin', 'user' (per reseller)
wallet_balance DECIMAL(10,2)
```

### 6.2 Indici Esistenti

```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_parent ON users(parent_id);  -- ✅ Già presente!
```

### 6.3 Funzioni Database

- `is_reseller(p_user_id UUID)` - Verifica se è reseller
- `is_sub_user_of(p_sub_user_id UUID, p_admin_id UUID)` - Verifica gerarchia
- `is_super_admin(p_user_id UUID)` - Verifica superadmin

---

## 7. Punti Critici per Migrazione

### 7.1 Query da Aggiornare (con fallback)

1. **`getSubUsers()`** - `actions/admin-reseller.ts:243`
   - Attuale: `.eq('parent_id', resellerCheck.userId)`
   - Nuovo: `.eq('tenant_id', tenantId)` con fallback a `parent_id`

2. **`getUserChildren()`** - `lib/db/user-helpers.ts:129`
   - Attuale: `.eq('parent_id', parentId)`
   - Nuovo: `.eq('tenant_id', tenantId)` con fallback a `parent_id`

3. **RLS Policy `users_select_reseller`** - `019_reseller_system_and_wallet.sql:213`
   - Attuale: Usa `is_sub_user_of(id, auth.uid())` che usa `parent_id`
   - Nuovo: Aggiungere controllo `tenant_id` con fallback

### 7.2 Controlli da Aggiornare (con fallback)

1. **Controlli `role`** - 20+ file
   - Mantenere come fallback
   - Aggiungere controlli `capability` opzionali

2. **Controlli `account_type`** - 50+ file
   - Mantenere come fallback
   - Aggiungere controlli `capability` opzionali

3. **Controlli `is_reseller`** - 15+ file
   - Mantenere come fallback
   - Aggiungere controlli `capability` opzionali

---

## 8. Strategia di Migrazione

### 8.1 Fase 1: Capability Flags (Non Breaking)

- ✅ Aggiungere tabella `account_capabilities`
- ✅ Popolare da `role`/`account_type` esistenti
- ✅ Funzione helper `hasCapability()` con fallback
- ✅ Nessuna modifica a query esistenti (solo aggiunta)

### 8.2 Fase 2: tenant_id (Non Breaking)

- ✅ Aggiungere campo `tenant_id` a `users`
- ✅ Popolare da `parent_id`/`user_id` esistenti
- ✅ Aggiornare query con fallback a `parent_id`
- ✅ Aggiornare RLS con fallback

### 8.3 Fase 3: Reseller Tier (Non Breaking)

- ✅ Aggiungere campo `reseller_tier` a `users`
- ✅ Popolare da numero sub-users o manuale
- ✅ Logica opzionale per limiti

### 8.4 Fase 4: Gestione Clienti (Nuova Feature)

- ✅ Usa `tenant_id` per query
- ✅ Usa `capability` per permessi
- ✅ Vista gerarchica reseller → sub-users

---

## 9. Rischi Identificati

| Rischio | Probabilità | Impatto | Mitigazione |
|---------|-------------|---------|-------------|
| Query esistenti non funzionano | Bassa | Alto | Fallback sempre attivo |
| RLS policies bloccano accesso | Media | Alto | Test completo, fallback |
| Performance degradata | Bassa | Medio | Indici su `tenant_id` |
| Migrazione dati fallita | Bassa | Alto | Backup, test staging |

---

## 10. Prossimi Passi

1. ✅ **Completato:** Audit codice esistente
2. ⏳ **Prossimo:** Definire schema database dettagliato
3. ⏳ **Prossimo:** Creare script migrazione
4. ⏳ **Prossimo:** Implementare Fase 1 (Capability Flags)

---

## 11. File da Modificare (Stima)

- **Database Migrations:** 3-4 nuovi file
- **Actions:** 5-8 file (aggiunta logica, non breaking)
- **Lib Helpers:** 2-3 file (nuove funzioni)
- **API Routes:** 2-3 file (nuovi endpoint)
- **UI Components:** 3-5 file (nuovi componenti)

**Totale stimato:** 15-23 file modificati/creati

---

**Status:** ✅ Audit completato, pronto per Fase 1
