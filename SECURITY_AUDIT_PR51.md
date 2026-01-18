# 🔴 SECURITY AUDIT: PR #51 - CRITICAL VULNERABILITY FOUND

**Date**: 2026-01-18
**Auditor**: Claude Sonnet 4.5
**Status**: 🔴 **BLOCKER - DO NOT MERGE**

---

## 📋 Executive Summary

PR #51 introduces **M2: APM & Log Aggregation** (✅ SECURE) but also includes commit `1add15d` with **Cascading Fees** feature (🔴 VULNERABLE).

**CRITICAL FINDING**: P0 Information Disclosure (IDOR) vulnerability in RPC functions.

**RISK LEVEL**: 🔴 **CRITICAL**
**EXPLOITABILITY**: 🔴 **TRIVIAL** (any authenticated user)
**IMPACT**: 🔴 **HIGH** (email disclosure, pricing strategy exposure)

---

## 🚨 Vulnerability Details

### **P0: Information Disclosure via Unprotected RPC Functions**

**Affected Functions**:
- `get_platform_fee_cascading(p_user_id UUID)`
- `get_platform_fee_details(p_user_id UUID)`

**File**: `supabase/migrations/112_cascading_platform_fees.sql`
**Commit**: `1add15d`

**Vulnerability Type**: IDOR (Insecure Direct Object Reference) + Information Disclosure

**CWE**: CWE-639 (Authorization Bypass Through User-Controlled Key)

---

## 🔍 Technical Analysis

### **Root Cause**

Functions are defined as `SECURITY DEFINER` (execute with elevated privileges) but **lack authorization checks**:

```sql
CREATE OR REPLACE FUNCTION get_platform_fee_cascading(p_user_id UUID)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
SECURITY DEFINER  -- ❌ Executes as function owner (superuser)
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  -- ❌ NO AUTHORIZATION CHECK HERE
  -- Any authenticated user can call this with ANY p_user_id

  SELECT platform_fee_override, parent_id, parent_imposed_fee, account_type
  FROM users
  WHERE id = p_user_id;  -- ❌ No check if caller is authorized to see this user
  ...
END;
$$;

-- ❌ Grants execute to ALL authenticated users
GRANT EXECUTE ON FUNCTION get_platform_fee_cascading(UUID) TO authenticated;
```

### **Attack Vector**

**Exploit PoC**:

```sql
-- Attacker (user A) authenticated as their own user
-- Calls function with victim's UUID (user B)

SELECT * FROM get_platform_fee_details('victim-uuid-here');

-- Response (LEAKED INFORMATION):
{
  "fee": 2.50,
  "source": "parent_imposed",
  "source_user_id": "parent-uuid",
  "source_user_email": "parent@reseller.com"  -- ❌ EMAIL LEAK
}
```

### **Impact Assessment**

| **Impact** | **Severity** | **Details** |
|------------|--------------|-------------|
| **Information Disclosure** | 🔴 HIGH | Exposes reseller parent emails to any authenticated user |
| **IDOR** | 🔴 HIGH | Unauthorized access to pricing data of other users |
| **Business Logic Bypass** | 🟡 MEDIUM | Reveals hierarchical structure (parent/subuser relationships) |
| **Pricing Strategy Exposure** | 🟡 MEDIUM | Competitors can discover pricing models |

### **CVSS Score**

**CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N**

- **Score**: 6.5 (Medium)
- **Attack Vector**: Network (N)
- **Attack Complexity**: Low (L)
- **Privileges Required**: Low (L) - authenticated user
- **User Interaction**: None (N)
- **Confidentiality Impact**: High (H)
- **Integrity Impact**: None (N)
- **Availability Impact**: None (N)

---

## ✅ Fix Implementation

### **Solution**: Add Authorization Checks

**File**: `supabase/migrations/113_fix_cascading_fee_security.sql` (✅ CREATED)

**Authorization Logic**:

```sql
-- ⚠️ SECURITY: Authorization check
-- Can only call for:
-- 1. Self (p_user_id = auth.uid())
-- 2. Own sub-users (if caller is parent/reseller)
-- 3. Any user (if caller is SUPERADMIN)

DECLARE
  v_caller_id UUID := auth.uid();
  v_is_authorized BOOLEAN := FALSE;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Check authorization
  IF p_user_id = v_caller_id THEN
    v_is_authorized := TRUE;  -- Case 1: Self
  ELSIF EXISTS (
    SELECT 1 FROM users
    WHERE id = v_caller_id
    AND (role = 'SUPERADMIN' OR account_type = 'superadmin')
  ) THEN
    v_is_authorized := TRUE;  -- Case 3: Superadmin
  ELSIF EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = p_user_id
    AND (u.parent_id = v_caller_id OR is_sub_user_of(p_user_id, v_caller_id))
  ) THEN
    v_is_authorized := TRUE;  -- Case 2: Own sub-user
  END IF;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Access denied: You are not authorized to view fees for user %', p_user_id;
  END IF;

  -- Rest of function logic...
END;
```

---

## 🧪 Verification Tests

