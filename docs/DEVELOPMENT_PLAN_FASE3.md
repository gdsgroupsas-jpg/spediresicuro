# 🚀 Development Plan - Fase 3: Reseller Tier System

**Data:** 2025-01-07  
**Priorità:** 🟡 **MEDIA** (Opzionale ma utile)  
**Status:** 📋 **PIANIFICATO**

---

## 🎯 Obiettivo

Implementare sistema di categorizzazione automatica reseller in 3 tier:

- **`small`**: < 10 sub-users (base features)
- **`medium`**: 10-100 sub-users (advanced features)
- **`enterprise`**: > 100 sub-users (unlimited, SLA dedicato)

**Valore Business:**

- Differenziazione offerta per tier
- Limiti configurabili per tier
- Analytics e reporting per tier
- Base per pricing differenziato futuro

---

## 📋 Analisi Situazione Attuale

### Stato Database

- ❌ Enum `reseller_tier` non esiste
- ❌ Campo `reseller_tier` non esiste in `users`
- ❌ Funzione `get_reseller_tier()` non esiste
- ✅ Numero sub-users calcolabile (via `parent_id`)

### Stato Backend

- ❌ Nessun helper TypeScript per tier
- ❌ Nessuna logica limiti per tier
- ✅ Query sub-users esistono (`getSubUsers()`)

### Stato Frontend

- ❌ Nessun badge/indicatore tier
- ❌ Nessun filtro per tier
- ✅ UI reseller esiste (`ClientsHierarchyView`)

---

## 🏗️ Soluzione Proposta

### Architettura

```
Database Layer:
├── Enum: reseller_tier ('small', 'medium', 'enterprise')
├── Campo: users.reseller_tier (nullable, solo per reseller)
├── Funzione: get_reseller_tier(user_id) → calcola automatico se NULL
└── Indice: idx_users_reseller_tier (performance)

Backend Layer:
├── Helper: lib/db/tier-helpers.ts
│   ├── getResellerTier(userId) → chiama DB function
│   ├── calculateTierFromSubUsers(count) → logica calcolo
│   └── getTierLimits(tier) → limiti configurabili
└── Actions: (opzionale) updateResellerTier()

Frontend Layer:
├── Badge: lib/utils/tier-badge.tsx (simile a role-badge)
├── UI: Mostra tier in ClientsHierarchyView
└── (Opzionale) Filtri per tier
```

---

## 📝 Piano di Sviluppo

### Step 1: Database - Enum e Campo (1 ora)

**File:** `supabase/migrations/088_reseller_tier_enum_and_column.sql`

- Crea enum `reseller_tier`
- Aggiunge campo `reseller_tier` a `users`
- Crea indice per performance
- Commenti e documentazione

**Test:**

- Verifica enum creato
- Verifica campo aggiunto
- Verifica indice creato
- Test idempotenza (eseguire 2 volte)

### Step 2: Database - Funzione Calcolo Automatico (1 ora)

**File:** `supabase/migrations/089_get_reseller_tier_function.sql`

- Crea funzione `get_reseller_tier(user_id)`
- Logica: se `reseller_tier` è NULL, calcola da numero sub-users
- Se non NULL, restituisce valore esistente
- Se non è reseller, restituisce NULL

**Test:**

- Test con reseller senza tier (calcola automatico)
- Test con reseller con tier (restituisce esistente)
- Test con non-reseller (restituisce NULL)
- Test con 0, 5, 15, 50, 150 sub-users (verifica threshold)

### Step 3: Database - Popolamento Iniziale (30 min)

**File:** `supabase/migrations/090_populate_reseller_tier.sql`

- Popola `reseller_tier` per tutti i reseller esistenti
- Calcola da numero sub-users attuale
- Idempotente (WHERE reseller_tier IS NULL)

**Test:**

- Verifica tutti i reseller hanno tier popolato
- Verifica calcolo corretto (small/medium/enterprise)
- Test idempotenza

### Step 4: Backend - Helper TypeScript (1 ora)

**File:** `lib/db/tier-helpers.ts`

- `getResellerTier(userId, fallbackUser?)` → chiama DB function
- `calculateTierFromSubUsers(count)` → logica calcolo (pure function)
- `getTierLimits(tier)` → limiti configurabili
- `isTierAtLimit(tier, currentCount)` → verifica limiti

**Test:**

- `tests/tier-helpers.test.ts` (unit test completi)
- Test database RPC
- Test fallback logic
- Test calcolo threshold

### Step 5: Frontend - Badge e UI (1-2 ore)

**File:** `lib/utils/tier-badge.tsx`

- Componente `TierBadge` (simile a `RoleBadge`)
- Colori distintivi: small (grigio), medium (blu), enterprise (oro)
- Icone opzionali

**File:** `app/dashboard/reseller-team/_components/clients-hierarchy-view.tsx`

- Mostra tier badge su ResellerCard
- (Opzionale) Filtro per tier

**Test:**

- Test rendering badge
- Test colori corretti
- Test UI integrazione

### Step 6: Integrazione e Test Completo (1 ora)

- Test end-to-end
- Test regressione
- Verifica performance
- Documentazione

