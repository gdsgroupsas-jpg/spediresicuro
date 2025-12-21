# 🔍 GREP GATE REPORT - No Bypass Enforcement

> **Date:** 2025-12-21  
> **Purpose:** Identify potential impersonation bypass (direct `auth()` usage)  
> **Status:** 🟡 ACTION REQUIRED

---

## 🎯 OBJECTIVE

Scansione codebase per identificare route/actions che usano `await auth()` direttamente invece di `requireSafeAuth()`.

**CRITICAL:** Questi file NON supportano impersonation e possono causare bypass security.

---

## 📋 FINDINGS SUMMARY

| Category | Pattern | Matches | Risk Level |
|----------|---------|---------|------------|
| API Routes (Shipments) | `await auth()` | 1 | 🔴 CRITICAL |
| Actions (All) | `await auth()` | 29 | 🟠 HIGH |
| **TOTAL** | | **30** | |

---

## 🔴 CRITICAL: API Routes (Shipments)

### File: `app/api/shipments/create/route.ts`

**Location:** Line 9

**Current Code:**
```typescript
const session = await auth()
```

**Risk:** 🔴 CRITICAL
- Route crea spedizioni (wallet debit)
- Se SuperAdmin impersona Cliente, usa wallet SuperAdmin (WRONG)
- Spedizione assegnata a SuperAdmin (WRONG)

**Required Fix:**
```typescript
// REPLACE:
const session = await auth()

// WITH:
const context = await requireSafeAuth()

// THEN:
// Use context.target.id for operations (NOT context.actor.id)
```

**Impact if NOT fixed:**
- SuperAdmin impersona Cliente → spedizione creata per SuperAdmin
- Wallet SuperAdmin addebitato invece di wallet Cliente
- Audit log incompleto (no actor/target distinction)

---

## 🟠 HIGH: Server Actions (29 occurrences)

### 1. `actions/super-admin.ts` (2 matches)

**Lines:** 21, 233

**Functions:**
- Line 21: Unknown function
- Line 233: Unknown function

**Risk:** 🟠 HIGH (admin operations)

**Required Fix:**
```typescript
import { requireSafeAuth } from '@/lib/safe-auth'

// In function:
const context = await requireSafeAuth()
const userId = context.target.id  // Use target for operations
const actorId = context.actor.id  // Use actor for audit
```

---

### 2. `actions/wallet.ts` (4 matches)

**Lines:** 20, 72, 121, 200

**Risk:** 🔴 CRITICAL (wallet operations)

**Functions:**
- Wallet recharge
- Wallet operations
- Balance checks

**Impact if NOT fixed:**
- SuperAdmin impersona Cliente → wallet SuperAdmin modificato
- Cliente non riceve ricarica
- Financial discrepancies

**Required Fix:** Replace all `auth()` with `requireSafeAuth()` + use `context.target.id`

---

### 3. `actions/configurations.ts` (5 matches)

**Lines:** 74, 113, 259, 399, 678

**Risk:** 🟡 MEDIUM (configuration management)

**Impact:** Configuration changes attributed to wrong user

---

### 4. `actions/price-lists.ts` (7 matches)

**Lines:** 37, 87, 135, 187, 226, 279, 311

**Risk:** 🟠 HIGH (pricing operations)

**Impact:** Price list changes for wrong tenant

---

### 5. `actions/admin-reseller.ts` (2 matches)

**Lines:** 26, 73

**Risk:** 🟠 HIGH (reseller management)

**Functions:**
- Create sub-user
- Get sub-users

**Impact:** Sub-users assigned to wrong reseller

---

### 6. `actions/returns.ts` (1 match)

**Line:** 82

**Risk:** 🟡 MEDIUM

---

### 7. `actions/privacy.ts` (2 matches)

**Lines:** 33, 170

**Risk:** 🟢 LOW (privacy settings)

---

### 8. `actions/ldv-internal.ts` (1 match)

**Line:** 36

**Risk:** 🟠 HIGH (LDV operations)

---

### 9. `actions/logistics.ts` (1 match)

**Line:** 76

**Risk:** 🟡 MEDIUM

---

### 10. `actions/contrassegni.ts` (2 matches)

**Lines:** 27, 100

**Risk:** 🟡 MEDIUM

---

### 11. `actions/ldv-import.ts` (2 matches)

**Lines:** 94, 265

**Risk:** 🟠 HIGH (import operations)

---

## 🔎 ADDITIONAL PATTERNS TO CHECK

### Pattern 1: Direct Cookie Reading

```bash
grep -rn "request.cookies.get('sp_impersonate" --include="*.ts" --include="*.tsx" .
```

**Expected:** 0 matches (only middleware should read impersonation cookie)

**Current Status:** ✅ PASS (only middleware.ts reads cookie)

---

### Pattern 2: Direct Header Reading

