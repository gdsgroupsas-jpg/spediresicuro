# Environment Variables Documentation

**Version:** 1.0.0
**Last Updated:** 2026-01-21
**Status:** 🟢 Active

---

## Overview

This document describes all environment variables used by SpediReSicuro, their purposes, security implications, and setup instructions.

⚠️ **SECURITY WARNING:** Never commit environment files (`.env.local`, `.env.production`) to git. Use `.env.example` as a template only.

---

## Quick Start

### 1. Copy Template

```bash
cp .env.example .env.local
```

### 2. Fill Required Values

Edit `.env.local` with your actual credentials (see sections below).

### 3. Verify Setup

```bash
npm run verify:env  # Coming soon
```

---

## Environment Files

| File              | Purpose                          | Git Tracked            | When to Use               |
| ----------------- | -------------------------------- | ---------------------- | ------------------------- |
| `.env.example`    | Template with placeholder values | ✅ Yes                 | Reference only            |
| `.env.local`      | Local development secrets        | ❌ **NEVER**           | Development               |
| `.env.production` | Production secrets               | ❌ **NEVER**           | Production (via platform) |
| `.env.test`       | Test environment                 | ✅ Yes (if no secrets) | CI/CD testing             |

---

## Required Variables

### Database (Supabase)

#### `NEXT_PUBLIC_SUPABASE_URL`

- **Required:** ✅ Yes
- **Example:** `https://abcdefghij.supabase.co`
- **Where to get:** Supabase Dashboard → Settings → API
- **Security:** 🟢 Public (safe to expose in browser)
- **Used by:** Database connection, authentication

#### `NEXT_PUBLIC_SUPABASE_ANON_KEY`

- **Required:** ✅ Yes
- **Example:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to get:** Supabase Dashboard → Settings → API
- **Security:** 🟢 Public (safe to expose, RLS protects data)
- **Used by:** Client-side database queries

#### `SUPABASE_SERVICE_ROLE_KEY`

- **Required:** ✅ Yes
- **Example:** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- **Where to get:** Supabase Dashboard → Settings → API
- **Security:** 🔴 **SECRET** (bypasses RLS - NEVER expose to browser)
- **Used by:** Server-side admin operations

⚠️ **CRITICAL:** `SUPABASE_SERVICE_ROLE_KEY` must ONLY be used server-side. Never send to browser.

---

### Authentication (NextAuth)

#### `NEXTAUTH_URL`

- **Required:** ✅ Yes
- **Example (dev):** `http://localhost:3000`
- **Example (prod):** `https://spediresicuro.com`
- **Where to get:** Your deployment URL
- **Security:** 🟢 Public
- **Used by:** OAuth callbacks, session management

#### `NEXTAUTH_SECRET`

- **Required:** ✅ Yes
- **Example:** `7f8a9b0c1d2e3f4g5h6i7j8k9l0m1n2o`
- **Where to get:** Generate with `openssl rand -base64 32`
- **Security:** 🔴 **SECRET** (used to encrypt session tokens)
- **Used by:** Session encryption, JWT signing
- **Rotation:** Change requires re-login for all users

**Generate:**

```bash
openssl rand -base64 32
```

---

## API Key Authentication (Optional)

⚠️ **NEW FEATURE:** API key authentication for external integrations.

### `ENABLE_API_KEY_AUTH`

- **Required:** ❌ No (default: `false`)
- **Type:** Boolean (`true` or `false`)
- **Example:** `true`
- **Purpose:** Enable/disable API key authentication
- **Used by:** Middleware auth logic

**When to enable:**

- ✅ You need server-to-server API integrations
- ✅ External partners need programmatic access
- ✅ You want to offer public API access

**When to disable:**

- ✅ Browser-only application (cookie auth sufficient)
- ✅ Testing/staging environments (unless testing API keys)
- ✅ Emergency rollback scenario

### `API_KEY_SHADOW_MODE`

- **Required:** ❌ No (default: `false`)
- **Type:** Boolean (`true` or `false`)
- **Example:** `true`
- **Purpose:** Log API keys but don't enforce (testing mode)
- **Used by:** Middleware auth logic

**Use cases:**

- ✅ Testing API key auth in production without blocking traffic
- ✅ Validating API key implementation before full rollout
- ✅ Monitoring API key usage patterns

**Behavior:**

- `true`: Invalid API keys are logged but requests proceed
- `false`: Invalid API keys are rejected with 401

### `API_KEY_SALT`

- **Required:** ✅ **YES** (if `ENABLE_API_KEY_AUTH=true`)
- **Example:** `Kx8vZn2Qm9wR4tYp3Lc7Fg5Hs6Jk1Mn0pQrStUvWxYz==`
- **Where to get:** Generate with `openssl rand -base64 32`
- **Security:** 🔴 **CRITICAL SECRET**
- **Used by:** Hashing API keys for storage

