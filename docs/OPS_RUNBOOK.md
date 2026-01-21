# 🚀 Operations Runbook

## Deployment Checklist

### Pre-Deploy

- [ ] Run all tests: `npm test`
- [ ] Run type checking: `npm run type-check`
- [ ] Run linting: `npm run lint`
- [ ] Verify migrations are idempotent (can run multiple times safely)
- [ ] Check for hardcoded secrets or credentials
- [ ] Review environment variables changes (update Vercel if needed)
- [ ] Verify database backup is recent (< 24h old)

### Deploy Steps (Vercel)

1. **Merge to main branch** - Triggers automatic deployment
2. **Monitor build logs** - Check for errors in Vercel dashboard
3. **Wait for deployment** - Typically 2-5 minutes
4. **Verify deployment URL** - Check preview URL before promoting
5. **Promote to production** - Click "Promote to Production" if preview looks good

### Post-Deploy Verification

- [ ] Run smoke tests: `npm run test:smoke` (if available)
- [ ] Check `/api/health` endpoint returns 200
- [ ] Login as test user and verify dashboard loads
- [ ] Create a test shipment (draft mode, don't submit to courier)
- [ ] Verify wallet balance displays correctly
- [ ] Check error monitoring for new errors (last 15 minutes)
- [ ] Monitor server logs for anomalies

### Rollback Procedure

If deployment causes critical issues:

1. **Immediate:** Revert in Vercel dashboard
   - Go to Deployments → Find previous working deployment
   - Click "..." → "Promote to Production"

2. **Database migrations:** If migration caused issue
   - Check if migration has rollback script
   - If yes: Run rollback migration
   - If no: Manual intervention required (contact DBA)

3. **Notify team:** Post in #incidents channel with details

---

## Environment Variables

### Production Environment Variables (Vercel)

#### Critical (P0 - App won't work without these)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project-ref].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]  # ⚠️ NEVER expose client-side

# Auth
NEXTAUTH_URL=https://spediresicuro.it
NEXTAUTH_SECRET=[random-32-char-string]  # ⚠️ Rotate on compromise

# Encryption
ENCRYPTION_KEY=[random-32-char-string]  # ⚠️ Used for courier credentials
```

#### Important (P1 - Features degraded without these)

```bash
# AI (Gemini)
GOOGLE_API_KEY=[gemini-api-key]  # For AI Anne features

# Payments (XPay)
XPAY_BO_API_KEY=[xpay-key]
XPAY_TERMINAL_ID=[terminal-id]

# OAuth (Optional)
GOOGLE_CLIENT_ID=[google-oauth-id]
GOOGLE_CLIENT_SECRET=[google-oauth-secret]
GITHUB_CLIENT_ID=[github-oauth-id]
GITHUB_CLIENT_SECRET=[github-oauth-secret]
```

#### Optional (P2 - Nice to have)

```bash
# Monitoring
DIAGNOSTICS_TOKEN=[diagnostics-token]

# Automation Service
AUTOMATION_SERVICE_TOKEN=[automation-token]
AUTOMATION_SERVICE_URL=https://automation.spediresicuro.it

# Impersonation
IMPERSONATION_COOKIE_NAME=impersonate-context  # Default
IMPERSONATION_TTL=3600  # Default (1 hour)
```

### How to Update Environment Variables

**Vercel:**

1. Go to project settings → Environment Variables
2. Add/Edit variable
3. Choose environment: Production, Preview, Development
4. Click "Save"
5. **Redeploy** to apply changes (automatic on next commit, or manual redeploy)

**Local Development:**

1. Edit `.env.local` (never commit this file!)
2. Restart dev server: `npm run dev`

---

## Database Migrations

### Running Migrations (Production)

**Method 1: Supabase Dashboard (Recommended for small changes)**

1. Go to Supabase Dashboard → SQL Editor
2. Copy migration SQL file content
3. Run SQL
4. Verify output (check for errors)

**Method 2: Supabase CLI (Recommended for complex migrations)**

```bash
# Link to production project
npx supabase link --project-ref [project-ref]

# Push migrations
npx supabase db push

# Verify migration applied
npx supabase migration list
```

### Migration Best Practices

- **Always test locally first** with `npx supabase db reset`
- **Idempotent:** Use `IF NOT EXISTS`, `IF EXISTS`, `DO $$ BEGIN ... END $$`
- **Backward compatible:** Don't drop columns immediately (deprecate first)
- **Small commits:** One logical change per migration
- **Rollback plan:** Include rollback script in comments or separate file

### Emergency: Rollback Migration

```sql
-- If migration added a column
ALTER TABLE users DROP COLUMN IF EXISTS new_column;

-- If migration created a function
DROP FUNCTION IF EXISTS function_name(args);

-- If migration created a table
DROP TABLE IF EXISTS new_table CASCADE;

-- If migration modified data (no easy rollback - restore from backup)
-- Contact DBA immediately
```

---

## Cron Jobs & Background Tasks

### Active Cron Jobs

#### 1. Doctor Service Health Check

**Schedule:** Every 15 minutes  
**Endpoint:** `/api/cron/doctor-check`  
**Purpose:** Monitors automation service health, detects failures  
**Auth:** Requires `CRON_SECRET` header

**Monitor:**

```sql
SELECT * FROM diagnostics_events
WHERE event_type = 'automation_health_check'
ORDER BY created_at DESC
LIMIT 10;
```

#### 2. Session Cleanup (if implemented)

**Schedule:** Daily at 02:00 UTC  
**Endpoint:** `/api/cron/cleanup-sessions`  
**Purpose:** Remove expired sessions and impersonation cookies

#### 3. Wallet Transaction Reconciliation (planned)

**Schedule:** Daily at 03:00 UTC  
**Purpose:** Verify wallet_balance matches sum of wallet_transactions

**Manual trigger:**

```sql
-- Check for discrepancies
SELECT
  u.id,
  u.email,
  u.wallet_balance AS current_balance,
  COALESCE(SUM(wt.amount), 0) AS calculated_balance,
  u.wallet_balance - COALESCE(SUM(wt.amount), 0) AS discrepancy
FROM users u
LEFT JOIN wallet_transactions wt ON wt.user_id = u.id
GROUP BY u.id, u.email, u.wallet_balance
HAVING ABS(u.wallet_balance - COALESCE(SUM(wt.amount), 0)) > 0.01;
```

---

## Incident Response Playbooks

### Incident: Database Connection Errors

**Symptoms:** 500 errors, "Database connection failed" in logs

**Investigation:**

1. Check Supabase dashboard status
2. Verify connection pool not exhausted
3. Check for long-running queries: `SELECT * FROM pg_stat_activity WHERE state = 'active' AND query_start < NOW() - INTERVAL '1 minute'`

**Resolution:**

1. Kill long-running queries if found: `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE ...`
2. Restart connection pool (redeploy app if persistent)
3. Contact Supabase support if issue persists

**Prevention:**

- Add connection pool monitoring
- Set query timeout limits
- Review slow queries and add indexes

---

### Incident: User Cannot Login

**Symptoms:** "Invalid credentials" or redirect loops

**Investigation:**

1. Check user exists: `SELECT id, email, role FROM users WHERE email = '[user-email]'`
2. Check NextAuth logs in Vercel
3. Verify `NEXTAUTH_URL` matches production domain
4. Check if user is locked/disabled

**Resolution:**

1. If user not found: User may have used different email (check variations)
2. If redirect loop: Clear cookies, check `NEXTAUTH_URL` config
3. If locked: Unlock user manually: `UPDATE users SET locked = false WHERE email = '[email]'`

**Prevention:**

- Add better error messages for auth failures
- Log auth attempts to audit_logs

---

### Incident: Wallet Balance Incorrect

**Symptoms:** User reports wrong balance

**Investigation:**

1. Get user wallet data:

```sql
SELECT
  u.id,
  u.email,
  u.wallet_balance,
  (SELECT COUNT(*) FROM wallet_transactions WHERE user_id = u.id) AS tx_count,
  (SELECT SUM(amount) FROM wallet_transactions WHERE user_id = u.id) AS calculated_balance
FROM users u
WHERE u.email = '[user-email]';
```

2. Check recent transactions:

```sql
SELECT * FROM wallet_transactions
WHERE user_id = '[user-id]'
ORDER BY created_at DESC
LIMIT 20;
```

3. Check for failed transactions or duplicates

**Resolution:**

1. If balance != calculated: Manual correction needed

   ```sql
   -- Fix balance to match transactions
   UPDATE users
   SET wallet_balance = (SELECT SUM(amount) FROM wallet_transactions WHERE user_id = '[user-id]')
   WHERE id = '[user-id]';
   ```

2. Document correction in audit_logs
3. Investigate root cause (trigger failure? race condition?)

**Prevention:**

- Add daily reconciliation cron job
- Add constraint to prevent manual balance updates
- Ensure all debits/credits go through RPC functions

---

### Incident: Shipment Creation Fails

**Symptoms:** 500 error on shipment creation, orphan shipments

**Investigation:**

1. Check compensation_queue for failed attempts:

```sql
SELECT * FROM compensation_queue
WHERE status = 'PENDING'
ORDER BY created_at DESC
LIMIT 10;
```

2. Check courier API logs
3. Check wallet balance sufficient
4. Check RLS policies not blocking

**Resolution:**

1. If courier API failed: Retry manually via admin UI
2. If wallet insufficient: Add credit or notify user
3. If orphan shipment: Use compensation queue to cleanup

**Prevention:**

- Improve error handling in shipment creation
- Add retry logic for transient failures
- Monitor compensation queue

---

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Error Rate**
   - Source: Vercel logs, Supabase logs
   - Threshold: >5% of requests
   - Alert: Slack/Email

2. **Response Time**
   - Source: Vercel Analytics
   - Threshold: P95 > 2 seconds
   - Alert: Slack

3. **Database Connection Pool**
   - Source: Supabase dashboard
   - Threshold: >80% utilization
   - Alert: Email

4. **Failed Shipments**
   - Source: `compensation_queue` table
   - Threshold: >10 pending items
   - Query:

   ```sql
   SELECT COUNT(*) FROM compensation_queue WHERE status = 'PENDING';
   ```

5. **Wallet Discrepancies**
   - Source: Daily reconciliation job
   - Threshold: Any discrepancy >€0.01
   - Alert: Email to finance team

### Log Locations

**Application Logs:** Vercel Dashboard → Logs  
**Database Logs:** Supabase Dashboard → Logs  
**Audit Logs:** `audit_logs` table in database  
**Diagnostics:** `diagnostics_events` table

---

## Security Operations

### Rotating Secrets

**When to rotate:**

- NEXTAUTH_SECRET: Every 90 days OR on suspected compromise
- SUPABASE_SERVICE_ROLE_KEY: On suspected compromise only (complex rotation)
- ENCRYPTION_KEY: Never (would require re-encrypting all data)
- Courier API keys: On expiration or compromise

**How to rotate NEXTAUTH_SECRET:**

1. Generate new secret: `openssl rand -base64 32`
2. Update in Vercel environment variables
3. Redeploy application
4. All users will be logged out (expected)

**How to rotate courier API keys:**

1. Update key in courier portal
2. Update `courier_configs` table via admin UI
3. Test with dummy shipment
4. Monitor for 24h

### Security Audit Queries

**Check for unauthorized impersonation attempts:**

```sql
SELECT * FROM audit_logs
WHERE action LIKE 'impersonation_%'
  AND created_at > NOW() - INTERVAL '7 days'
ORDER BY created_at DESC;
```

**Check for failed login attempts:**

```sql
SELECT * FROM audit_logs
WHERE action = 'USER_LOGIN_FAILED'
  AND created_at > NOW() - INTERVAL '1 day'
GROUP BY user_email
HAVING COUNT(*) > 5;
```

**Check for privilege escalation attempts:**

```sql
SELECT * FROM audit_logs
WHERE action = 'USER_ROLE_CHANGED'
  AND created_at > NOW() - INTERVAL '30 days'
ORDER BY created_at DESC;
```

---

## Performance Optimization

### Database Indexes

**Check missing indexes:**

```sql
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 100
  AND correlation < 0.1
ORDER BY tablename, attname;
```

**Check slow queries:**

```sql
SELECT query, calls, total_time, mean_time
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Cache Strategy

**Currently caching:**

- User profiles (5 minute TTL)
- Courier configs (15 minute TTL)
- Price lists (1 hour TTL)

**Not cached (dynamic):**

- Wallet balance
- Shipment status
- Audit logs

---

**Document Owner:** DevOps Team  
**Last Updated:** December 21, 2025  
**Review Cycle:** Monthly
