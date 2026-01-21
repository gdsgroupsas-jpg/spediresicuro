# GDPR Compliance - SpedireSicuro

## Overview

Questo documento descrive le misure di compliance GDPR di SpedireSicuro, inclusi data export e anonymization.

## Target Audience

- [x] Developers
- [x] DevOps
- [x] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- GDPR basics
- Data privacy understanding

## Quick Reference

| Sezione            | Pagina                  | Link                                                       |
| ------------------ | ----------------------- | ---------------------------------------------------------- |
| Data Export        | docs/8-SECURITY/GDPR.md | [Data Export](#data-export-gdpr-right-to-access)           |
| Data Anonymization | docs/8-SECURITY/GDPR.md | [Anonymization](#data-anonymization-gdpr-right-to-erasure) |

## Content

### Data Export (GDPR Right to Access)

User can export all personal data via `/dashboard/impostazioni/privacy`

**Implementation:** `app/actions/privacy.ts` → `exportUserData()`

**Format:** JSON file with all tables (shipments, wallet_transactions, audit_logs referencing user)

**Included Data:**

- User profile (name, email, phone, address)
- Shipments (all shipments created by user)
- Wallet transactions (all transactions)
- Audit logs (all actions by/for user)

---

### Data Anonymization (GDPR Right to Erasure)

User can request account deletion via same page

**Implementation:** `app/actions/privacy.ts` → `anonymizeUser()`

**Strategy:**

- Email → `deleted_<timestamp>@privacy.local`
- Name → `[Account Deleted]`
- Phone → NULL
- Address → NULL
- Shipments → Keep (anonymized recipient/sender data)
- Wallet → Freeze balance (manual admin refund if needed)

**RLS Impact:** Uses `supabaseAdmin` (service role) to bypass policies

---

## Examples

### Export User Data

```typescript
// app/actions/privacy.ts
export async function exportUserData(userId: string) {
  const context = await requireSafeAuth();

  // Verifica che utente richieda i propri dati
  if (context.target.id !== userId && !isSuperAdmin(context)) {
    throw new Error('FORBIDDEN');
  }

  // Raccogli tutti i dati
  const [user, shipments, transactions, auditLogs] = await Promise.all([
    supabaseAdmin.from('users').select('*').eq('id', userId).single(),
    supabaseAdmin.from('shipments').select('*').eq('user_id', userId),
    supabaseAdmin.from('wallet_transactions').select('*').eq('user_id', userId),
    supabaseAdmin.from('audit_logs').select('*').or(`actor_id.eq.${userId},target_id.eq.${userId}`),
  ]);

  return {
    user: user.data,
    shipments: shipments.data,
    wallet_transactions: transactions.data,
    audit_logs: auditLogs.data,
    exported_at: new Date().toISOString(),
  };
}
```

### Anonymize User

```typescript
export async function anonymizeUser(userId: string) {
  const context = await requireSafeAuth();

  // Verifica autorizzazione
  if (context.target.id !== userId && !isSuperAdmin(context)) {
    throw new Error('FORBIDDEN');
  }

  const timestamp = Date.now();

  // Anonymize user
  await supabaseAdmin
    .from('users')
    .update({
      email: `deleted_${timestamp}@privacy.local`,
      name: '[Account Deleted]',
      phone: null,
      address_line1: null,
      address_line2: null,
      postal_code: null,
      city: null,
      province: null,
    })
    .eq('id', userId);

  // Anonymize shipments (keep for business records)
  await supabaseAdmin
    .from('shipments')
    .update({
      sender_name: '[Anonymized]',
      sender_address: '[Anonymized]',
      recipient_name: '[Anonymized]',
      recipient_address: '[Anonymized]',
    })
    .eq('user_id', userId);

  // Freeze wallet (admin must manually refund)
  // Wallet balance remains but user cannot access

  // Audit log
  await writeAuditLog({
    context,
    action: 'USER_ANONYMIZED',
    resourceType: 'user',
    resourceId: userId,
  });
}
```

---

## Common Issues

| Issue                    | Soluzione                                                |
| ------------------------ | -------------------------------------------------------- |
| Export fallisce          | Verifica autorizzazione e accesso database               |
| Anonymization incompleta | Verifica che tutti i campi PII siano anonimizzati        |
| Wallet balance perso     | Admin deve rimborsare manualmente prima di anonymization |

---

## Related Documentation

- [Security Overview](OVERVIEW.md) - Overview sicurezza
- [Data Protection](DATA_PROTECTION.md) - Encryption

---

## Changelog

| Date       | Version | Changes         | Author   |
| ---------- | ------- | --------------- | -------- |
| 2026-01-12 | 1.0.0   | Initial version | AI Agent |

---

_Last Updated: 2026-01-12_  
_Status: 🟢 Active_  
_Maintainer: Engineering Team_
