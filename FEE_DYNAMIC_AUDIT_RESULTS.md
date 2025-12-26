# Fee Dinamico - Audit Results

**Data Audit:** 2025-12-26
**Branch:** `claude/audit-fee-dinamico-dS8Kl`
**Auditor:** Claude Code
**Scope:** Analisi stato implementazione fee dinamico e BYOC (Bring Your Own Carrier)

---

## EXECUTIVE SUMMARY

### Stato Generale: 🟡 PARZIALMENTE IMPLEMENTATO

**Cosa Esiste:**
- ✅ Infrastructure BYOC database-ready (`owner_user_id`, `account_type`, `is_default`)
- ✅ Factory pattern per courier configs con supporto BYOC/Broker
- ✅ Pricing engine con margine applicato (hardcoded 15%)
- ✅ Wallet debit atomico con compensation logic

**Cosa Manca:**
- ❌ Fee dinamico per-user (`users.platform_fee_override`)
- ❌ Audit trail fee changes (`platform_fee_history` table)
- ❌ Service layer per fee management (getPlatformFee/updatePlatformFee)
- ❌ UI SuperAdmin per gestione fee
- ❌ Integrazione BYOC nella route shipments/create
- ❌ Logica BYOC vs Broker per calcolo fee differenziato

**Severity Gap:** 🔴 **ALTA**
Il sistema attualmente applica fee HARDCODED (8.50€ + margine 15%) a tutti gli utenti, senza distinzione BYOC vs Broker. Infrastructure BYOC esiste ma NON è connessa al flusso di booking.

---

## DATABASE SCHEMA

### ✅ IMPLEMENTED

- [x] **`courier_configs.owner_user_id`** exists
  - Location: `supabase/migrations/032_integration_hub_schema.sql`
  - Type: `UUID REFERENCES users(id) ON DELETE CASCADE`
  - Purpose: Identifica owner per config BYOC

- [x] **`courier_configs.is_default`** exists
  - Type: `BOOLEAN`
  - Purpose: Marca config broker default

- [x] **`courier_configs.account_type`** exists
  - Type: ENUM-like (`'admin' | 'byoc' | 'reseller'`)
  - Purpose: Distingue tipo configurazione

- [x] **`courier_configs.status`** exists
  - Type: ENUM-like (`'active' | 'error' | 'testing' | 'inactive'`)
  - Purpose: Health check configurazione

- [x] **`shipments.total_cost`** exists
  - Location: Varie migrations
  - Type: `DECIMAL`
  - Purpose: Costo totale spedizione (include fee)

### ❌ MISSING

- [ ] **`users.platform_fee_override`** DOES NOT EXIST
  - Expected Type: `DECIMAL(5,2) DEFAULT NULL`
  - Purpose: Fee override per-user (BYOC = 0%, Broker = custom%)
  - **GAP SEVERITY:** 🔴 HIGH - Blocca fee dinamico

- [ ] **`platform_fee_history` table** DOES NOT EXIST
  - Expected Schema:
    ```sql
    CREATE TABLE platform_fee_history (
      id UUID PRIMARY KEY,
      user_id UUID REFERENCES users(id),
      old_fee DECIMAL(5,2),
      new_fee DECIMAL(5,2),
      changed_by UUID REFERENCES users(id),
      changed_at TIMESTAMPTZ DEFAULT NOW(),
      reason TEXT
    );
    ```
  - **GAP SEVERITY:** 🟡 MEDIUM - Audit trail importante ma non bloccante

- [ ] **`shipments.platform_fee_applied`** DOES NOT EXIST
  - Expected Type: `DECIMAL(10,2)`
  - Purpose: Tracciare fee applicata alla spedizione (snapshot)
  - **GAP SEVERITY:** 🟡 MEDIUM - Importante per transparency

---

## WORKERS

### ✅ PricingWorker Exists

**File:** `lib/agent/workers/pricing.ts`

