# Shipments Management - SpedireSicuro

## Overview

Questo documento descrive il sistema di gestione spedizioni di SpedireSicuro, inclusi creazione spedizioni, idempotency per prevenire duplicati, compensation queue per recovery da errori, e integrazione con wallet per pagamenti automatici.

## Target Audience

- [x] Developers
- [x] DevOps
- [x] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- Conoscenza base di API corrieri
- Comprensione di idempotency patterns
- Familiarità con wallet system

## Quick Reference

| Sezione               | Pagina                          | Link                                                 |
| --------------------- | ------------------------------- | ---------------------------------------------------- |
| Creazione Spedizione  | docs/11-FEATURES/SHIPMENTS.md   | [Creazione](#creazione-spedizione)                   |
| Idempotency           | docs/11-FEATURES/SHIPMENTS.md   | [Idempotency](#idempotency-duplicate-prevention)     |
| Compensation Queue    | docs/11-FEATURES/SHIPMENTS.md   | [Compensation](#compensation-queue-failure-recovery) |
| Wallet Integration    | docs/11-FEATURES/WALLET.md      | [Wallet](WALLET.md)                                  |
| Database Architecture | docs/2-ARCHITECTURE/DATABASE.md | [Database](../2-ARCHITECTURE/DATABASE.md)            |

## Content

### Creazione Spedizione

#### Flow Utente

1. **Utente compila form spedizione** (`/dashboard/spedizioni/nuova`)
2. **Sistema calcola preventivo** (quote da corriere API)
3. **Utente conferma e clicca "Crea Spedizione"**
4. **Sistema verifica:**
   - Saldo wallet sufficiente (o SuperAdmin bypass)
   - Idempotency key non duplicato
5. **Sistema crea spedizione:**
   - Acquire idempotency lock
   - Debit wallet (atomico)
   - Chiama API corriere
   - Inserisce record in DB
   - Rilascia lock
6. **Utente riceve tracking number** e etichetta PDF

#### Flow Tecnico

**File:** `app/api/shipments/create/route.ts`

```typescript
export async function POST(request: Request) {
  const context = await requireSafeAuth();
  const targetId = context.target.id; // Who pays

  const validated = createShipmentSchema.parse(await request.json());

  // 1. Genera idempotency key
  const idempotencyKey = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        userId: targetId,
        recipient: validated.recipient,
        packages: validated.packages,
        timestamp: Math.floor(Date.now() / 5000), // 5-second window
      })
    )
    .digest('hex');

  // 2. Acquire idempotency lock (CRASH-SAFE)
  const { data: lockResult } = await supabaseAdmin.rpc('acquire_idempotency_lock', {
    p_idempotency_key: idempotencyKey,
    p_user_id: targetId,
    p_ttl_minutes: 30,
  });

  if (!lockResult?.[0]?.acquired) {
    // Duplicato o lock già acquisito
    return Response.json({ error: 'DUPLICATE_REQUEST' }, { status: 409 });
  }

  // 3. Verifica saldo wallet
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('wallet_balance, role')
    .eq('id', targetId)
    .single();

  const estimatedCost = 8.5; // TODO: Real quote
  const isSuperadmin = user.role === 'SUPERADMIN';

  if (!isSuperadmin && user.wallet_balance < estimatedCost) {
    return Response.json(
      {
        error: 'INSUFFICIENT_CREDIT',
        available: user.wallet_balance,
        required: estimatedCost,
      },
      { status: 402 }
    );
  }

  // 4. Debit wallet (ATOMICO)
  if (!isSuperadmin) {
    const { error: walletError } = await supabaseAdmin.rpc('decrement_wallet_balance', {
      p_user_id: targetId,
      p_amount: estimatedCost,
    });

    if (walletError) {
      return Response.json({ error: 'WALLET_DEBIT_FAILED' }, { status: 500 });
    }
  }

  // 5. Chiama API corriere
  const courierResponse = await courierClient.createShipping(validated);

  // 6. Inserisci spedizione in DB
  const { data: shipment, error: dbError } = await supabaseAdmin
    .from('shipments')
    .insert({
      user_id: targetId,
      tracking_number: courierResponse.trackingNumber,
      total_cost: courierResponse.cost,
      idempotency_key: idempotencyKey,
      // ...
    })
    .select()
    .single();

  if (dbError) {
    // Compensation: Tenta di cancellare da corriere
    try {
      await courierClient.deleteShipping({ shipmentId: courierResponse.shipmentId });
    } catch (deleteError) {
      // Queue per manual intervention
      await supabaseAdmin.from('compensation_queue').insert({
        action: 'DELETE',
        shipment_id_external: courierResponse.shipmentId,
        status: 'PENDING',
      });
    }
    throw dbError;
  }

  // 7. Rilascia lock
  await supabaseAdmin.rpc('complete_idempotency_lock', {
    p_idempotency_key: idempotencyKey,
    p_shipment_id: shipment.id,
  });

  return Response.json({ success: true, shipment });
}
```

#### Core Function

**File:** `lib/shipments/create-shipment-core.ts`

Funzione riusabile per creazione spedizione, usata da:

- API Route (`app/api/shipments/create/route.ts`)
- Smoke test scripts (con courier mock + failure injection)

```typescript
export async function createShipmentCore(params: {
  context: ActingContext;
  validated: CreateShipmentInput;
  deps: CreateShipmentCoreDeps;
}): Promise<CreateShipmentCoreResult> {
  // Implementazione completa con:
  // - Idempotency lock
  // - Wallet debit
  // - Courier API call
  // - DB insert
  // - Error handling + compensation
}
```

---

### Idempotency (Duplicate Prevention)

#### Problema

Utente fa doppio click su "Crea Spedizione" → crea 2 spedizioni identiche.

#### Soluzione

Hash key fields + timestamp window + crash-safe lock.

#### Implementazione

**Idempotency Key:**

```typescript
const idempotencyKey = crypto
  .createHash('sha256')
  .update(
    JSON.stringify({
      userId: context.target.id,
      recipient: validated.recipient,
      packages: validated.packages,
      timestamp: Math.floor(Date.now() / 5000), // 5-second buckets
    })
  )
  .digest('hex');
```

**Crash-Safe Lock:**

```typescript
// Acquire lock PRIMA di wallet debit
const { data: lockResult } = await supabaseAdmin.rpc('acquire_idempotency_lock', {
  p_idempotency_key: idempotencyKey,
  p_user_id: targetId,
  p_ttl_minutes: 30, // ⚠️ TTL aumentato da 10 a 30 minuti (audit 2025-12-22)
});

if (!lockResult?.[0]?.acquired) {
  // Lock già acquisito = duplicato
  if (lockResult?.[0]?.status === 'completed') {
    // Spedizione già creata, ritorna esistente
    return Response.json({
      shipment_id: lockResult[0].shipment_id,
      duplicate: true,
    });
  }
  return Response.json({ error: 'DUPLICATE_REQUEST' }, { status: 409 });
}
```

**Why 5-second window:**

- Permette retry legittimi (utente doppio click)
- Previene stessa spedizione creata multiple volte in burst

**Why 30-minute TTL:**

- Previene TOCTOU (Time-Of-Check-Time-Of-Use) race condition
- Se lock scade prima del retry, potrebbe causare doppio debit

**Vedi:** [Database Architecture](../2-ARCHITECTURE/DATABASE.md) per dettagli tecnici su idempotency locks.

---

### Compensation Queue (Failure Recovery)

#### Scenario: DB Insert Fails AFTER Courier API Call

**Problema:** Spedizione creata lato corriere, ma DB insert fallisce → utente addebitato lato corriere ma nessun record in DB.

**Soluzione:** Compensation queue per cleanup manuale admin.

#### Flow Compensation

```typescript
try {
  // 1. Chiama API corriere
  const courierResponse = await courierClient.createShipping(validated);

  // 2. Inserisci spedizione in DB
  const { data: shipment } = await supabaseAdmin.from('shipments').insert({
    tracking_number: courierResponse.trackingNumber,
    // ...
  });
} catch (dbError) {
  // 3. DB fallito, prova a cancellare da corriere
  try {
    await courierClient.deleteShipping({
      shipmentId: courierResponse.shipmentId,
    });
  } catch (deleteError) {
    // 4. Non può cancellare, metti in coda per intervento manuale
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

#### Admin Dashboard

**Location:** `/dashboard/admin/compensation` (TODO: Build UI)

**Actions:**

- Visualizza pending compensations
- Retry delete su corriere API
- Mark as resolved
- Refund utente se non può cancellare

#### Tipi di Compensation

- `DELETE` - Cancella spedizione da corriere (DB insert fallito)
- `REFUND` - Rimborsa utente (wallet adjustment fallito)
- `ADJUST` - Aggiustamento manuale (costo finale diverso da stimato)

---

### Wallet Integration

#### Pre-Check Saldo

Prima di creare spedizione, sistema verifica saldo wallet sufficiente:

```typescript
const { data: user } = await supabaseAdmin
  .from('users')
  .select('wallet_balance, role')
  .eq('id', context.target.id)
  .single();

const estimatedCost = 8.5;
const isSuperadmin = user.role === 'SUPERADMIN';

if (!isSuperadmin && user.wallet_balance < estimatedCost) {
  return Response.json(
    {
      error: 'INSUFFICIENT_CREDIT',
      available: user.wallet_balance,
      required: estimatedCost,
    },
    { status: 402 }
  );
}
```

#### Debit Atomico

Dopo verifica saldo, sistema addebita wallet in modo atomico:

```typescript
if (!isSuperadmin) {
  const { error: walletError } = await supabaseAdmin.rpc('decrement_wallet_balance', {
    p_user_id: targetId,
    p_amount: estimatedCost,
  });

  if (walletError) {
    // Fail-fast: Non procedere senza debit atomico
    throw new Error(`Wallet debit failed: ${walletError.message}`);
  }

  // Registra transazione (audit trail)
  await supabaseAdmin.from('wallet_transactions').insert({
    user_id: targetId,
    amount: -estimatedCost,
    type: 'SHIPMENT_CHARGE',
    description: `Spedizione ${courierResponse.trackingNumber}`,
  });
}
```

#### Adjustment (Costo Finale Diverso)

Se costo finale corriere è diverso da stimato, sistema aggiusta wallet:

```typescript
const costDifference = finalCost - estimatedCost;

if (Math.abs(costDifference) > 0.01) {
  if (costDifference > 0) {
    // Debit aggiuntivo
    await supabaseAdmin.rpc('decrement_wallet_balance', {
      p_user_id: targetId,
      p_amount: costDifference,
    });
  } else {
    // Refund parziale
    await supabaseAdmin.rpc('increment_wallet_balance', {
      p_user_id: targetId,
      p_amount: Math.abs(costDifference),
    });
  }
}
```

**Vedi:** [Wallet Feature](WALLET.md) per dettagli completi.

---

### Acting Context (Impersonation)

**⚠️ IMPORTANTE:** Le spedizioni supportano impersonation tramite Acting Context.

**Pattern:**

- `context.target.id` → Chi paga (cliente, anche se impersonating)
- `context.actor.id` → Chi esegue (SuperAdmin se impersonating)

**Esempio:**

```typescript
const context = await requireSafeAuth();

// target.id = chi paga (cliente)
// actor.id = chi clicca (SuperAdmin se impersonating)

const { data: shipment } = await supabaseAdmin.from('shipments').insert({
  user_id: context.target.id, // ⚠️ Usa TARGET, non actor
  // ...
});
```

**Vedi:** [Authorization & Acting Context](../8-SECURITY/AUTHORIZATION.md) per dettagli completi.

---

### Courier Adapter Pattern

**Problema:** Sistema deve supportare multiple corrieri (Spedisci.Online, Poste, GLS, etc.) senza hardcoding.

**Soluzione:** Abstract adapter interface con implementazioni provider-specific.

**Core Interface:**

```typescript
// lib/adapters/couriers/base.ts
export abstract class CourierAdapter {
  abstract connect(): Promise<boolean>;
  abstract createShipment(data: any): Promise<ShippingLabel>;
  abstract getTracking(trackingNumber: string): Promise<TrackingEvent[]>;
  abstract cancelShipment?(trackingNumber: string): Promise<void>;
}
```

**Implementations:**

- `SpedisciOnlineAdapter` - Spedisci.Online API (JSON + CSV fallback)
- `PosteAdapter` - Poste Italiane API
- `MockCourierAdapter` - Testing

**Vedi:** [Architecture Overview](../2-ARCHITECTURE/OVERVIEW.md) per dettagli completi.

---

## Examples

### Creare Spedizione (API Route)

```typescript
// app/api/shipments/create/route.ts
import { requireSafeAuth } from '@/lib/safe-auth';
import { createShipmentCore } from '@/lib/shipments/create-shipment-core';

export async function POST(request: Request) {
  const context = await requireSafeAuth();
  const validated = createShipmentSchema.parse(await request.json());

  const result = await createShipmentCore({
    context,
    validated,
    deps: {
      supabaseAdmin,
      courierClient,
      now: () => new Date(),
    },
  });

  return Response.json(result.json, { status: result.status });
}
```

### Verificare Idempotency

```typescript
// Check se spedizione già creata
const { data: existing } = await supabaseAdmin
  .from('idempotency_locks')
  .select('shipment_id, status')
  .eq('idempotency_key', idempotencyKey)
  .eq('user_id', targetId)
  .single();

if (existing?.status === 'completed') {
  // Spedizione già creata, ritorna esistente
  return Response.json({
    shipment_id: existing.shipment_id,
    duplicate: true,
  });
}
```

### Query Compensation Queue

```typescript
// Admin: Visualizza pending compensations
const { data: compensations } = await supabaseAdmin
  .from('compensation_queue')
  .select('*')
  .eq('status', 'PENDING')
  .order('created_at', { ascending: false });
```

---

## Common Issues

| Issue                      | Soluzione                                                               |
| -------------------------- | ----------------------------------------------------------------------- |
| Doppia spedizione creata   | Verifica che idempotency lock sia acquisito PRIMA di wallet debit       |
| Wallet debit fallito       | Verifica che `decrement_wallet_balance()` sia chiamato correttamente    |
| Compensation queue piena   | Verifica log errori, risolvi manualmente, retry delete su corriere      |
| Courier API timeout        | Implementa retry con exponential backoff, fallback a compensation queue |
| Costo finale diverso       | Verifica che adjustment wallet sia eseguito correttamente               |
| Impersonation non funziona | Verifica che `context.target.id` sia usato (non `context.actor.id`)     |

---

## Related Documentation

- [Wallet Feature](WALLET.md) - Integrazione wallet per pagamenti
- [Database Architecture](../2-ARCHITECTURE/DATABASE.md) - Idempotency locks, compensation queue
- [Architecture Overview](../2-ARCHITECTURE/OVERVIEW.md) - Courier Adapter pattern
- [Authorization & Acting Context](../8-SECURITY/AUTHORIZATION.md) - Impersonation support
- [Money Flows](../MONEY_FLOWS.md) - Flussi finanziari completi

---

## Changelog

| Date       | Version | Changes                                                             | Author   |
| ---------- | ------- | ------------------------------------------------------------------- | -------- |
| 2026-01-12 | 1.0.0   | Initial version - Shipments system, Idempotency, Compensation Queue | AI Agent |

---

_Last Updated: 2026-01-12_  
_Status: 🟢 Active_  
_Maintainer: Engineering Team_
