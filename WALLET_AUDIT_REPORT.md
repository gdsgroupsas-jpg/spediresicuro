# 🔍 WALLET AUDIT REPORT - Senior Engineer OSTILE

**Data Audit:** 2025-12-22  
**Auditor:** Senior Engineer OSTILE  
**Scope:** Sistema Wallet - Race Conditions, Idempotenza, Logica "Magica"

---

## 📋 EXECUTIVE SUMMARY

**STATO GENERALE:** ⚠️ **CRITICO** - Trovati **3 VULNERABILITÀ CRITICHE** e **2 PROBLEMI ARCHITETTURALI**

### Findings per Severità

- 🔴 **P0 - CRITICO:** 3 findings
- 🟡 **P1 - ALTO:** 2 findings  
- 🟢 **P2 - MEDIO:** 0 findings

---

## 🔴 P0 - VULNERABILITÀ CRITICHE

### 1. `deduct_wallet_credit()` NON ATOMICA - RACE CONDITION

**File:** `supabase/migrations/019_reseller_system_and_wallet.sql:356`

**Problema:**
```sql
CREATE OR REPLACE FUNCTION deduct_wallet_credit(...)
RETURNS UUID AS $$
DECLARE
  v_current_balance DECIMAL(10,2);
BEGIN
  -- ❌ SELECT SENZA LOCK - RACE CONDITION!
  SELECT wallet_balance INTO v_current_balance
  FROM users
  WHERE id = p_user_id;
  
  -- ❌ CHECK FUORI DAL LOCK - TOCTOU!
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Credito insufficiente...';
  END IF;
  
  -- ❌ INSERT che si affida a TRIGGER RIMOSSO in migration 041!
  INSERT INTO wallet_transactions (...)
  -- Il trigger aggiornerà automaticamente wallet_balance
  -- ⚠️ MA IL TRIGGER È STATO RIMOSSO!
END;
```

**Impatto:**
1. **Race Condition:** Due chiamate concorrenti possono entrambe passare il check di balance
2. **Saldo Negativo:** Possibile andare in negativo
3. **NON FUNZIONA:** Dopo migration 041, il trigger è rimosso, quindi `wallet_balance` NON viene aggiornato
4. **Inconsistenza:** `wallet_transactions` viene creata ma `wallet_balance` non cambia

**Uso in Produzione:**
- `actions/super-admin.ts:212` - `manageWallet()` usa `deduct_wallet_credit()` per rimuovere credito

**Fix Richiesto:**
```sql
-- SOSTITUIRE con decrement_wallet_balance() + INSERT wallet_transactions
-- O aggiornare deduct_wallet_credit() per usare decrement_wallet_balance()
```

**Severità:** 🔴 **P0 - CRITICO** (Perdita soldi, inconsistenza dati)

---

### 2. IDEMPOTENCY LOCK: TOCTOU tra Lock e Debit

**File:** `app/api/shipments/create/route.ts:55-158`

**Problema:**
```typescript
// 1. Acquire lock
const { data: lockResult } = await supabaseAdmin.rpc('acquire_idempotency_lock', {
  p_idempotency_key: idempotencyKey,
  p_user_id: targetId
})

// 2. Check lock status
if (!lock.acquired) {
  // Handle replay...
}

// 3. ⚠️ GAP TEMPORALE: Se crash qui, lock è "in_progress" ma debit non fatto
// 4. Retry vedrà lock "in_progress" e NON farà debit (corretto)
// 5. MA: Se lock scade prima del retry, retry farà debit (BUG!)

// 6. Wallet debit
const { error: walletError } = await withConcurrencyRetry(
  async () => await supabaseAdmin.rpc('decrement_wallet_balance', {...})
)
```

**Scenario di Attacco:**
1. Request 1: Acquire lock → `status='in_progress'`
2. Request 1: Crash DOPO lock, PRIMA di debit
3. Lock scade dopo 10 minuti (TTL)
4. Request 2 (retry): Acquire lock → Lock scaduto, riacquisito
5. Request 2: Debit eseguito
6. Request 1: Recovery/retry → Lock ancora "in_progress" (se non scaduto) → NO debit
7. **RISULTATO:** Doppio debit se lock scade tra retry

**Fix Richiesto:**
- Lock TTL più lungo (30 minuti invece di 10)
- O: Debit atomico dentro `acquire_idempotency_lock()` stesso
- O: Lock status "debit_done" separato da "in_progress"

**Severità:** 🔴 **P0 - CRITICO** (Doppio addebito possibile)

---

### 3. `wallet_transactions.status` NON ESISTE

**File:** `app/api/shipments/create/route.ts:342-350`

**Problema:**
```typescript
await supabaseAdmin
  .from('wallet_transactions')
  .insert({
    user_id: targetId,
    amount: -finalCost,
    type: 'SHIPMENT_CHARGE',
    description: `Spedizione ${courierResponse.trackingNumber}`,
    status: 'COMPLETED'  // ❌ COLONNA NON ESISTE!
  })
```

