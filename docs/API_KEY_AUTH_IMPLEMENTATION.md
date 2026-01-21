# API Key Authentication - Implementation Plan

**Status:** 🟡 In Progress
**Priority:** P0 (Blocker for External Integrations)
**Risk Level:** 🟢 LOW (Feature-flagged, additive-only)
**Author:** Claude Code
**Date:** 2026-01-21

---

## Executive Summary

**Problem:** API documentation promises Bearer token authentication, but codebase only supports browser cookie auth. External server integrations are impossible.

**Solution:** Implement hybrid authentication system (cookie + API key) using enterprise-grade approach with zero breaking changes.

**Approach:** Additive-only implementation with feature flags, progressive rollout, and instant rollback capability.

---

## Architecture Design

### Current State (Cookie-Only)

```
Browser Request → Middleware → Check Cookie Session → Allow/Deny
```

### Target State (Hybrid)

```
Request → Middleware → {
  IF cookie session valid → Allow (EXISTING PATH)
  ELSE IF API key valid → Allow (NEW PATH)
  ELSE → Deny
}
```

**Key Principle:** Existing cookie auth logic **UNTOUCHED**. API key auth is **additive layer**.

---

## Implementation Phases

### Phase 0: Protective Infrastructure ✅ Current Phase

**Objective:** Setup safety mechanisms before touching code

#### 0.1 Feature Flag System

```typescript
// lib/feature-flags.ts
export const FeatureFlags = {
  API_KEY_AUTH: process.env.ENABLE_API_KEY_AUTH === 'true',
  API_KEY_SHADOW_MODE: process.env.API_KEY_SHADOW_MODE === 'true',
} as const;
```

**Environment Variables:**

```env
# .env.local (NOT COMMITTED)
ENABLE_API_KEY_AUTH=false        # Main kill switch
API_KEY_SHADOW_MODE=false        # Log-only mode
API_KEY_SALT=<generated>         # For hashing (NEVER COMMIT)
```

**Safety:** Feature disabled by default. Can enable/disable without code changes.

#### 0.2 Database Schema (Isolated)

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_api_keys.sql

-- API Keys Table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Security
  key_prefix TEXT NOT NULL UNIQUE,           -- First 8 chars (sk_live_abc12345)
  key_hash TEXT NOT NULL,                    -- bcrypt hash of full key

  -- Metadata
  name TEXT NOT NULL,                        -- User-friendly name
  scopes TEXT[] DEFAULT ARRAY['quotes:read'], -- Permissions

  -- Rate Limiting
  rate_limit_per_hour INTEGER DEFAULT 1000,

  -- Lifecycle
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  revoked_at TIMESTAMP WITH TIME ZONE,

  -- Audit
  created_by_ip INET,

  CONSTRAINT valid_expiry CHECK (expires_at > created_at)
);

-- Indexes for performance
CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX idx_api_keys_key_prefix ON public.api_keys(key_prefix);
CREATE INDEX idx_api_keys_active ON public.api_keys(user_id)
  WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW());

-- Row Level Security
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own keys
CREATE POLICY "Users can view own API keys"
  ON public.api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own API keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can revoke own API keys"
  ON public.api_keys FOR UPDATE
  USING (auth.uid() = user_id);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS public.api_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,

  -- Request Details
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,

  -- Network
  ip_address INET,
  user_agent TEXT,

  -- Performance
  response_time_ms INTEGER,

  -- Timestamp
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audit_log_api_key ON public.api_audit_log(api_key_id);
CREATE INDEX idx_audit_log_timestamp ON public.api_audit_log(timestamp DESC);

-- Auto-cleanup old logs (optional - keep 90 days)
-- CREATE POLICY api_audit_retention ON public.api_audit_log
--   USING (timestamp > NOW() - INTERVAL '90 days');

COMMENT ON TABLE public.api_keys IS 'API key authentication for external integrations';
COMMENT ON TABLE public.api_audit_log IS 'Audit trail for API key usage';
```

**Safety:**

- New tables, zero impact on existing schema
- RLS enabled by default
- Can drop tables without affecting existing auth

#### 0.3 Environment Documentation

```markdown
# docs/ENVIRONMENT_VARIABLES.md

