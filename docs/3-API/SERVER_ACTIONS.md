# Server Actions - Complete Catalog

## Overview

Catalogo completo di tutte le Server Actions disponibili in SpedireSicuro. Le Server Actions sono funzioni TypeScript esportate da `actions/**/*.ts` che possono essere chiamate direttamente da componenti React.

## Target Audience

- [x] Developers
- [ ] DevOps
- [ ] Business/PM
- [x] AI Agents

## Prerequisites

- Next.js 15+ App Router
- React Server Components
- Conoscenza base di TypeScript

## Quick Reference

| Categoria      | File                        | Actions                    |
| -------------- | --------------------------- | -------------------------- |
| Wallet         | `actions/wallet.ts`         | Ricarica, transazioni      |
| Price Lists    | `actions/price-lists.ts`    | CRUD listini, assegnazioni |
| Reseller       | `actions/admin-reseller.ts` | Gestione sub-users         |
| Super Admin    | `actions/super-admin.ts`    | Operazioni superadmin      |
| Configurations | `actions/configurations.ts` | Config corrieri            |
| Platform Costs | `actions/platform-costs.ts` | P&L, financial tracking    |

---

## What are Server Actions?

Server Actions sono funzioni TypeScript che:

- Eseguono **sul server** (Node.js)
- Hanno accesso diretto a database (Supabase)
- Supportano **type-safety** end-to-end
- Si integrano con **React Query** per caching
- Supportano **Acting Context** (impersonation)

**Esempio:**

```typescript
// actions/wallet.ts
'use server';

export async function rechargeMyWallet(amount: number) {
  const context = await requireSafeAuth();
  // ... logica server-side
  return { success: true, newBalance: 150.0 };
}

// Component
import { rechargeMyWallet } from '@/actions/wallet';

const handleRecharge = async () => {
  const result = await rechargeMyWallet(100);
  if (result.success) {
    console.log('New balance:', result.newBalance);
  }
};
```

**Vedi:** [Backend Architecture](../2-ARCHITECTURE/BACKEND.md) - Dettagli Server Actions

---

## Wallet Actions

### `rechargeMyWallet(amount, reason?)`

Ricarica wallet dell'utente corrente.

**File:** `actions/wallet.ts`

**Parameters:**

- `amount: number` - Importo da aggiungere (deve essere > 0)
- `reason?: string` - Motivo ricarica (default: "Ricarica wallet utente")

**Returns:**

```typescript
{
  success: boolean;
  message?: string;
  error?: string;
  transactionId?: string;
  newBalance?: number;
}
```

**Authorization:**

- Utente normale: crea richiesta ricarica
- Admin/SuperAdmin: ricarica diretta

**Vedi:** [Wallet Feature](../11-FEATURES/WALLET.md)

---

### `getMyWalletTransactions()`

Ottiene storico transazioni wallet.

**File:** `actions/wallet.ts`

**Returns:**

```typescript
{
  success: boolean;
  transactions?: Array<{
    id: string;
    type: 'credit' | 'debit';
    amount: number;
    description: string;
    created_at: string;
  }>;
  error?: string;
}
```

---

## Price Lists Actions

### `createPriceListAction(data)`

Crea nuovo listino prezzi.

**File:** `actions/price-lists.ts`

**Parameters:**

```typescript
{
  name: string;
  courier: string;
  is_master?: boolean;
  master_list_id?: string;
}
```

**Returns:**

```typescript
{
  success: boolean;
  price_list_id?: string;
  error?: string;
}
```

---

### `clonePriceListAction(sourceId, newName)`

Clona listino esistente.

**File:** `actions/price-lists.ts`

**Parameters:**

- `sourceId: string` - ID listino da clonare
- `newName: string` - Nome nuovo listino

**Returns:**

```typescript
{
  success: boolean;
  cloned_price_list_id?: string;
  error?: string;
}
```

**Vedi:** [Price Lists Feature](../11-FEATURES/PRICE_LISTS.md) - Clonazione listini

---

### `assignPriceListToUserViaTableAction(priceListId, userId)`

Assegna listino a utente (via `price_list_assignments`).

**File:** `actions/price-lists.ts`

**Parameters:**

- `priceListId: string`
- `userId: string`

**Returns:**

```typescript
{
  success: boolean;
  assignment_id?: string;
  error?: string;
}
```

---

### `revokePriceListAssignmentAction(priceListId, userId)`

Revoca assegnazione listino.

**File:** `actions/price-lists.ts`

---

### `listPriceListsAction(filters?)`

Lista listini disponibili.

**File:** `actions/price-lists.ts`

**Parameters:**

```typescript
{
  courier?: string;
  is_master?: boolean;
  limit?: number;
  offset?: number;
}
```

**Returns:**

