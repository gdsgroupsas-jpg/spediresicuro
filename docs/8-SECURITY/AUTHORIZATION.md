# Authorization & Acting Context - SpedireSicuro

## Overview

Questo documento descrive il sistema di autorizzazione e Acting Context (impersonation) di SpedireSicuro, che permette ai SuperAdmin di operare per conto di altri utenti.

## Target Audience

- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- NextAuth knowledge
- Cookie-based authentication understanding
- Middleware concepts

## Quick Reference

| Sezione             | Pagina                           | Link                                                   |
| ------------------- | -------------------------------- | ------------------------------------------------------ |
| Acting Context      | docs/8-SECURITY/AUTHORIZATION.md | [Acting Context](#acting-context-impersonation-system) |
| Authorization Rules | docs/8-SECURITY/AUTHORIZATION.md | [Rules](#authorization-rules)                          |
| Implementation      | docs/8-SECURITY/AUTHORIZATION.md | [Implementation](#implementation-files)                |
| Guardrails          | docs/8-SECURITY/AUTHORIZATION.md | [Guardrails](#critical-guardrails)                     |

## Content

### Acting Context (Impersonation System)

**Problema:** SuperAdmin deve operare per conto di utenti senza loggarsi come loro.

**Soluzione:** Cookie-based impersonation con validazione middleware.

#### Authorization Rules

- **Who can impersonate:** ONLY SUPERADMIN (role='superadmin' OR account_type='superadmin')
- **Target validation:** Target user MUST exist and NOT be another superadmin
- **Audit requirement:** ALL operations MUST log both actor_id AND target_id

#### Implementation Files

- `lib/safe-auth.ts` - Core implementation (`getSafeAuth()`, `requireSafeAuth()`)
- `middleware.ts` - Cookie parsing + validation
- `/app/api/impersonate/**` - Start/stop endpoints
- `lib/security/audit-log.ts` - Unified audit logger

#### Flow Diagram

```
1. SuperAdmin clicks "Impersonate User X"
   ↓
2. POST /api/impersonate/start {targetUserId}
   ↓
3. Middleware validates:
   - Actor = SUPERADMIN ✓
   - Target exists ✓
   - Target ≠ SUPERADMIN ✓
   ↓
4. Set cookie: {actorId, targetId, expiresAt, reason}
   TTL: 3600s (configurable via IMPERSONATION_TTL)
   ↓
5. All subsequent requests:
   requireSafeAuth() → ActingContext {
     actor: {id, email, role},  // SuperAdmin (who clicked)
     target: {id, email, role}, // Client (who pays)
     isImpersonating: true
   }
   ↓
6. Operations execute as target.id
   Audit logs record actor.id + target.id
   ↓
7. Exit: POST /api/impersonate/stop OR cookie expires
```

#### Critical Guardrails

**ESLint Rule (Progressive Enforcement):**

- ❌ **BANNED:** Direct `auth()` import in `/app/api/**` and `/app/actions/**`
- ✅ **REQUIRED:** Use `requireSafeAuth()` for impersonation support
- **P0 files:** Error (blocks build)
- **Legacy files:** Warning (34 files in backlog)

**Fail-Closed Principles:**

- If auth fails → DENY (throw error)
- If cookie invalid → Ignore, return normal context
- If target load fails → Return actor as target (fail-safe)
- If audit log fails → WARN but proceed (fail-open on logging ONLY)

---

### RBAC (Role-Based Access Control)

#### Roles

- **superadmin** - Accesso completo, può impersonare
- **admin** - Accesso a tutti i dati, non può impersonare
- **reseller** - Accesso ai propri dati e sub-reseller
- **user** - Accesso solo ai propri dati

#### Capabilities

Le capabilities sono gestite via `users.capabilities` (array JSONB):

```typescript
interface UserCapabilities {
  ai_chat?: boolean;
  advanced_pricing?: boolean;
  bulk_import?: boolean;
  // ... altre capabilities
}
```

#### Verifica Accesso

```typescript
import { requireSafeAuth } from '@/lib/safe-auth';
import { isSuperAdmin, hasCapability } from '@/lib/security/rbac';

export async function adminOnlyAction() {
  const context = await requireSafeAuth();

  // Verifica ruolo
  if (!isSuperAdmin(context)) {
    throw new Error('FORBIDDEN: SuperAdmin only');
  }

  // Verifica capability
  if (!hasCapability(context.target, 'advanced_pricing')) {
    throw new Error('FORBIDDEN: Missing capability');
  }

  // Operazione autorizzata
}
```

---

## Examples

### Usare Acting Context

```typescript
import { requireSafeAuth } from '@/lib/safe-auth';

export async function createShipment(data: ShipmentData) {
  const context = await requireSafeAuth();

  // Business logic usa SEMPRE context.target.id
  const { data: shipment } = await supabaseAdmin.from('shipments').insert({
    ...data,
    user_id: context.target.id, // ✅ Target, non actor
  });

  // Audit log registra ENTRAMBI
  await writeAuditLog({
    context,
    action: 'CREATE_SHIPMENT',
    resourceId: shipment.id,
    metadata: {
      actor_id: context.actor.id, // Chi ha fatto l'azione
      target_id: context.target.id, // Per conto di chi
    },
  });

  return shipment;
}
```

### Avviare Impersonation

```typescript
// API Route: /api/impersonate/start
export async function POST(request: Request) {
  const { targetUserId, reason } = await request.json();
  const context = await requireSafeAuth();

  // Verifica SUPERADMIN
  if (!isSuperAdmin(context)) {
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 });
  }

  // Verifica target
  const { data: target } = await supabaseAdmin
    .from('users')
    .select('id, role')
    .eq('id', targetUserId)
    .single();

  if (!target || isSuperAdmin({ target })) {
    return Response.json({ error: 'INVALID_TARGET' }, { status: 400 });
  }

  // Crea cookie firmato
  const cookie = createImpersonationCookie({
    actorId: context.target.id,
    targetId: targetUserId,
    expiresAt: Date.now() + 3600 * 1000, // 1 ora
    reason,
  });

  // Set cookie
  return Response.json(
    { success: true },
    {
      headers: { 'Set-Cookie': cookie },
    }
  );
}
```

---

## Common Issues

| Issue                      | Soluzione                                               |
| -------------------------- | ------------------------------------------------------- |
| Impersonation non funziona | Verifica cookie signature e ruolo SUPERADMIN            |
| Target non trovato         | Verifica che utente esista e non sia SUPERADMIN         |
| Cookie scaduto             | Cookie ha TTL 3600s, riavvia impersonation              |
| Audit log mancante         | Verifica che `writeAuditLog()` sia chiamato con context |

---

## Related Documentation

- [Security Overview](OVERVIEW.md) - Overview sicurezza
- [Audit Logging](AUDIT_LOGGING.md) - Audit trail
- [Backend Architecture](../2-ARCHITECTURE/BACKEND.md) - Acting Context tecnico

---

## Changelog

| Date       | Version | Changes         | Author   |
| ---------- | ------- | --------------- | -------- |
| 2026-01-12 | 1.0.0   | Initial version | AI Agent |

---

_Last Updated: 2026-01-12_  
_Status: 🟢 Active_  
_Maintainer: Engineering Team_