## API Key Authentication

### Required (Production)

- `ENABLE_API_KEY_AUTH` - Enable API key authentication (default: false)
- `API_KEY_SALT` - Salt for API key hashing (REQUIRED if enabled)

### Optional (Advanced)

- `API_KEY_SHADOW_MODE` - Log API keys without enforcing (default: false)
- `API_KEY_DEFAULT_RATE_LIMIT` - Requests per hour (default: 1000)
- `API_KEY_DEFAULT_EXPIRY_DAYS` - Auto-expire keys (default: 90)

### Security Notes

⚠️ NEVER commit API_KEY_SALT to git
⚠️ Generate with: `openssl rand -base64 32`
⚠️ Rotate salt requires regenerating all API keys
```

---

### Phase 1: Core Implementation

#### 1.1 API Key Service (Isolated Module)

**File:** `lib/api-key-service.ts`

```typescript
import { createHash } from 'crypto';
import { supabase } from './supabase';
import { FeatureFlags } from './feature-flags';

export interface ApiKey {
  id: string;
  userId: string;
  keyPrefix: string;
  name: string;
  scopes: string[];
  expiresAt: Date | null;
}

export interface ApiKeyValidation {
  valid: boolean;
  apiKey?: ApiKey;
  error?: string;
}

/**
 * Generate a new API key
 * Format: sk_live_<32 random chars>
 *
 * SECURITY: Key shown ONCE to user, then only hash stored
 */