**Functionality:**
- ✅ Calcola preventivi usando `calculateOptimalPrice()`
- ✅ Valida dati minimi per pricing
- ✅ Restituisce array `pricing_options`

**Fee Awareness:**
- 🟡 PARTIAL: Usa pricing-engine che applica margine
- ❌ NO: Non distingue BYOC vs Broker
- ❌ NO: Non mostra fee separatamente al user

**Code Evidence:**
```typescript
// lib/ai/pricing-engine.ts:86
const marginPercent = 15; // 🔴 HARDCODED - Margine fisso 15%
const margin = (priceResult.totalCost * marginPercent) / 100;
const finalPrice = priceResult.totalCost + margin;
```

**Implementation Status:**
- ✅ Worker exists and functional
- ❌ Fee calculation is HARDCODED (15%)
- ❌ No user-specific fee logic
- ❌ No BYOC detection

---

### ✅ BookingWorker Exists

**File:** `lib/agent/workers/booking.ts`

**Functionality:**
- ✅ Pre-flight checks
- ✅ Chiamata adapter SpedisciOnline
- ✅ Idempotency key generation

**Wallet Debit:**
- ❌ NO: Worker NON gestisce wallet debit
- ✅ YES: Debit è gestito in `/api/shipments/create`
- ❌ NO: Non usa logica BYOC vs Broker

**Code Evidence:**
```typescript
// lib/agent/workers/booking.ts:360
prezzo: pricingOption.finalPrice || 0,  // 🔴 Usa finalPrice da pricing
```

**Implementation Status:**
- ✅ Worker exists and functional
- ❌ Does NOT use dynamic fee
- ❌ Wallet debit is in API route, not worker
- ❌ No BYOC detection

---

## API ROUTES

### ✅ Legacy Route Active

**File:** `app/api/shipments/create/route.ts`

**Status:** ✅ **ACTIVE** (NOT deprecated)

**Fee Calculation:**
```typescript
// app/api/shipments/create/route.ts:221
const baseEstimatedCost = 8.50 // 🔴 HARDCODED - TODO: Calcolo reale
const estimatedCost = baseEstimatedCost * 1.20 // Buffer 20%
```

**Wallet Debit Logic:**
- ✅ Uses `decrement_wallet_balance()` RPC (atomic)
- ✅ Pre-debit BEFORE courier call ("No Credit, No Label")
- ✅ Compensation if courier call fails
- ✅ Adjustment after real cost from courier
- ❌ NO per-user fee logic
- ❌ NO BYOC detection

**BYOC Support:**
- ❌ NO: Route usa solo `validated.provider` e `validated.carrier`
- ❌ NO: Non chiama `getCarrierConfigForUser()` per BYOC detection
- ❌ NO: Non applica fee differenziato BYOC vs Broker

**Code Evidence:**
```typescript
// app/api/shipments/create/route.ts:169-191
const providerId = validated.provider === 'spediscionline' ? 'spedisci_online' : validated.provider

const { data: courierConfigs, error: configError } = await supabaseAdmin
  .from('courier_configs')
  .select('*')
  .eq('provider_id', providerId)
  .eq('carrier', validated.carrier)
  .eq('is_active', true)
  // 🔴 NON usa owner_user_id o assigned_config_id
```

**Implementation Status:**
- ✅ Route exists and active
- ❌ Fee is HARDCODED (8.50€)
- ❌ Does NOT use dynamic fee per user
- ❌ Does NOT integrate BYOC logic
- ❌ Does NOT apply differential fee BYOC vs Broker

---

## BYOC IMPLEMENTATION

### ✅ PARTIAL Infrastructure Exists

**Files:**
- `lib/integrations/carrier-configs-compat.ts` (compatibility layer)
- `lib/couriers/factory.ts` (database-backed provider factory)

