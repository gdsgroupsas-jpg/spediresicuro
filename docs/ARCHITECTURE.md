# 🏗️ Technical Architecture Deep Dive

> **Allineamento Costituzione:** ✅ Questo documento descrive l'implementazione tecnica dei pattern definiti in README.md (Courier Adapter, 3 modelli operativi)

---

## 📜 Riferimento Costituzione

**Prima di leggere questo documento, leggi OBBLIGATORIAMENTE:**
- [README.md](../README.md) - Costituzione del sistema (Courier Adapter pattern, 3 modelli operativi)

**Questo documento implementa:**
- Pattern Courier Adapter (sistema agnostico rispetto al fornitore)
- Stack tecnologico per i 3 modelli operativi
- Patterns architetturali (Acting Context, Wallet, RLS)

---

## System Overview

SpedireSicuro is a **Next.js 14** application with **App Router** architecture, using **Supabase** (PostgreSQL) as the database and **Vercel** for hosting.

**Architettura:** Logistics Operating System (Logistics OS) - Non è un comparatore prezzi, è un'infrastruttura B2B che orchestra spedizioni, pagamenti e corrieri.

```
┌─────────────────────────────────────────────────────┐
│                   CLIENT (Browser)                   │
│  Next.js App Router + React Server Components       │
└─────────────┬───────────────────────────────────────┘
              │
              │ HTTPS
              ↓
┌─────────────────────────────────────────────────────┐
│              VERCEL (Edge Network)                   │
│  ├─ Static Assets (CDN)                             │
│  ├─ Server Components (Node.js)                     │
│  └─ API Routes (Node.js/Edge Runtime)               │
└─────────────┬───────────────────────────────────────┘
              │
              ├──────────────┬──────────────┬──────────────┐
              │              │              │              │
              ↓              ↓              ↓              ↓
      ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐
      │ Supabase │   │  Gemini  │   │  XPay    │   │ Courier  │
      │ (DB+Auth)│   │   AI     │   │ Payment  │   │   APIs   │
      └──────────┘   └──────────┘   └──────────┘   └──────────┘
```

---

## Stack Reality Check

### Frontend
- **Next.js 14.2+** - App Router (NOT Pages Router)
- **React 18+** - Server Components + Client Components
- **TypeScript** - Strict mode enabled
- **Tailwind CSS** - Utility-first styling
- **Shadcn/UI** - Component library (Radix UI primitives)
- **Framer Motion** - Animations (glassmorphism effects)

### Backend
- **Next.js API Routes** - `/app/api/**` (Node.js runtime)
- **Server Actions** - `/app/actions/**` (React Server Actions)
- **Supabase Client** - RLS-enforced queries
- **Supabase Admin** - Bypass RLS (server-side only)

### Database
- **PostgreSQL 15+** - Via Supabase
- **Row Level Security (RLS)** - Tenant isolation
- **Triggers** - Auto-update wallet balance
- **Functions (RPC)** - Business logic in DB

### Authentication
- **NextAuth.js v5** - Session management
- **Supabase Auth** - User storage (auth.users)
- **Custom Impersonation** - Acting Context system

### AI/Automation
- **Google Gemini 2.0 Flash** - Multimodal AI (text + vision)
- **LangGraph** - AI workflow orchestration (planned, not live)
- **Puppeteer** - Browser automation (external service)

### Payments
- **Intesa XPay** - Credit card processing (integration ready, not live)
- **Manual Bank Transfer** - Current live payment method

### Monitoring
- **Vercel Analytics** - Performance monitoring
- **Supabase Logs** - Database query logs
- **Custom Diagnostics** - `diagnostics_events` table

---

## Directory Structure