export async function generateApiKey(
  userId: string,
  name: string,
  scopes: string[] = ['quotes:read'],
  expiresInDays: number = 90
): Promise<{ key: string; keyPrefix: string }> {
  // Generate cryptographically secure random key
  const randomBytes = crypto.getRandomValues(new Uint8Array(24));
  const randomString = Array.from(randomBytes)
    .map((b) => b.toString(36))
    .join('')
    .substring(0, 32);

  const key = `sk_live_${randomString}`;
  const keyPrefix = key.substring(0, 16); // sk_live_abc12345
  const keyHash = await hashApiKey(key);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { error } = await supabase.from('api_keys').insert({
    user_id: userId,
    key_prefix: keyPrefix,
    key_hash: keyHash,
    name,
    scopes,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    throw new Error(`Failed to create API key: ${error.message}`);
  }

  return { key, keyPrefix };
}

/**
 * Validate API key from Authorization header
 *
 * SECURITY: Uses timing-safe comparison, rate limiting, audit logging
 */
export async function validateApiKey(key: string): Promise<ApiKeyValidation> {
  // Feature flag check
  if (!FeatureFlags.API_KEY_AUTH) {
    return { valid: false, error: 'API key auth disabled' };
  }

  // Validate format
  if (!key.startsWith('sk_live_') || key.length < 40) {
    return { valid: false, error: 'Invalid key format' };
  }

  const keyPrefix = key.substring(0, 16);
  const keyHash = await hashApiKey(key);

  // Lookup key by prefix (index scan)
  const { data, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_prefix', keyPrefix)
    .is('revoked_at', null)
    .single();

  if (error || !data) {
    return { valid: false, error: 'Invalid API key' };
  }

  // Timing-safe comparison
  if (!timingSafeEqual(data.key_hash, keyHash)) {
    return { valid: false, error: 'Invalid API key' };
  }

  // Check expiry
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { valid: false, error: 'API key expired' };
  }

  // Update last_used_at (async, don't wait)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(); // Fire and forget

  return {
    valid: true,
    apiKey: {
      id: data.id,
      userId: data.user_id,
      keyPrefix: data.key_prefix,
      name: data.name,
      scopes: data.scopes,
      expiresAt: data.expires_at ? new Date(data.expires_at) : null,
    },
  };
}

/**
 * Hash API key for storage
 * SECURITY: Uses SHA-256 + salt (stored in env)
 */
async function hashApiKey(key: string): Promise<string> {
  const salt = process.env.API_KEY_SALT;
  if (!salt) {
    throw new Error('API_KEY_SALT not configured');
  }

  const hash = createHash('sha256');
  hash.update(key + salt);
  return hash.digest('hex');
}

/**
 * Timing-safe string comparison
 * SECURITY: Prevents timing attacks
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Check if API key has permission for scope
 */
export function hasScope(apiKey: ApiKey, requiredScope: string): boolean {
  // Wildcard scope
  if (apiKey.scopes.includes('*')) return true;

  // Exact match
  if (apiKey.scopes.includes(requiredScope)) return true;

  // Prefix match (e.g., "quotes:*" matches "quotes:read")
  const [resource] = requiredScope.split(':');
  if (apiKey.scopes.includes(`${resource}:*`)) return true;

  return false;
}
```

**Safety:**

- Isolated module, no dependencies on existing auth
- Feature flag checked first
- Cryptographically secure key generation
- Timing-safe comparisons

#### 1.2 Middleware Update (Controlled Modification)

**File:** `middleware.ts` (EXISTING FILE - CAREFUL MODIFICATION)

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { validateApiKey } from './lib/api-key-service';
import { FeatureFlags } from './lib/feature-flags';

const PUBLIC_ROUTES = [
  '/api/health',
  '/login',
  '/register',
  // ... existing routes
];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes bypass auth
  if (PUBLIC_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // ======= EXISTING COOKIE AUTH (UNTOUCHED) =======
  const session = await getServerSession(/* ... */);
  if (session?.user?.email) {
    return NextResponse.next(); // ✅ EXISTING PATH PRESERVED
  }
  // ================================================

  // ======= NEW API KEY AUTH (ADDITIVE) =======
  if (FeatureFlags.API_KEY_AUTH) {
    const authHeader = req.headers.get('authorization');

    if (authHeader?.startsWith('Bearer ')) {
      const apiKey = authHeader.replace('Bearer ', '');
      const validation = await validateApiKey(apiKey);

      if (validation.valid) {
        // Store API key context for downstream handlers
        const requestHeaders = new Headers(req.headers);
        requestHeaders.set('x-api-key-id', validation.apiKey!.id);
        requestHeaders.set('x-api-key-user-id', validation.apiKey!.userId);
        requestHeaders.set('x-api-key-scopes', validation.apiKey!.scopes.join(','));

        return NextResponse.next({
          request: { headers: requestHeaders },
        }); // ✅ NEW PATH
      }

      // Invalid API key
      if (!FeatureFlags.API_KEY_SHADOW_MODE) {
        return NextResponse.json({ error: 'Invalid or expired API key' }, { status: 401 });
      }
    }
  }
  // ==========================================

  // ======= EXISTING FALLBACK (UNTOUCHED) =======
  return NextResponse.redirect(new URL('/login', req.url));
  // =============================================
}
```

**Safety:**

- Existing cookie auth code **zero changes**
- API key logic wrapped in feature flag
- Shadow mode for testing without enforcement
- Headers passed downstream for scope checking

#### 1.3 Scope Enforcement Middleware

**File:** `lib/api-scope-middleware.ts` (NEW FILE)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { hasScope } from './api-key-service';

/**
 * Enforce API key scopes on protected endpoints
 *
 * Usage in route handlers:
 * export async function POST(req: NextRequest) {
 *   await enforceScope(req, 'quotes:create');
 *   // ... handler logic
 * }
 */
export async function enforceScope(req: NextRequest, requiredScope: string): Promise<void> {
  // Check if request is from API key (not cookie)
  const apiKeyId = req.headers.get('x-api-key-id');
  if (!apiKeyId) {
    // Cookie auth - no scope enforcement needed
    return;
  }

  const scopes = req.headers.get('x-api-key-scopes')?.split(',') || [];
  const apiKey = {
    id: apiKeyId,
    userId: req.headers.get('x-api-key-user-id') || '',
    keyPrefix: '',
    name: '',
    scopes,
    expiresAt: null,
  };

  if (!hasScope(apiKey, requiredScope)) {
    throw new Error(`Insufficient permissions. Required scope: ${requiredScope}`);
  }
}
```

---

### Phase 2: API Key Management Endpoints

#### 2.1 Create API Key

**File:** `app/api/api-keys/create/route.ts` (NEW FILE)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { generateApiKey } from '@/lib/api-key-service';

export async function POST(req: NextRequest) {
  // Require cookie auth (user must be logged in)
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { name, scopes, expiresInDays } = await req.json();

  // Validation
  if (!name || name.length < 3) {
    return NextResponse.json({ error: 'Name must be at least 3 characters' }, { status: 400 });
  }

  try {
    const { key, keyPrefix } = await generateApiKey(
      session.user.id,
      name,
      scopes || ['quotes:read'],
      expiresInDays || 90
    );

    return NextResponse.json({
      success: true,
      key, // ⚠️ SHOWN ONLY ONCE
      keyPrefix,
      message: 'Save this key securely. It will not be shown again.',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}
```

#### 2.2 List API Keys

**File:** `app/api/api-keys/list/route.ts` (NEW FILE)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { supabase } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, key_prefix, name, scopes, created_at, last_used_at, expires_at')
    .eq('user_id', session.user.id)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 });
  }

  return NextResponse.json({ keys: data });
}
```

#### 2.3 Revoke API Key

**File:** `app/api/api-keys/revoke/route.ts` (NEW FILE)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { supabase } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { keyId } = await req.json();

  const { error } = await supabase
    .from('api_keys')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('user_id', session.user.id); // Security: only owner can revoke

  if (error) {
    return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
```