**Functionality:**
```typescript
// lib/integrations/carrier-configs-compat.ts:162
export async function getCarrierConfigForUser(
  userId: string,
  providerId: string
): Promise<CarrierConfig | null> {
  // 1. Verifica assigned_config_id
  // 2. Verifica config BYOC (owner_user_id = userId)
  // 3. Fallback: config default
}
```

**Implementation Status:**
- ✅ BYOC detection logic EXISTS
- ✅ `owner_user_id` support EXISTS
- ✅ `account_type` discrimination EXISTS
- ❌ NOT USED in `/api/shipments/create`
- ❌ NOT INTEGRATED in booking flow
- ❌ NO differential fee based on BYOC vs Broker

**Credential Encryption:**
- ✅ Functions `encryptCredential()` / `decryptCredential()` exist
- ✅ Used in `lib/integrations/carrier-configs-compat.ts`
- 🟡 UNCLEAR: Coverage in all codepaths

**Adapter Pattern:**
- ✅ `CourierFactory.getClient()` exists (`lib/services/couriers/courier-factory.ts`)
- ✅ Supports SpedisciOnlineClient
- ❌ Limited: Only SpedisciOnline fully implemented
- ❌ NOT USED: `/api/shipments/create` bypasses factory

---

## SERVICE LAYER

### ❌ Fee Management Service DOES NOT EXIST

**Expected Location:** `lib/services/pricing/platform-fee.ts`

**Missing Functions:**

1. **`getPlatformFee(userId: string): Promise<number>`**
   - Purpose: Recupera fee per utente (con fallback a default)
   - Status: ❌ NOT IMPLEMENTED

2. **`updatePlatformFee(userId: string, newFee: number, changedBy: string, reason: string)`**
   - Purpose: Aggiorna fee e registra in history
   - Status: ❌ NOT IMPLEMENTED

3. **`calculateTotalWalletDebit(userId: string, courierCost: number): number`**
   - Purpose: Wrapper che calcola `courierCost + (courierCost * platformFee)`
   - Status: ❌ NOT IMPLEMENTED

**Gap Severity:** 🔴 **HIGH** - Service layer centralizzato essenziale per evitare codice duplicato

---

## UI SUPERADMIN

### ❌ Fee Management UI DOES NOT EXIST

**Expected Location:** `app/admin/users/[id]/fee-settings` o simile

**Missing Components:**

1. **User Fee Settings Page**
   - Purpose: Mostra fee corrente utente
   - Status: ❌ NOT FOUND in `app/admin/`

2. **Fee Update Dialog**
   - Purpose: Form per aggiornare fee override
   - Status: ❌ NOT FOUND in `components/admin/`

3. **Fee History View**
   - Purpose: Audit trail modifiche fee
   - Status: ❌ NOT FOUND (table non esiste)

**Search Results:**
```bash
$ grep -r "platform.*fee\|fee.*management" app/admin/ --include="*.tsx"
# No output

$ find components/admin -name "*fee*.tsx"
# No files found
```

**Gap Severity:** 🟡 **MEDIUM** - UI può essere creata dopo che backend è pronto

---

## GAP ANALYSIS

### ✅ Cosa Esiste Già (No Implementation Needed)

1. **Database Infrastructure BYOC**
   - `courier_configs.owner_user_id` ✅
   - `courier_configs.account_type` ✅
   - `courier_configs.is_default` ✅

2. **BYOC Detection Logic**
   - `getCarrierConfigForUser()` in `lib/integrations/carrier-configs-compat.ts` ✅
   - Support for assigned_config_id ✅
   - Fallback to default config ✅

3. **Wallet Debit Atomic**
   - `decrement_wallet_balance()` RPC ✅
   - Compensation logic ✅
   - Idempotency locks ✅

4. **Pricing Engine**
   - `calculateOptimalPrice()` ✅
   - Margin application ✅
   - Price list support ✅

---

### ❌ Cosa Manca (Implementation Required)