```
spediresicuro/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth group routes
│   │   └── login/               
│   ├── dashboard/                # Protected dashboard
│   │   ├── page.tsx             # Main dashboard
│   │   ├── wallet/              # Wallet management
│   │   ├── spedizioni/          # Shipments
│   │   ├── admin/               # Admin pages
│   │   └── impostazioni/        # Settings
│   ├── api/                      # API routes
│   │   ├── auth/[...nextauth]/  # NextAuth endpoints
│   │   ├── shipments/           # Shipment APIs
│   │   ├── wallet/              # Wallet APIs
│   │   ├── impersonate/         # Impersonation APIs
│   │   └── cron/                # Cron jobs
│   ├── actions/                  # Server Actions
│   │   ├── wallet.ts            # Wallet operations
│   │   ├── topups-admin.ts      # Top-up approval
│   │   └── privacy.ts           # GDPR operations
│   └── layout.tsx               # Root layout
│
├── components/                   # React components
│   ├── ui/                      # Shadcn/UI components
│   ├── dashboard/               # Dashboard-specific
│   └── shared/                  # Shared components
│
├── lib/                          # Core libraries
│   ├── auth-config.ts           # NextAuth configuration
│   ├── safe-auth.ts             # Acting Context implementation
│   ├── db/                      # Database utilities
│   │   └── client.ts            # Supabase clients
│   ├── security/                # Security utilities
│   │   ├── audit-log.ts         # Audit logging
│   │   ├── audit-actions.ts     # Action constants
│   │   └── security-events.ts   # Security event logging
│   ├── payments/                # Payment integrations
│   │   └── intesa-xpay.ts       # XPay integration
│   └── supabase-server.ts       # Server-side Supabase client
│
├── supabase/                     # Database
│   ├── migrations/              # SQL migrations (49 files)
│   └── seed.sql                 # Seed data (if any)
│
├── middleware.ts                 # Next.js middleware (auth + impersonation)
├── .env.local                   # Local environment variables (not committed)
├── .env.example                 # Template for env vars
└── package.json                 # Dependencies
```

---

## Key Patterns

### 1. Acting Context (Impersonation)

**Problem:** SuperAdmin needs to operate on behalf of users without logging in as them.

**Solution:** Cookie-based impersonation with middleware validation.

**Files:**
- `middleware.ts` - Validates impersonation cookie, injects headers
- `lib/safe-auth.ts` - `getSafeAuth()` reads headers, builds `ActingContext`
- `app/api/impersonate/start/route.ts` - Start impersonation
- `app/api/impersonate/stop/route.ts` - Stop impersonation

**Flow:**
1. Admin UI calls `/api/impersonate/start` with `targetUserId`
2. API validates: Actor is SuperAdmin, Target exists
3. Set cookie: `impersonate-context` with signed data
4. Middleware reads cookie, validates signature, injects `x-sec-impersonate-target` header
5. `getSafeAuth()` reads header, loads target user from DB
6. Returns `ActingContext { actor, target, isImpersonating: true }`
7. All operations use `context.target.id` for queries

**Key Insight:** Business logic ALWAYS uses `context.target.id`, never `context.actor.id`.

---

### 2. Wallet System (Prepaid Credit)

**Problem:** Need to prevent negative balance, ensure audit trail, support refunds.

**Solution:** Trigger-based balance update + immutable transaction ledger.

**Tables:**
- `users.wallet_balance` - Current balance (CHECK >= 0)
- `wallet_transactions` - Immutable ledger (append-only)

**Flow:**
1. Admin approves top-up request
2. Call `add_wallet_credit(user_id, amount, description, admin_id)`
3. Function inserts row into `wallet_transactions`
4. Trigger `update_wallet_balance_on_transaction` fires
5. Trigger updates `users.wallet_balance += amount`
6. User creates shipment → pre-check balance
7. If sufficient, insert negative transaction → trigger debits balance

**Key Insight:** Balance is NEVER updated directly, always via transaction insert.

**Reconciliation:**
```sql
-- Daily job verifies integrity
SELECT u.id, u.wallet_balance, SUM(wt.amount) AS calculated
FROM users u
LEFT JOIN wallet_transactions wt ON wt.user_id = u.id
GROUP BY u.id
HAVING u.wallet_balance != SUM(wt.amount);
```

---

### 3. Idempotency (Duplicate Prevention)

**Problem:** User double-clicks "Create Shipment" → creates 2 shipments.

**Solution:** Hash key fields + timestamp window.

**Implementation:**
```typescript
const idempotencyKey = crypto.createHash('sha256').update(JSON.stringify({
  userId: context.target.id,
  recipient: validated.recipient,
  packages: validated.packages,
  timestamp: Math.floor(Date.now() / 5000) // 5-second buckets
})).digest('hex')

// Check last 60 seconds for duplicate
const { data: duplicate } = await supabaseAdmin
  .from('shipments')
  .select('id')
  .eq('user_id', context.target.id)
  .eq('idempotency_key', idempotencyKey)
  .gte('created_at', oneMinuteAgo)
  .maybeSingle()

if (duplicate) {
  return Response.json({ error: 'DUPLICATE_REQUEST' }, { status: 409 })
}
```

**Key Insight:** 5-second buckets allow retries, 60-second window balances safety vs performance.

---

### 4. Courier Adapter Pattern (Provider Agnostic)

**Problem:** System must support multiple courier providers (Spedisci.Online, Poste, GLS, etc.) without hardcoding provider-specific logic.