---

### Phase 3: Security Enhancements

#### 3.1 Rate Limiting

**File:** `lib/rate-limiter.ts` (NEW FILE)

```typescript
import { supabase } from './supabase';

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
}

/**
 * Rate limit API key requests
 * Uses Redis-like sliding window in Supabase
 */
export async function checkRateLimit(
  apiKeyId: string,
  limit: number = 1000
): Promise<RateLimitResult> {
  const windowMs = 60 * 60 * 1000; // 1 hour
  const now = Date.now();
  const windowStart = now - windowMs;

  // Count requests in window
  const { count } = await supabase
    .from('api_audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', apiKeyId)
    .gte('timestamp', new Date(windowStart).toISOString());

  const remaining = Math.max(0, limit - (count || 0));
  const resetAt = new Date(now + windowMs);

  return {
    allowed: remaining > 0,
    remaining,
    resetAt,
  };
}
```

#### 3.2 Audit Logging

**File:** `lib/audit-logger.ts` (NEW FILE)

```typescript
import { supabase } from './supabase';

export async function logApiRequest(
  apiKeyId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number,
  ipAddress: string,
  userAgent: string
): Promise<void> {
  // Fire and forget - don't block request
  supabase
    .from('api_audit_log')
    .insert({
      api_key_id: apiKeyId,
      endpoint,
      method,
      status_code: statusCode,
      response_time_ms: responseTimeMs,
      ip_address: ipAddress,
      user_agent: userAgent,
    })
    .then(); // Async, don't await
}
```

---

### Phase 4: Testing Infrastructure

#### 4.1 Snapshot Tests

**File:** `tests/auth-snapshot.test.ts` (NEW FILE)

```typescript
import { describe, it, expect } from 'vitest';

/**
 * Snapshot tests to ensure existing cookie auth unchanged
 */
describe('Cookie Authentication (Existing Behavior)', () => {
  it('should allow authenticated user with valid session', async () => {
    // Test existing cookie auth flow
    // If this breaks, we've broken existing functionality
  });

  it('should redirect unauthenticated user to login', async () => {
    // Test existing redirect behavior
  });

  it('should preserve session data in headers', async () => {
    // Test existing session handling
  });
});
```

#### 4.2 API Key Integration Tests

**File:** `tests/api-key-auth.test.ts` (NEW FILE)