```typescript
{
  success: boolean;
  price_lists?: Array<PriceList>;
  total?: number;
  error?: string;
}
```

---

### `getApplicablePriceListAction(courier, userId?)`

Ottiene listino applicabile per corriere/utente.

**File:** `actions/price-lists.ts`

**Logic:**

1. Cerca listino personalizzato utente
2. Fallback a listino master
3. Fallback a default

---

### `calculateQuoteAction(params)`

Calcola preventivo da listini database.

**File:** `actions/price-lists.ts`

**Parameters:**

```typescript
{
  weight: number;
  zip: string;
  province?: string;
  courier: string;
  services?: string[];
  insuranceValue?: number;
  codValue?: number;
}
```

**Returns:**

```typescript
{
  success: boolean;
  quote?: {
    price: number;
    source: 'custom' | 'master' | 'default';
    price_list_id?: string;
  };
  error?: string;
}
```

---

## Reseller Actions

### `createSubUser(data)`

Crea sub-user per reseller.

**File:** `actions/admin-reseller.ts`

**Parameters:**

```typescript
{
  email: string;
  name: string;
  password: string;
  role?: 'user' | 'agent' | 'courier' | 'team_administrator';
  initialCredit?: number;
}
```

**Returns:**

```typescript
{
  success: boolean;
  userId?: string;
  error?: string;
}
```

**Authorization:** Richiede `is_reseller = true`

**Vedi:** [Reseller Hierarchy](../11-FEATURES/RESELLER_HIERARCHY.md)

---

### `getSubUsers()`

Ottiene lista sub-users del reseller corrente.

**File:** `actions/admin-reseller.ts`

**Returns:**

```typescript
{
  success: boolean;
  subUsers?: Array<{
    id: string;
    email: string;
    name: string;
    role: string;
    wallet_balance: number;
  }>;
  error?: string;
}
```

---

### `getSubUsersStats()`

Statistiche sub-users (conteggio, tier, ecc.).

**File:** `actions/admin-reseller.ts`

**Returns:**

```typescript
{
  success: boolean;
  stats?: {
    total: number;
    tier: 'small' | 'medium' | 'enterprise';
    total_shipments: number;
    total_revenue: number;
  };
  error?: string;
}
```

---

### `manageSubUserWallet(userId, amount, reason)`

Gestisce wallet sub-user (solo reseller).

**File:** `actions/admin-reseller.ts`

**Parameters:**

- `userId: string` - ID sub-user
- `amount: number` - Importo (positivo = credit, negativo = debit)
- `reason: string` - Motivo operazione

---

## Super Admin Actions

### `toggleResellerStatus(userId, isReseller)`

Attiva/disattiva status reseller.

**File:** `actions/super-admin.ts`

**Authorization:** Richiede `account_type = 'superadmin'`

---

### `manageWallet(userId, amount, reason, isFree?)`

Gestisce wallet utente (solo superadmin).

**File:** `actions/super-admin.ts`

**Parameters:**

- `userId: string`
- `amount: number` - Importo (positivo = credit, negativo = debit)
- `reason: string`
- `isFree?: boolean` - Se true, non scala credito (regalo)

---

### `grantFeature(userId, featureCode, isFree?)`

Attiva feature per utente.

**File:** `actions/super-admin.ts`

**Parameters:**

- `userId: string`
- `featureCode: string` - Codice feature (es. "ai_ocr")
- `isFree?: boolean` - Se true, attiva senza scalare credito

**Vedi:** [AI Features Toggle](../11-FEATURES/AI_FEATURES_TOGGLE.md)

---

### `getAllUsers(limit?)`

Ottiene tutti gli utenti (solo superadmin).

**File:** `actions/super-admin.ts`

**Parameters:**

- `limit?: number` - Numero risultati (default: 100)

**Returns:**

```typescript
{
  success: boolean;
  users?: Array<{
    id: string;
    email: string;
    name: string;
    account_type: string;
    is_reseller: boolean;
    wallet_balance: number;
  }>;
  error?: string;
}
```

---

### `createReseller(data)`

Crea nuovo reseller completo.

**File:** `actions/super-admin.ts`

**Parameters:**

```typescript
{
  email: string;
  name: string;
  password: string;
  initialCredit?: number;
  notes?: string;
}
```

---

## Configuration Actions

### `saveConfiguration(data)`

Salva configurazione corriere.

**File:** `actions/configurations.ts`

**Parameters:**

```typescript
{
  provider: 'spediscionline' | 'poste' | 'gls';
  api_key: string;
  base_url?: string;
  contract_mapping: Record<string, string>;
  config_name: string;
}
```

---

### `listConfigurations()`

Lista configurazioni corriere disponibili.

**File:** `actions/configurations.ts`

**Returns:**

```typescript
{
  success: boolean;
  configurations?: Array<CourierConfig>;
  error?: string;
}
```