```bash
grep -rn "headers().get('x-sec-impersonate" --include="*.ts" --include="*.tsx" .
```

**Expected:** 1-2 matches (only lib/safe-auth.ts should read headers)

**Current Status:** ✅ PASS (only safe-auth.ts reads headers)

---

### Pattern 3: getServerSession (NextAuth v4 legacy)

```bash
grep -rn "getServerSession" --include="*.ts" --include="*.tsx" .
```

**Expected:** 0 matches (NextAuth v5 uses `auth()`)

**Current Status:** ✅ PASS (no legacy getServerSession)

---

## 📊 RISK MATRIX

| File | Risk | Priority | Estimated Effort |
|------|------|----------|------------------|
| `app/api/shipments/create/route.ts` | 🔴 CRITICAL | P0 | 1-2h |
| `actions/wallet.ts` | 🔴 CRITICAL | P0 | 1-2h |
| `actions/price-lists.ts` | 🟠 HIGH | P1 | 2-3h |
| `actions/admin-reseller.ts` | 🟠 HIGH | P1 | 1h |
| `actions/ldv-internal.ts` | 🟠 HIGH | P1 | 1h |
| `actions/ldv-import.ts` | 🟠 HIGH | P1 | 1h |
| `actions/super-admin.ts` | 🟠 HIGH | P1 | 1-2h |
| `actions/configurations.ts` | 🟡 MEDIUM | P2 | 1-2h |
| Other actions/* | 🟢 LOW | P3 | 1-2h |

**TOTAL ESTIMATED EFFORT:** 10-15 hours

---

## ✅ MIGRATION CHECKLIST (Per File)

For each file identified above:

- [ ] 1. Import `requireSafeAuth` from `@/lib/safe-auth`
- [ ] 2. Replace `await auth()` with `await requireSafeAuth()`
- [ ] 3. Replace `session.user.id` with `context.target.id` (for operations)
- [ ] 4. Add `context.actor.id` to audit fields (if applicable)
- [ ] 5. Replace audit log with `logActingContextAudit()` (if applicable)
- [ ] 6. Add `context.isImpersonating` check (if special handling needed)
- [ ] 7. Update TypeScript types (session → context)
- [ ] 8. Test:
   - [ ] Normal user operation
   - [ ] SuperAdmin impersonation
   - [ ] Reseller impersonation
- [ ] 9. Verify audit logs
- [ ] 10. Code review

---

## 🚨 IMMEDIATE ACTIONS (P0)

### Action 1: Fix Critical Routes

**Files:**
1. `app/api/shipments/create/route.ts`
2. `actions/wallet.ts`

**Deadline:** Before PROD deployment

**Owner:** Backend Developer

**Verification:**
```bash
# After fix, verify pattern replaced:
grep -n "await auth()" app/api/shipments/create/route.ts actions/wallet.ts
# Expected: 0 matches
```

---

### Action 2: Document Migration Pattern

Create `MIGRATION_GUIDE_AUTH_TO_SAFEAUTH.md` with:
- Step-by-step instructions
- Before/after examples
- Common pitfalls
- Testing checklist

---

### Action 3: Add ESLint Rule (Optional)

Prevent future bypasses with ESLint rule:

```javascript
// .eslintrc.js
rules: {
  'no-restricted-imports': ['error', {
    'patterns': [{
      'group': ['@/lib/auth-config'],
      'importNames': ['auth'],
      'message': 'Use requireSafeAuth() from @/lib/safe-auth instead of auth() to support impersonation'
    }]
  }]
}
```

---

## 📈 PROGRESS TRACKING

| Phase | Status | Completion |
|-------|--------|------------|
| Grep Gate Report | ✅ DONE | 100% |
| P0 Files (2 files) | ⏳ TODO | 0% |
| P1 Files (6 files) | ⏳ TODO | 0% |
| P2 Files (1 file) | ⏳ TODO | 0% |
| P3 Files (others) | ⏳ TODO | 0% |
| ESLint Rule | ⏳ TODO | 0% |
| Testing | ⏳ TODO | 0% |

**Overall Progress:** 10% (Infrastructure only)

---

## 🔗 RELATED DOCUMENTS

- `ACTING_CONTEXT_IMPLEMENTATION.md` - Original implementation
- `IMPERSONATION_HARDENING_TESTS.md` - Test checklist
- `ACTING_CONTEXT_EXAMPLE.ts` - Migration examples
- `lib/safe-auth.ts` - Safe auth helper

---

## 📞 SUPPORT

**Questions?**
1. Check `ACTING_CONTEXT_EXAMPLE.ts` for before/after patterns
2. Review `lib/safe-auth.ts` API documentation
3. Run test suite: `IMPERSONATION_HARDENING_TESTS.md`

**Blockers?**
- Document in Grep Gate Report
- Escalate to Lead Developer

---

**End Grep Gate Report**