⚠️ **CRITICAL SECURITY NOTES:**

1. **Never commit to git** - This salt is the master secret for all API keys
2. **Minimum 32 characters** - Shorter salts are insecure
3. **Unique per environment** - Dev/staging/prod should use different salts
4. **Rotation breaks everything** - Changing salt invalidates ALL API keys
5. **Store securely** - Use environment variable manager (Vercel/Railway secrets)

**Generate:**

```bash
openssl rand -base64 32
```

**Rotation procedure** (if compromised):

1. Generate new salt
2. Notify all API key users (minimum 7 days notice)
3. Update `API_KEY_SALT` in environment
4. Revoke all old keys in database
5. Users must regenerate keys

### `API_KEY_DEFAULT_RATE_LIMIT`

- **Required:** ❌ No (default: `1000`)
- **Type:** Integer (requests per hour)
- **Example:** `500`
- **Purpose:** Default rate limit for new API keys
- **Used by:** Rate limiting middleware

**Recommendations:**

- Development: `10000` (permissive)
- Production: `1000` (balanced)
- Public API: `100` (conservative)
- Enterprise: Custom per key in database

### `API_KEY_DEFAULT_EXPIRY_DAYS`

- **Required:** ❌ No (default: `90`)
- **Type:** Integer (days)
- **Example:** `30`
- **Purpose:** Auto-expire API keys after N days
- **Used by:** API key creation

**Recommendations:**

- High security: `30` days (monthly rotation)
- Standard: `90` days (quarterly rotation)
- Low risk: `365` days (annual rotation)
- Internal tools: `null` (never expire)

---

## Optional Variables

### `LOG_LEVEL`

- **Default:** `info`
- **Options:** `debug`, `info`, `warn`, `error`
- **Example:** `debug`
- **Purpose:** Control logging verbosity

### `SENTRY_DSN`

- **Default:** None (error tracking disabled)
- **Example:** `https://abc123@o123456.ingest.sentry.io/7890123`
- **Purpose:** Error tracking and monitoring
- **Where to get:** Sentry.io project settings

---

## Environment-Specific Configuration

### Local Development (`.env.local`)

```env
# Use localhost URLs
NEXTAUTH_URL=http://localhost:3000

# Use test/development Supabase project
NEXT_PUBLIC_SUPABASE_URL=https://dev-project.supabase.co

# Enable debug logging
LOG_LEVEL=debug

# API key auth disabled (unless testing)
ENABLE_API_KEY_AUTH=false
```

### Staging

```env
# Use staging domain
NEXTAUTH_URL=https://staging.spediresicuro.com

# Use staging Supabase project
NEXT_PUBLIC_SUPABASE_URL=https://staging-project.supabase.co

# Enable API key auth in shadow mode (testing)
ENABLE_API_KEY_AUTH=true
API_KEY_SHADOW_MODE=true
API_KEY_SALT=<staging-specific-salt>

# Standard logging
LOG_LEVEL=info
```

### Production

```env
# Use production domain
NEXTAUTH_URL=https://spediresicuro.com

# Use production Supabase project
NEXT_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co

# Enable API key auth (enforced)
ENABLE_API_KEY_AUTH=true
API_KEY_SHADOW_MODE=false
API_KEY_SALT=<production-secret-salt>

# Conservative rate limits
API_KEY_DEFAULT_RATE_LIMIT=500

# Error-only logging (performance)
LOG_LEVEL=error

# Enable monitoring
SENTRY_DSN=https://...
```

---

## Platform-Specific Setup

### Vercel

#### Via Dashboard

1. Go to Project Settings → Environment Variables
2. Add each variable with appropriate scope (Production/Preview/Development)
3. For secrets, mark as "Sensitive"

#### Via CLI

```bash
# Add secret
vercel env add API_KEY_SALT production
# Paste value when prompted

# Add non-secret
vercel env add ENABLE_API_KEY_AUTH production
# Enter: true

# List all variables
vercel env ls
```

### Railway

#### Via Dashboard

1. Go to Project → Variables
2. Add variables as key-value pairs
3. Click "Deploy" to apply

#### Via CLI

```bash
# Set variable
railway variables set API_KEY_SALT=<your-salt>
railway variables set ENABLE_API_KEY_AUTH=true

# List variables
railway variables

# Link to environment
railway environment production
```

### Docker / Self-Hosted

**docker-compose.yml:**

```yaml
services:
  web:
    image: spediresicuro:latest
    env_file:
      - .env.production # Never commit this file
    environment:
      - NODE_ENV=production
      - ENABLE_API_KEY_AUTH=true
```

**Kubernetes Secret:**