#### 🔴 P0 - CRITICAL (Blocca fee dinamico)

1. **Database Schema - Fee Override**
   ```sql
   ALTER TABLE users ADD COLUMN platform_fee_override DECIMAL(5,2) DEFAULT NULL;
   ```
   - Permet fee per-user (BYOC = 0%, Broker = custom%)

2. **Service Layer - Fee Management**
   - File: `lib/services/pricing/platform-fee.ts`
   - Funzioni:
     - `getPlatformFee(userId: string): Promise<number>`
     - `updatePlatformFee(userId, newFee, changedBy, reason)`
     - `calculateTotalWalletDebit(userId, courierCost): number`

3. **Integration BYOC in API Route**
   - File: `app/api/shipments/create/route.ts`
   - Changes:
     - Usa `getCarrierConfigForUser()` invece di query diretta
     - Rileva BYOC vs Broker
     - Applica fee differenziato
     - Sostituisci `baseEstimatedCost = 8.50` con `getPlatformFee()`

4. **Integration BYOC in Workers**
   - PricingWorker: Passa `account_type` a pricing engine
   - BookingWorker: Nessuna modifica (debit già in route)

#### 🟡 P1 - HIGH (Importante ma non bloccante)

5. **Database Schema - Fee History**
   ```sql
   CREATE TABLE platform_fee_history (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID REFERENCES users(id) ON DELETE CASCADE,
     old_fee DECIMAL(5,2),
     new_fee DECIMAL(5,2),
     changed_by UUID REFERENCES users(id),
     changed_at TIMESTAMPTZ DEFAULT NOW(),
     reason TEXT
   );
   ```

6. **Database Schema - Fee Snapshot in Shipments**
   ```sql
   ALTER TABLE shipments ADD COLUMN platform_fee_applied DECIMAL(10,2);
   ```
   - Snapshot della fee applicata (transparency)

7. **UI SuperAdmin - Fee Management**
   - Page: `app/admin/users/[id]/fee-settings/page.tsx`
   - Component: `components/admin/fee-update-dialog.tsx`
   - Features:
     - View current fee
     - Update fee override
     - View fee history

#### 🟢 P2 - MEDIUM (Nice to have)

8. **Enhanced Pricing Engine**
   - Passa `userId` e `account_type` a `calculateOptimalPrice()`
   - Apply differential markup BYOC vs Broker
   - Show fee breakdown in pricing_options

9. **Telemetry & Monitoring**
   - Log fee applied per shipment
   - Metrics BYOC vs Broker revenue
   - Alert fee anomalie

---

### 🔥 Rischi Regressione

**Se procediamo con modifiche, potrebbero rompersi:**

1. **API Route `/api/shipments/create`**
   - **Risk:** Cambiando logica fee, potremmo rompere wallet debit
   - **Mitigation:** Test coverage + feature flag

2. **PricingWorker Output**
   - **Risk:** Modificando `pricing_options` schema, potrebbe rompere frontend
   - **Mitigation:** Backward compatibility + versioning

3. **Existing Shipments**
   - **Risk:** Se aggiungiamo `platform_fee_applied`, vecchie shipments hanno NULL
   - **Mitigation:** Backfill con margine default 15%

4. **Wallet Transactions**
   - **Risk:** Cambiando calcolo fee, potremmo creare discrepanze wallet
   - **Mitigation:** Atomic operations + smoke tests

---

## IMPLEMENTATION PATHS

### 🅰️ OPZIONE A: Full Implementation (Recommended)

**Implementa tutto P0 + P1**

**PRO:**
- Fee dinamico completo
- BYOC funzionante
- Audit trail completo
- SuperAdmin UI ready

**CONTRO:**
- Effort: ~4-6 giorni
- Richiede testing approfondito
- Rischio regressione medio

