# Audit Logging - SpedireSicuro

## Overview

Questo documento descrive il sistema di audit logging di SpedireSicuro, che registra tutte le operazioni sensibili per tracciabilità e compliance.

## Target Audience

- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- Understanding of audit trails
- Acting Context knowledge

## Quick Reference

| Sezione          | Pagina                           | Link                        |
| ---------------- | -------------------------------- | --------------------------- |
| Audit Taxonomy   | docs/8-SECURITY/AUDIT_LOGGING.md | [Taxonomy](#audit-taxonomy) |
| Usage Pattern    | docs/8-SECURITY/AUDIT_LOGGING.md | [Usage](#usage-pattern)     |
| Query Audit Logs | docs/8-SECURITY/AUDIT_LOGGING.md | [Query](#query-audit-logs)  |

## Content

### Audit Taxonomy

#### Standard Actions (from `AUDIT_ACTIONS`)

```typescript
// Shipments
(CREATE_SHIPMENT, UPDATE_SHIPMENT, DELETE_SHIPMENT, CANCEL_SHIPMENT);
(DOWNLOAD_LABEL, TRACK_SHIPMENT, SHIPMENT_ADJUSTMENT);

// Wallet
(WALLET_RECHARGE, WALLET_DEBIT, WALLET_CREDIT, WALLET_REFUND);
(VIEW_WALLET_BALANCE, VIEW_WALLET_TRANSACTIONS);

// Impersonation
(IMPERSONATION_STARTED, IMPERSONATION_ENDED);
(IMPERSONATION_DENIED, IMPERSONATION_EXPIRED);
(IMPERSONATION_INVALID_COOKIE, IMPERSONATION_TARGET_NOT_FOUND);

// Users
(USER_LOGIN, USER_LOGOUT, USER_CREATED, USER_UPDATED);
(USER_ROLE_CHANGED, USER_PASSWORD_CHANGED);

// Courier Configs
(COURIER_CONFIG_CREATED, COURIER_CONFIG_UPDATED);
(COURIER_CREDENTIAL_VIEWED, COURIER_CREDENTIAL_DECRYPTED);
```

### Usage Pattern

```typescript
import { writeAuditLog } from '@/lib/security/audit-log';
import { AUDIT_ACTIONS } from '@/lib/security/audit-actions';

// In Server Action or API Route
const context = await requireSafeAuth();

await writeAuditLog({
  context,
  action: AUDIT_ACTIONS.CREATE_SHIPMENT,
  resourceType: 'shipment',
  resourceId: shipment.id,
  metadata: {
    carrier: 'GLS',
    cost: 8.5,
    reason: 'Bulk import', // Optional
    requestId: headers.get('x-request-id'), // Optional
  },
});
```

### Audit Log Structure

```typescript
interface AuditLog {
  id: string;
  actor_id: string; // Chi ha fatto l'azione
  target_id: string; // Per conto di chi (se impersonation)
  action: string; // AUDIT_ACTIONS.*
  resource_type: string; // "shipment", "wallet", "user", etc.
  resource_id: string; // ID risorsa
  metadata: Record<string, any>; // Dati aggiuntivi
  created_at: Date;
}
```

**Key Insight:** `actor_id` e `target_id` sono sempre registrati per supportare impersonation.

---

### Query Audit Logs

#### Per Utente

```sql
SELECT * FROM audit_logs
WHERE target_id = '<user_id>'
ORDER BY created_at DESC
LIMIT 50;
```

#### Per Azione

```sql
SELECT * FROM audit_logs
WHERE action = 'CREATE_SHIPMENT'
AND created_at >= NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

#### Per Impersonation

```sql
SELECT * FROM audit_logs
WHERE action LIKE 'IMPERSONATION_%'
ORDER BY created_at DESC
LIMIT 50;
```

---

## Examples

### Log Creazione Spedizione

```typescript
import { writeAuditLog } from '@/lib/security/audit-log';
import { AUDIT_ACTIONS } from '@/lib/security/audit-actions';

export async function createShipment(data: ShipmentData) {
  const context = await requireSafeAuth();

  const { data: shipment } = await supabaseAdmin
    .from('shipments')
    .insert({ ...data, user_id: context.target.id });

  // Audit log
  await writeAuditLog({
    context,
    action: AUDIT_ACTIONS.CREATE_SHIPMENT,
    resourceType: 'shipment',
    resourceId: shipment.id,
    metadata: {
      carrier: data.carrier,
      cost: data.cost,
      tracking_number: shipment.tracking_number,
    },
  });

  return shipment;
}
```

### Log Wallet Credit

```typescript
export async function addWalletCredit(userId: string, amount: number) {
  const context = await requireSafeAuth();

  await supabaseAdmin.rpc('add_wallet_credit', {
    p_user_id: userId,
    p_amount: amount,
    p_admin_id: context.target.id,
  });

  // Audit log
  await writeAuditLog({
    context,
    action: AUDIT_ACTIONS.WALLET_CREDIT,
    resourceType: 'wallet',
    resourceId: userId,
    metadata: {
      amount,
      reason: 'Admin top-up',
    },
  });
}
```

---

## Common Issues

| Issue                 | Soluzione                                         |
| --------------------- | ------------------------------------------------- |
| Audit log non scritto | Verifica che `writeAuditLog()` sia chiamato       |
| Metadata mancante     | Aggiungi metadata rilevante per tracciabilità     |
| Query lenta           | Usa indici su `target_id`, `action`, `created_at` |

---

## Related Documentation

- [Security Overview](OVERVIEW.md) - Overview sicurezza
- [Authorization](AUTHORIZATION.md) - Acting Context
- [Database Architecture](../2-ARCHITECTURE/DATABASE.md) - Schema database

---

## Changelog

| Date       | Version | Changes                                                                                                                        | Author   |
| ---------- | ------- | ------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 2026-02-21 | 1.1.0   | Fix: audit_metadata → metadata (11 file). Tutti gli insert usavano colonna inesistente, zero log registrati. Fix RPC fallback. | AI Agent |
| 2026-01-12 | 1.0.0   | Initial version                                                                                                                | AI Agent |

---

_Last Updated: 2026-02-21_  
_Status: 🟢 Active_  
_Maintainer: Engineering Team_