```bash
kubectl create secret generic spediresicuro-env \
  --from-literal=API_KEY_SALT=<your-salt> \
  --from-literal=NEXTAUTH_SECRET=<your-secret>
```

---

## Security Best Practices

### ✅ DO

1. **Use strong secrets**

   ```bash
   # ✅ Good: Cryptographically secure
   openssl rand -base64 32

   # ❌ Bad: Predictable
   API_KEY_SALT=password123
   ```

2. **Different secrets per environment**
   - Dev salt ≠ Staging salt ≠ Production salt
   - Compromise of dev doesn't affect production

3. **Rotate secrets periodically**
   - `NEXTAUTH_SECRET`: Every 6 months
   - `API_KEY_SALT`: Only if compromised (breaks keys)
   - `SUPABASE_SERVICE_ROLE_KEY`: Only if compromised

4. **Use environment variable managers**
   - Vercel Environment Variables
   - Railway Variables
   - AWS Secrets Manager
   - HashiCorp Vault

5. **Audit access**
   - Track who has access to production secrets
   - Remove access for former team members
   - Use principle of least privilege

### ❌ DON'T

1. **Never commit secrets to git**

   ```bash
   # ❌ Bad
   git add .env.local

   # ✅ Good
   # .env.local is in .gitignore
   ```

2. **Never hardcode secrets**

   ```typescript
   // ❌ Bad
   const salt = 'abc123';

   // ✅ Good
   const salt = process.env.API_KEY_SALT;
   ```

3. **Never share secrets via insecure channels**
   - ❌ Email
   - ❌ Slack messages
   - ❌ SMS
   - ✅ 1Password / LastPass shared vaults
   - ✅ Encrypted communication (PGP)

4. **Never use production secrets in development**
   - Accidental data deletion
   - Debugging exposes secrets
   - Local logs may leak secrets

5. **Never log secrets**

   ```typescript
   // ❌ Bad
   console.log('API Key:', apiKey);

   // ✅ Good
   console.log('API Key:', apiKey.substring(0, 8) + '...');
   ```

---

## Troubleshooting

### "API_KEY_SALT not configured"

**Cause:** `ENABLE_API_KEY_AUTH=true` but `API_KEY_SALT` not set

**Fix:**

```bash
# Generate salt
openssl rand -base64 32

# Set in .env.local (dev) or platform dashboard (prod)
API_KEY_SALT=<generated-value>
```

### "NEXTAUTH_SECRET not configured"

**Cause:** Missing required NextAuth secret

**Fix:**

```bash
openssl rand -base64 32
# Add to NEXTAUTH_SECRET
```

### "Supabase connection failed"

**Cause:** Invalid Supabase credentials

**Fix:**

1. Verify URL in Supabase Dashboard → Settings → API
2. Check project is not paused
3. Verify anon key is correct (starts with `eyJ...`)

### Environment variables not updating

**Platform-specific fixes:**

**Vercel:**

```bash
# Redeploy to pick up new variables
vercel --prod
```

**Railway:**

```bash
# Variables apply automatically, but may need restart
railway restart
```

**Local:**

```bash
# Restart dev server
npm run dev
```

---

## Validation Script

**Coming soon:** `npm run verify:env`

Will check:

- ✅ All required variables present
- ✅ Secret strength (minimum length)
- ✅ Format validation (URLs, keys)
- ✅ Supabase connectivity
- ⚠️ Warnings for weak secrets

---

## Emergency Procedures

### API Key System Compromised

1. **Immediate:** Disable API key auth

   ```bash
   ENABLE_API_KEY_AUTH=false
   # Redeploy (takes ~30 seconds)
   ```

2. **Within 1 hour:** Revoke all keys

   ```sql
   UPDATE api_keys SET revoked_at = NOW();
   ```

3. **Within 24 hours:**
   - Generate new `API_KEY_SALT`
   - Notify all API key users
   - Establish new key issuance process

### NextAuth Secret Compromised

1. **Immediate:** Generate new secret

   ```bash
   openssl rand -base64 32
   # Update NEXTAUTH_SECRET
   ```

2. **Impact:** All users logged out (need to re-login)

3. **Communication:** Email users about forced logout

### Supabase Service Role Key Compromised

1. **Immediate:** Rotate key in Supabase Dashboard
2. **Update:** All environments with new key
3. **Monitor:** Database audit logs for suspicious activity

---

## Related Documentation

- [API Key Authentication Implementation](./API_KEY_AUTH_IMPLEMENTATION.md)
- [Security Best Practices](./SECURITY.md)
- [Deployment Guide](./DEPLOYMENT.md)

---

**Document Status:** 🟢 Complete and reviewed
**Next Review:** 2026-04-21 (quarterly)