**Effort Breakdown:**
- P0.1 Database schema fee override: 1h
- P0.2 Service layer fee management: 3h
- P0.3 Integration BYOC in route: 4h
- P0.4 Workers integration: 2h
- P1.5 Fee history table: 1h
- P1.6 Fee snapshot shipments: 1h
- P1.7 UI SuperAdmin: 6h
- Testing + docs: 4h
**Total:** ~22h (3 giorni full-time)

---

### 🅱️ OPZIONE B: Minimal Viable (Fast Track)

**Implementa solo P0 (no history, no UI)**

**PRO:**
- Fee dinamico funzionante
- BYOC detection attivo
- Effort ridotto: ~2 giorni

**CONTRO:**
- No audit trail (fee changes non tracciati)
- No UI (update fee via DB direct)
- No snapshot fee in shipments

**Effort Breakdown:**
- P0.1-P0.4 solo: ~10h
- Testing: 2h
**Total:** ~12h (1.5 giorni)

---

### 🅲 OPZIONE C: Incremental (Safest)

**Sprint 1:** P0.1 + P0.2 (Schema + Service layer)
**Sprint 2:** P0.3 + P0.4 (Integration in route + workers)
**Sprint 3:** P1.5 + P1.6 + P1.7 (History + UI)

**PRO:**
- Rischio regressione minimo
- Testing incrementale
- Rollback facile

**CONTRO:**
- Timeline più lunga: ~2 settimane
- Overhead coordinamento sprint

---

## RECOMMENDATION

### 🎯 Scelta Consigliata: **OPZIONE A** (Full Implementation)

**Motivazioni:**

1. **Gap P0 è bloccante:** Senza fee dinamico, BYOC non ha senso economico
2. **Infrastructure già pronta:** DB schema BYOC esiste, basta connettere
3. **ROI alto:** Una volta implementato, sblocca revenue model differenziato
4. **Technical debt basso:** Implementiamo subito history/UI invece di posticipare

**Sequenza Implementazione:**

1. ✅ **Merge su branch corrente** (`claude/audit-fee-dinamico-dS8Kl`)
2. 🔨 **Implementa P0.1** (schema migration fee override)
3. 🔨 **Implementa P0.2** (service layer `platform-fee.ts`)
4. 🧪 **Test P0.1+P0.2** (unit tests service layer)
5. 🔨 **Implementa P0.3** (integration route API)
6. 🔨 **Implementa P0.4** (workers integration)
7. 🧪 **Test P0.3+P0.4** (integration tests + smoke wallet)
8. 🔨 **Implementa P1** (history + snapshot + UI)
9. 🧪 **Full regression test**
10. 📝 **Update docs + migration guide**

**Risk Mitigation:**

- ✅ Feature flag `ENABLE_DYNAMIC_FEE` (default: false)
- ✅ Smoke tests wallet MUST pass
- ✅ Rollback plan: revert migration + disable flag

---

## NEXT STEPS

1. **Review audit con team** (this document)
2. **Approve opzione implementazione** (A/B/C)
3. **Create implementation plan** (task breakdown)
4. **Assign priorities** (P0 first)
5. **Start Sprint 1** (schema + service layer)

---

## APPENDIX

### File Paths Reference

**Database:**
- Migrations: `supabase/migrations/`
- Integration Hub: `032_integration_hub_schema.sql`

**Backend:**
- Workers: `lib/agent/workers/`
- Service Layer: `lib/services/` (NEW: `pricing/platform-fee.ts`)
- Factory: `lib/couriers/factory.ts`, `lib/integrations/carrier-configs-compat.ts`
- Pricing: `lib/ai/pricing-engine.ts`, `lib/db/price-lists.ts`

**API:**
- Routes: `app/api/shipments/create/route.ts`

**Frontend (to create):**
- Admin UI: `app/admin/users/[id]/fee-settings/` (NEW)
- Components: `components/admin/fee-update-dialog.tsx` (NEW)

---

**End of Audit Report**