---

## ✅ Test Plan Completo

### Test Database

#### Test 1: Enum e Campo

```sql
-- Verifica enum esiste
SELECT enumlabel FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'reseller_tier');

-- Verifica campo esiste
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'reseller_tier';

-- Verifica indice esiste
SELECT indexname FROM pg_indexes
WHERE tablename = 'users' AND indexname = 'idx_users_reseller_tier';
```

#### Test 2: Funzione get_reseller_tier()

```sql
-- Test 1: Reseller senza tier (calcola automatico)
-- Setup: Reseller con 5 sub-users, reseller_tier = NULL
-- Expected: 'small'

-- Test 2: Reseller con tier esistente
-- Setup: Reseller con reseller_tier = 'medium'
-- Expected: 'medium' (non ricalcola)

-- Test 3: Non-reseller
-- Setup: User normale
-- Expected: NULL

-- Test 4: Threshold boundaries
-- Setup: Reseller con 9, 10, 99, 100, 101 sub-users
-- Expected: small, medium, medium, medium, enterprise
-- Nota: 100 è incluso in medium (boundary corretto)
```

#### Test 3: Popolamento Iniziale

```sql
-- Verifica tutti i reseller hanno tier
SELECT COUNT(*) FROM users
WHERE is_reseller = true AND reseller_tier IS NULL;
-- Expected: 0

-- Verifica calcolo corretto
SELECT
  reseller_tier,
  COUNT(*) as count,
  AVG(sub_count) as avg_sub_users
FROM (
  SELECT
    u.id,
    u.reseller_tier,
    COUNT(su.id) as sub_count
  FROM users u
  LEFT JOIN users su ON su.parent_id = u.id
  WHERE u.is_reseller = true
  GROUP BY u.id, u.reseller_tier
) tier_stats
GROUP BY reseller_tier;
```

### Test Backend (Unit)

#### Test 1: getResellerTier()

- Mock database RPC
- Test con tier esistente
- Test con tier NULL (calcola automatico)
- Test con non-reseller
- Test error handling

#### Test 2: calculateTierFromSubUsers()

- Test threshold: 0, 5, 9, 10, 11, 99, 100, 101, 150
- Test edge cases: negativi, null, undefined

#### Test 3: getTierLimits()

- Test limiti per ogni tier
- Test tier non valido

#### Test 4: isTierAtLimit()

- Test small: 9 (false), 10 (true)
- Test medium: 99 (false), 100 (true)
- Test enterprise: sempre false (unlimited)

### Test Frontend (Unit)

#### Test 1: TierBadge Component

- Test rendering per ogni tier
- Test colori corretti
- Test null/undefined handling

#### Test 2: UI Integration

- Test tier badge visibile in ResellerCard
- Test filtro tier (se implementato)

### Test Integration

#### Test 1: End-to-End Flow

1. Crea reseller
2. Verifica tier = NULL inizialmente
3. Aggiungi 5 sub-users
4. Verifica tier calcolato = 'small'
5. Aggiungi altri 10 sub-users (totale 15)
6. Verifica tier aggiornato = 'medium'
7. Verifica UI mostra badge corretto

#### Test 2: Regressione

- Verifica Fase 4 (Gestione Clienti) funziona ancora
- Verifica getSubUsers() funziona
- Verifica altre funzionalità reseller

### Test Performance

- Query `get_reseller_tier()` con indice
- Query popolamento tier (batch update)
- UI rendering con molti reseller

---

## 🔒 Sicurezza e Validazione

- ✅ Enum previene valori non validi
- ✅ Funzione DB `SECURITY DEFINER` per sicurezza
- ✅ RLS policies rispettate
- ✅ Validazione input TypeScript

---

## 📊 Metriche Successo

- ✅ Tutti i reseller hanno tier popolato
- ✅ Calcolo automatico funziona correttamente
- ✅ UI mostra tier badge
- ✅ Nessuna regressione
- ✅ Performance query < 100ms

---

## 🚀 Ordine di Esecuzione

1. **Database First** (testabile via SQL)
   - Step 1: Enum e Campo
   - Step 2: Funzione calcolo
   - Step 3: Popolamento iniziale

2. **Backend Second** (testabile via unit test)
   - Step 4: Helper TypeScript

3. **Frontend Third** (testabile via UI)
   - Step 5: Badge e UI

4. **Integration Finale**
   - Step 6: Test completo

---

## ⚠️ Note Importanti

1. **Non Breaking:** Campo nullable, funziona anche se NULL
2. **Idempotenza:** Tutte le migration idempotenti
3. **Fallback:** Se tier è NULL, calcola automatico
4. **Performance:** Indice su `reseller_tier` per query veloci

---

## 📊 Stima Tempo

- **Database:** ~2-3 ore
- **Backend:** ~1-2 ore
- **Frontend:** ~1-2 ore
- **Testing:** ~1-2 ore
- **Totale:** ~5-9 ore

---

**Status:** 📋 **PRONTO PER SVILUPPO**

**Prossimo Step:** Iniziare con Step 1 (Database - Enum e Campo)
