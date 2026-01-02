# 📊 Analisi Completa: Sezione Listini Prezzi

**Data Analisi**: 2025-01-XX  
**Scope**: Super Admin, Reseller, BYOC

---

## 📋 INDICE

1. [Architettura Generale](#architettura-generale)
2. [Super Admin](#super-admin)
3. [Reseller](#reseller)
4. [BYOC (Bring Your Own Carrier)](#byoc)
5. [RLS Policies](#rls-policies)
6. [Funzionalità Comuni](#funzionalità-comuni)
7. [Gap e Limitazioni](#gap-e-limitazioni)

---

## 🏗️ ARCHITETTURA GENERALE

### Struttura Database

**Tabella `price_lists`:**

- `id` (UUID) - Chiave primaria
- `courier_id` (UUID, nullable) - Corriere specifico o NULL per multi-corriere
- `name` (TEXT) - Nome listino
- `version` (TEXT) - Versione (es. "1.0.0")
- `status` (TEXT) - 'draft' | 'active' | 'archived'
- `priority` (TEXT) - 'global' | 'partner' | 'client' | 'default'
- `is_global` (BOOLEAN) - Se true, listino globale (solo admin)
- `assigned_to_user_id` (UUID, nullable) - Listino personalizzato per utente
- `rules` (JSONB) - Array di regole PriceRule avanzate
- `default_margin_percent` (DECIMAL) - Margine % di default
- `default_margin_fixed` (DECIMAL) - Margine fisso di default (€)
- `valid_from` / `valid_until` (DATE) - Validità temporale
- `usage_count` (INTEGER) - Statistiche utilizzo
- `last_used_at` (TIMESTAMPTZ) - Ultimo utilizzo

**Tabella `users`:**

- `assigned_price_list_id` (UUID, nullable) - Listino predefinito assegnato

**Tabella `shipments`:**

- `price_list_id` (UUID, nullable) - Listino applicato (audit)
- `applied_price_rule_id` (TEXT, nullable) - Regola applicata (audit)

### Sistema PriceRule

Ogni listino può contenere un array di **regole avanzate** (JSONB) che permettono:

- Matching per peso/volume
- Matching geografico (zone, CAP, province, regioni, paesi)
- Matching per corriere/servizio
- Calcolo margine (percentuale o fisso)
- Sovrapprezzi (carburante, isole, ZTL, express, contrassegno, assicurazione)
- Priorità per matching multipli
- Validità temporale

---

## 👑 SUPER ADMIN

### ✅ Permessi Completi

**Accesso UI:**

- ✅ Dashboard `/dashboard/listini` **SOLO per superadmin/admin**
- ✅ Verifica permessi: `account_type === 'superadmin' || account_type === 'admin'`
- ❌ Reseller e BYOC vengono reindirizzati a `/dashboard?error=unauthorized`

**Operazioni Disponibili:**

#### 1. **Visualizzazione Listini**

```typescript
// actions/price-lists.ts:300-362
listPriceListsAction(filters?)
```

- ✅ **Vede TUTTI i listini** (nessun filtro RLS)
- ✅ Filtri disponibili: `courierId`, `status`, `isGlobal`, `assignedToUserId`
- ✅ Query: `supabaseAdmin.from('price_lists').select('*')` (senza filtri RLS)

#### 2. **Creazione Listini**

```typescript
// actions/price-lists.ts:29-73
createPriceListAction(data);
```

- ✅ Può creare **listini globali** (`is_global = true`)
- ✅ Può creare **listini personalizzati** (`assigned_to_user_id`)
- ✅ Può creare listini con **qualsiasi priorità** ('global', 'partner', 'client', 'default')
- ✅ Verifica: `isAdmin = true` → permesso garantito

#### 3. **Modifica Listini**

```typescript
// actions/price-lists.ts:78-122
updatePriceListAction(id, data);
```

- ✅ Può modificare **qualsiasi listino** (anche creato da altri)
- ✅ Verifica: `isAdmin = true` → permesso garantito
- ✅ Non serve essere owner (`created_by` o `assigned_to_user_id`)

#### 4. **Eliminazione Listini**

- ✅ Può eliminare **qualsiasi listino**
- ✅ RLS Policy: `account_type IN ('admin', 'superadmin')`

#### 5. **Assegnazione Listini a Utenti**

```typescript
// actions/price-lists.ts:218-268
assignPriceListToUserAction(userId, priceListId);
```

- ✅ **Solo Super Admin** può assegnare listini
- ✅ Aggiorna `users.assigned_price_list_id`
- ✅ Verifica: `isAdmin = true` → permesso garantito

### 🔍 Algoritmo Matching Listino Applicabile

**Funzione SQL:** `get_applicable_price_list(userId, courierId?, date?)`

**Priorità (match_score):**

1. **100** - Listino assegnato direttamente (`assigned_to_user_id = userId`)
2. **50** - Listino globale (`is_global = true`)
3. **10** - Listino default (`priority = 'default'`)

**Super Admin:**

- ✅ Vede tutti i listini nella UI
- ✅ Può assegnare qualsiasi listino a qualsiasi utente
- ✅ Può creare listini globali visibili a tutti

---

## 🏢 RESELLER

### ⚠️ Limitazioni Attuali

**Accesso UI:**

- ❌ **NON ha accesso** a `/dashboard/listini`
- ❌ Viene reindirizzato: `router.push('/dashboard?error=unauthorized')`
- ⚠️ **GAP**: Reseller non ha UI dedicata per gestire listini

**Operazioni Disponibili (Server Actions):**

#### 1. **Creazione Listini**

```typescript
// actions/price-lists.ts:53-64
const isReseller = user.is_reseller === true;
if (!isAdmin && !isReseller) {
  return { error: "Solo admin e reseller possono creare listini" };
}
```

- ✅ **Può creare listini** (verificato in `createPriceListAction`)
- ❌ **NON può creare listini globali** (`is_global = true`)
- ✅ Può creare listini personalizzati (`assigned_to_user_id = userId`)
- ✅ Può creare listini con priorità 'partner' o 'client'

#### 2. **Visualizzazione Listini**

```typescript
// actions/price-lists.ts:345-349
const isAdmin =
  user.account_type === "admin" || user.account_type === "superadmin";
if (!isAdmin) {
  query = query.or(`is_global.eq.true,assigned_to_user_id.eq.${user.id}`);
}
```

- ✅ Vede **listini globali** (`is_global = true`)
- ✅ Vede **listini assegnati a lui** (`assigned_to_user_id = userId`)
- ❌ **NON vede** listini di altri reseller o utenti

#### 3. **Modifica Listini**

```typescript
// actions/price-lists.ts:108-113
const isAdmin =
  user.account_type === "admin" || user.account_type === "superadmin";
const isOwner =
  priceList.created_by === user.id || priceList.assigned_to_user_id === user.id;
if (!isAdmin && !isOwner) {
  return { error: "Non hai i permessi per modificare questo listino" };
}
```

- ✅ Può modificare **solo i propri listini** (`created_by = userId` o `assigned_to_user_id = userId`)
- ❌ **NON può modificare** listini globali o di altri

#### 4. **Eliminazione Listini**

- ✅ Può eliminare **solo i propri listini** (`created_by = userId`)
- ❌ **NON può eliminare** listini globali o di altri

#### 5. **Assegnazione Listini**

- ❌ **NON può assegnare** listini ad altri utenti (solo Super Admin)

### 🔍 Algoritmo Matching per Reseller

**Priorità:**

1. **100** - Listino assegnato direttamente (`assigned_to_user_id = userId`)
2. **50** - Listino globale (`is_global = true`)
3. **10** - Listino default (`priority = 'default'`)

**Reseller:**

- ✅ Può creare listini personalizzati per se stesso
- ✅ Può creare listini per i suoi sub-users (se implementato)
- ⚠️ **GAP**: Non ha UI per gestire listini

---

## 🔑 BYOC (Bring Your Own Carrier)

### ⚠️ Limitazioni Attuali

**Accesso UI:**

- ❌ **NON ha accesso** a `/dashboard/listini`
- ❌ Viene reindirizzato: `router.push('/dashboard?error=unauthorized')`
- ⚠️ **GAP**: BYOC non ha UI dedicata per gestire listini

**Operazioni Disponibili (Server Actions):**

#### 1. **Creazione Listini**

```typescript
// actions/price-lists.ts:53-64
const isAdmin =
  user.account_type === "admin" || user.account_type === "superadmin";
const isReseller = user.is_reseller === true;
if (!isAdmin && !isReseller) {
  return { error: "Solo admin e reseller possono creare listini" };
}
```

- ❌ **NON può creare listini** (verifica: `!isAdmin && !isReseller`)
- ⚠️ **GAP**: BYOC non può creare listini personalizzati

#### 2. **Visualizzazione Listini**

```typescript
// actions/price-lists.ts:345-349
if (!isAdmin) {
  query = query.or(`is_global.eq.true,assigned_to_user_id.eq.${user.id}`);
}
```

- ✅ Vede **listini globali** (`is_global = true`)
- ✅ Vede **listini assegnati a lui** (`assigned_to_user_id = userId`)
- ❌ **NON vede** listini di altri utenti

#### 3. **Modifica Listini**

- ❌ **NON può modificare** listini (solo admin o owner)
- ⚠️ **GAP**: BYOC non può modificare nemmeno i propri listini assegnati

#### 4. **Eliminazione Listini**

- ❌ **NON può eliminare** listini (solo admin o owner)

#### 5. **Assegnazione Listini**

- ❌ **NON può assegnare** listini (solo Super Admin)

### 🔍 Algoritmo Matching per BYOC

**Priorità:**

1. **100** - Listino assegnato direttamente (`assigned_to_user_id = userId`)
2. **50** - Listino globale (`is_global = true`)
3. **10** - Listino default (`priority = 'default'`)

**BYOC:**

- ✅ Usa listini assegnati da Super Admin
- ✅ Usa listini globali come fallback
- ❌ **NON può creare** listini personalizzati
- ⚠️ **GAP**: BYOC non ha controllo sui propri listini

---

## 🔒 RLS POLICIES

### SELECT Policy

```sql
-- supabase/migrations/020_advanced_price_lists_system.sql:439-459
CREATE POLICY price_lists_select ON price_lists FOR SELECT USING (
  -- Super Admin vede tutto
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text::uuid
          AND users.account_type = 'superadmin')
  OR
  -- Listini globali visibili a tutti
  is_global = true
  OR
  -- Listini assegnati all'utente
  assigned_to_user_id = auth.uid()::text::uuid
  OR
  -- Listini creati dall'utente
  created_by = auth.uid()::text::uuid
  OR
  -- Listini di default
  priority = 'default'
);
```

**Comportamento:**

- ✅ Super Admin: Vede tutto
- ✅ Tutti: Vedono listini globali
- ✅ Utente: Vede listini assegnati (`assigned_to_user_id`)
- ✅ Creatore: Vede listini creati (`created_by`)
- ✅ Tutti: Vedono listini default (`priority = 'default'`)

### INSERT Policy

```sql
-- supabase/migrations/020_advanced_price_lists_system.sql:462-472
CREATE POLICY price_lists_insert ON price_lists FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text::uuid
          AND (users.account_type IN ('admin', 'superadmin') OR users.is_reseller = true))
  OR
  -- Utente può creare listino per se stesso
  (assigned_to_user_id = auth.uid()::text::uuid AND is_global = false)
);
```

**Comportamento:**

- ✅ Super Admin/Admin: Può creare qualsiasi listino
- ✅ Reseller: Può creare listini (verificato anche in Server Action)
- ✅ Utente: Può creare listino per se stesso (`assigned_to_user_id = userId`)
- ❌ BYOC: **NON può creare** (non è reseller e non ha logica specifica)

### UPDATE Policy

```sql
-- supabase/migrations/020_advanced_price_lists_system.sql:475-486
CREATE POLICY price_lists_update ON price_lists FOR UPDATE USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text::uuid
          AND users.account_type IN ('admin', 'superadmin'))
  OR
  created_by = auth.uid()::text::uuid
  OR
  assigned_to_user_id = auth.uid()::text::uuid
);
```

**Comportamento:**

- ✅ Super Admin/Admin: Può modificare qualsiasi listino
- ✅ Creatore: Può modificare listini creati (`created_by = userId`)
- ✅ Proprietario: Può modificare listini assegnati (`assigned_to_user_id = userId`)

### DELETE Policy

```sql
-- supabase/migrations/020_advanced_price_lists_system.sql:489-498
CREATE POLICY price_lists_delete ON price_lists FOR DELETE USING (
  EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid()::text::uuid
          AND users.account_type IN ('admin', 'superadmin'))
  OR
  created_by = auth.uid()::text::uuid
);
```

**Comportamento:**

- ✅ Super Admin/Admin: Può eliminare qualsiasi listino
- ✅ Creatore: Può eliminare listini creati (`created_by = userId`)
- ❌ Proprietario: **NON può eliminare** listini assegnati (solo creati)

---

## 🛠️ FUNZIONALITÀ COMUNI

### 1. **Calcolo Prezzi con PriceRule**

```typescript
// lib/db/price-lists-advanced.ts:128-183
calculatePriceWithRules(userId, params, priceListId?)
```

**Algoritmo:**

1. Recupera listino applicabile (gerarchia: assegnato → globale → default)
2. Trova regole che matchano condizioni (peso, volume, geografia, corriere, servizio)
3. Seleziona regola con priorità più alta
4. Calcola: `basePrice + surcharges + margin = finalPrice`

**Disponibile per:**

- ✅ Super Admin
- ✅ Reseller
- ✅ BYOC
- ✅ Tutti gli utenti (tramite `getApplicablePriceList`)

### 2. **Recupero Listino Applicabile**

```typescript
// lib/db/price-lists-advanced.ts:28-60
getApplicablePriceList(userId, courierId?, date?)
```

**Priorità:**

1. Listino assegnato (`assigned_to_user_id`)
2. Listino globale (`is_global = true`)
3. Listino default (`priority = 'default'`)

**Disponibile per:**

- ✅ Tutti gli utenti

### 3. **Statistiche Utilizzo**

- ✅ Trigger automatico: `update_price_list_usage()`
- ✅ Aggiorna `usage_count` e `last_used_at` quando listino viene applicato
- ✅ Disponibile per tutti (audit trail)

---

## ⚠️ GAP E LIMITAZIONI

### 1. **UI Mancante per Reseller**

- ❌ Reseller **NON ha accesso** a `/dashboard/listini`
- ❌ Reseller **NON ha UI** per gestire i propri listini
- ⚠️ **Soluzione**: Creare `/dashboard/reseller/listini` o estendere UI esistente

### 2. **UI Mancante per BYOC**

- ❌ BYOC **NON ha accesso** a `/dashboard/listini`
- ❌ BYOC **NON può creare** listini personalizzati
- ⚠️ **Soluzione**: Permettere BYOC di creare listini personalizzati o assegnare da Super Admin

### 3. **Assegnazione Listini a Sub-Users (Reseller)**

- ⚠️ **NON implementato**: Reseller non può assegnare listini ai suoi sub-users
- ⚠️ **GAP**: Reseller può creare listini ma non può gestirli per sub-users
- ⚠️ **Soluzione**: Implementare `assignPriceListToSubUserAction` per reseller

### 4. **Priorità "partner" Non Utilizzata**

- ⚠️ Priorità `'partner'` esiste ma non è utilizzata nell'algoritmo matching
- ⚠️ **GAP**: Reseller crea listini con `priority = 'partner'` ma matching usa solo 'global' e 'default'
- ⚠️ **Soluzione**: Estendere `get_applicable_price_list` per supportare priorità 'partner'

### 5. **RLS vs Server Actions Inconsistenza**

- ⚠️ RLS permette a utenti di creare listini per se stessi (`assigned_to_user_id = userId`)
- ⚠️ Server Action `createPriceListAction` **NON verifica** questo caso per BYOC
- ⚠️ **GAP**: BYOC potrebbe creare listini tramite RLS ma Server Action lo blocca
- ⚠️ **Soluzione**: Allineare Server Action con RLS o rimuovere permesso RLS

### 6. **Modifica Listini Assegnati**

- ⚠️ RLS UPDATE permette modifica se `assigned_to_user_id = userId`
- ⚠️ Server Action `updatePriceListAction` verifica solo `created_by` o admin
- ⚠️ **GAP**: Utente con listino assegnato può modificare tramite RLS ma Server Action lo blocca
- ⚠️ **Soluzione**: Aggiungere verifica `assigned_to_user_id` in Server Action

### 7. **Eliminazione Listini Assegnati**

- ❌ RLS DELETE **NON permette** eliminazione se `assigned_to_user_id = userId` (solo `created_by`)
- ⚠️ **GAP**: Utente con listino assegnato non può eliminarlo anche se è proprietario
- ⚠️ **Soluzione**: Estendere RLS DELETE per permettere eliminazione se `assigned_to_user_id = userId`

---

## 📊 TABELLA RIASSUNTIVA PERMESSI (VECCHIA - DA AGGIORNARE)

| Operazione                           | Super Admin | Reseller         | BYOC                          |
| ------------------------------------ | ----------- | ---------------- | ----------------------------- |
| **Accesso UI `/dashboard/listini`**  | ✅          | ❌               | ❌                            |
| **Vedere tutti i listini**           | ✅          | ❌               | ❌                            |
| **Vedere listini globali**           | ✅          | ✅               | ✅                            |
| **Vedere propri listini**            | ✅          | ✅               | ✅                            |
| **Creare listini globali**           | ✅          | ❌               | ❌                            |
| **Creare listini personalizzati**    | ✅          | ✅               | ❌                            |
| **Modificare qualsiasi listino**     | ✅          | ❌               | ❌                            |
| **Modificare propri listini**        | ✅          | ✅               | ⚠️ (RLS sì, Server Action no) |
| **Eliminare qualsiasi listino**      | ✅          | ❌               | ❌                            |
| **Eliminare propri listini**         | ✅          | ✅ (solo creati) | ❌                            |
| **Assegnare listini a utenti**       | ✅          | ❌               | ❌                            |
| **Usare listini per calcolo prezzi** | ✅          | ✅               | ✅                            |

---

## 📋 DEFINIZIONI CHIAVE

### 🔵 Listini Globali (`is_global = true`)

**Cosa sono:**

- Listini creati **esclusivamente da Super Admin**
- Rappresentano i **prezzi base standard** del sistema
- Sono **visibili a tutti gli utenti** del sistema (Super Admin, Admin, Reseller, BYOC)
- Utilizzati come **fallback** quando un utente non ha listini personalizzati
- **NON contengono margini applicati** - sono i prezzi "puri" del corriere

**Esempio:**

- Super Admin crea "Listino Globale GLS 2025" con `is_global = true`
- Questo listino è visibile a tutti ma **NON può essere modificato** da Reseller/BYOC
- Serve come riferimento base per tutti gli utenti

### 🏭 Listini Fornitore (Supplier Price Lists)

**Cosa sono:**

- Listini che rappresentano i **prezzi del corriere/fornitore** senza margine applicato
- **Uno per ogni corriere** che l'utente (Reseller/BYOC) utilizza
- Creati e gestiti **direttamente dall'utente** (Reseller o BYOC)
- **NON sono visibili ad altri utenti** (isolamento per utente)
- Utilizzati come **base di calcolo** per applicare margini personalizzati

**Esempio:**

- Reseller ha configurazione API per Spedisci.Online (multi-corriere: GLS, BRT, SDA)
- Reseller crea:
  - "Listino Fornitore GLS" (prezzi base GLS)
  - "Listino Fornitore BRT" (prezzi base BRT)
  - "Listino Fornitore SDA" (prezzi base SDA)
- Questi listini contengono i **prezzi del fornitore** senza margine

### 👥 Listini Personalizzati (Custom Price Lists)

**Cosa sono:**

- Listini creati da **Reseller per i propri sub-users**
- Contengono **prezzi con margine applicato** (prezzo fornitore + margine reseller)
- Assegnati a **specifici sub-users** del Reseller
- Permettono al Reseller di **personalizzare i prezzi** per ogni cliente

**Esempio:**

- Reseller crea "Listino Cliente Premium" con margine 20%
- Assegna questo listino al sub-user "Cliente A"
- Quando Cliente A crea una spedizione, usa questo listino personalizzato

---

## 📊 TABELLA RIASSUNTIVA PERMESSI (NUOVA - AGGIORNATA)

| Operazione                                   | Super Admin | Reseller                   | BYOC                   |
| -------------------------------------------- | ----------- | -------------------------- | ---------------------- |
| **Accesso UI `/dashboard/listini`**          | ✅          | ⚠️ (da creare)             | ⚠️ (da creare)         |
| **Vedere tutti i listini**                   | ✅          | ❌                         | ❌                     |
| **Vedere listini globali**                   | ✅          | ❌                         | ❌                     |
| **Vedere propri listini fornitore**          | ✅          | ✅                         | ✅                     |
| **Vedere listini personalizzati creati**     | ✅          | ✅ (solo propri)           | ❌                     |
| **Creare listini globali**                   | ✅          | ❌                         | ❌                     |
| **Creare listini fornitore**                 | ✅          | ✅ (per ogni corriere)     | ✅ (per ogni corriere) |
| **Creare listini personalizzati**            | ✅          | ✅ (solo per propri user)  | ❌                     |
| **Modificare qualsiasi listino**             | ✅          | ❌                         | ❌                     |
| **Modificare propri listini fornitore**      | ✅          | ✅                         | ✅                     |
| **Modificare listini personalizzati creati** | ✅          | ✅ (solo propri)           | ❌                     |
| **Eliminare qualsiasi listino**              | ✅          | ❌                         | ❌                     |
| **Eliminare propri listini fornitore**       | ✅          | ✅                         | ✅                     |
| **Eliminare listini personalizzati creati**  | ✅          | ✅ (solo propri)           | ❌                     |
| **Assegnare listini a utenti**               | ✅          | ✅ (solo propri sub-users) | ❌                     |
| **Usare listini per calcolo prezzi**         | ✅          | ✅                         | ✅                     |

### 📝 Note Dettagliate

#### Super Admin

- ✅ **Accesso completo** a tutti i listini
- ✅ Può creare **listini globali** visibili a tutti (ma Reseller/BYOC non li vedono nella loro UI)
- ✅ Può gestire qualsiasi listino del sistema

#### Reseller

- ❌ **NON può vedere listini globali** (non visibili nella sua UI)
- ✅ Può vedere e gestire i **propri listini fornitore** (uno per ogni corriere che usa)
- ✅ Può **creare listini fornitore** per ogni corriere della sua configurazione API
- ✅ Può **creare listini personalizzati** solo per i propri sub-users
- ✅ Può **assegnare listini personalizzati** ai propri sub-users
- ⚠️ **UI da creare**: Sezione "Listini Fornitore" e "Listini Personalizzati"

#### BYOC

- ❌ **NON può vedere listini globali** (non visibili nella sua UI)
- ✅ Può vedere e gestire i **propri listini fornitore** (uno per ogni corriere che usa)
- ✅ Può **creare listini fornitore** per ogni corriere della sua configurazione API
- ✅ Può **eliminare propri listini fornitore**
- ❌ **NON può creare listini personalizzati** (non ha sub-users)
- ⚠️ **UI da creare**: Sezione "Listini Fornitore"

### 🔍 Logica Listini Fornitore

**Per Reseller:**

1. Reseller ha configurazione API Spedisci.Online con multi-corriere (GLS, BRT, SDA)
2. Reseller accede a sezione "Listini Fornitore"
3. Per ogni corriere può:
   - **Vedere** se esiste già un listino fornitore
   - **Creare** nuovo listino fornitore (se non esiste)
   - **Modificare** listino fornitore esistente
   - **Eliminare** listino fornitore esistente

**Per BYOC:**

1. BYOC ha configurazione API per corriere specifico (es. GLS diretto)
2. BYOC accede a sezione "Listini Fornitore"
3. Per ogni corriere può:
   - **Vedere** se esiste già un listino fornitore
   - **Creare** nuovo listino fornitore (se non esiste)
   - **Modificare** listino fornitore esistente
   - **Eliminare** listino fornitore esistente

### 🔍 Logica Listini Personalizzati (Solo Reseller)

1. Reseller accede a sezione "Listini Personalizzati"
2. Reseller può:
   - **Creare** nuovo listino personalizzato (con margine)
   - **Assegnare** listino a uno o più sub-users
   - **Modificare** listino personalizzato esistente
   - **Eliminare** listino personalizzato esistente
3. Il listino personalizzato usa come **base** il listino fornitore del corriere
4. Applica il **margine configurato** dal Reseller

---

## 🎯 RACCOMANDAZIONI

### Priorità Alta (P0)

1. **Creare UI per Reseller**: `/dashboard/reseller/listini` o estendere UI esistente
2. **Allineare Server Actions con RLS**: Verificare `assigned_to_user_id` in UPDATE
3. **Permettere BYOC di creare listini personalizzati**: Estendere `createPriceListAction`

### Priorità Media (P1)

4. **Implementare assegnazione listini a sub-users per Reseller**
5. **Estendere algoritmo matching per priorità 'partner'**
6. **Permettere eliminazione listini assegnati** (se `assigned_to_user_id = userId`)

### Priorità Bassa (P2)

7. **Aggiungere UI per BYOC** (se necessario)
8. **Implementare versionamento avanzato** (già presente ma non utilizzato)
9. **Aggiungere audit trail completo** per modifiche listini

---

## 📝 NOTE TECNICHE

### File Chiave

- `actions/price-lists.ts` - Server Actions (permessi applicativi)
- `lib/db/price-lists.ts` - CRUD base
- `lib/db/price-lists-advanced.ts` - Sistema PriceRule avanzato
- `app/dashboard/listini/page.tsx` - UI (solo Super Admin)
- `supabase/migrations/020_advanced_price_lists_system.sql` - Schema e RLS

### Funzioni SQL

- `get_applicable_price_list(userId, courierId?, date?)` - Matching intelligente
- `update_price_list_usage()` - Trigger statistiche

### Tipi TypeScript

- `types/listini.ts` - Definizioni complete (PriceList, PriceRule, ecc.)

---

**Fine Analisi**
