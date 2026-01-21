# Copilot Instructions for SpedireSicuro

## Project Overview

SpedireSicuro is a **Logistics Operating System (Logistics OS)** - a B2B infrastructure orchestrating shipments, payments, and carriers. It is NOT a price comparator. Built with Next.js 14 (App Router), Supabase (PostgreSQL + RLS), and deployed on Vercel.

## Architecture Principles (Inviolable)

### Financial Core - "No Credit, No Label"

- **Never** update `wallet_balance` directly in the database
- **Always** use atomic RPC functions: `decrement_wallet_balance()` and `increment_wallet_balance()`
- Every wallet operation requires an `idempotency_key` to prevent duplicate charges
- Example: `await supabaseAdmin.rpc('decrement_wallet_balance', { p_user_id, p_amount })`

### Three Business Models

1. **Broker (B2B)**: Reseller/agencies - wallet is debited for each shipment
2. **BYOC (SaaS)**: E-commerce with own contracts - wallet NOT touched (only SaaS fee)
3. **Web Reseller (B2C)**: Private users - uses centralized "Web Channel" wallet

### Multi-Tenant Security (RLS)

- `supabase` client: Browser-side, enforces Row Level Security
- `supabaseAdmin` client: Server-side only (API routes, scripts), bypasses RLS
- Never expose `supabaseAdmin` or service role key to client code

## Key Directories

- `app/api/` - API routes (Node.js runtime)
- `app/dashboard/` - Protected UI routes requiring authentication
- `lib/agent/` - AI orchestrator (LangGraph Supervisor + workers)
- `lib/pricing/calculator.ts` - Single source of truth for pricing logic (pure function)
- `lib/wallet/` - Wallet operations with retry logic
- `lib/rbac.ts` - Role-based access control (superadmin, admin, reseller, user)
- `supabase/migrations/` - Database migrations

## AI Agent Architecture (LangGraph)

Entry point: `lib/agent/orchestrator/supervisor-router.ts`

- Workers: `lib/agent/workers/{pricing,address,ocr,booking}.ts`
- Intent detector: `lib/agent/intent-detector.ts`
- **Strangler Fig Pattern**: Legacy code is the parachute - never delete it

## Commands

```bash
npm run dev           # Start development server
npm run build         # Build for production
npm run test:unit     # Run unit tests (Vitest)
npm run test:e2e      # Run E2E tests (Playwright)
npm run type-check    # TypeScript check
npm run check:env     # Verify environment variables
npm run check:rls     # Audit Supabase RLS policies
```

## Critical Rules for AI Agents

### DO

- Use `createLogger(requestId)` for structured logging with request tracing
- Hash user IDs in logs: `hashUserId(userId)` - never log PII
- Check wallet balance before creating shipments
- Use `middleware.ts` route protection patterns (fail-closed security)
- Run tests after changes: `npm run test:unit`

### DON'T

- ❌ Direct SQL updates to `wallet_balance` column
- ❌ Log PII (addresses, names, phone numbers) - only `user_id_hash` and `trace_id`
- ❌ Mix logic between the 3 business models
- ❌ Bypass wallet checks "to go faster"
- ❌ Create features without P0 tests first

## Testing Patterns

- Unit tests: `tests/unit/` - Pure function testing
- Integration tests: `tests/integration/` - API and DB interactions
- E2E tests: `e2e/` - Playwright browser tests
- Example: `npm run test:unit -- tests/unit/normalize-it-address.test.ts`

## Role Hierarchy

```
superadmin > admin > reseller > user
```

Resellers can create and manage sub-users. See `lib/rbac.ts` for permission mappings.

## Environment Setup

Required variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
Verify with: `npm run check:env:simple`