**Solution:** Abstract adapter interface with provider-specific implementations.

**Core Interface:**
```typescript
// lib/adapters/couriers/base.ts
export abstract class CourierAdapter {
  abstract connect(): Promise<boolean>;
  abstract createShipment(data: any): Promise<ShippingLabel>;
  abstract getTracking(trackingNumber: string): Promise<TrackingEvent[]>;
  abstract cancelShipment?(trackingNumber: string): Promise<void>;
}
```

**Implementations:**
- `SpedisciOnlineAdapter` - Spedisci.Online API (JSON + CSV fallback)
- `PosteAdapter` - Poste Italiane API
- `MockCourierAdapter` - Testing

**Factory Pattern:**
```typescript
// lib/couriers/factory.ts
export async function getShippingProvider(
  userId: string,
  providerId: string
): Promise<CourierAdapter | null> {
  // 1. Load config from DB (courier_configs)
  // 2. Decrypt credentials
  // 3. Instantiate adapter based on providerId
  // 4. Return adapter or null
}
```

**Key Insight:** Business logic (shipment creation, tracking) NEVER calls courier APIs directly. Always uses `CourierAdapter` interface.

**Benefits:**
- ✅ Easy to add new couriers (just implement adapter)
- ✅ Testing with MockCourierAdapter
- ✅ BYOC support (user provides own credentials)
- ✅ Multi-tenant isolation (each user can have different config)

**Files:**
- `lib/adapters/couriers/base.ts` - Abstract base class
- `lib/adapters/couriers/spedisci-online.ts` - Spedisci.Online implementation
- `lib/couriers/factory.ts` - Factory for instantiating adapters

---

### 5. RLS (Row Level Security)

**Problem:** Ensure users can only see their own data.

**Solution:** PostgreSQL RLS policies on ALL tenant tables.

**Pattern:**
```sql
-- Enable RLS
ALTER TABLE shipments ENABLE ROW LEVEL SECURITY;

-- Policy: Users see own data, admins see all
CREATE POLICY "shipments_select" ON shipments FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('admin', 'superadmin')
  )
);
```

**Bypass (Server-Side Only):**
```typescript
// Uses service role key (bypasses RLS)
import { supabaseAdmin } from '@/lib/db/client'

// Safe: Server-side only
const { data } = await supabaseAdmin.from('shipments').select('*')
```

**Key Insight:** NEVER use `supabaseAdmin` in client components, only Server Actions/API Routes.

---

### 6. Listini Avanzati (Advanced Price Lists)

**Problem:** Resellers need custom pricing per customer.

**Solution:** Hierarchical price lists with fallback.

**Tables:**
- `price_lists` - Base price list per courier
- `advanced_price_lists` - Reseller-specific overrides
- `price_list_entries` - Zone-based pricing rules

**Query Logic:**
1. Check if user has custom price list (via reseller)
2. If yes, use custom pricing
3. If no entry for zone, fallback to base price list
4. Cache result for 1 hour

**Key Insight:** Pricing is NEVER hardcoded, always DB-driven.

---

### 7. Compensation Queue (Failure Recovery)

**Problem:** Shipment created on courier API, but DB insert fails → orphan.

**Solution:** Compensation queue for manual cleanup.

**Flow:**
```typescript
try {
  // 1. Call courier API
  const courierResponse = await courierClient.createShipping(...)
  
  // 2. Insert shipment in DB
  const { data: shipment } = await supabaseAdmin.from('shipments').insert(...)
} catch (dbError) {
  // 3. DB failed, try to delete from courier
  try {
    await courierClient.deleteShipping({ shipmentId })
  } catch (deleteError) {
    // 4. Can't delete, queue for manual intervention
    await supabaseAdmin.from('compensation_queue').insert({
      action: 'DELETE',
      shipment_id_external: courierResponse.shipmentId,
      error_context: { dbError, deleteError }
    })
  }
}
```

**Admin Dashboard:** `/dashboard/admin/compensation` (TODO: Build UI)

**Key Insight:** Fail-safe recovery, never lose money.

---

## Feature Flags

### Live Features (Production Ready)
- ✅ **User Dashboard** - Shipment creation, tracking
- ✅ **Wallet System** - Prepaid credit, top-ups
- ✅ **Multi-Courier** - GLS, BRT, Poste (via Spedisci.Online)
- ✅ **Reseller System** - Hierarchical user management
- ✅ **Acting Context** - SuperAdmin impersonation
- ✅ **Audit Logging** - Security event tracking
- ✅ **GDPR Compliance** - Data export, anonymization
- ✅ **CRM Leads** - Lead management, conversion
- ✅ **Courier Configs** - Encrypted credential storage

