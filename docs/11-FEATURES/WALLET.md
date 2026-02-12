# Wallet System - SpedireSicuro

## Overview

Questo documento descrive il sistema wallet prepagato di SpedireSicuro, che permette agli utenti di ricaricare credito e pagare spedizioni in modo sicuro e tracciabile. Il wallet implementa il principio "No Credit, No Label" - nessuna etichetta viene generata senza credito disponibile.

## Target Audience

- [x] Developers
- [x] DevOps
- [x] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- Conoscenza base di sistemi prepagati
- Comprensione di transazioni atomiche
- Familiarità con PostgreSQL stored procedures

## Quick Reference

| Sezione              | Pagina                          | Link                                                   |
| -------------------- | ------------------------------- | ------------------------------------------------------ |
| Wallet Overview      | docs/11-FEATURES/WALLET.md      | [Overview](#overview)                                  |
| Ricarica Wallet      | docs/11-FEATURES/WALLET.md      | [Ricarica](#ricarica-wallet)                           |
| Addebito Spedizioni  | docs/11-FEATURES/WALLET.md      | [Addebito](#addebito-spedizioni)                       |
| Transazioni          | docs/11-FEATURES/WALLET.md      | [Transazioni](#transazioni-wallet)                     |
| Architettura Tecnica | docs/2-ARCHITECTURE/DATABASE.md | [Database Architecture](../2-ARCHITECTURE/DATABASE.md) |
| Money Flows          | docs/MONEY_FLOWS.md             | [Money Flows](../MONEY_FLOWS.md)                       |

## Content

### Wallet Overview

**Cos'è il Wallet:**
Il wallet è un sistema di credito prepagato che permette agli utenti di:

- Ricaricare credito tramite bonifico bancario (con approvazione admin)
- Pagare spedizioni automaticamente al momento della creazione
- Visualizzare storico transazioni completo
- Monitorare saldo corrente in tempo reale

**Principio Fondamentale: "No Credit, No Label"**

- Nessuna etichetta viene generata senza credito disponibile nel wallet
- Eccezione: SuperAdmin può bypassare (per testing/emergenze)
- Eccezione: Utenti **Postpagato** possono spedire senza saldo (fattura a fine mese)
- Modello BYOC: Wallet NON toccato (cliente paga direttamente corriere)

**Modelli Operativi:**

- **Broker/Arbitraggio (B2B Core):** Wallet obbligatorio, cliente usa nostri contratti
- **SaaS/BYOC:** Wallet NON utilizzato per spedizioni (solo fee SaaS)
- **Web Reseller (B2C):** Wallet "Web Channel" (non personale)

**Billing Modes (dal 2026-02-12):**

- **Prepagato** (default): Il cliente paga in anticipo tramite wallet. Le spedizioni vengono addebitate immediatamente dal saldo disponibile.
- **Postpagato**: Il cliente spedisce senza pagare subito. A fine mese riceve una fattura con il riepilogo di tutte le spedizioni effettuate (`POSTPAID_CHARGE`). Solo i Reseller possono impostare il billing_mode dei propri sub-user.

### Reseller Transfer Atomico

Quando un Reseller ricarica un sub-user, il trasferimento è **atomico**: il wallet del Reseller viene debitato e quello del sub-user accreditato in una singola transazione SQL (`reseller_transfer_credit`).

- **Lock deterministico**: ordina UUID (min first) per evitare deadlock
- **Idempotency**: key basata su hash SHA-256 dei parametri + finestra temporale 5s
- **Tipi transazione**: `RESELLER_TRANSFER_OUT` (debit reseller) + `RESELLER_TRANSFER_IN` (credit sub-user)
- **Max importo**: 10.000 EUR per singolo trasferimento (validato in TS + SQL)
- **File**: `supabase/migrations/20260216100000_reseller_transfer_credit.sql`

### Fatturazione Postpagata

Per utenti con `billing_mode = 'postpagato'`:

1. **Pre-check credito**: bypassa verifica saldo (`credit-check.ts`)
2. **Creazione spedizione**: crea `POSTPAID_CHARGE` in `wallet_transactions` (importo negativo per tracciamento, ma wallet_balance NON modificato)
3. **Compensazione errore**: se corriere/DB fallisce, il record `POSTPAID_CHARGE` viene eliminato
4. **Fatturazione mensile**: `generatePostpaidMonthlyInvoice()` aggrega i `POSTPAID_CHARGE` del mese e genera fattura con tipo `periodic`
5. **Vista SQL**: `postpaid_monthly_summary` aggrega consumo mensile per utente
6. **Protezione cambio contratto**: non si puo passare da postpagato a prepagato se ci sono `POSTPAID_CHARGE` non fatturate

---

### Ricarica Wallet

#### Flow Utente

1. **Utente naviga a `/dashboard/wallet`**
2. **Clicca "Ricarica Wallet"**
3. **Carica PDF/foto bonifico bancario** (opzionale: AI estrae importo)
4. **Sistema crea richiesta** (`top_up_requests` con status=`pending`)
5. **Admin approva/rifiuta** entro 24h (SLA)
6. **Se approvato:** Credito aggiunto al wallet via `add_wallet_credit()`

#### Flow Admin

1. **Admin naviga a `/dashboard/admin/bonifici`**
2. **Vede lista richieste pending**
3. **Rivede bonifico** (download PDF/immagine)
4. **Verifica:**
   - Importo corrisponde a dichiarato
   - IBAN è conto aziendale
   - CRO/TRN valido (no duplicati)
5. **Approva o Rifiuta** con motivo

#### Notifica Email Admin (dal 2026-02-12)

Quando un utente carica una ricevuta di bonifico, il sistema invia automaticamente una email a tutti gli admin/superadmin tramite `sendAdminTopUpNotificationEmail()`:

- **Template:** Amber-themed con link diretto a `/dashboard/admin/bonifici`
- **Contenuto:** Nome utente, email, importo dichiarato, ID richiesta
- **Non-bloccante:** Errore email non impedisce il completamento dell'upload
- **File:** `lib/email/resend.ts`

#### Storage Ricevute (Bucket `receipts`)

Le ricevute bonifico vengono salvate nel bucket Supabase `receipts`:

- **Limite file:** 10MB
- **Formati:** JPEG, PNG, PDF
- **RLS:** Utente carica/vede solo nella propria cartella, admin vedono tutto
- **Migrazione:** `20260217100000_create_receipts_storage_bucket.sql`

#### Limitazioni Anti-Frode

- **Limite per transazione:** €10,000 (enforced in DB function)
- **Rilevamento duplicati:** SHA256 hash del file caricato
- **Approvazione manuale:** Previene attacchi automatizzati
- **Saldo massimo:** €100,000 (enforced in `increment_wallet_balance()`)

#### Esempio Server Action

```typescript
// actions/wallet.ts
export async function rechargeMyWallet(amount: number, reason: string = 'Ricarica wallet utente') {
  const context = await requireSafeAuth();
  const targetId = context.target.id; // Who receives credit
  const actorId = context.actor.id; // Who clicked (admin se impersonating)

  // Se admin: ricarica diretta
  if (isSuperAdmin(context)) {
    const { data: txId, error } = await supabaseAdmin.rpc('add_wallet_credit', {
      p_user_id: targetId,
      p_amount: amount,
      p_description: reason,
      p_created_by: actorId,
    });

    // Audit log
    await writeWalletAuditLog(context, 'WALLET_RECHARGE', amount, txId);

    return { success: true, transactionId: txId };
  }

  // Utente normale: crea richiesta (TODO: implementare approvazione)
  // ...
}
```

---

### Addebito Spedizioni

#### Pre-Check Saldo

**File:** `app/api/shipments/create/route.ts`

```typescript
// 1. Carica saldo utente
const { data: user } = await supabaseAdmin
  .from('users')
  .select('wallet_balance, role')
  .eq('id', context.target.id) // Who pays (target in impersonation)
  .single();

const estimatedCost = 8.5; // TODO: Real quote from courier API
const isSuperadmin = user.role === 'SUPERADMIN';

// 2. Verifica credito sufficiente (SuperAdmin bypassa)
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

#### Addebito Atomico

**⚠️ REGOLA CRITICA:** Ogni movimento di denaro DEVE usare funzioni SQL atomiche. MAI update diretto a `wallet_balance`.

```typescript
// Dopo chiamata API corriere riuscita
const finalCost = courierResponse.cost;

if (!isSuperadmin) {
  // 1. Decrementa wallet (ATOMICO - lock pessimistico)
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

  // 2. Registra transazione (audit trail)
  await supabaseAdmin.from('wallet_transactions').insert({
    user_id: context.target.id,
    amount: -finalCost,
    type: 'SHIPMENT_CHARGE',
    description: `Spedizione ${courierResponse.trackingNumber}`,
  });
}
```

#### Funzioni Atomiche Disponibili

- `decrement_wallet_balance(user_id, amount)` - Debit atomico con lock pessimistico (FOR UPDATE NOWAIT)
- `increment_wallet_balance(user_id, amount)` - Credit atomico con lock pessimistico
- `add_wallet_credit(user_id, amount, description, created_by)` - Credit con audit trail

**Vedi:** [Database Architecture](../2-ARCHITECTURE/DATABASE.md) per dettagli tecnici.

---

### Transazioni Wallet

#### Struttura Tabella

```sql
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  amount DECIMAL(10,2) NOT NULL, -- Positivo = credito, Negativo = debito
  type TEXT NOT NULL, -- 'deposit', 'SHIPMENT_CHARGE', 'refund', etc.
  description TEXT,
  created_by UUID REFERENCES users(id), -- Admin che ha eseguito operazione
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### Tipi di Transazione

- `deposit` - Ricarica wallet (bonifico approvato)
- `SHIPMENT_CHARGE` - Addebito spedizione
- `refund` - Rimborso spedizione annullata
- `admin_adjustment` - Aggiustamento manuale admin
- `recharge_request` - Richiesta ricarica (pending)

#### Query Transazioni

```typescript
// actions/wallet.ts
export async function getMyWalletTransactions() {
  const context = await requireSafeAuth();
  const targetId = context.target.id; // Wallet owner

  const { data: transactions, error } = await supabaseAdmin
    .from('wallet_transactions')
    .select('*')
    .eq('user_id', targetId) // Target ID (wallet owner)
    .order('created_at', { ascending: false })
    .limit(100);

  return { success: true, transactions: transactions || [] };
}
```

#### UI Dashboard

**File:** `app/dashboard/wallet/page.tsx`

- Visualizza saldo corrente
- Lista transazioni (crediti/debiti)
- Filtri per tipo (tutte/crediti/debiti)
- Statistiche (totale crediti, totale debiti, ultima ricarica)
- Pulsante "Ricarica Wallet"
- Card con `variant="dark"` (sfondo scuro per leggibilità, dal 2026-02-12)

### Azzera Wallet (SuperAdmin)

**File:** `components/admin/manage-wallet-card.tsx`

Il SuperAdmin può azzerare il saldo di un utente direttamente dalla dashboard, senza dover eseguire SQL manuali.

- **Bottone:** "Azzera Wallet (€XX.XX)" — visibile solo quando `currentBalance > 0`
- **Azione:** Pre-compila il dialog di debito con importo completo e motivo "Reset wallet — azzeramento saldo"
- **Stile:** Arancione (distinto da credito verde e debito rosso)
- **Icona:** `RotateCcw` (lucide-react)
- **Sottostante:** Usa la stessa `manageWallet()` server action (tipo `debit`)

---

### Architettura Tecnica

#### Tabelle Database

1. **`users.wallet_balance`** - Saldo corrente (DECIMAL(10,2), DEFAULT 0, CHECK >= 0)
2. **`wallet_transactions`** - Ledger immutabile (append-only, audit trail)
3. **`top_up_requests`** - Richieste ricarica (pending/approved/rejected)

#### Funzioni SQL Atomiche

**Key Insight:** Il saldo NON viene MAI aggiornato direttamente. Solo funzioni RPC atomiche possono modificare `wallet_balance`:

- `increment_wallet_balance(user_id, amount)` - Credito atomico con pessimistic lock
- `decrement_wallet_balance(user_id, amount)` - Debito atomico con pessimistic lock
- `add_wallet_credit(user_id, amount, description, admin_id)` - Wrapper che chiama `increment_wallet_balance()` + inserisce transazione

**⚠️ IMPORTANTE:** Trigger legacy rimosso in migration `041_remove_wallet_balance_trigger.sql` (causava doppio accredito).

#### Reconciliation

```sql
-- Job giornaliero verifica integrità
SELECT u.id, u.wallet_balance, SUM(wt.amount) AS calculated
FROM users u
LEFT JOIN wallet_transactions wt ON wt.user_id = u.id
GROUP BY u.id
HAVING u.wallet_balance != SUM(wt.amount);
```

**Vedi:** [Database Architecture](../2-ARCHITECTURE/DATABASE.md) per dettagli completi.

---

### Acting Context (Impersonation)

**⚠️ IMPORTANTE:** Il wallet supporta impersonation tramite Acting Context.

**Pattern:**

- `context.target.id` → Chi paga (cliente, anche se impersonating)
- `context.actor.id` → Chi esegue (SuperAdmin se impersonating)

**Esempio:**

```typescript
const context = await requireSafeAuth();

// target.id = chi riceve credito (cliente)
// actor.id = chi clicca (SuperAdmin se impersonating)

const { data: txId } = await supabaseAdmin.rpc('add_wallet_credit', {
  p_user_id: context.target.id, // ⚠️ Usa TARGET, non actor
  p_amount: amount,
  p_created_by: context.actor.id, // Audit: chi ha eseguito
});
```

**Vedi:** [Authorization & Acting Context](../8-SECURITY/AUTHORIZATION.md) per dettagli completi.

---

### Anti-Fraud Mechanisms

#### 1. Top-Up Limits

- **Hard Limit:** €10,000 per transaction (enforced in DB function)
- **Saldo Massimo:** €100,000 (enforced in `increment_wallet_balance()`)

#### 2. Duplicate File Detection

- **Meccanismo:** SHA256 hash del file caricato
- **Check:** Verifica hash esistente prima di approvare

#### 3. Manual Admin Approval

- **Perché:** Previene attacchi automatizzati
- **SLA:** Admin rivede entro 24h

#### 4. Negative Balance Prevention

- **Meccanismo:** CHECK constraint su `users.wallet_balance >= 0`
- **Conseguenza:** Se debit andrebbe negativo, transazione fallisce

---

### Compensation Queue (Failure Recovery)

**Scenario:** DB Insert fallisce DOPO chiamata API corriere

**Problema:** Spedizione creata lato corriere, ma DB insert fallisce → utente addebitato lato corriere ma nessun record

**Soluzione:** Compensation queue per cleanup manuale admin

```typescript
try {
  // ... DB insert shipment
} catch (dbError) {
  // Tenta di cancellare da corriere
  try {
    await courierClient.deleteShipping({ shipmentId: courierResponse.shipmentId });
  } catch (deleteError) {
    // Queue per retry manuale
    await supabaseAdmin.from('compensation_queue').insert({
      user_id: context.target.id,
      shipment_id_external: courierResponse.shipmentId,
      action: 'DELETE',
      status: 'PENDING',
    });
  }
}
```

**Vedi:** [Shipments Feature](SHIPMENTS.md) per dettagli completi.

---

## Examples

### Ricarica Wallet (Admin)

```typescript
// Server Action
import { rechargeMyWallet } from '@/actions/wallet';

const result = await rechargeMyWallet(100.0, 'Ricarica manuale admin');

if (result.success) {
  console.log(`Ricarica completata: €${result.newBalance}`);
}
```

### Verifica Saldo Prima di Spedizione

```typescript
// API Route
import { requireSafeAuth } from '@/lib/safe-auth';

export async function POST(request: Request) {
  const context = await requireSafeAuth();

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('wallet_balance')
    .eq('id', context.target.id)
    .single();

  const estimatedCost = 8.5;

  if (user.wallet_balance < estimatedCost) {
    return Response.json(
      {
        error: 'INSUFFICIENT_CREDIT',
        available: user.wallet_balance,
        required: estimatedCost,
      },
      { status: 402 }
    );
  }

  // Procedi con creazione spedizione
}
```

### Query Transazioni Utente

```typescript
// Server Action
import { getMyWalletTransactions } from '@/actions/wallet';

const { transactions } = await getMyWalletTransactions();

transactions.forEach((tx) => {
  console.log(`${tx.type}: €${tx.amount} - ${tx.description}`);
});
```

---

## Common Issues

| Issue                        | Soluzione                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------- |
| Saldo negativo dopo addebito | Verifica che `decrement_wallet_balance()` sia chiamato prima di creare spedizione     |
| Doppio accredito             | Verifica che trigger legacy sia rimosso (migration 041), usa solo funzioni atomiche   |
| Transazione mancante         | Verifica che INSERT in `wallet_transactions` sia eseguito dopo RPC                    |
| Race condition               | Usa sempre funzioni atomiche (`decrement_wallet_balance`, `increment_wallet_balance`) |
| Impersonation non funziona   | Verifica che `context.target.id` sia usato (non `context.actor.id`)                   |
| Reconciliation fallisce      | Esegui query reconciliation, verifica transazioni mancanti                            |

---

## Related Documentation

- [Database Architecture](../2-ARCHITECTURE/DATABASE.md) - Wallet System tecnico, funzioni atomiche
- [Money Flows](../MONEY_FLOWS.md) - Flussi finanziari completi, compensation queue
- [Shipments Feature](SHIPMENTS.md) - Addebito wallet durante creazione spedizione
- [Authorization & Acting Context](../8-SECURITY/AUTHORIZATION.md) - Impersonation support
- [Audit Logging](../8-SECURITY/AUDIT_LOGGING.md) - Audit trail per operazioni wallet

---

## Changelog

| Date       | Version | Changes                                                              | Author   |
| ---------- | ------- | -------------------------------------------------------------------- | -------- |
| 2026-02-12 | 2.1.0   | UI contrast fix, email admin top-up, receipts bucket, azzera wallet  | AI Agent |
| 2026-02-12 | 2.0.0   | Post-paid billing, reseller transfer atomico, billing mode UI        | AI Agent |
| 2026-01-12 | 1.0.0   | Initial version - Wallet system completo, Acting Context, Anti-fraud | AI Agent |

---

_Last Updated: 2026-02-12_
_Status: 🟢 Active_
_Maintainer: Engineering Team_