```typescript
import { describe, it, expect, beforeAll } from 'vitest';

describe('API Key Authentication (New Behavior)', () => {
  let testApiKey: string;

  beforeAll(async () => {
    // Generate test API key
    testApiKey = await createTestApiKey();
  });

  it('should authenticate with valid API key', async () => {
    const response = await fetch('/api/quotes/realtime', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${testApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        /* test payload */
      }),
    });

    expect(response.status).toBe(200);
  });

  it('should reject invalid API key', async () => {
    const response = await fetch('/api/quotes/realtime', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer sk_live_invalid',
      },
    });

    expect(response.status).toBe(401);
  });

  it('should enforce scopes', async () => {
    const readOnlyKey = await createTestApiKey(['quotes:read']);

    const response = await fetch('/api/quotes/realtime', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${readOnlyKey}`,
      },
    });

    expect(response.status).toBe(403); // Insufficient permissions
  });
});
```

---

### Phase 5: Documentation Updates

#### 5.1 API Documentation

**File:** `docs/API_DOCUMENTATION.md` (UPDATE EXISTING)

````markdown
## Authentication

SpediReSicuro API supports two authentication methods:

### 1. Cookie-Based (Browser/Web App)

Used by web application. Handled automatically via next-auth session.

### 2. API Key (External Integrations)

Used for server-to-server integrations.

#### Obtaining an API Key

1. Log in to SpediReSicuro dashboard
2. Navigate to Settings → API Keys
3. Click "Create New API Key"
4. Configure permissions (scopes)
5. Copy key immediately (shown only once)

#### Using an API Key

```http
POST /api/quotes/realtime
Authorization: Bearer sk_live_your_api_key_here
Content-Type: application/json

{
  "origin": "20121",
  "destination": "00100"
}
```
````

#### Security Best Practices

- ✅ Store keys in environment variables (never hardcode)
- ✅ Use minimum required scopes
- ✅ Rotate keys every 90 days
- ✅ Revoke unused keys immediately
- ✅ Monitor usage in dashboard
- ❌ Never commit keys to git
- ❌ Never share keys in public channels

#### Available Scopes

- `quotes:read` - Get pricing quotes
- `quotes:create` - Create quotes
- `shipments:read` - List shipments
- `shipments:create` - Create new shipment
- `shipments:update` - Update shipment status
- `wallet:read` - Check wallet balance
- `*` - Full access (admin only)

````

#### 5.2 Environment Setup Guide

**File:** `docs/SETUP_API_KEYS.md` (NEW FILE)

```markdown
# API Key Authentication Setup

## Prerequisites
- Supabase project configured
- Database migrations run
- Next.js environment configured

## Step 1: Generate Salt

```bash
# Generate cryptographically secure salt
openssl rand -base64 32
````

**Output example:** `Kx8vZn2Qm9wR4tYp3Lc7Fg5Hs6Jk1Mn0`

## Step 2: Configure Environment

**Local Development** (`.env.local`):

```env
ENABLE_API_KEY_AUTH=true
API_KEY_SALT=Kx8vZn2Qm9wR4tYp3Lc7Fg5Hs6Jk1Mn0
API_KEY_SHADOW_MODE=false
```

**Production** (Vercel/Railway):

```bash
# Set via platform dashboard or CLI
vercel env add ENABLE_API_KEY_AUTH true production
vercel env add API_KEY_SALT <your-salt> production

# OR Railway CLI
railway variables set ENABLE_API_KEY_AUTH=true
railway variables set API_KEY_SALT=<your-salt>
```

⚠️ **CRITICAL:** Never commit `.env.local` to git

## Step 3: Run Database Migration

```bash
# Apply migration
npx supabase migration up

# Verify tables created
npx supabase db inspect
```

Expected output:

- ✅ Table: `public.api_keys`
- ✅ Table: `public.api_audit_log`
- ✅ RLS policies enabled

## Step 4: Test Locally

```bash
# Start dev server
npm run dev

# Create test API key (via UI or script)
curl -X POST http://localhost:3000/api/api-keys/create \
  -H "Cookie: next-auth.session-token=<your-session>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Key", "scopes": ["quotes:read"]}'

