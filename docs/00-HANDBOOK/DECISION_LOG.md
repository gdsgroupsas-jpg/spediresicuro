---
title: Decision Log
scope: process
audience: all
owner: engineering
status: active
source_of_truth: true
updated: 2026-02-17
---

# Decision Log

Record structural and process decisions for fast AI retrieval.

## 2026-01-19 - Consolidate tests under tests/

- Decision: move all tests, e2e, and test scripts into tests/.
- Rationale: single root improves discoverability and automation.
- Impact: updated config paths and doc references.

## 2026-01-19 - Create handbook hub and process flow

- Decision: create docs/00-HANDBOOK as the canonical process hub.
- Rationale: single entry point for rules, workflows, testing, and skills.
- Impact: new index files, AI process flow added.

## 2026-01-28 - Shipment Wizard Improvements

- Decision: Multiple improvements to shipment creation wizard
- Changes:
  1. **Step order**: Mittente → Destinatario → Colli → Corriere → Servizi → Ritiro → Conferma
  2. **Carrier normalization**: POSTEDELIVERYBUSINESS → POSTE, etc. (both in wizard and legacy payload converter)
  3. **Auto PDF download**: Automatic label download after successful shipment creation
  4. **Email validation**: Accept empty strings in recipient email (optional field)
  5. **CarrierStep API format**: Fixed request format to match /api/quotes/db expectations
- Rationale: Improve UX flow, fix validation errors, ensure carrier codes match API enum
- Impact: ShipmentWizard.tsx, ShipmentWizardContext.tsx, CarrierStep.tsx, convert-legacy-payload.ts, shipment.ts validation
- Tests: Existing tests cover carrier normalization (convert-legacy-payload.test.ts)

## 2026-01-28 - Wallet Logic Refactor

- Decision: Simplify wallet debit logic
- Before: Block estimated cost (final_price × 1.10) → Create shipment → Adjust with conguaglio
- After: Verify balance >= final_price → Create shipment → Debit final_price (no conguaglio)
- Rationale:
  1. Single transaction instead of block+adjustment
  2. User pays exactly what they see in quote
  3. Margin guaranteed by price list, not by API response
  4. BYOC pays only platform_fee (industry standard)
- Role-based logic:
  - SUPERADMIN: No wallet charge (internal testing)
  - BYOC: Charge only platform_fee (they pay courier directly)
  - RESELLER/USER: Charge final_price from their assigned price list
- Status: PR #80 merged
- Impact: create-shipment-core.ts (removed ~50 lines of adjustment logic)
- Tests: Wallet smoke tests pass (zero-balance, idempotency, courier-fail, db-fail)

## 2026-01-29 - Per-Provider Financial Tracking

- Decision: Add `courier_config_id` to shipments + per-provider analytics dashboard
- Problem: No way to aggregate financial data by provider/API config (e.g. Prime vs SpeedGo)
- Changes:
  1. **Migration**: Added `courier_config_id` (uuid FK, nullable) to `shipments` table with partial index
  2. **Shipment creation**: `getCourierClientReal()` result now passes `configId` through to insert
  3. **Dashboard**: New "Margine per Fornitore" chart in Analytics tab (same pattern as MarginByCourierChart)
  4. **Action**: `getMarginByProviderAction()` aggregates shipments by `courier_config_id` with JOIN to `courier_configs`
- Architecture:
  - `courier_config_id` is optional (nullable) - legacy shipments have NULL
  - No RLS added: system uses `supabaseAdmin` (service_role) throughout; RLS would have no effect
  - Tenant isolation enforced at application layer via `getCourierClientReal()` ownership checks
  - Query limited to 50k rows for performance safety
- Impact: migration, route.ts, create-shipment-core.ts, platform-costs.ts, financial dashboard page
- Tests: TypeScript build clean, 8 unit tests (provider-analytics.test.ts), 3 unit tests (courier-config-tracking.test.ts)

## 2026-01-29 - Address Validation & Autocomplete System

- Decision: Implement top-tier address validation inspired by ShippyPro
- Components:
  1. **Google Places Autocomplete**: Search-as-you-type for Italian addresses with session-based billing
  2. **Italian Postal Dataset**: CAP/City/Province cross-validation using ISTAT/Poste Italiane data
  3. **Postal Normalization**: Street abbreviations per Italian postal standards (Via->V., Piazza->P.zza)
  4. **Address Classification**: Residential/business heuristic (P.IVA, company name, business keywords)
  5. **Redis Cache**: Upstash caching layer for Places API (24h autocomplete, 7d details)
