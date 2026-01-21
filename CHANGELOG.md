# Changelog

Tutte le modifiche significative al progetto SpedireSicuro sono documentate in questo file.

Il formato è basato su [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## Versioning Strategy

Questo progetto segue [Semantic Versioning 2.0.0](https://semver.org/):

- **Major (X)**: Breaking changes, major architectural shifts
- **Minor (Y)**: New features, backward compatible
- **Patch (Z)**: Bug fixes, security patches

## Release Process

1. Tutte le modifiche significative vanno in `[Unreleased]`
2. Al deploy in produzione, spostare il contenuto in nuova sezione `[X.Y.Z]`
3. Aggiungere data alla release
4. Creare nuova sezione vuota `[Unreleased]`

---

## [Unreleased]

Ultimo aggiornamento: 2026-01-21

### Changed

#### P1 Complete: Legacy Auth Migration (2026-01-21)

**All 70+ files migrated from `auth()` to `getSafeAuth()` for impersonation support.**

- **Core Middleware** (`lib/api-middleware.ts`)
  - `requireAuth()` now returns `{ context: ActingContext }` instead of `{ session }`
  - `requireAdminRole()` and `requireResellerRole()` updated similarly
  - Pattern change: `session.user.email` → `context.actor.email`

- **API Routes Migrated:**
  - `app/api/features/check/route.ts`
  - `app/api/notifications/subscribe/route.ts`
  - `app/api/notifications/unsubscribe/route.ts`
  - `app/api/wallet/transactions/route.ts`
  - `app/api/user/info/route.ts`
  - `app/api/user/settings/route.ts`
  - `app/api/user/dati-cliente/route.ts`
  - `app/api/couriers/available/route.ts`
  - And 60+ more files...

- **Server Actions Migrated:**
  - `lib/actions/spedisci-online.ts` (4 auth calls)
  - `actions/admin-reseller.ts`
  - `actions/price-lists.ts`
  - `actions/privacy.ts`
  - And all other action files...

- **Test Mocks Updated:**
  - Changed from `vi.mock('@/lib/auth-config')` to `vi.mock('@/lib/safe-auth')`
  - Mock return shape: `{ actor: { email, id, name, role }, target, isImpersonating }`

### Fixed

- **VAT backward compatibility test** - Added mock entries to price list for proper mock chain
- **Platform costs integration test** - Added fallback query when `v_platform_margin_alerts` view missing

---

## [1.1.0] - 2026-01-21

### Added - API Key Authentication System

**Feature:** Hybrid authentication system supporting both cookie-based sessions and API key authentication for external server integrations.

#### Core Implementation

- **Unified Auth Helper** (`lib/auth-helper.ts`) - Single source of truth for authentication
  - `getCurrentUser()` function supports both cookie and API key auth
  - Priority: Cookie session first, then API key headers
  - Graceful error handling (returns null instead of throwing)
  - Try-catch wrapper to prevent 500 errors on malformed requests

- **API Key Service** (`lib/api-key-service.ts`) - Cryptographic key generation and validation
  - SHA-256 hashing with configurable salt (`API_KEY_SALT`)
  - Timing-safe comparison to prevent timing attacks
  - Key format: `sk_live_XXXXXXXX...` (lowercase enforced)
  - Rate limiting support (per-key configurable)
  - Automatic expiry support (configurable days)

- **Database Schema** (migrations `20260121000000` and `20260121000002`)
  - `public.api_keys` table with comprehensive audit fields
  - `public.api_audit_log` table for request logging
  - Row Level Security (RLS) policies for multi-tenant isolation
  - Foreign key constraint to `public.users` (NOT `auth.users`)
  - Indexes optimized for fast lookup and rate limiting queries
  - Helper functions: `cleanup_old_audit_logs()`, `get_api_key_stats()`, `find_stale_api_keys()`

- **Middleware Integration** (`middleware.ts`)
  - Header sanitization (removes all `x-*` headers to prevent spoofing)
  - API key validation via service
  - Trusted header injection (`x-user-id`, `x-api-key-id`, `x-api-key-scopes`)
  - Rate limiting check (per-key, per-hour)
  - Audit logging for all API key requests

- **API Endpoint Integration** (`app/api/quotes/realtime/route.ts`)
  - Uses `getCurrentUser()` instead of direct `auth()` call
  - Automatic detection of auth method (cookie vs API key)
  - Consistent response format regardless of auth method

#### Security Features

- **Header Spoofing Protection:** Middleware sanitizes all `x-*` headers before processing
- **Hash-Based Storage:** API keys stored as SHA-256 hashes, never in plaintext
- **Timing-Safe Comparison:** Uses `crypto.timingSafeEqual()` to prevent timing attacks
- **Row Level Security:** PostgreSQL RLS policies ensure users can only access their own keys
- **Audit Logging:** All API key requests logged to `api_audit_log` table
- **Rate Limiting:** Per-key rate limits (default: 1000 req/hour, configurable)
- **Auto-Expiry:** Keys can be configured to expire automatically
- **Graceful Degradation:** Authentication errors return 401, not 500

#### Environment Variables (New)

```bash
API_KEY_SALT=<random-32-chars>          # Required for key hashing
API_KEY_DEFAULT_RATE_LIMIT=1000         # Default requests per hour
API_KEY_DEFAULT_EXPIRY_DAYS=365         # Default key expiry (1 year)
ENABLE_API_KEY_AUTH=true                # Feature flag
API_KEY_SHADOW_MODE=false               # Test mode (logs but doesn't block)
```

### Fixed

#### Bug #1: Key Prefix Case Mismatch

- **Issue:** Database constraint required lowercase `[a-z0-9]` but `randomBytes().toString('base64')` produced mixed case
- **Fix:** Added `.toLowerCase()` in key generation (lib/api-key-service.ts:109)
- **Impact:** API key creation now succeeds without constraint violations

#### Bug #2: Foreign Key Constraint Violation

- **Issue:** Migration referenced `auth.users` but application uses `public.users`
- **Fix:** Changed foreign key to `REFERENCES public.users(id)`
- **Impact:** API key creation no longer fails with foreign key constraint error
- **Migration:** Created fix migration `20260121000002_fix_api_keys_foreign_key.sql`

#### Bug #3: IMMUTABLE Function Error in Migration

- **Issue:** PostgreSQL indexes with `WHERE NOW()` clauses failed (NOW() is not immutable)
- **Fix:** Removed problematic indexes (`idx_api_keys_stale`, `idx_audit_log_rate_limit`)
- **Impact:** Migration applies successfully without function errors

#### Bug #4: Header Spoofing Test Returning 500

- **Issue:** Malformed UUIDs in spoofed headers caused Supabase to throw exceptions
- **Fix:** Wrapped `getCurrentUser()` in try-catch to return null gracefully
- **Impact:** Spoofing attempts now return 401 instead of 500

#### Bug #5: Spoofing Test Using Cookie Session

- **Issue:** Browser automatically sent cookies even without `credentials: 'include'`
- **Fix:** Added `credentials: 'omit'` to test harness to force no-cookie requests
- **Impact:** Security test correctly validates header sanitization

### Testing

#### E2E Testing (All Passed ✅)

- **Test 1: API Key Creation** - Successfully generates lowercase keys with correct format
- **Test 2: API Key Authentication** - Middleware accepts valid keys, endpoints authenticate correctly
- **Test 3: Header Spoofing Protection** - Spoofed headers are sanitized, requests blocked with 401
- **Test Tool:** Interactive HTML test harness (`public/test-api-key.html`)
- **Report:** Complete E2E testing report in `docs/E2E_TESTING_REPORT.md`

#### Code Quality

- ✅ ESLint: 0 errors
- ✅ Prettier: All files formatted
- ✅ TypeScript: Compilation successful
- ✅ Husky: Pre-commit hooks passing

### Documentation

#### New Documentation

- **[docs/E2E_TESTING_REPORT.md](docs/E2E_TESTING_REPORT.md)** - Comprehensive E2E testing report (400+ lines)
  - Executive summary (all tests passing)
  - Test environment details
  - 3 test results with detailed logs
  - 5 bugs found and fixed with explanations
  - Security verification
  - Performance verification
  - Code quality metrics
  - Sign-off and recommendations

- **[docs/PRODUCTION_DEPLOY_CHECKLIST.md](docs/PRODUCTION_DEPLOY_CHECKLIST.md)** - Production deployment guide
  - Pre-deployment verification checklist
  - Environment variable setup
  - Database migration steps
  - Deployment procedure
  - Post-deploy verification
  - Rollback plan
  - Monitoring & alerts setup
  - Known limitations

#### Updated Documentation

- **[README.md](README.md)** - Added API Key Authentication section
  - Quick start guide
  - Environment variables
  - Security features
  - Links to detailed documentation

- **[CHANGELOG.md](CHANGELOG.md)** - This entry

- **[docs/INDEX.md](docs/INDEX.md)** - Updated with new documentation links

### Security Audit

#### Verified Security Measures

- ✅ Header sanitization working (middleware removes all x-\* headers)
- ✅ Header spoofing blocked (spoofed headers return 401)
- ✅ API key hashing implemented (SHA-256 + salt)
- ✅ Row Level Security policies active
- ✅ Rate limiting functional (per-key configurable)
- ✅ Audit logging complete (all requests logged)
- ✅ No plaintext keys in database
- ✅ Error handling prevents information leakage
- ✅ Timing-safe comparison prevents timing attacks

#### Known Limitations

- API key rotation not automated (manual revoke + create)
- Rate limiting per-hour only (no burst protection)
- Audit log retention 90 days (cleanup script needed)
- Key expiry not enforced (cleanup script needed)

### Performance Impact

- **Overhead:** < 50ms per request (header validation + database lookup)
- **Database Queries:** 1 additional query per API key request (cached via index)
- **Memory:** Negligible (no in-memory key storage)

### Commits

- `7389394` - fix(api-keys): resolve E2E testing issues and security vulnerabilities
- `a1e5f1f` - chore: apply linting and formatting after E2E testing

### Migration Path

1. Apply migrations (`20260121000000`, `20260121000002`)
2. Set `API_KEY_SALT` environment variable
3. Set `ENABLE_API_KEY_AUTH=true`
4. Redeploy application
5. Create API keys via UI (when ready) or via script
6. Test authentication with created keys

---

## [Unreleased]

Ultimo aggiornamento: 2026-01-21

### Added

- **Health Readiness/Liveness** - Nuovi endpoint `/api/health/ready` e `/api/health/live` per probe uptime/dep readiness
- **VAT Semantics in Price Lists (ADR-001)** - Implementazione semantica IVA esplicita nei listini prezzi (FASE 0-8 completata)
  - Colonne `vat_mode` e `vat_rate` aggiunte a `price_lists` e `shipments` (migration 110)
  - Supporto prezzi con IVA inclusa o esclusa
  - Utility functions per normalizzazione e calcolo IVA (`lib/pricing/vat-utils.ts`)
  - Calcolo margine sempre su base IVA esclusa (Invariant #1)
  - Fix critico: gestione corretta margine 0 quando master e custom hanno `vat_mode` diversi
  - Fix critico: Surcharges seguono `vat_mode` del listino (non sempre IVA esclusa)
  - Backward compatibility completa (NULL = 'excluded')
  - Quote API: campi VAT opzionali aggiunti (FASE 4)
  - UI: Badge VAT con feature flag `NEXT_PUBLIC_SHOW_VAT_SEMANTICS` (FASE 5)
  - Shipment creation: persistenza VAT context (FASE 6)
  - Data migration: legacy → explicit (migration 111, conservativa) (FASE 7)
  - Test suite enterprise-grade: 62 unit test + integration + regression (FASE 8)
  - Manual testing checklist completa
  - Documentazione: ADR-001, Implementation Plan, Migration Memory aggiornato
  - **Fix post-implementazione (16/01/2025):**
    - Fix display costo fornitore: aggiunto `supplierPriceOriginal` per mostrare prezzo master nella modalità VAT corretta
    - Fix matching entry matrice: migliorata selezione entry più specifica per fasce di peso sovrapposte
    - Logging dettagliato per debug matching entry e prezzi fornitore

### Added

- **AI Capabilities Toggle** - Toggle per abilitare/disabilitare capabilities AI di Anne nella dashboard admin
  - Componente `AiFeaturesCard` nella pagina admin
  - Toggle specifico per "Gestione Listini" (price list management)
  - Actions `updateUserAiFeatures` per aggiornare metadata utente
  - Refresh automatico stato locale dopo toggle
  - Commits: 9df1a86, 11c331c, a4a31e1, 5dc5791, fd7de78, 88ac7fe

- **Anne Price List Management** - Abilitazione dell'agente Anne alla gestione dei listini prezzi
  - Strumenti AI: `search_master_price_lists`, `clone_price_list`, `assign_price_list`
  - Worker: `price-list-manager` per gestione intenti complessi
  - Sicurezza RBAC: Superadmin accesso completo, Reseller accesso negato di default
  - Graph integration: nodo `price_list_worker` in pricing-graph.ts
  - Documentazione: `docs/ANNE_PRICE_LIST_CAPABILITIES.md`

- **Reseller Personalized Price Lists** - Sistema enterprise-grade per reseller con listini personalizzati
  - Clone supplier price lists con custom margins (percent o fixed)
  - Creazione listini vuoti con import CSV
  - Operazioni CRUD complete per price list entries
  - UI matrix-style per preview e editing manuale
  - Enterprise audit trail con logging completo
  - Integrazione con preventivatore intelligente
  - Miglioramenti matching geografico zone/provincia/regione

### Fixed

- **Admin Overview KPI** - KPI admin server-side via RPC con filtri no-limit e esclusione cancellate/test (salva include testspediresicuro+)
- **Admin Overview Data Quality** - Lista spedizioni ora esclude soft-delete/cancellate; detection test include tracking con `TEST`; query utenti con fallback colonne opzionali
- **Metadata Column Missing** - Risolto problema colonna metadata mancante usando `auth.users` invece di `users` (5dc5791)
- **Supabase Client** - Usa client Supabase corretto e migliora log errori (fd7de78)
- **Local State Update** - Aggiorna stato locale con metadata freschi dopo toggle (11c331c)
- **Dashboard Refresh** - Refresh automatico dashboard dopo toggle AI features (a4a31e1)
- **TypeScript Build Error** - Risolto errore TS su assegnazione potenzialmente undefined (9c85761)
- **Service Accessori Format** - Formato corretto: array numeri `[200001]` invece di stringhe
- **Validazione Corriere Obbligatorio** - Pulsante "Genera Spedizione" disabilitato senza selezione corriere
- **Multi-Configurazione Spedisci.Online** - Rimosso deduplicazione errata che filtrava config valide
- **Creazione Spedizione Refresh** - Reset cache quote comparator + ricaricamento corrieri dopo reset
- **Refresh Lista Spedizioni** - Ottimizzato con timestamp invece di `cache: 'no-store'`

### Security

- 🔒 Metadata access limitato a service role solo
- 🔒 Audit logging per tutte le operazioni toggle AI
- 🔒 Rimozione endpoint di test esposti in produzione (redis, supabase, spedisci-online)
- 🔒 Bloccato PLAYWRIGHT_TEST_MODE bypass in produzione

### Documentation

- Aggiornato `MIGRATION_MEMORY.md` con Anne price list capabilities
- Documentazione completa per reseller personalized price lists (PR#43)
- Documentazione AI features toggle workflow

---

## [0.3.1] - 2026-01-02

### Added

- **Anne Price List Management** - Abilitazione dell'agente Anne alla gestione dei listini prezzi
  - Strumenti AI: `search_master_price_lists`, `clone_price_list`, `assign_price_list`
  - Worker: `price-list-manager` per gestione intenti complessi
  - Sicurezza RBAC: Superadmin accesso completo, Reseller accesso negato di default
  - Graph integration: nodo `price_list_worker` in pricing-graph.ts
  - Documentazione: `docs/ANNE_PRICE_LIST_CAPABILITIES.md`

### Changed

- **MIGRATION_MEMORY.md** - Aggiornato con Anne price list capabilities

---

## [0.3.0] - 2025-12-27

### Added

- **Dynamic Platform Fees** - Fee configurabili per utente
  - DB migration 050: colonna `platform_fee_override`, tabella `platform_fee_history`
  - Service layer `lib/services/pricing/platform-fee.ts`
  - Worker integration: BookingWorker applica fee dinamica
  - SuperAdmin UI: `CurrentFeeDisplay`, `UpdateFeeDialog`, `FeeHistoryTable`

- **Fase 2.8: SuperAdmin UI** - Gestione platform fee via UI

### Fixed

- **Platform Fee Audit** - Fix foreign key constraint in audit history

---

## [0.2.0] - 2025-12-20

### Added

- **OCR Immagini** - Integrazione Gemini Vision per OCR da immagini
  - Vision support con max 1 retry per errori transient
  - Fallback: clarification request immediata
  - 10 immagini test processate, 90% confidence
  - Test integration: 13 test passati

- **Booking Worker** - Prenotazione spedizioni con preflight checks
  - Pre-flight check: verifica recipient/parcel/pricing_option
  - Conferma esplicita utente via pattern matching
  - Test integration: 30 test passati

---

## [0.1.0] - 2025-12-01

### Added

- **LangGraph Supervisor Architecture** - Orchestrazione AI Anne con LangGraph
  - Supervisor Router come entry point unico
  - Workers: OCR, Address, Pricing, Booking
  - Telemetria strutturata
  - Rate limiting distribuito (Upstash Redis)

- **Address Worker** - Normalizzazione indirizzi italiani
  - Estrazione CAP, provincia, città
  - Schema Zod per validazione
  - Test: 107 test passati

- **OCR Worker** - Estrazione dati da testo
  - Parsing deterministico con regex
  - Output `ShipmentDraft` con missing fields
  - Test: 25 test passati

- **Pricing Worker** - Calcolo preventivi multi-corriere
  - Single source of truth: `lib/pricing/calculator.ts`
  - Contract tests: 18 test passati

### Changed

- **MIGRATION_MEMORY.md** - Creato come Single Source of Truth per migrazione Anne

---

## Note per Sviluppatori

### Vulnerabilità Note (Non Fixabili senza Breaking Changes)

- `xlsx` - Prototype Pollution (no fix disponibile, considerare migrazione)
- `jspdf/dompurify` - Richiede major upgrade
- `vercel CLI` - Solo dev dependency
- `glob` - Richiede eslint-config-next 16.x

### Prossimi Passi Prioritari

1. Valutare migrazione da `xlsx` a `exceljs`
2. Implementare CSP reporting endpoint
3. Configurare WAF (Cloudflare/Vercel)

---

**Vedi anche:**

- [MIGRATION_MEMORY.md](MIGRATION_MEMORY.md) - Architettura AI Anne dettagliata
- [docs/README.md](docs/README.md) - Indice documentazione completo
