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

## Milestone 3: Workspace Integration in Pricing

**Target:** Multi-tenant safety nel calcolo prezzi

### Deliverables

- [ ] Aggiungere `workspace_id` filter in `getApplicablePriceList()`
- [ ] Aggiungere `workspace_id` filter in `calculatePriceWithRules()`
- [ ] Scope cache master list per workspace
- [ ] Test multi-tenant isolation
- [ ] Test verdi su tutta la suite

### File coinvolti

- `lib/db/price-lists-advanced.ts`
- `lib/services/pricing/pricing-service.ts`

### Impatto atteso

- Nessun cross-contamination tra workspace
- Cache invalidation per workspace

---

## Milestone 4: Unified Logging

**Target:** Logging strutturato e parsabile

### Deliverables

- [ ] Creare `lib/logging/price-logger.ts`
- [ ] Sostituire console.log/warn/error sparsi
- [ ] Context automatico (user_id, workspace_id, operation)
- [ ] Test verdi su tutta la suite

### File coinvolti

- `lib/db/price-lists-advanced.ts`
- `lib/services/pricing/pricing-service.ts`
- `app/actions/wallet.ts`

### Impatto atteso

- Debugging più facile
- Log parsabili per monitoring

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
| 3. Workspace Integration | ⏳ Pending    | -          |
| 4. Unified Logging       | ⏳ Pending    | -          |
| 5. Cache Unification     | ⏳ Pending    | -          |

---

## Note

- Ogni milestone richiede test verdi PRIMA del merge
- Documentazione aggiornata DOPO verifica in produzione
- Nessuna milestone dipende strettamente dalle altre (parallelizzabili)
