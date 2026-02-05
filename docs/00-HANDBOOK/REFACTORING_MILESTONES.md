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

## Milestone 5: Caching Strategy Unification

**Target:** Cache layer centralizzato

### Deliverables

- [ ] Creare `lib/cache/pricing-cache.ts`
- [ ] Unificare TTL (30s vs 5min → configurabile)
- [ ] Invalidation strategy esplicita
- [ ] Test cache hit/miss/invalidation
- [ ] Test verdi su tutta la suite

### File coinvolti

- `lib/db/price-lists-advanced.ts`
- `lib/services/pricing/pricing-service.ts`

### Impatto atteso

- No stale data
- Performance prevedibile

---

## Tracking

| Milestone                | Status        | Completato |
| ------------------------ | ------------- | ---------- |
| 1. VAT Consolidation     | ✅ Completato | 2026-02-05 |
| 2. Pricing Decomposition | ✅ Completato | 2026-02-05 |
| 3. Workspace Integration | ✅ Completato | 2026-02-05 |
| 4. Unified Logging       | ✅ Completato | 2026-02-05 |
| 5. Cache Unification     | ⏳ Pending    | -          |

---

## Note

- Ogni milestone richiede test verdi PRIMA del merge
- Documentazione aggiornata DOPO verifica in produzione
- Nessuna milestone dipende strettamente dalle altre (parallelizzabili)
