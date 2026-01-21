# 💰 Money Flows & Financial Architecture

> **Allineamento Costituzione:** ✅ Questo documento implementa il Financial Core ("No Credit, No Label") definito in README.md

---

## 📜 Riferimento Costituzione

**Prima di leggere questo documento, leggi OBBLIGATORIAMENTE:**

- [README.md](../README.md) - Costituzione del sistema (Financial Core, "No Credit, No Label")

**Principi Inderogabili (da README.md):**

- 🚫 **"No Credit, No Label"** - Nessuna etichetta senza credito
- ✅ **Atomicità** - Solo funzioni SQL atomiche
- ✅ **Idempotenza** - Ogni addebito ha idempotency_key
- ✅ **Audit Trail** - Ogni movimento ha transazione

---

## 💰 Financial Dogma: "No Credit, No Label"

**Il cuore del sistema non è la spedizione, è il WALLET.**

**Regola Fondamentale:** Nessuna etichetta viene generata senza credito disponibile nel wallet.

**Eccezioni:**

- SuperAdmin può bypassare (per testing/emergenze)
- Modello BYOC: Wallet NON toccato (cliente paga direttamente corriere)

---

## Overview

SpedireSicuro uses a **prepaid wallet system** with manual top-up approval to prevent fraud and ensure liquidity control.

**IMPORTANTE:** Questo sistema si applica SOLO al modello Broker/Arbitraggio. Per BYOC, il wallet NON viene utilizzato per la spedizione.

---

## Wallet System Architecture

### Core Tables

1. **`users.wallet_balance`** - Current balance (DECIMAL(10,2), DEFAULT 0)
2. **`wallet_transactions`** - Immutable ledger (append-only)
3. **`top_up_requests`** - Recharge requests (pending/approved/rejected)
4. **`payment_transactions`** - Card payments via XPay (planned, NOT LIVE)

### State Diagram

```
┌─────────────┐
│   User      │
│ Balance: €0 │
└──────┬──────┘
       │
       │ 1. Request Top-Up (upload PDF/photo)
       ↓
┌──────────────────────┐
│ top_up_requests      │
│ status: pending      │
│ file_url: /receipts/ │
└──────┬───────────────┘
       │
       │ 2. Admin Reviews
       ↓
    [APPROVE] ────────► [REJECT]
       │                   │
       │                   │ 3b. Rejection
       │                   ↓
       │              ┌──────────────┐
       │              │ status:      │
       │              │ rejected     │
       │              │ admin_notes  │
       │              └──────────────┘
       │
       │ 3a. Approval
       ↓
┌──────────────────────────┐
│ wallet_transactions      │
│ type: deposit            │
│ amount: +€100.00         │
│ status: COMPLETED        │
└──────┬───────────────────┘
       │
       │ 4. Trigger updates balance
       ↓
┌─────────────────┐
│   User          │
│ Balance: €100   │
└─────────────────┘
       │
       │ 5. Create Shipment
       ↓
┌──────────────────────────┐
│ Pre-Check:               │
│ wallet_balance >= cost?  │
└──────┬───────────────────┘
       │
    [YES] ──────────► [NO: 402 Insufficient Credit]
       │
       │ 6. Atomic Debit
       ↓
┌──────────────────────────┐
│ 1. Decrement balance     │
│ 2. Insert transaction    │
│    type: SHIPMENT_CHARGE │
│    amount: -€8.50        │
│ 3. Insert shipment       │
│    status: confirmed     │
└──────────────────────────┘
```

---

## Flow 1: Top-Up Request (Bank Transfer)

### User Journey

1. User navigates to `/dashboard/wallet`
2. Clicks "Ricarica con Bonifico"
3. Uploads PDF or photo of bank transfer receipt
4. Declares amount (optional, AI extracts if missing)
5. System creates `top_up_requests` record (status=`pending`)

### Admin Journey

1. Admin navigates to `/dashboard/admin/bonifici`
2. Sees list of pending requests
3. Reviews receipt (downloads PDF/image)
4. Verifies:
   - Amount matches declared
   - IBAN is company account
   - CRO/TRN is valid (no duplicates)
5. Approves or Rejects with reason

### Backend Flow (Approval)

**File:** `app/actions/topups-admin.ts` → `approveTopUpRequest()`