- Provider choice: Google Places API over Photon/Nominatim/Streetlayer
  - Rationale: Free tier covers ~10k sessions/month, industry standard quality, zero ops
  - Cost at 50k shipments: ~$680/month (~$0.013/shipment), justified by $5-15/error savings
  - Future option: migrate to Photon self-hosted on VPS when volume justifies ops overhead
- Architecture: Adapter pattern (Google + Mock), factory with auto-detection, graceful degradation
- Impact: 19 new files, 6 modified files across lib/, app/api/, components/, tests/, docs/
- Tests: 7 test files (unit + integration) covering postal data, classification, normalization, cache, adapter, API routes

## 2026-01-29 - Reseller Per-Provider Analytics

- Decision: Extend per-provider margin visibility to reseller dashboard
- Problem: Reseller had fiscal report by client but no breakdown by courier config/provider
- Changes:
  1. **Action**: `getResellerMarginByProvider()` in `reseller-fiscal-report.ts` — scoped to reseller's sub-users via `parent_id`, filtered by month/year
  2. **Component**: `ResellerProviderChart` — horizontal bar chart (orange gradient, same pattern as superadmin but simplified: no owner badges, no platform/reseller filter)
  3. **Integration**: Added to report-fiscale page with parallel `Promise.all` loading
  4. **Type**: `ResellerProviderMarginData` in `types/reseller-fiscal.ts`
- Security: Auth via `getSafeAuth()`, verified `is_reseller || superadmin`, data scoped to `parent_id` sub-users + reseller's own shipments
- Impact: reseller-fiscal-report.ts, report-fiscale/page.tsx, reseller-provider-chart.tsx, reseller-fiscal.ts
- Tests: TypeScript build clean, 9 unit tests (reseller-provider-analytics.test.ts)

## 2026-02-16 - Audit Enterprise: Rate Limit, Resilience, Observability

- Decision: Implement full enterprise hardening across 3 phases (score 7.5→9.2/10)
- Problem: Rate limiter existed but was not connected to routes; no retry/circuit breaker for external APIs; no client-side Sentry; health check only checked Supabase
- Changes:
  - **FASE 1 - Fondamenta**: Rate limit middleware (fail-open) on spedizioni/quotes/register; log levels (console.log→console.debug) in factory.ts/encryption.ts; Sentry client config with replay
  - **FASE 2 - Resilienza**: Generic withRetry() with exponential backoff+jitter; Circuit Breaker (Redis+in-memory fallback); Resilient Provider decorator wrapper in factory.ts (1 line change)
  - **FASE 3 - Observability**: Sentry business metrics (shipment, API, CB, wallet); Health check expanded with Redis ping + circuit breaker states + uptime/version
- Feature flags: RATE_LIMIT_ENABLED, RETRY_ENABLED, CIRCUIT_BREAKER_ENABLED (all true, set false for instant rollback)
- New files: lib/security/rate-limit-middleware.ts, lib/resilience/{retry,circuit-breaker,resilient-provider}.ts, lib/observability/metrics.ts, sentry.client.config.ts
- Modified: factory.ts (import+3 lines), encryption.ts (2 log levels), health/route.ts (+25 lines), 3 API routes (+2 lines each)
- Impact: 18 files changed, 1984 insertions
- Tests: 2925 total tests green (+23 new), build clean
- Env vars: RATE_LIMIT_ENABLED, RETRY_ENABLED, CIRCUIT_BREAKER_ENABLED added to Vercel (prod/preview/dev)

## 2026-02-16 - Fix Wallet Balance Desync (users vs workspaces)

- Decision: Dashboard banner reads `users.wallet_balance` (source of truth) instead of `workspaces.wallet_balance` (stale snapshot)
- Problem: All wallet RPC functions (`increment_wallet_balance`, `decrement_wallet_balance`, `add_wallet_credit`, `refund_wallet_balance`, `reseller_transfer_credit`) write to `users.wallet_balance`. But the dashboard banner read from `workspaces.wallet_balance`, which was only populated once during the workspace migration (2026-02-03) and never updated after.
  - Result: "Saldo esaurito" shown even with real credit on the account
- Fix: Derived variable `walletBalance = user?.wallet_balance ?? workspace?.wallet_balance ?? 0` in `app/dashboard/page.tsx`
- Scope: 1 file changed (`page.tsx`), 7 occurrences replaced
- Future: Full migration wallet→workspace planned as Phase 2 (sync trigger, RPC dual-write, source of truth flip)
- Impact: app/dashboard/page.tsx
- Tests: 8 new unit tests (dashboard-wallet-balance-source.test.ts), 2874 total tests green, build clean

