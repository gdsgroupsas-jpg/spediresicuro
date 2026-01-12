# Security Overview - SpedireSicuro

## Overview

Questo documento descrive l'architettura di sicurezza di SpedireSicuro, inclusi isolamento multi-tenant, Row Level Security (RLS), Acting Context per impersonation, e compliance GDPR.

## Target Audience

- [x] Developers
- [x] DevOps
- [ ] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- PostgreSQL RLS knowledge
- NextAuth basics
- Understanding of multi-tenant architecture

## Quick Reference

| Sezione | Pagina | Link |
|---------|--------|------|
| Multi-Tenant Enforcement | docs/8-SECURITY/OVERVIEW.md | [Multi-Tenant](#multi-tenant-enforcement) |
| RLS Pattern | docs/8-SECURITY/OVERVIEW.md | [RLS](#rls-row-level-security-pattern) |
| Acting Context | docs/8-SECURITY/AUTHORIZATION.md | [Acting Context](../8-SECURITY/AUTHORIZATION.md) |
| Audit Logging | docs/8-SECURITY/AUDIT_LOGGING.md | [Audit](../8-SECURITY/AUDIT_LOGGING.md) |
| Data Protection | docs/8-SECURITY/DATA_PROTECTION.md | [Data Protection](../8-SECURITY/DATA_PROTECTION.md) |

## Content

### Multi-Tenant Enforcement

**SpedireSicuro supporta 3 modelli operativi (vedi [README.md](../../README.md)):**

1. **Broker/Arbitraggio (B2B Core):** Cliente usa nostri contratti → Wallet interno obbligatorio
2. **SaaS/BYOC:** Cliente usa suoi contratti → Wallet NON toccato (solo fee SaaS)
3. **Web Reseller (B2C):** Utente finale → Wallet "Web Channel" (non personale)

**Implicazioni Sicurezza:**

- RLS deve isolare dati per tenant (user_id)
- BYOC: Config corriere isolata per owner_user_id
- Web Reseller: Trattato come tenant speciale

**Principio Fondamentale:** Ogni utente vede SOLO i propri dati, tranne admin/superadmin che vedono tutto.

---

### RLS (Row Level Security) Pattern

**ALL tenant tables MUST have RLS enabled**

#### Policy Template

```sql
CREATE POLICY "tenant_isolation" ON <table>
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  )
);
```

#### Query Safety Pattern

```typescript
// ❌ DANGEROUS - No tenant filter
const { data } = await supabase.from("shipments").select("*");

// ✅ SAFE - Explicit tenant binding
const { data } = await supabase
  .from("shipments")
  .select("*")
  .eq("user_id", context.target.id); // Acting Context aware
```

#### Core Tables Status

| Table                 | RLS Enabled | Policies               | Notes                               |
| --------------------- | ----------- | ---------------------- | ----------------------------------- |
| `users`               | ✅          | SELECT, UPDATE         | Self + admin access                 |
| `shipments`           | ✅          | SELECT, INSERT, UPDATE | Tenant-isolated + orphan prevention |
| `wallet_transactions` | ✅          | SELECT only            | Immutable ledger                    |
| `audit_logs`          | ❌          | None                   | Service role only                   |
| `top_up_requests`     | ✅          | SELECT, INSERT         | Self-service                        |
| `compensation_queue`  | ❌          | None                   | System table                        |
| `courier_configs`     | ✅          | SELECT, INSERT, UPDATE | Admin-only on sensitive fields      |

Vedi [Database Architecture](../2-ARCHITECTURE/DATABASE.md) per dettagli tecnici su RLS.

---

### Security Boundaries

#### Client-Side (Browser)
- **Can access:** Public Supabase anon key (RLS enforced)
- **Cannot access:** Service role key, API secrets, encrypted passwords
- **Pattern:** Use Server Actions for sensitive operations

#### Server-Side (Node.js)
- **Can access:** All secrets via environment variables
- **Can bypass:** RLS via `supabaseAdmin`
- **Pattern:** Validate input, enforce business rules

#### Database (PostgreSQL)
- **Enforces:** RLS policies, CHECK constraints, foreign keys
- **Trusted:** Only server-side code (service role)
- **Pattern:** Defense in depth, never trust client

---

### Security Incidents Playbook

#### Incident: User A sees User B's data

**Root Cause:** Bypass RLS or missing `WHERE user_id` filter

**Investigation:**
1. Check recent code changes in affected API/action
2. Verify RLS policy exists: `SELECT * FROM pg_policies WHERE tablename='<table>'`
3. Check query pattern: Must use `context.target.id`

**Fix:**
1. Add explicit filter: `.eq('user_id', context.target.id)`
2. Verify policy: Re-run migration if missing
3. Test with different users (normal + admin + impersonation)

**Prevention:**
- Code review checklist: All tenant queries filtered
- Add integration test: User A cannot see User B data

#### Incident: Unauthorized impersonation

**Root Cause:** Missing SUPERADMIN check or cookie tampering

**Investigation:**
1. Check `middleware.ts`: Cookie signature validation
2. Verify actor role: `SELECT role, account_type FROM users WHERE id=<actor_id>`
3. Audit log: `SELECT * FROM audit_logs WHERE action LIKE 'impersonation_%' ORDER BY created_at DESC LIMIT 50`

**Fix:**
1. Validate cookie signature (HMAC with `NEXTAUTH_SECRET`)
2. Enforce role check: `isSuperAdmin(context)` before allowing
3. Rotate `NEXTAUTH_SECRET` if compromise suspected

**Prevention:**
- Cookie must be HTTP-only, Secure, SameSite=Lax
- TTL enforcement (default 3600s)
- Rate limit impersonation start endpoint

---

### Code Review Checklist

#### Security Gate (Mandatory for PR Approval)

- [ ] All new tenant tables have RLS enabled
- [ ] All queries use `context.target.id` (not hardcoded user_id)
- [ ] No `auth()` direct usage in `/app/api/**` or `/app/actions/**`
- [ ] Audit log written for sensitive operations (shipment create, wallet credit)
- [ ] No secrets in code (use env vars)
- [ ] Input validation (Zod schema)
- [ ] Error messages don't leak sensitive data

#### Impersonation Safety

- [ ] Only SUPERADMIN can start impersonation
- [ ] Target user exists and is not SUPERADMIN
- [ ] Cookie has TTL (not permanent)
- [ ] Audit log records actor + target + reason
- [ ] UI shows clear impersonation banner

---

## Examples

### Verificare RLS Status

```sql
-- Check all tables with RLS status
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  (SELECT COUNT(*) FROM pg_policies WHERE tablename = t.tablename) AS policy_count
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY tablename;
```

### Query Sicura con Acting Context

```typescript
import { requireSafeAuth } from '@/lib/safe-auth';

export async function getMyShipments() {
  const context = await requireSafeAuth();
  
  // ✅ SAFE: Usa context.target.id
  const { data } = await supabase
    .from('shipments')
    .select('*')
    .eq('user_id', context.target.id);
  
  return data;
}
```

---

## Common Issues

| Issue | Soluzione |
|-------|-----------|
| User A vede dati di User B | Verifica RLS policy e filtri espliciti `user_id` |
| Impersonation non funziona | Verifica cookie signature e ruolo SUPERADMIN |
| RLS blocca query legittime | Verifica che `auth.uid()` sia impostato correttamente |
| Audit log non scritto | Verifica che `writeAuditLog()` sia chiamato |

---

## Related Documentation

- [Authorization](AUTHORIZATION.md) - Acting Context, RBAC
- [Audit Logging](AUDIT_LOGGING.md) - Audit trail completo
- [Data Protection](DATA_PROTECTION.md) - Encryption, secrets
- [GDPR](GDPR.md) - Compliance GDPR
- [Database Architecture](../2-ARCHITECTURE/DATABASE.md) - RLS tecnico
- [Backend Architecture](../2-ARCHITECTURE/BACKEND.md) - API security

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-01-12 | 1.0.0 | Initial version | AI Agent |

---
*Last Updated: 2026-01-12*  
*Status: 🟢 Active*  
*Maintainer: Engineering Team*