**Verifica Schema:**
```sql
-- Migration 019 crea wallet_transactions SENZA colonna status
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  reference_id UUID,
  reference_type TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
  -- ❌ NO status column!
);
```

**Impatto:**
- Insert fallisce silenziosamente o ignora campo `status`
- Nessun tracking dello stato della transazione
- Possibile errore runtime se Supabase valida strict

**Fix Richiesto:**
- Rimuovere campo `status` dall'insert
- O aggiungere colonna `status` alla tabella (migration)

**Severità:** 🔴 **P0 - CRITICO** (Errore runtime, inconsistenza)

---

## 🟡 P1 - PROBLEMI ARCHITETTURALI

### 4. Pre-check Balance NON ATOMICO

**File:** `app/api/shipments/create/route.ts:204-227`

**Problema:**
```typescript
// Pre-check balance (NON atomico)
const { data: user } = await supabaseAdmin
  .from('users')
  .select('wallet_balance, role')
  .eq('id', targetId)
  .single()

if (!isSuperadmin && (user.wallet_balance || 0) < estimatedCost) {
  return Response.json({ error: 'INSUFFICIENT_CREDIT' }, { status: 402 })
}

// ... chiamata corriere (può richiedere secondi) ...

// Debit atomico (DOPO chiamata corriere)
const { error: walletError } = await withConcurrencyRetry(
  async () => await supabaseAdmin.rpc('decrement_wallet_balance', {...})
)
```

**Race Condition:**
1. User ha €10, pre-check passa
2. Chiamata corriere richiede 5 secondi
3. In quei 5 secondi, altro processo scala €9
4. Balance ora è €1
5. Debit di €8.50 fallisce (insufficient balance)
6. **RISULTATO:** Chiamata corriere fatta ma debit fallito (compensation necessaria)

**Nota:** Il compensation è implementato (righe 435-477), ma è costoso e può fallire.

**Fix Suggerito:**
- Pre-check opzionale solo per UX (mostra errore prima)
- Debit atomico gestisce sempre insufficient balance
- Compensation solo se necessario

**Severità:** 🟡 **P1 - ALTO** (Compensation costoso ma gestito)

---

### 5. `manageWallet()` Usa Funzione NON ATOMICA

**File:** `actions/super-admin.ts:212`

**Problema:**
```typescript
// Per rimuovere credito, usa deduct_wallet_credit() che NON è atomica
const { data: txData, error: txError } = await supabaseAdmin.rpc('deduct_wallet_credit', {
  p_user_id: userId,
  p_amount: Math.abs(amount),
  p_type: transactionType,
  p_description: reason,
})
```