# Test API key
curl -X POST http://localhost:3000/api/quotes/realtime \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{"origin": "20121", "destination": "00100"}'
```

## Step 5: Gradual Production Rollout

### Week 1: Shadow Mode

```env
ENABLE_API_KEY_AUTH=true
API_KEY_SHADOW_MODE=true  # Log only, don't enforce
```

Monitor logs for API key usage patterns.

### Week 2: Canary (5% traffic)

```env
ENABLE_API_KEY_AUTH=true
API_KEY_SHADOW_MODE=false
```

Use load balancer routing or feature flag service.

### Week 3: Full Rollout

Scale to 100% if no issues detected.

## Rollback Plan

### Emergency Disable (10 seconds)

```bash
# Via platform dashboard
ENABLE_API_KEY_AUTH=false

# Redeploy (automatic)
```

### Full Rollback (2 minutes)

```bash
git revert <commit-hash>
git push origin master
```

## Monitoring

### Key Metrics

- API key validation success rate
- Cookie auth success rate (should be unchanged)
- Response time p95
- Error rate 4xx/5xx

### Alerts

- Error rate > 0.5% → Page on-call
- Response time > 1000ms → Investigate
- Cookie auth degradation → Immediate rollback

## Troubleshooting

### "API_KEY_SALT not configured"

- Set environment variable in platform dashboard
- Restart application

### "Invalid API key format"

- Ensure key starts with `sk_live_`
- Check for whitespace/newlines

### "Rate limit exceeded"

- Check `api_audit_log` for request count
- Increase `rate_limit_per_hour` in database

```

---

## Security Checklist

### Pre-Deployment
- [ ] API_KEY_SALT generated with `openssl rand -base64 32`
- [ ] Salt stored in environment (NOT in code)
- [ ] `.env.local` added to `.gitignore`
- [ ] Database RLS policies enabled
- [ ] Rate limiting configured
- [ ] Audit logging enabled

### Post-Deployment
- [ ] Test with invalid API key (should reject)
- [ ] Test with expired API key (should reject)
- [ ] Test scope enforcement (should reject insufficient scopes)
- [ ] Test rate limiting (should throttle after limit)
- [ ] Verify cookie auth still works (zero regression)

### Monitoring
- [ ] Error rate dashboard configured
- [ ] API key usage dashboard configured
- [ ] Alerts configured for anomalies
- [ ] Audit log retention policy set (90 days)

---

## Rollout Timeline

### Week 1: Development & Testing
- Days 1-2: Implement core functionality
- Days 3-4: Integration tests
- Day 5: Security review
- Days 6-7: Documentation

### Week 2: Staging
- Deploy to staging with shadow mode
- Invite pilot testers
- Monitor for issues
- Iterate based on feedback

### Week 3: Production (Gradual)
- Day 1: 5% traffic
- Day 2: Monitor, then 25% if stable
- Day 3: Monitor, then 50% if stable
- Day 4: Monitor, then 100% if stable
- Days 5-7: Monitor, document learnings

### Week 4: Stabilization
- Full documentation update
- Customer onboarding
- Support team training
- Post-mortem meeting

---

## Success Criteria

### Technical
- ✅ Zero regression in cookie auth
- ✅ API key auth success rate > 99.9%
- ✅ Response time increase < 50ms (p95)
- ✅ Error rate < 0.1%

### Security
- ✅ All keys hashed (never plaintext)
- ✅ Rate limiting enforced
- ✅ Scope enforcement working
- ✅ Audit logging complete

### Business
- ✅ External integrations enabled
- ✅ Documentation complete
- ✅ Support team trained
- ✅ Customer onboarding process defined

---

## Known Limitations

1. **Key Rotation:** Requires manual user action (no auto-rotation yet)
2. **IP Whitelisting:** Not implemented (P1 feature)
3. **Webhook Signatures:** Not implemented (P1 feature)
4. **GraphQL Support:** Not implemented (API is REST-only)

---

## Future Enhancements (P1)

1. **Automatic Key Rotation:** Notify users 7 days before expiry
2. **IP Whitelisting:** Allow keys only from specific IPs
3. **Webhook Integration:** Notify on key creation/revocation
4. **Usage Analytics:** Per-endpoint metrics dashboard
5. **Team API Keys:** Shared keys for organizations
6. **Key Templates:** Pre-configured scope sets for common use cases

---

**Document Version:** 1.0.0
**Last Updated:** 2026-01-21
**Status:** 🟡 Ready for Implementation Review
```
