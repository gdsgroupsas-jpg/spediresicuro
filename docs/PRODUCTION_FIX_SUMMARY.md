# 🔧 Production Fix Summary: Shipment Creation

## 📊 Root Cause Analysis

### Evidence from Vercel Logs:

1. ✅ **Supabase insert succeeds**: "Spedizione salvata con successo"
2. ❌ **Orchestrator fails** with 3 errors:
   - **RPC error 42702**: `column reference "id" is ambiguous` in `get_courier_config_for_user`
   - **Credential decrypt error**: `Unsupported state or unable to authenticate data` (ENCRYPTION_KEY rotation)
   - **No provider config**: `No provider configuration found for provider "poste" and user id`
3. ⚠️ **user_id = null**: `getSupabaseUserIdFromEmail` returns null, shipments saved without user_id

---

## 🛠️ Fixes Applied

### 1. Fix RPC Function: Ambiguous "id" Column Reference

**File**: `supabase/migrations/031_fix_ambiguous_id_rpc.sql` (NEW)

**Problem**: Function `get_courier_config_for_user` uses unqualified `id` in subqueries, causing error 42702.

**Fix**: Qualify all column references in subqueries:

```sql
-- BEFORE: WHERE id = p_user_id
-- AFTER: WHERE u.id = p_user_id (with alias u)
```

**Deploy**: Run migration in Supabase SQL Editor or via CLI.

---

### 2. Fix Credential Decryption: ENCRYPTION_KEY Rotation

**File**: `lib/security/encryption.ts`

**Problem**: `decryptCredential()` throws generic error on ENCRYPTION_KEY rotation, crashing orchestrator.

**Fix**:

- Detect decryption errors (Unsupported state, unable to authenticate)
- Return clear error message: `CREDENTIAL_DECRYPT_FAILED` with actionable hint
- Allow graceful handling in calling code

**Changes**:

- Lines 139-151: Enhanced error handling with specific error detection
- Returns `CREDENTIAL_DECRYPT_FAILED` error for rotation scenarios

---

### 3. Fix user_id Null: NextAuth Token Fallback

**File**: `lib/database.ts`

**Problem**: `getSupabaseUserIdFromEmail()` returns null when user not found in Supabase, causing shipments with `user_id = null`.

**Fix**:

- Add `nextAuthUserId` parameter to `getSupabaseUserIdFromEmail()`
- Use `session.user.id` as fallback when Supabase user_id not found
- Update `addSpedizione()` to pass NextAuth user.id

**Changes**:

- Lines 281-366: Enhanced `getSupabaseUserIdFromEmail()` with NextAuth fallback
- Lines 678-700: Updated `addSpedizione()` to get and pass NextAuth user.id

**File**: `lib/actions/spedisci-online.ts`

**Changes**:

- Lines 128-137: Pass `session.user.id` to `getSupabaseUserIdFromEmail()`

---

### 4. Security: Remove Sensitive Payload Logging

**File**: `lib/database.ts`

**Problem**: Full payload logged in production, potentially exposing sensitive data.

**Fix**:

- Only log full payload in development
- In production, log structure with sensitive fields redacted
- Sensitive fields: `api_key`, `api_secret`, `password`, `token`, `secret`, `credential`

**Changes**:

- Lines 756-767: Conditional logging based on NODE_ENV

---

### 5. Enhanced Error Handling: RPC Fallback

**File**: `lib/couriers/factory.ts`

**Problem**: RPC error 42702 not clearly identified, causing confusion.

**Fix**:

- Detect ambiguous column error (code 42702)
- Log clear message with migration hint
- Fallback to direct query works correctly

**Changes**:

- Lines 58-66: Enhanced error detection and logging

---

## 📝 Files Changed

1. ✅ `supabase/migrations/031_fix_ambiguous_id_rpc.sql` (NEW)
2. ✅ `lib/security/encryption.ts` (Lines 139-151)
3. ✅ `lib/database.ts` (Lines 281-366, 678-700, 756-767)
4. ✅ `lib/actions/spedisci-online.ts` (Lines 128-137, 210-228)
5. ✅ `lib/couriers/factory.ts` (Lines 58-66)

---

## 🚀 Deploy Steps

### Step 1: Apply SQL Migration

**Option A: Supabase Dashboard**