### Partially Implemented (Infrastructure Ready, UI Missing)
- 🟡 **AI Anne Chat** - Backend ready, chat UI not built
- 🟡 **Smart Top-Up OCR** - Gemini Vision integration exists, not exposed
- 🟡 **Invoice System** - Tables exist, PDF generation missing
- 🟡 **XPay Payments** - Integration ready, not enabled
- 🟡 **Doctor Service** - Diagnostics logging active, UI dashboard missing

### Planned (Backlog)
- 📋 **LangGraph Workflows** - AI agent orchestration
- 📋 **Fiscal Brain** - F24, LIPE tracking
- 📋 **Multi-Region** - Database sharding
- 📋 **Mobile App** - React Native
- 📋 **API Marketplace** - Public API for integrations

**Key Insight:** Don't claim features as "live" unless UI is accessible to users.

---

## Environment-Specific Behavior

### Development (`npm run dev`)
- Uses `NEXT_PUBLIC_SUPABASE_URL` from `.env.local`
- NextAuth callback: `http://localhost:3000/api/auth/callback`
- Hot reload enabled
- Source maps enabled

### Production (Vercel)
- Uses environment variables from Vercel dashboard
- NextAuth callback: `https://spediresicuro.it/api/auth/callback`
- Optimized builds (tree shaking, minification)
- Edge functions for faster response

### Preview (Vercel Preview Deployments)
- Separate DB instance (or same as dev)
- Unique preview URL per branch
- Same env vars as production (configurable)

---

## Security Boundaries

### Client-Side (Browser)
- **Can access:** Public Supabase anon key (RLS enforced)
- **Cannot access:** Service role key, API secrets, encrypted passwords
- **Pattern:** Use Server Actions for sensitive operations

### Server-Side (Node.js)
- **Can access:** All secrets via environment variables
- **Can bypass:** RLS via `supabaseAdmin`
- **Pattern:** Validate input, enforce business rules

### Database (PostgreSQL)
- **Enforces:** RLS policies, CHECK constraints, foreign keys
- **Trusted:** Only server-side code (service role)
- **Pattern:** Defense in depth, never trust client

---

## Performance Optimizations

### Caching Strategy
- **User profiles:** 5 minutes (React Query)
- **Courier configs:** 15 minutes
- **Price lists:** 1 hour
- **Static assets:** CDN (Vercel Edge)

### Database Indexes
- All foreign keys indexed
- Composite indexes on (user_id, created_at) for pagination
- GIN index on JSONB metadata columns

### Query Patterns
- Use `.select('id, name, email')` (specific columns, not `*`)
- Paginate with `.range(0, 49)` (50 per page)
- Use `.maybeSingle()` when expecting 0 or 1 result

---

## Error Handling

### Client-Side
```typescript
try {
  const result = await serverAction(...)
  if (!result.success) {
    toast.error(result.error)
  }
} catch (error) {
  toast.error('Unexpected error')
  console.error(error)
}
```

### Server-Side (API Routes)
```typescript
try {
  const context = await requireSafeAuth()
  // ... business logic
  return Response.json({ success: true, data })
} catch (error: any) {
  console.error('API Error:', error)
  return Response.json({
    error: error.message || 'Internal error'
  }, { status: error.status || 500 })
}
```

### Server-Side (Server Actions)
```typescript
export async function createShipment(...) {
  try {
    const context = await requireSafeAuth()
    // ... business logic
    return { success: true, data }
  } catch (error: any) {
    console.error('Action Error:', error)
    return { success: false, error: error.message }
  }
}
```

---

## Testing Strategy

### Current State
- **E2E Tests:** Playwright (smoke tests exist)
- **Unit Tests:** None (TODO)
- **Integration Tests:** None (TODO)

### Recommended Additions
- Unit tests for `safe-auth.ts` (Acting Context logic)
- Integration tests for wallet operations
- API route tests with mock Supabase
- Component tests with React Testing Library

---

## Deployment Pipeline

### CI/CD (GitHub Actions)
```
1. Push to branch → GitHub Actions
2. Run linting: `npm run lint`
3. Run type checking: `npm run type-check`
4. Run tests: `npm test` (if any)
5. Build: `npm run build`
6. Deploy to Vercel preview
```

### Production Deploy
```
1. Merge PR to main
2. Vercel auto-deploys to production
3. Post-deploy: Smoke tests
4. Monitor: Error rate, response time
```

---

**Document Owner:** Engineering Team  
**Last Updated:** December 21, 2025  
**Review Cycle:** Quarterly