### **Test Script**: `scripts/test-fee-security-vulnerability.sql` (✅ CREATED)

**Test Case 1**: Attacker tries to read victim's fee

```sql
-- Setup: Attacker authenticated as user B
SET LOCAL request.jwt.claims TO '{"sub": "attacker-uuid"}';

-- Attempt: Read victim's fee
SELECT get_platform_fee_cascading('victim-uuid');

-- BEFORE FIX: Returns victim's fee (2.50) ❌ VULNERABLE
-- AFTER FIX:  ERROR: Access denied ✅ SECURE
```

**Test Case 2**: Attacker tries to read victim's fee details (email leak)

```sql
SELECT * FROM get_platform_fee_details('victim-uuid');

-- BEFORE FIX: Returns (fee, source, source_user_id, source_user_email) ❌ VULNERABLE
-- AFTER FIX:  ERROR: Access denied ✅ SECURE
```

**Test Case 3**: User reads own fee (legitimate use)

```sql
SELECT get_platform_fee_cascading(auth.uid());

-- BEFORE FIX: Works ✅
-- AFTER FIX:  Works ✅ (authorized)
```

---

## 📊 Remediation Steps

### **Immediate Actions** (Required before merge)

1. **Apply Fix Migration**:
   ```bash
   # Run migration 113
   supabase migration up
   ```

2. **Run Security Tests**:
   ```bash
   psql -f scripts/test-fee-security-vulnerability.sql
   # Expected: All unauthorized access attempts should FAIL with "Access denied"
   ```

3. **Verify in Staging**:
   - Deploy to staging environment
   - Test with non-superadmin user
   - Confirm unauthorized access blocked

4. **Code Review**:
   - Review all `SECURITY DEFINER` functions for similar issues
   - Audit all RPC endpoints exposed to `authenticated` role

### **Deployment Strategy**

**Option A: Fix Before Merge** (✅ RECOMMENDED)

```bash
# 1. Commit fix migration to feature branch
git add supabase/migrations/113_fix_cascading_fee_security.sql
git commit -m "fix(P0): Add authorization check to cascading fee RPC functions"
git push origin feature/invoice-recharges-billing

# 2. Update PR #51 with fix
# 3. Re-test in preview
# 4. Merge to master
```

**Option B: Revert Cascading Fees**

```bash
# Remove migration 112 from PR
git revert 1add15d
git push origin feature/invoice-recharges-billing
# Then create separate PR for cascading fees with fix
```

**Option C: Emergency Hotfix** (if already in production)

```bash
# Deploy fix immediately
supabase db push
# Verify exploit blocked
psql -f scripts/test-fee-security-vulnerability.sql
```

---

## 🔒 Additional Security Recommendations

### **1. Audit All SECURITY DEFINER Functions**

```sql
-- Find all SECURITY DEFINER functions
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE prosecdef = TRUE  -- SECURITY DEFINER
  AND n.nspname = 'public'
ORDER BY p.proname;
```

**Action**: Review each function for authorization checks.

### **2. Implement Least Privilege**

- Use `SECURITY INVOKER` by default (caller's permissions)
- Only use `SECURITY DEFINER` when absolutely necessary
- Always add authorization checks in `SECURITY DEFINER` functions

### **3. Add Automated Security Tests**

Create test suite to verify:
- ❌ Unauthorized user cannot access other users' data
- ✅ Authorized user can access own data
- ✅ Superadmin can access all data
- ✅ Parent can access sub-users' data

### **4. Enable Query Logging**

```sql
-- Enable RPC call logging for audit trail
ALTER FUNCTION get_platform_fee_cascading SET log_statement = 'all';
ALTER FUNCTION get_platform_fee_details SET log_statement = 'all';
```

---

## 📝 Checklist

### **Before Merging PR #51**

- [ ] Apply migration 113 (authorization fix)
- [ ] Run security test script (must fail unauthorized access)
- [ ] Test in staging environment
- [ ] Verify legitimate use cases still work (self, parent → sub-user, superadmin)
- [ ] Update PR description with security fix
- [ ] Code review by second engineer
- [ ] Confirm no other `SECURITY DEFINER` functions have similar issues

### **After Deployment**

- [ ] Monitor Sentry for "Access denied" errors (verify working correctly)
- [ ] Check Better Stack logs for suspicious RPC call patterns
- [ ] Audit database logs for unauthorized access attempts
- [ ] Update security documentation

---

## 🎯 Conclusion

**VERDICT**: 🔴 **DO NOT MERGE PR #51 WITHOUT FIX**

**Timeline**:
- **Fix Migration Created**: ✅ migration 113 ready
- **Test Script Created**: ✅ verification script ready
- **Estimated Time to Fix**: 15 minutes (apply migration + test)

**Recommendation**: Apply fix migration to PR branch, re-test, then merge.

---

## 📞 Contact

**Security Issues**: Report to security@spediresicuro.it
**Audit Questions**: Contact DevOps team

---

**Auditor**: Claude Sonnet 4.5
**Date**: 2026-01-18
**Audit Duration**: ~30 minutes
**Findings**: 1 Critical (P0)