1. Go to: https://supabase.com/dashboard → Your project → SQL Editor
2. Copy contents of `supabase/migrations/031_fix_ambiguous_id_rpc.sql`
3. Execute SQL
4. Verify: Function should update without errors

**Option B: Supabase CLI**

```bash
supabase db push
```

### Step 2: Deploy Code Changes

```bash
git add .
git commit -m "fix: resolve production shipment creation failures

- Fix RPC ambiguous id column reference (42702)
- Handle ENCRYPTION_KEY rotation gracefully
- Use NextAuth user.id as fallback for user_id
- Remove sensitive payload logging in production
- Enhanced error handling and logging"

git push origin master
```

### Step 3: Verify Deployment

1. Wait for Vercel deployment to complete
2. Check logs for errors
3. Run smoke tests (see below)

---

## 🧪 Smoke Test Steps

### Test 1: Create Shipment (Full Flow)

1. **Login** to production
2. **Navigate** to "Crea Spedizione"
3. **Fill form** with test data:
   - Mittente: Test Sender
   - Destinatario: Test Recipient
   - Peso: 1 kg
   - Corriere: GLS (or any available)
4. **Submit**
5. **Verify**:
   - ✅ Shipment created successfully
   - ✅ No errors in Vercel logs
   - ✅ Shipment has non-null `user_id` in database
   - ✅ Label generated (if orchestrator succeeds)

### Test 2: Verify user_id in Database

```sql
-- In Supabase SQL Editor
SELECT id, user_id, tracking_number, created_by_user_email, created_at
FROM shipments
ORDER BY created_at DESC
LIMIT 5;

-- Verify: user_id should NOT be null for new shipments
```

### Test 3: Verify RPC Function

```sql
-- Test RPC function (should not error)
SELECT * FROM get_courier_config_for_user(
  'USER_UUID_HERE'::uuid,
  'spedisci_online'
);
```

### Test 4: Verify Decryption Error Handling

**If ENCRYPTION_KEY was rotated**:

1. Try to create shipment
2. Should see clear error: `CREDENTIAL_DECRYPT_FAILED: Impossibile decriptare credenziali...`
3. Error should NOT crash the system
4. User should see actionable message

---

## 📊 Regression Checklist

- [ ] Login works (already confirmed)
- [ ] Shipment creation succeeds
- [ ] Shipments have non-null `user_id`
- [ ] RPC function `get_courier_config_for_user` works (no 42702 error)
- [ ] Decryption errors handled gracefully (if ENCRYPTION_KEY rotated)
- [ ] No sensitive data in production logs
- [ ] Multi-tenant isolation preserved (user_id scoping works)
- [ ] Label generation works (if provider configured)

---

## 🔍 Monitoring

### Log Patterns to Watch

**Success**:

```
✅ [SUPABASE] Spedizione salvata con successo! ID: ...
✅ [ORCHESTRATOR] LDV creata (method): ...
```

**Warnings (non-critical)**:

```
⚠️ [SUPABASE] Usando NextAuth user.id come fallback: ...
⚠️ [BROKER] Errore decriptazione api_secret (ENCRYPTION_KEY rotation) - continuo senza secret
```

**Errors (action required)**:

```
❌ [BROKER] Errore decriptazione api_key (ENCRYPTION_KEY rotation)
→ Action: Reconfigure integration credentials
```

---

## 🆘 Troubleshooting

### Issue: RPC still errors with 42702

**Cause**: Migration not applied

**Fix**:

1. Verify migration executed: `SELECT * FROM pg_proc WHERE proname = 'get_courier_config_for_user';`
2. Re-run migration manually

### Issue: user_id still null

**Cause**: NextAuth session.user.id not available

**Fix**:

1. Verify session structure: Check `lib/auth-config.ts` session callback
2. Verify `session.user.id` is set in token callback

### Issue: Decryption still fails

**Cause**: ENCRYPTION_KEY mismatch

**Fix**:

1. Verify ENCRYPTION_KEY in Vercel matches the one used to encrypt
2. If rotated, reconfigure integration credentials in `/dashboard/admin/configurations`

---

## ✅ Success Criteria

- ✅ Shipment creation completes end-to-end
- ✅ No RPC 42702 errors in logs
- ✅ Decryption errors handled gracefully
- ✅ All shipments have non-null user_id
- ✅ No sensitive data in production logs
- ✅ Multi-tenant isolation preserved

---

**Status**: Ready for deployment and testing