```typescript
async function approveTopUpRequest(requestId, approvedAmount?) {
  // 1. Load request
  const request = await supabase.from('top_up_requests').select('*').eq('id', requestId).single();

  if (request.status !== 'pending') {
    throw new Error('Request already processed');
  }

  // 2. Use declared amount or override
  const finalAmount = approvedAmount || request.amount;

  // 3. Call DB function (has €10k limit)
  const txId = await supabaseAdmin.rpc('add_wallet_credit', {
    p_user_id: request.user_id,
    p_amount: finalAmount,
    p_description: `Bonifico approvato #${requestId}`,
    p_created_by: adminId,
  });

  // 4. Update request status
  await supabase
    .from('top_up_requests')
    .update({ status: 'approved', admin_notes: 'Approved' })
    .eq('id', requestId);

  // 5. Audit log
  await writeAuditLog({
    context,
    action: AUDIT_ACTIONS.WALLET_CREDIT,
    resourceType: 'wallet_transaction',
    resourceId: txId,
    metadata: { approvedAmount: finalAmount },
  });
}
```

### Database Function: `add_wallet_credit()`

**File:** `supabase/migrations/040_wallet_atomic_operations.sql` (aggiornata)

**⚠️ IMPORTANTE:** Questa funzione ora usa `increment_wallet_balance()` internamente (atomica). Il trigger legacy è stato rimosso in migration `041_remove_wallet_balance_trigger.sql` per evitare doppio accredito.

```sql
CREATE OR REPLACE FUNCTION add_wallet_credit(
  p_user_id UUID,
  p_amount DECIMAL(10,2),
  p_description TEXT DEFAULT NULL,
  p_created_by UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_transaction_id UUID;
  MAX_SINGLE_AMOUNT CONSTANT DECIMAL(10,2) := 10000.00;
BEGIN
  -- Anti-Fraud: Limit per transaction
  IF p_amount > MAX_SINGLE_AMOUNT THEN
    RAISE EXCEPTION 'Max €10,000 per transaction. Requested: €%', p_amount;
  END IF;

  -- 1. Incrementa wallet (ATOMICO)
  PERFORM increment_wallet_balance(p_user_id, p_amount);

  -- 2. Insert transaction (audit trail - NO trigger)
  INSERT INTO wallet_transactions (user_id, amount, type, description, created_by)
  VALUES (p_user_id, p_amount, 'deposit', p_description, p_created_by)
  RETURNING id INTO v_transaction_id;

  RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Nota Storica:**

- ❌ **PRIMA (migration 019):** Trigger `update_wallet_balance_on_transaction` causava doppio accredito quando `add_wallet_credit()` chiamava `increment_wallet_balance()` + INSERT transaction
- ✅ **DOPO (migration 041):** Trigger rimosso. `add_wallet_credit()` chiama `increment_wallet_balance()` (atomica) e poi INSERT transaction (solo audit)

---

## Flow 2: Shipment Creation (Wallet Debit)

### Pre-Check

**File:** `app/api/shipments/create/route.ts`

```typescript
// 1. Load user wallet balance
const { data: user } = await supabaseAdmin
  .from('users')
  .select('wallet_balance, role')
  .eq('id', context.target.id) // Who pays (target in impersonation)
  .single();

const estimatedCost = 8.5; // TODO: Real quote from courier API
const isSuperadmin = user.role === 'SUPERADMIN';

// 2. Check if sufficient credit (SuperAdmin bypasses)
if (!isSuperadmin && user.wallet_balance < estimatedCost) {
  return Response.json(
    {
      error: 'INSUFFICIENT_CREDIT',
      required: estimatedCost,
      available: user.wallet_balance,
      message: `Credito insufficiente. Disponibile: €${user.wallet_balance.toFixed(2)}`,
    },
    { status: 402 }
  );
}
```

### Atomic Transaction

**⚠️ REGOLA CRITICA:** Ogni movimento di denaro DEVE usare funzioni SQL atomiche. MAI update diretto a `wallet_balance`.

**File:** `lib/shipments/create-shipment-core.ts`

```typescript
// After courier API call succeeds
const finalCost = courierResponse.cost;

if (!isSuperadmin) {
  // 1. Decrement wallet (ATOMICO - lock pessimistico)
  const { error: walletError } = await supabaseAdmin.rpc('decrement_wallet_balance', {
    p_user_id: context.target.id,
    p_amount: finalCost,
  });

  // ❌ VIETATO: Fallback manuale con .update()
  // ✅ CORRETTO: Se fallisce, ritorna errore e compensa
  if (walletError) {
    // Fail-fast: Non procedere senza debit atomico
    // Se corriere già chiamato, eseguire refund o enqueue in compensation_queue
    throw new Error(`Wallet debit failed: ${walletError.message}`);
  }

  // 2. Record transaction (audit trail)
  await supabaseAdmin.from('wallet_transactions').insert({
    user_id: context.target.id,
    amount: -finalCost,
    type: 'SHIPMENT_CHARGE',
    description: `Spedizione ${courierResponse.trackingNumber}`,
  });
}

// 3. Create shipment
const { data: shipment } = await supabaseAdmin.from('shipments').insert({
  user_id: context.target.id,
  status: 'pending', // Nota: DB constraint richiede 'pending'
  total_cost: finalCost,
  tracking_number: courierResponse.trackingNumber,
  // ... other fields
});
```

**Funzioni Atomiche Disponibili:**

- `decrement_wallet_balance(user_id, amount)` - Debit atomico con lock pessimistico (FOR UPDATE NOWAIT)
- `increment_wallet_balance(user_id, amount)` - Credit atomico con lock pessimistico
- `add_wallet_credit(user_id, amount, description, created_by)` - Credit con audit trail

**Migrations:**

- `040_wallet_atomic_operations.sql` - Funzioni atomiche
- `041_remove_wallet_balance_trigger.sql` - Rimozione trigger legacy (causava doppio accredito)

---

## Anti-Fraud Mechanisms

### 1. Top-Up Limits

**Hard Limit:** €10,000 per transaction (enforced in DB function)

**Workaround for large amounts:**

- Split into multiple transactions
- OR create override function for SuperAdmin (manual verification)

### 2. Duplicate File Detection

**Mechanism:** SHA256 hash of uploaded file

**File:** `supabase/migrations/028_wallet_security_fixes.sql`

```sql
ALTER TABLE top_up_requests ADD COLUMN file_hash TEXT;
CREATE INDEX idx_top_up_requests_file_hash ON top_up_requests(file_hash)
WHERE file_hash IS NOT NULL;
```

**Check on upload:**

```typescript
const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

const { data: existingRequest } = await supabase
  .from('top_up_requests')
  .select('id')
  .eq('file_hash', fileHash)
  .single();

if (existingRequest) {
  throw new Error('This receipt has already been uploaded');
}
```

### 3. Manual Admin Approval

**Why:** Prevents automated fraud attacks

**Process:**

- User uploads receipt → status=`pending`
- Admin reviews within 24h (SLA)
- Admin can reject with reason → user notified

### 4. Negative Balance Prevention

**Mechanism:** Trigger constraint on `users.wallet_balance`

```sql
ALTER TABLE users ADD CONSTRAINT wallet_balance_non_negative
CHECK (wallet_balance >= 0);
```

**Consequence:** If debit would go negative, transaction fails

**Recovery:** Admin manually adds credit if legitimate case

---

## Idempotency (Duplicate Prevention)

### Shipment Creation

**Mechanism:** SHA256 hash of key fields + timestamp window

**File:** `app/api/shipments/create/route.ts`

```typescript
const idempotencyKey = crypto
  .createHash('sha256')
  .update(
    JSON.stringify({
      userId: context.target.id,
      recipient: validated.recipient,
      packages: validated.packages,
      timestamp: Math.floor(Date.now() / 5000), // 5-second window
    })
  )
  .digest('hex');

// Check last 60 seconds
const oneMinuteAgo = new Date(Date.now() - 60000);
const { data: duplicate } = await supabaseAdmin
  .from('shipments')
  .select('id')
  .eq('user_id', context.target.id)
  .eq('idempotency_key', idempotencyKey)
  .gte('created_at', oneMinuteAgo.toISOString())
  .maybeSingle();

if (duplicate) {
  return Response.json(
    {
      error: 'DUPLICATE_REQUEST',
      shipment_id: duplicate.id,
    },
    { status: 409 }
  );
}
```

**Why 5-second window:**

- Allows legitimate retries (user double-clicks)
- Prevents same shipment created multiple times in burst

**Why 60-second check:**

- Balances DB performance vs safety
- Unlikely user waits >1min to retry

---

## Compensation Queue (Failure Recovery)

### Scenario: DB Insert Fails AFTER Courier API Call

**Problem:** Shipment created on courier side, but DB insert fails → user charged on courier but no record

**Solution:** Compensation queue for manual admin cleanup

**File:** `app/api/shipments/create/route.ts`

```typescript
try {
  // ... DB insert shipment
} catch (dbError) {
  // Attempt to delete from courier
  try {
    await courierClient.deleteShipping({ shipmentId: courierResponse.shipmentId });
  } catch (deleteError) {
    // Queue for manual retry
    await supabaseAdmin.from('compensation_queue').insert({
      user_id: context.target.id,
      provider_id: validated.provider,
      carrier: validated.carrier,
      shipment_id_external: courierResponse.shipmentId,
      tracking_number: courierResponse.trackingNumber,
      action: 'DELETE',
      original_cost: finalCost,
      error_context: {
        db_error: dbError.message,
        delete_error: deleteError.message,
        retry_strategy: 'MANUAL',
        actor_id: context.actor.id,
      },
      status: 'PENDING',
    });
  }

  throw new Error('Shipment creation failed. Support notified.');
}
```

### Admin Dashboard

**Location:** `/dashboard/admin/compensation` (TODO: Build UI)

**Actions:**

- View pending compensations
- Retry delete on courier API
- Mark as resolved
- Refund user if cannot delete

---

## Edge Cases & Resolutions

### Case 1: User uploads same receipt twice

**Detection:** `file_hash` duplicate check

**Resolution:** Reject second upload with message "Receipt already used"

### Case 2: Admin approves twice (button double-click)

**Detection:** `top_up_requests.status` check

**Resolution:** Second approve fails with "Request already processed"

### Case 3: Shipment created but wallet not debited

**Detection:** Missing `wallet_transactions` record for shipment

**SQL Audit:**

```sql
SELECT s.id, s.tracking_number, s.total_cost, s.user_id
FROM shipments s
LEFT JOIN wallet_transactions wt ON (
  wt.user_id = s.user_id
  AND wt.type = 'SHIPMENT_CHARGE'
  AND wt.description LIKE '%' || s.tracking_number || '%'
)
WHERE wt.id IS NULL AND s.status != 'draft';
```

**Resolution:**

1. Verify shipment is real (check courier API)
2. Create manual debit: `add_wallet_credit(user_id, -cost, 'Manual adjustment for shipment #...')`
3. Update shipment: Add note about manual correction

### Case 4: SuperAdmin creates shipment (should NOT debit wallet)

**Detection:** `isSuperadmin` check in code

**Verification:**

```sql
-- SuperAdmin shipments should have NO wallet transaction
SELECT s.id, s.user_id, u.role, wt.id AS transaction_id
FROM shipments s
JOIN users u ON s.user_id = u.id
LEFT JOIN wallet_transactions wt ON (
  wt.user_id = s.user_id
  AND wt.description LIKE '%' || s.tracking_number || '%'
)
WHERE u.role = 'SUPERADMIN' AND wt.id IS NOT NULL;
-- Should return 0 rows
```

---

## Reporting & Analytics

### Daily Wallet Summary

```sql
SELECT
  DATE(created_at) AS date,
  type,
  COUNT(*) AS transaction_count,
  SUM(amount) AS total_amount
FROM wallet_transactions
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at), type
ORDER BY date DESC, type;
```

### Top-Up Conversion Rate

```sql
SELECT
  status,
  COUNT(*) AS requests,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) AS percentage
FROM top_up_requests
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY status;
```

### User Balance Distribution

```sql
SELECT
  CASE
    WHEN wallet_balance = 0 THEN '€0'
    WHEN wallet_balance < 50 THEN '€1-49'
    WHEN wallet_balance < 100 THEN '€50-99'
    WHEN wallet_balance < 500 THEN '€100-499'
    ELSE '€500+'
  END AS balance_range,
  COUNT(*) AS user_count
FROM users
WHERE role != 'SUPERADMIN'
GROUP BY balance_range
ORDER BY
  CASE balance_range
    WHEN '€0' THEN 1
    WHEN '€1-49' THEN 2
    WHEN '€50-99' THEN 3
    WHEN '€100-499' THEN 4
    ELSE 5
  END;
```

---

**Document Owner:** Finance Team, Engineering  
**Last Updated:** December 29, 2025  
**Review Cycle:** Monthly

---

## ⚠️ CHANGELOG DOCUMENTAZIONE

**2025-12-29:**

- ✅ Rimosso esempio obsoleto con fallback manuale `.update(wallet_balance)` (VIETATO)
- ✅ Aggiornata sezione `add_wallet_credit()` per riflettere rimozione trigger (migration 041)
- ✅ Aggiunto riferimento a funzioni atomiche e migrations corrette
- ✅ Chiarito che `wallet_transactions` è solo audit trail (NO trigger)

**Principi Inderogabili:**

- 🚫 MAI update diretto a `wallet_balance` (solo funzioni RPC atomiche)
- ✅ Fail-fast se RPC fallisce (NO fallback manuali)
- ✅ Ogni movimento ha transazione in `wallet_transactions` (audit trail)
