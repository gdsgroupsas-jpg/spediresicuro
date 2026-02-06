# Refactoring Milestones - SpedireSicuro

## Obiettivo

Ridurre complessità e debito tecnico nei moduli critici identificati dall'audit.

---

## Milestone 1: VAT Logic Consolidation ✅

**Target:** Eliminare duplicazione logica IVA
**Completato:** 2026-02-05

### Deliverables

- [x] Creare `lib/pricing/vat-handler.ts` con funzioni pure
- [x] Sostituire 5+ occorrenze duplicate in `price-lists-advanced.ts`
- [x] Test unit parametrici per tutti i casi VAT (22 test)
- [x] Test verdi su tutta la suite (1175 unit + 195 integration)

### File coinvolti

- `lib/db/price-lists-advanced.ts` (refactored)
- `lib/pricing/vat-utils.ts` (esistente)
- `lib/pricing/vat-handler.ts` (nuovo)
- `tests/unit/vat-handler.test.ts` (nuovo)

### Impatto ottenuto

- ~60 righe di codice duplicate rimosse
- 3 funzioni helper riusabili (`normalizePricesToExclVAT`, `normalizeCustomAndSupplierPrices`, `isManuallyModified`)
- Un solo punto di manutenzione per pattern di normalizzazione VAT

---

## Milestone 2: Pricing Decomposition ✅

**Target:** Spezzare `calculateWithDefaultMargin()` da 670 righe
**Completato:** 2026-02-05

### Deliverables

- [x] Estrarre `recoverMasterListPrice()`
- [x] Estrarre `calculateMatrixPrice()`
- [x] Estrarre `determineSupplierPrice()`
- [x] Test unit per pricing helpers (12 test)
- [x] Test verdi su tutta la suite (1187 unit + 195 integration)

### File coinvolti

- `lib/db/price-lists-advanced.ts` (refactored)
- `lib/pricing/pricing-helpers.ts` (nuovo)
- `tests/unit/pricing-helpers.test.ts` (nuovo)

### Impatto ottenuto

- 3 funzioni helper estratte e testate
- ~100 righe di logica complessa modularizzate
- Responsabilità ben separate (master recovery, matrix calc, supplier determination)

---

## Milestone 3: Workspace Integration in Pricing ✅

**Target:** Multi-tenant safety nel calcolo prezzi
**Completato:** 2026-02-05

### Deliverables

- [x] Aggiungere `workspace_id` filter in `getApplicablePriceList()`
- [x] Aggiungere `workspace_id` filter in `calculatePriceWithRules()`
- [x] Scope cache master list per workspace
- [x] Test multi-tenant isolation (12 test)
- [x] Test security price-lists isolation (12 test)
- [x] RLS migration per nascondere listini supplier globali
- [x] Test verdi su tutta la suite (1199 unit)

### File coinvolti

- `lib/db/price-lists-advanced.ts` (refactored)
- `lib/services/pricing/pricing-service.ts` (refactored)
- `lib/services/pricing/calculate-from-pricelist.ts` (refactored)
- `lib/engine/fulfillment-orchestrator.ts` (refactored)
- `lib/ai/tools.ts` (refactored)
- `actions/price-lists.ts` (refactored)
- `app/api/quotes/*.ts` (refactored)
- `app/api/spedizioni/route.ts` (refactored)
- `tests/unit/pricing-workspace-isolation.test.ts` (nuovo)
- `tests/security/price-lists-isolation.test.ts` (nuovo)
- `supabase/migrations/20260205120000_fix_price_lists_rls_hide_supplier.sql` (nuovo)

### Impatto ottenuto

- Cache `masterListCache` scoped per workspace (chiave: `{workspaceId}:{masterListId}`)
- Filtro workspace in tutte le query pricing
- Listini globali (workspace_id=NULL) accessibili ma supplier globali nascosti ai reseller
- 24 nuovi test (12 isolation + 12 security)

---

## Milestone 4: Unified Logging ✅

**Target:** Logging strutturato e parsabile
**Completato:** 2026-02-05

### Deliverables

- [x] Creare `lib/logging/price-logger.ts` con logger strutturato
- [x] Livelli configurabili (PRICE_LOG_LEVEL=debug|info|warn|error)
- [x] Verbose mode disabilitabile (PRICE_LOG_VERBOSE=false)
- [x] JSON output per parsing in produzione (PRICE_LOG_JSON=true)
- [x] Context automatico (operation, priceListId, workspaceId, userId)
- [x] Helper functions (logPricingDetails, logPricingError)
- [x] Integrazione in pricing-helpers.ts
- [x] Test verdi su tutta la suite (1219 unit, +20 nuovi test logger)

### File coinvolti