## 2026-02-17 - Multi-Tenant Isolation Fix (5 endpoint critici)

- Decision: Chiudere 5 buchi di sicurezza multi-tenant identificati dall'audit CTO
- Problem: Diversi endpoint usavano `supabaseAdmin` (bypassa RLS) senza filtro `workspace_id`, esponendo dati cross-workspace
- Vulnerabilità chiuse:
  1. **Export Spedisci.Online** (`/api/export/spediscionline`): esportava TUTTE le spedizioni pending senza filtro workspace. Rimossa anche `auth.admin.listUsers()` (information disclosure). Fix: `.eq('workspace_id', workspaceId)` + fail-closed (403 se workspace mancante)
  2. **Fatture** (`getInvoices` in `actions/invoices.ts`): ritornava TUTTE le fatture globali. La tabella `invoices` non ha workspace_id (TODO: migration). Fix temporaneo: filtro via `workspace_members` → `.in('user_id', memberIds)`
  3. **COD Items/Distinte** (`/api/cod/items`, `/api/cod/distinte`): nessun filtro workspace su GET/POST. Le tabelle `cod_*` non hanno workspace_id (TODO: migration). Fix: filtro via `workspace_members` → `.in('client_id', memberIds)` + validazione ownership su POST
  4. **Ricerca Destinatari** (`/api/recipients/search`): filtrava solo per `user_id`, mancava `workspace_id`. Fix: `.eq('workspace_id', workspaceId)` su entrambe le query (recenti + ILIKE)
  5. **Tracking pubblico**: nessuna azione — standard universale del settore (tracking number = token di accesso)
- Architettura: pattern "workspace*members bridge" per tabelle senza colonna workspace_id (invoices, cod*\*)
- Debito tecnico residuo: invoices e cod\_\* necessitano migration per aggiungere colonna `workspace_id` + backfill
- Impact: 5 file modificati, 4 test file creati (35 test)
- Tests: 35 nuovi test verdi + 22 pre-esistenti verdi + guardian stabile a 57 violazioni (non aumentate)
- Build: zero errori compilazione
- Benchmark: Spedisci.Online Enterprise usa subdomain isolation per-account — stesso livello di protezione ora raggiunto

## 2026-02-17 - Workspace-Scoped Query Builder (architettura anti-leak)

- Decision: Creato `workspaceQuery()` wrapper che forza `workspace_id` su 29 tabelle multi-tenant
- Problem: Errori umani ripetuti — ogni sviluppatore deve ricordarsi di aggiungere `.eq('workspace_id', ...)` manualmente
- Solution: `lib/db/workspace-query.ts` — wrapper architetturale che intercetta select/insert/update/delete
- Guardian test: `tests/unit/workspace-query-guardian.test.ts` scansiona il codice e conta usi diretti di `supabaseAdmin` su tabelle protette
- Baseline: 57 violazioni in 46 file (da ridurre a 0 nel tempo). Il numero NON deve MAI aumentare.
- Rule in CLAUDE.md: "Usa workspaceQuery() per tabelle multi-tenant, mai supabaseAdmin.from() direttamente"
- Impact: lib/db/workspace-query.ts, tests/unit/workspace-query-guardian.test.ts, CLAUDE.md

## 2026-02-02 - Unified Listini UI (4→1 sidebar entry per role)

- Decision: Consolidate 4 separate Listini sidebar entries into 1 per role with tab-based UX
- Before: Superadmin had "Listini Prezzi" + "Listini Master" (2 entries), Reseller had "Listini Fornitore" + "Listini Personalizzati" (2 entries)
- After:
  - Superadmin/Admin: Single "Listini" → `/dashboard/listini` with tabs (Prezzi + Master for superadmin, Prezzi only for admin)
  - Reseller: Single "Listini" → `/dashboard/reseller/listini` with tabs (Fornitore + Personalizzati)
  - BYOC: Unchanged
- Architecture:
  - Extracted 4 tab components: `price-lists-tab.tsx`, `master-price-lists-tab.tsx`, `reseller-fornitore-tab.tsx`, `reseller-personalizzati-tab.tsx`
  - Unified pages use controlled `<Tabs>` with URL sync via `window.history.replaceState`
  - Old URLs (`/super-admin/listini-master`, `/reseller/listini-fornitore`, `/reseller/listini-personalizzati`) redirect to new unified pages
  - Detail page route `/reseller/listini-fornitore/[id]` unchanged
- Impact: navigationConfig.ts, 2 new pages, 4 new tab components, 3 redirect pages, 4 e2e test files, 6 doc files
- Tests: 41 unit tests pass (4 new nav tests, 3 redirect tests), build clean