**Impatto:**
- Stesso problema di `deduct_wallet_credit()` (Finding #1)
- Race condition possibile
- Dopo migration 041, non aggiorna `wallet_balance`

**Fix Richiesto:**
- Usare `decrement_wallet_balance()` + INSERT `wallet_transactions` manuale
- O aggiornare `deduct_wallet_credit()` per usare `decrement_wallet_balance()`

**Severità:** 🟡 **P1 - ALTO** (Stesso problema di Finding #1)

---

## ✅ COSE FATTE BENE

### 1. Uso Corretto Funzioni Atomiche (Shipment Creation)

**File:** `app/api/shipments/create/route.ts:313-319`

```typescript
// ✅ CORRETTO: Usa decrement_wallet_balance() atomica
const { error: walletError } = await withConcurrencyRetry(
  async () => await supabaseAdmin.rpc('decrement_wallet_balance', {
    p_user_id: targetId,
    p_amount: finalCost
  }),
  { operationName: 'shipment_debit' }
)
```

**Note:**
- Usa funzione atomica con lock pessimistico
- Smart retry per lock contention
- Fail-fast su errori

---

### 2. Idempotency Lock Implementato

**File:** `app/api/shipments/create/route.ts:55-158`

**Note:**
- Lock acquisito PRIMA di debit (previene doppio debit)
- Gestione stati: `completed`, `in_progress`, `failed`
- Idempotent replay per `completed`

**Miglioramento Suggerito:**
- Fix TOCTOU (Finding #2)

---

### 3. No UPDATE Diretti su `wallet_balance`

**Verifica:**
- ✅ Nessun UPDATE diretto trovato in codice produzione
- ✅ Solo file di test usano UPDATE (accettabile)
- ✅ Guardrails documentati in `WALLET_SECURITY_GUARDRAILS.md`

---

## 📊 STATISTICHE AUDIT

- **File Analizzati:** 15
- **Migrazioni Verificate:** 7
- **Funzioni RPC Analizzate:** 4
- **Vulnerabilità Trovate:** 5
- **Codice Corretto:** ~80%

---

## 🎯 PRIORITÀ FIX

### IMMEDIATO (Oggi)

1. **Fix Finding #3:** Rimuovere `status` da insert `wallet_transactions`
2. **Fix Finding #1:** Aggiornare `deduct_wallet_credit()` per usare `decrement_wallet_balance()`

### BREVE TERMINE (Questa Settimana)

3. **Fix Finding #2:** Migliorare idempotency lock (TTL più lungo o debit atomico)
4. **Fix Finding #5:** Aggiornare `manageWallet()` per usare funzione atomica

### MEDIO TERMINE (Prossimo Sprint)

5. **Fix Finding #4:** Ottimizzare pre-check balance (opzionale)

---

## 🔧 FIX DETTAGLIATI

### Fix #1: Aggiornare `deduct_wallet_credit()`

**File:** Nuova migration `045_fix_deduct_wallet_credit_atomic.sql`

```sql
CREATE OR REPLACE FUNCTION deduct_wallet_credit(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_type TEXT,
  p_description TEXT DEFAULT NULL,
  p_reference_id UUID DEFAULT NULL,
  p_reference_type TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
BEGIN
  -- ✅ USA FUNZIONE ATOMICA per decremento
  PERFORM decrement_wallet_balance(p_user_id, p_amount);
  
  -- ✅ Crea transazione di tracciamento
  INSERT INTO wallet_transactions (
    user_id,
    amount,
    type,
    description,
    reference_id,
    reference_type
  ) VALUES (
    p_user_id,
    -p_amount,
    p_type,
    p_description,
    p_reference_id,
    p_reference_type
  ) RETURNING id INTO v_transaction_id;
  
  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

### Fix #3: Rimuovere `status` da Insert

**File:** `app/api/shipments/create/route.ts:342`

```typescript
// ❌ PRIMA
await supabaseAdmin
  .from('wallet_transactions')
  .insert({
    user_id: targetId,
    amount: -finalCost,
    type: 'SHIPMENT_CHARGE',
    description: `Spedizione ${courierResponse.trackingNumber}`,
    status: 'COMPLETED'  // ❌ RIMUOVERE
  })

// ✅ DOPO
await supabaseAdmin
  .from('wallet_transactions')
  .insert({
    user_id: targetId,
    amount: -finalCost,
    type: 'SHIPMENT_CHARGE',
    description: `Spedizione ${courierResponse.trackingNumber}`
    // ✅ NO status
  })
```

---

## 📝 CONCLUSIONI

Il sistema wallet ha una **base solida** con funzioni atomiche e idempotency lock, ma presenta **3 vulnerabilità critiche** che devono essere risolte **IMMEDIATAMENTE**:

1. `deduct_wallet_credit()` non atomica e non funzionante
2. TOCTOU in idempotency lock
3. Campo `status` inesistente in insert

**RACCOMANDAZIONE:** 
- 🔴 **NON DEPLOYARE** fino a fix Finding #1 e #3
- 🟡 Fix Finding #2 entro questa settimana
- 🟢 Fix Finding #4 e #5 nel prossimo sprint

---

**Firmato:** Senior Engineer OSTILE  
**Data:** 2025-12-22

---

## 📌 APPENDICE: FIX APPLICATI (2025-12-23)

### Status Fix

| Fix | Descrizione | File | Status |
|-----|-------------|------|--------|
| #1 | Rimozione campo `status` inesistente | `app/api/shipments/create/route.ts:342` | ✅ APPLICATO |
| #2 | Migration `deduct_wallet_credit` atomica | `supabase/migrations/045_fix_deduct_wallet_credit_atomic.sql` | ✅ CREATO |
| #3 | Verifica `manageWallet` | `actions/super-admin.ts` | ✅ VERIFICATO (già corretto) |
| #4 | Aumento TTL idempotency lock (10→30 min) | `app/api/shipments/create/route.ts:58` | ✅ APPLICATO |

### File Modificati

1. **`app/api/shipments/create/route.ts`**
   - Riga 342: Rimosso `status: 'COMPLETED'` da insert `wallet_transactions`
   - Riga 58: TTL lock aumentato da 10 a 30 minuti

2. **`supabase/migrations/045_fix_deduct_wallet_credit_atomic.sql`** (NUOVO)
   - Riscritta funzione `deduct_wallet_credit()` per usare `decrement_wallet_balance()`
   - Aggiunto `search_path` per sicurezza
   - Documentazione completa nel file

### Script di Validazione

- **`scripts/test-wallet-fix-validation.ts`** (NUOVO)
  - Test atomicità `deduct_wallet_credit()`
  - Test assenza colonna `status`
  - Test race condition
  - Test configurazione sicurezza

### Prossimi Passi

1. Applicare migration 045 su Supabase:
   ```bash
   supabase db push
   ```

2. Eseguire test di validazione:
   ```bash
   npx ts-node scripts/test-wallet-fix-validation.ts
   ```

3. Verificare con Audit AI indipendente (Claude, GPT-4, etc.)

---

**Ultimo aggiornamento:** 2025-12-23  
**Fix applicati da:** Cursor AI (Senior Engineer OSTILE)