- `lib/logging/price-logger.ts` (nuovo)
- `lib/pricing/pricing-helpers.ts` (refactored)
- `tests/unit/price-logger.test.ts` (nuovo)

### Impatto ottenuto

- Logger strutturato con livelli e contesto
- Log parsabili JSON per monitoring in produzione
- Verbose mode per debug dettagliato disabilitabile
- 20 nuovi test per il modulo logger

---

## Milestone 5: Caching Strategy Unification ✅

**Target:** Cache layer centralizzato
**Completato:** 2026-02-05

### Deliverables

- [x] Creare `lib/cache/pricing-cache.ts`
- [x] Unificare TTL (30s master-list, 5min quote, 1min price-list → tutti configurabili)
- [x] Invalidation strategy esplicita (per workspace, tipo, pattern, età)
- [x] Test cache hit/miss/invalidation (34 test)
- [x] Test verdi su tutta la suite (1253 unit)

### File coinvolti

- `lib/cache/pricing-cache.ts` (nuovo)
- `tests/unit/pricing-cache.test.ts` (nuovo)

### Impatto ottenuto

- Cache centralizzata con TTL configurabili via env:
  - `PRICING_CACHE_DEFAULT_TTL` (default: 30s)
  - `PRICING_CACHE_MASTER_TTL` (default: 30s)
  - `PRICING_CACHE_QUOTE_TTL` (default: 5min)
  - `PRICING_CACHE_PRICELIST_TTL` (default: 1min)
  - `PRICING_CACHE_MAX_ENTRIES` (default: 1000)
  - `PRICING_CACHE_DEBUG` (default: false)
- Workspace scoping per isolamento multi-tenant
- LRU eviction quando cache è piena
- Statistiche (hit rate, size per tipo/workspace)
- Helper functions (`withMasterListCache`, `buildQuoteCacheKey`)
- 34 nuovi test

---

## Tracking

| Milestone                | Status        | Completato |
| ------------------------ | ------------- | ---------- |
| 1. VAT Consolidation     | ✅ Completato | 2026-02-05 |
| 2. Pricing Decomposition | ✅ Completato | 2026-02-05 |
| 3. Workspace Integration | ✅ Completato | 2026-02-05 |
| 4. Unified Logging       | ✅ Completato | 2026-02-05 |
| 5. Cache Unification     | ✅ Completato | 2026-02-05 |

---

## Security Hardening ✅

**Target:** Fix vulnerabilità identificate da code review severa
**Completato:** 2026-02-06

### Fix CRITICAL

| Issue                             | File                      | Fix                                           |
| --------------------------------- | ------------------------- | --------------------------------------------- |
| Division by zero con vatRate=-100 | `vat-utils.ts`            | Input validation: vatRate deve essere [0,100] |
| NaN/Infinity propagation          | `vat-utils.ts`            | `assertFinitePositive()` su tutti gli input   |
| Floating point precision          | `vat-utils.ts`            | `roundToTwoDecimals()` su tutti i risultati   |
| Cache invalidation totale         | `pricing-cache.ts`        | Blocco keyPattern vuoto                       |
| Info sensibili nei log            | `price-logger.ts`         | PII scrubbing in produzione                   |
| LRU errato (insertion order)      | `price-lists-advanced.ts` | LRU basato su `accessTime`                    |

### Fix HIGH

| Issue                        | File               | Fix                                   |
| ---------------------------- | ------------------ | ------------------------------------- |
| parseInt NaN su env invalide | `pricing-cache.ts` | `parseEnvInt()` con fallback          |
| Cache key collision          | `pricing-cache.ts` | `escapeCacheKeyPart()` per separatore |

### Test aggiunti

- `tests/unit/vat-utils-critical.test.ts` - 29 test input validation
- `tests/unit/validators.test.ts` - 16 test SQL injection prevention

### Impatto

- Prevenzione errori runtime su input malformati
- Precisione finanziaria garantita (2 decimali)
- Nessun leak di dati sensibili in produzione
- Cache thread-safe con eviction corretta

---

## Tracking

| Milestone                | Status        | Completato |
| ------------------------ | ------------- | ---------- |
| 1. VAT Consolidation     | ✅ Completato | 2026-02-05 |
| 2. Pricing Decomposition | ✅ Completato | 2026-02-05 |
| 3. Workspace Integration | ✅ Completato | 2026-02-05 |
| 4. Unified Logging       | ✅ Completato | 2026-02-05 |
| 5. Cache Unification     | ✅ Completato | 2026-02-05 |
| 6. Security Hardening    | ✅ Completato | 2026-02-06 |

---

## Note

- Ogni milestone richiede test verdi PRIMA del merge
- Documentazione aggiornata DOPO verifica in produzione
- Nessuna milestone dipende strettamente dalle altre (parallelizzabili)