---

### `assignConfigurationToUser(configId, userId)`

Assegna configurazione a utente.

**File:** `actions/configurations.ts`

---

## Platform Costs Actions

### `getDailyPnLAction(days?)`

Ottiene P&L giornaliero.

**File:** `actions/platform-costs.ts`

**Parameters:**

- `days?: number` - Numero giorni (default: 30)

**Returns:**

```typescript
{
  success: boolean;
  pnl?: Array<{
    date: string;
    revenue: number;
    costs: number;
    margin: number;
  }>;
  error?: string;
}
```

**Vedi:** [Financial Tracking](../11-FEATURES/FINANCIAL_TRACKING.md)

---

### `getMonthlyPnLAction(months?)`

Ottiene P&L mensile.

**File:** `actions/platform-costs.ts`

---

### `getMarginAlertsAction()`

Ottiene alert margini negativi.

**File:** `actions/platform-costs.ts`

**Returns:**

```typescript
{
  success: boolean;
  alerts?: Array<{
    shipment_id: string;
    revenue: number;
    cost: number;
    margin: number;
    date: string;
  }>;
  error?: string;
}
```

---

### `getReconciliationPendingAction()`

Ottiene spedizioni in attesa riconciliazione.

**File:** `actions/platform-costs.ts`

---

## Reseller Price Lists Actions

### `resellerCloneSupplierPriceListAction(supplierListId, newName)`

Clona listino fornitore per reseller.

**File:** `actions/reseller-price-lists.ts`

---

### `resellerAssignPriceListAction(priceListId, userId)`

Assegna listino a sub-user.

**File:** `actions/reseller-price-lists.ts`

---

### `updateResellerPriceListMarginAction(priceListId, marginPercentage)`

Aggiorna margine listino reseller.

**File:** `actions/reseller-price-lists.ts`

---

## Privacy Actions

### `exportUserData()`

Esporta tutti i dati utente (GDPR).

**File:** `actions/privacy.ts`

**Returns:**

```typescript
{
  success: boolean;
  data?: {
    user: UserData;
    shipments: Shipment[];
    wallet_transactions: Transaction[];
    audit_logs: AuditLog[];
  };
  error?: string;
}
```

**Vedi:** [GDPR](../8-SECURITY/GDPR.md)

---

### `requestAccountDeletion(confirmation)`

Richiede cancellazione account (GDPR).

**File:** `actions/privacy.ts`

**Parameters:**

- `confirmation: string` - Deve essere "DELETE" per confermare

---

## Automation Actions

### `toggleAutomation(configId, enabled)`

Attiva/disattiva automazione sync listini.

**File:** `actions/automation.ts`

---

### `manualSync(configId)`

Sincronizzazione manuale listini.

**File:** `actions/automation.ts`

---

### `getAutomationStatus(configId)`

Ottiene stato automazione.

**File:** `actions/automation.ts`

---

## Common Patterns

### 1. Acting Context Support

Tutte le Server Actions che operano su dati utente devono usare `requireSafeAuth()`:

```typescript
import { requireSafeAuth } from '@/lib/safe-auth';

export async function myAction() {
  const context = await requireSafeAuth();
  const targetId = context.target.id; // Chi paga/riceve
  const actorId = context.actor.id; // Chi ha cliccato

  // ... logica
}
```

**Vedi:** [Authorization](../8-SECURITY/AUTHORIZATION.md) - Acting Context

---

### 2. Error Handling

Pattern standardizzato:

```typescript
export async function myAction() {
  try {
    // ... logica
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error:', error);
    return {
      success: false,
      error: error.message || 'Operazione fallita',
    };
  }
}
```

---

### 3. Validation (Zod)

Usa Zod per validazione input:

```typescript
import { z } from 'zod';

const schema = z.object({
  amount: z.number().positive(),
  reason: z.string().min(1),
});

export async function myAction(input: unknown) {
  const validated = schema.parse(input);
  // ... usa validated
}
```

---

## Related Documentation

- [Overview](OVERVIEW.md) - Panoramica API
- [REST API](REST_API.md) - Endpoints REST
- [Backend Architecture](../2-ARCHITECTURE/BACKEND.md) - Dettagli Server Actions
- [Wallet Feature](../11-FEATURES/WALLET.md) - Wallet actions
- [Price Lists Feature](../11-FEATURES/PRICE_LISTS.md) - Price lists actions
- [Reseller Hierarchy](../11-FEATURES/RESELLER_HIERARCHY.md) - Reseller actions

---

## Changelog

| Date       | Version | Changes         | Author   |
| ---------- | ------- | --------------- | -------- |
| 2026-01-12 | 1.0.0   | Initial version | Dev Team |

---

_Last Updated: 2026-01-12_  
_Status: 🟢 Active_  
_Maintainer: Dev Team_
