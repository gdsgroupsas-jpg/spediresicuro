# 🔒 Security Architecture

## Multi-Tenant Enforcement

### RLS (Row Level Security) Pattern
**ALL tenant tables MUST have RLS enabled**

Policy Template:
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

### Query Safety Pattern
```typescript
// ❌ DANGEROUS - No tenant filter
const { data } = await supabase.from('shipments').select('*')

// ✅ SAFE - Explicit tenant binding
const { data } = await supabase
  .from('shipments')
  .select('*')
  .eq('user_id', context.target.id) // Acting Context aware
```

---

## Acting Context (Impersonation System)

### Authorization Rules
- **Who can impersonate:** ONLY SUPERADMIN (role='superadmin' OR account_type='superadmin')
- **Target validation:** Target user MUST exist and NOT be another superadmin
- **Audit requirement:** ALL operations MUST log both actor_id AND target_id

### Implementation Files
- `lib/safe-auth.ts` - Core implementation (`getSafeAuth()`, `requireSafeAuth()`)
- `middleware.ts` - Cookie parsing + validation
- `/app/api/impersonate/**` - Start/stop endpoints
- `lib/security/audit-log.ts` - Unified audit logger

### Flow Diagram
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

### Critical Guardrails
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

## Audit Taxonomy

### Standard Actions (from `AUDIT_ACTIONS`)
```typescript
// Shipments
CREATE_SHIPMENT, UPDATE_SHIPMENT, DELETE_SHIPMENT, CANCEL_SHIPMENT
DOWNLOAD_LABEL, TRACK_SHIPMENT, SHIPMENT_ADJUSTMENT

// Wallet
WALLET_RECHARGE, WALLET_DEBIT, WALLET_CREDIT, WALLET_REFUND
VIEW_WALLET_BALANCE, VIEW_WALLET_TRANSACTIONS

// Impersonation
IMPERSONATION_STARTED, IMPERSONATION_ENDED
IMPERSONATION_DENIED, IMPERSONATION_EXPIRED
IMPERSONATION_INVALID_COOKIE, IMPERSONATION_TARGET_NOT_FOUND

// Users
USER_LOGIN, USER_LOGOUT, USER_CREATED, USER_UPDATED
USER_ROLE_CHANGED, USER_PASSWORD_CHANGED

// Courier Configs
COURIER_CONFIG_CREATED, COURIER_CONFIG_UPDATED
COURIER_CREDENTIAL_VIEWED, COURIER_CREDENTIAL_DECRYPTED
```

### Usage Pattern
```typescript
import { writeAuditLog } from '@/lib/security/audit-log'
import { AUDIT_ACTIONS } from '@/lib/security/audit-actions'

// In Server Action or API Route
const context = await requireSafeAuth()

await writeAuditLog({
  context,
  action: AUDIT_ACTIONS.CREATE_SHIPMENT,
  resourceType: 'shipment',
  resourceId: shipment.id,
  metadata: {
    carrier: 'GLS',
    cost: 8.50,
    reason: 'Bulk import', // Optional
    requestId: headers.get('x-request-id') // Optional
  }
})
```

---

## RLS Policy Audit

### Core Tables Status
| Table | RLS Enabled | Policies | Notes |
|-------|-------------|----------|-------|
| `users` | ✅ | SELECT, UPDATE | Self + admin access |
| `shipments` | ✅ | SELECT, INSERT, UPDATE | Tenant-isolated + orphan prevention |
| `wallet_transactions` | ✅ | SELECT only | Immutable ledger |
| `audit_logs` | ❌ | None | Service role only |
| `top_up_requests` | ✅ | SELECT, INSERT | Self-service |
| `compensation_queue` | ❌ | None | System table |
| `courier_configs` | ✅ | SELECT, INSERT, UPDATE | Admin-only on sensitive fields |

### Verification Query
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

---

## Security Incidents Playbook

### Incident: User A sees User B's data
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

---

### Incident: Unauthorized impersonation
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

## Compliance & GDPR

### Data Export (GDPR Right to Access)
User can export all personal data via `/dashboard/impostazioni/privacy`

**Implementation:** `app/actions/privacy.ts` → `exportUserData()`
**Format:** JSON file with all tables (shipments, wallet_transactions, audit_logs referencing user)

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

## Environment Variables (Security-Critical)

### Auth
- `NEXTAUTH_SECRET` - **P0** - JWT signing key (rotate on compromise)
- `NEXTAUTH_URL` - Callback URL base (must match OAuth app settings)

### Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - **P0** - Bypasses RLS, NEVER expose client-side
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public key (RLS enforced)

### Impersonation
- `IMPERSONATION_COOKIE_NAME` - Cookie name (default: `impersonate-context`)
- `IMPERSONATION_TTL` - Session TTL in seconds (default: 3600)

### Couriers (Encrypted in DB)
- API keys stored in `courier_configs.api_key` (encrypted at rest if using Supabase Vault)
- Accessed only server-side via `supabaseAdmin`

**Rotation Procedure:**
1. Update key in courier portal
2. Update `courier_configs` via admin UI
3. Test with dummy shipment
4. Monitor for 24h

---

## Code Review Checklist

### Security Gate (Mandatory for PR Approval)
- [ ] All new tenant tables have RLS enabled
- [ ] All queries use `context.target.id` (not hardcoded user_id)
- [ ] No `auth()` direct usage in `/app/api/**` or `/app/actions/**`
- [ ] Audit log written for sensitive operations (shipment create, wallet credit)
- [ ] No secrets in code (use env vars)
- [ ] Input validation (Zod schema)
- [ ] Error messages don't leak sensitive data

### Impersonation Safety
- [ ] Only SUPERADMIN can start impersonation
- [ ] Target user exists and is not SUPERADMIN
- [ ] Cookie has TTL (not permanent)
- [ ] Audit log records actor + target + reason
- [ ] UI shows clear impersonation banner

---

**Document Owner:** Engineering Team  
**Last Updated:** December 21, 2025  
**Reviewers:** Security Team, DevOps
