# PR: VAT Semantics in Price Lists - Fase 0-3 (Foundation)

## 📋 Overview

Implementazione delle **fasi 0-3** del piano VAT Semantics (ADR-001), che stabilisce le fondamenta per la gestione esplicita dell'IVA nei listini prezzi.

**ADR:** `ADR_001_VAT_SEMANTICS_IN_PRICE_LISTS.md`  
**Piano:** `IMPLEMENTATION_PLAN_VAT_SEMANTICS.md`

---

## 🎯 Obiettivo

Supportare listini prezzi con IVA inclusa o esclusa, garantendo:
- Calcolo margine sempre su base IVA esclusa (Invariant #1)
- Normalizzazione corretta tra listini master e custom con `vat_mode` diversi
- Backward compatibility completa (NULL = 'excluded')
- Zero downtime e idempotenza

---

## ✅ Modifiche Implementate

### FASE 0: Preparazione

#### 0.1 Audit Baseline
- **File:** `scripts/audit-vat-baseline.sql`
- Script SQL per verificare stato attuale prima delle modifiche

#### 0.2 Test Suite
- **File:** `tests/pricing/vat-utils.test.ts`
- 25 test unitari per utility functions VAT
- ✅ Tutti i test passano

---

### FASE 1: Schema & Types

#### 1.1 Migration Database
- **File:** `supabase/migrations/110_add_vat_semantics_to_price_lists.sql`
- **Modifiche:**
  - Aggiunta colonna `vat_mode` (TEXT, CHECK 'included'/'excluded', NULL) a `price_lists`
  - Aggiunta colonna `vat_rate` (DECIMAL(5,2), DEFAULT 22.00) a `price_lists`
  - Aggiunta colonna `vat_mode` (TEXT, CHECK 'included'/'excluded', NULL) a `shipments`
  - Aggiunta colonna `vat_rate` (DECIMAL(5,2), DEFAULT 22.00) a `shipments`
  - Indici parziali per performance
- **Caratteristiche:**
  - ✅ Idempotente (safe to run multiple times)
  - ✅ Zero downtime (solo aggiunta colonne nullable)
  - ✅ Backward compatible (NULL = assume 'excluded')

#### 1.2 TypeScript Types
- **File:** `types/listini.ts`
  - `PriceList`: aggiunti `vat_mode?`, `vat_rate?`
  - `PriceCalculationResult`: aggiunti `vatMode?`, `vatRate?`, `vatAmount?`, `totalPriceWithVAT?`
- **File:** `types/shipments.ts`
  - `Shipment`: aggiunti `vat_mode?`, `vat_rate?`
- **Tutti i campi sono opzionali** per backward compatibility

---

### FASE 2: Utility Functions

#### 2.1 VAT Utils
- **File:** `lib/pricing/vat-utils.ts`
- **Funzioni implementate:**
  - `normalizePrice()`: conversione prezzi excluded ↔ included
  - `calculateVATAmount()`: calcolo importo IVA
  - `calculatePriceWithVAT()`: prezzo con IVA aggiunta
  - `extractPriceExclVAT()`: estrazione prezzo escluso IVA
  - `isValidVATMode()`: validazione vat_mode
  - `getVATModeWithFallback()`: fallback NULL → 'excluded'
- **Caratteristiche:**
  - Funzioni pure (no side effects)
  - Gestione precisione floating point
  - Backward compatibility (NULL = 'excluded')

#### 2.2 Test Suite
- **File:** `tests/pricing/vat-utils.test.ts`
- **Coverage:**
  - Normalizzazione prezzi (excluded ↔ included)
  - Calcolo importo IVA
  - Estrazione prezzo escluso IVA
  - Backward compatibility (null = 'excluded')
  - Edge cases (zero VAT, piccoli prezzi)
  - Integration scenarios (round-trip, margin calculation)
- ✅ **25 test, tutti passati**

---

### FASE 3: Pricing Engine Update

#### 3.1 Core Logic Update
- **File:** `lib/db/price-lists-advanced.ts`
- **Modifiche critiche:**

  1. **Recupero VAT mode del master list:**
     ```typescript
     // Recupera vat_mode e vat_rate del master list se presente
     if (priceList.master_list_id && priceList.list_type === 'custom') {
       const { data: masterListMeta } = await supabaseAdmin
         .from('price_lists')
         .select('vat_mode, vat_rate')
         .eq('id', priceList.master_list_id)
         .single()
       // ...
     }
     ```

  2. **Normalizzazione basePrice a IVA esclusa:**
     ```typescript
     let basePriceExclVAT = basePrice
     if (customVATMode === 'included') {
       basePriceExclVAT = normalizePrice(basePrice, 'included', 'excluded', customVATRate)
     }
     ```

  3. **Normalizzazione per confronto isManuallyModified:**
     ```typescript
     // Normalizza entrambi i valori a IVA esclusa PRIMA del confronto
     const totalCostExclVATForComparison = customVATMode === 'included'
       ? normalizePrice(totalCost, 'included', 'excluded', customVATRate)
       : totalCost
     
     const supplierTotalCostExclVATForComparison = masterVATMode === 'included'
       ? normalizePrice(supplierTotalCostRaw, 'included', 'excluded', masterVATRate)
       : supplierTotalCostRaw
     ```

  4. **Margine sempre su base IVA esclusa (Invariant #1):**
     ```typescript
     let marginExclVAT = 0
     if (isManuallyModified) {
       marginExclVAT = totalCostExclVAT - supplierTotalCostExclVAT
     } else {
       // Applica margine su base IVA esclusa
       marginExclVAT = costBaseForMarginExclVAT * (marginPercent / 100)
     }
     ```

  5. **FinalPrice riflette vat_mode del listino:**
     ```typescript
     const finalPriceWithVAT = customVATMode === 'included'
       ? (isManuallyModified 
         ? totalCost // Usa prezzo originale (già con IVA inclusa)
         : calculatePriceWithVAT(finalPriceExclVAT, customVATRate))
       : finalPriceExclVAT
     ```

  6. **Propagazione VAT semantics nel risultato:**
     ```typescript
     return {
       // ...
       vatMode: priceList.vat_mode || 'excluded',
       vatRate: customVATRate,
       vatAmount,
       totalPriceWithVAT,
       // ...
     }
     ```

#### 3.2 Fix Critico: Margine Zero con VAT Mode Diversi

**Problema identificato:**
Quando master list e custom list hanno `vat_mode` diversi (es. master 'excluded', custom 'included'), il confronto per determinare `isManuallyModified` falliva perché confrontava direttamente prezzi con basi IVA diverse.

**Soluzione:**
- Normalizzazione di entrambi i valori a IVA esclusa **prima** del confronto
- Calcolo margine sempre su base IVA esclusa
- `finalPrice` corretto quando `isManuallyModified = true` (usa prezzo originale listino)

#### 3.3 Test Suite
- **File:** `tests/pricing/vat-margin-zero-fix.test.ts`
- **Scenari testati:**
  1. Master excluded, Custom included (Margin 0) ✅
  2. Master included, Custom excluded (Margin 0) ✅
  3. Master excluded, Custom included (Margin > 0) ✅
  4. Same VAT mode (Backward Compatibility) ✅
- ✅ **4 test, tutti passati**

---

## 🔒 Invariants Implementati

1. **Invariant #1:** Margine sempre calcolato su base IVA esclusa
2. **Invariant #2:** Confronto prezzi sempre su base normalizzata (IVA esclusa)
3. **Invariant #3:** Backward compatibility: `vat_mode = NULL` → assume 'excluded'

---

## 🧪 Test Coverage

### Unit Tests
- ✅ VAT Utils: 25 test
- ✅ VAT Margin Zero Fix: 4 scenari

### Integration Tests
- ✅ Pricing engine con VAT logic
- ✅ Backward compatibility verificata

### Regression Tests
- ✅ Listini esistenti senza `vat_mode` funzionano correttamente
- ✅ Calcoli identici a prima se `vat_mode = null`

---

## 📊 Impact Analysis

### Breaking Changes
- ❌ **Nessuno** - Tutti i campi sono opzionali, backward compatible

### Database Changes
- ✅ Migration idempotente e zero-downtime
- ✅ Colonne nullable (NULL = legacy, assume 'excluded')
- ✅ Indici parziali per performance

### API Changes
- ❌ **Nessuno** - Campi VAT sono opzionali nella response

### UI Changes
- ❌ **Nessuno** - Fase 5 (UI updates) sarà in PR separata

---

## 🚀 Deployment

### Pre-requisiti
1. ✅ Migration 110 applicata al database
2. ✅ Test suite passata localmente

### Steps
1. Applicare migration 110 (idempotente, safe)
2. Deploy codice (backward compatible)
3. Verificare test suite in staging
4. Monitorare log per eventuali warning

### Rollback
- Migration può essere rollback rimuovendo colonne (non consigliato)
- Codice è backward compatible, rollback non necessario

---

## 📝 Documentazione

- ✅ ADR-001: Decisione formale VAT semantics
- ✅ Implementation Plan: Piano completo fasi 0-8
- ✅ Migration Memory: Aggiornato con sezione VAT
- ✅ Changelog: Aggiornato con modifiche

---

## 🔄 Prossimi Passi (FASE 4-8)

- **FASE 4:** Update Quote API response (campi VAT opzionali)
- **FASE 5:** UI updates con feature flag (comparator + dashboard)
- **FASE 6:** Shipment creation - persistenza VAT context
- **FASE 7:** Data migration legacy → explicit (conservativa)
- **FASE 8:** Testing completo (unit, integration, regression)

---

## ✅ Checklist Pre-Merge

- [x] Migration idempotente e testata
- [x] TypeScript types aggiornati
- [x] Utility functions implementate e testate
- [x] Pricing engine aggiornato con VAT logic
- [x] Test suite completa (29 test, tutti passati)
- [x] Backward compatibility verificata
- [x] Documentazione aggiornata (ADR, Migration Memory, Changelog)
- [x] Fix critico margine zero implementato e testato
- [x] Code review self-check completato

---

## 👥 Review Notes

### Per Reviewer

**Focus Areas:**
1. **Normalizzazione VAT:** Verificare che tutti i confronti siano su base IVA esclusa
2. **Backward Compatibility:** Verificare che listini esistenti funzionino correttamente
3. **Edge Cases:** Verificare gestione NULL, zero VAT, prezzi molto piccoli
4. **Performance:** Verificare che indici siano utilizzati correttamente

**Test da Eseguire:**
```bash
# Unit tests
npm run test tests/pricing/vat-utils.test.ts
npm run test tests/pricing/vat-margin-zero-fix.test.ts

# Type check
npm run type-check

# Lint
npm run lint
```

---

## 📌 Related Issues

- ADR-001: VAT Semantics in Price Lists
- Implementation Plan: Fase 0-3 Foundation

---

**Author:** Top Dev  
**Date:** 2026-01-XX  
**Status:** ✅ Ready for Review
