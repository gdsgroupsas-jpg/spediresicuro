# 🚀 Piano di Implementazione: VAT Semantics (ADR-001)

**Basato su:** ADR-001: VAT Semantics in Price Lists  
**Obiettivo:** Implementare semantica IVA senza rotture o regressioni  
**Strategia:** Incrementale, backward-compatible, feature-flagged

---

## 📋 Principi Guida

1. **Backward Compatibility First**: Il sistema deve funzionare anche senza `vat_mode` configurato
2. **Incremental Rollout**: Implementazione in fasi verificabili
3. **Feature Flags**: Abilitazione graduale per testing
4. **Zero Downtime**: Migrazioni non bloccanti
5. **Safe Defaults**: `vat_mode = NULL` = `'excluded'` (comportamento attuale)

---

## 🎯 Fasi di Implementazione

### FASE 0: Preparazione e Validazione (Pre-requisiti)

**Obiettivo:** Verificare stato attuale e preparare ambiente

#### Step 0.1: Audit Dati Esistenti

**Script SQL:**

```sql
-- Verifica quanti listini esistono
SELECT
  list_type,
  COUNT(*) as total,
  COUNT(CASE WHEN metadata IS NULL OR metadata = '{}' THEN 1 END) as no_metadata
FROM price_lists
GROUP BY list_type;

-- Verifica spedizioni senza vat_mode (dopo migration)
SELECT COUNT(*) as shipments_without_vat_mode
FROM shipments
WHERE vat_mode IS NULL;
```

**Output Atteso:** Baseline per confronto post-migration

---

#### Step 0.2: Test Suite Preparazione

**File:** `tests/pricing/vat-semantics.test.ts` (nuovo)

**Test da Implementare:**

- ✅ Calcolo prezzo con `vat_mode = 'excluded'` (comportamento attuale)
- ✅ Calcolo prezzo con `vat_mode = 'included'` (nuovo)
- ✅ Normalizzazione prezzi tra modalità IVA
- ✅ Margine applicato su base senza IVA
- ✅ Retrocompatibilità: `vat_mode = NULL` = `'excluded'`

**Comando:** `npm run test:vat-semantics` (nuovo script)

---

### FASE 1: Schema Migration (Sicura, Non-Breaking)

**Durata Stimata:** 1-2 giorni  
**Rischio:** 🟢 BASSO (solo aggiunta colonne nullable)

#### Step 1.1: Migration Database

**File:** `supabase/migrations/XXX_add_vat_semantics_to_price_lists.sql`

```sql
-- ============================================
-- Migration: Add VAT Semantics to Price Lists
-- Based on: ADR-001
-- ============================================

-- Step 1: Aggiungi vat_mode a price_lists (nullable, default NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'price_lists' AND column_name = 'vat_mode'
  ) THEN
    ALTER TABLE price_lists
    ADD COLUMN vat_mode TEXT CHECK (vat_mode IN ('included', 'excluded')) DEFAULT NULL;

    COMMENT ON COLUMN price_lists.vat_mode IS
      'Modalità IVA: included = prezzi con IVA inclusa, excluded = prezzi con IVA esclusa, NULL = legacy (assume esclusa)';

    RAISE NOTICE '✅ Aggiunto campo: price_lists.vat_mode';
  ELSE
    RAISE NOTICE '⚠️ Campo price_lists.vat_mode già esistente';
  END IF;
END $$;

-- Step 2: Aggiungi vat_rate a price_lists (nullable, default 22.00)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'price_lists' AND column_name = 'vat_rate'
  ) THEN
    ALTER TABLE price_lists
    ADD COLUMN vat_rate DECIMAL(5,2) DEFAULT 22.00 CHECK (vat_rate >= 0 AND vat_rate <= 100);

    COMMENT ON COLUMN price_lists.vat_rate IS
      'Aliquota IVA in percentuale (default 22% per Italia). Usato solo se vat_mode = included per calcolo reverse.';

    -- Popola vat_rate per listini esistenti (default 22%)
    UPDATE price_lists SET vat_rate = 22.00 WHERE vat_rate IS NULL;

    RAISE NOTICE '✅ Aggiunto campo: price_lists.vat_rate';
  ELSE
    RAISE NOTICE '⚠️ Campo price_lists.vat_rate già esistente';
  END IF;
END $$;

-- Step 3: Aggiungi vat_mode a shipments (nullable, default NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipments' AND column_name = 'vat_mode'
  ) THEN
    ALTER TABLE shipments
    ADD COLUMN vat_mode TEXT CHECK (vat_mode IN ('included', 'excluded')) DEFAULT NULL;

    COMMENT ON COLUMN shipments.vat_mode IS
      'Modalità IVA del prezzo finale: included = IVA inclusa, excluded = IVA esclusa, NULL = legacy (assume esclusa)';

    RAISE NOTICE '✅ Aggiunto campo: shipments.vat_mode';
  ELSE
    RAISE NOTICE '⚠️ Campo shipments.vat_mode già esistente';
  END IF;
END $$;

-- Step 4: Aggiungi vat_rate a shipments (nullable, default 22.00)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'shipments' AND column_name = 'vat_rate'
  ) THEN
    ALTER TABLE shipments
    ADD COLUMN vat_rate DECIMAL(5,2) DEFAULT 22.00 CHECK (vat_rate >= 0 AND vat_rate <= 100);

    COMMENT ON COLUMN shipments.vat_rate IS
      'Aliquota IVA applicata (default 22% per Italia)';

    -- Popola vat_rate per spedizioni esistenti (default 22%)
    UPDATE shipments SET vat_rate = 22.00 WHERE vat_rate IS NULL;

    RAISE NOTICE '✅ Aggiunto campo: shipments.vat_rate';
  ELSE
    RAISE NOTICE '⚠️ Campo shipments.vat_rate già esistente';
  END IF;
END $$;

-- Step 5: Indici per performance
CREATE INDEX IF NOT EXISTS idx_price_lists_vat_mode ON price_lists(vat_mode) WHERE vat_mode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_vat_mode ON shipments(vat_mode) WHERE vat_mode IS NOT NULL;

RAISE NOTICE '✅ Migration completata: VAT semantics aggiunte';
```

**Validazione:**

```sql
-- Verifica colonne aggiunte
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name IN ('price_lists', 'shipments')
  AND column_name IN ('vat_mode', 'vat_rate')
ORDER BY table_name, column_name;
```

**Rollback (se necessario):**

```sql
-- ⚠️ SOLO in caso di rollback completo
ALTER TABLE price_lists DROP COLUMN IF EXISTS vat_mode;
ALTER TABLE price_lists DROP COLUMN IF EXISTS vat_rate;
ALTER TABLE shipments DROP COLUMN IF EXISTS vat_mode;
ALTER TABLE shipments DROP COLUMN IF EXISTS vat_rate;
```

---

#### Step 1.2: TypeScript Types Update

**File:** `types/listini.ts`

```typescript
export interface PriceList {
  // ... campi esistenti ...

  // ✨ NUOVO: VAT Semantics (ADR-001)
  vat_mode?: 'included' | 'excluded' | null; // NULL = legacy (assume 'excluded')
  vat_rate?: number; // Default 22.00
}
```

**File:** `types/shipments.ts`

```typescript
export interface Shipment {
  // ... campi esistenti ...

  // ✨ NUOVO: VAT Semantics (ADR-001)
  vat_mode?: 'included' | 'excluded' | null; // NULL = legacy (assume 'excluded')
  vat_rate?: number; // Default 22.00
}
```

**File:** `types/listini.ts` (PriceCalculationResult)

```typescript
export interface PriceCalculationResult {
  // ... campi esistenti ...

  // ✨ NUOVO: VAT Semantics (ADR-001)
  vatMode?: 'included' | 'excluded' | null;
  vatRate?: number;
  vatAmount?: number; // Calcolato se vatMode = 'excluded'
  totalPriceWithVAT?: number; // Calcolato se vatMode = 'excluded'
}
```

**Validazione:**

- ✅ TypeScript compila senza errori
- ✅ Nessun breaking change (tutti i campi sono opzionali)

---

### FASE 2: Utility Functions (Backward Compatible)

**Durata Stimata:** 2-3 giorni  
**Rischio:** 🟢 BASSO (nuove funzioni, non modifica esistenti)

#### Step 2.1: VAT Utility Functions

**File:** `lib/pricing/vat-utils.ts` (nuovo)

```typescript
/**
 * VAT Utilities - ADR-001
 *
 * Funzioni pure per gestione semantica IVA.
 * Backward compatible: gestisce vat_mode = null come 'excluded'
 */

export type VATMode = 'included' | 'excluded' | null;

const DEFAULT_VAT_RATE = 22.0;

/**
 * Normalizza prezzo da una modalità IVA a un'altra
 *
 * @param price - Prezzo da normalizzare
 * @param fromMode - Modalità IVA corrente (null = 'excluded' per retrocompatibilità)
 * @param toMode - Modalità IVA target (null = 'excluded' per retrocompatibilità)
 * @param vatRate - Aliquota IVA (default 22%)
 * @returns Prezzo normalizzato
 */
export function normalizePrice(
  price: number,
  fromMode: VATMode,
  toMode: VATMode,
  vatRate: number = DEFAULT_VAT_RATE
): number {
  // Normalizza null a 'excluded' (retrocompatibilità)
  const from = fromMode || 'excluded';
  const to = toMode || 'excluded';

  if (from === to) return price;

  if (from === 'included' && to === 'excluded') {
    // IVA inclusa → esclusa: price / (1 + vatRate/100)
    return price / (1 + vatRate / 100);
  }

  if (from === 'excluded' && to === 'included') {
    // IVA esclusa → inclusa: price * (1 + vatRate/100)
    return price * (1 + vatRate / 100);
  }

  return price;
}

/**
 * Calcola importo IVA da prezzo escluso
 */
export function calculateVATAmount(
  priceExclVAT: number,
  vatRate: number = DEFAULT_VAT_RATE
): number {
  return priceExclVAT * (vatRate / 100);
}

/**
 * Calcola prezzo totale con IVA da prezzo escluso
 */
export function calculatePriceWithVAT(
  priceExclVAT: number,
  vatRate: number = DEFAULT_VAT_RATE
): number {
  return priceExclVAT + calculateVATAmount(priceExclVAT, vatRate);
}

/**
 * Estrae prezzo escluso IVA da prezzo incluso
 */
export function extractPriceExclVAT(
  priceInclVAT: number,
  vatRate: number = DEFAULT_VAT_RATE
): number {
  return priceInclVAT / (1 + vatRate / 100);
}

/**
 * Verifica se vat_mode è valido (non null o 'excluded'/'included')
 */
export function isValidVATMode(mode: VATMode): mode is 'included' | 'excluded' {
  return mode === 'included' || mode === 'excluded';
}

/**
 * Ottiene modalità IVA con fallback (null → 'excluded')
 */
export function getVATModeWithFallback(mode: VATMode): 'included' | 'excluded' {
  return mode || 'excluded';
}
```

**Test:** `tests/pricing/vat-utils.test.ts` (nuovo)

```typescript
import { normalizePrice, calculateVATAmount, extractPriceExclVAT } from '@/lib/pricing/vat-utils';

describe('VAT Utils', () => {
  it('normalizes price from excluded to included', () => {
    const result = normalizePrice(100, 'excluded', 'included', 22);
    expect(result).toBeCloseTo(122, 2);
  });

  it('normalizes price from included to excluded', () => {
    const result = normalizePrice(122, 'included', 'excluded', 22);
    expect(result).toBeCloseTo(100, 2);
  });

  it('handles null as excluded (backward compatibility)', () => {
    const result = normalizePrice(100, null, 'included', 22);
    expect(result).toBeCloseTo(122, 2);
  });

  // ... altri test
});
```

**Validazione:**

- ✅ Tutti i test passano
- ✅ Funzioni pure (no side effects)
- ✅ Backward compatible (null = 'excluded')

---

### FASE 3: Pricing Engine Update (Backward Compatible)

**Durata Stimata:** 3-4 giorni  
**Rischio:** 🟡 MEDIO (modifica logica core, ma con fallback)

#### Step 3.1: Update calculatePriceWithRules

**File:** `lib/db/price-lists-advanced.ts`

**Strategia:** Aggiungere logica VAT senza modificare comportamento esistente

```typescript
// Import utility VAT
import {
  normalizePrice,
  getVATModeWithFallback,
  calculateVATAmount,
  calculatePriceWithVAT,
} from '@/lib/pricing/vat-utils';

async function calculatePriceWithRule(
  priceList: PriceList,
  rule: PriceRule,
  params: {
    /* ... */
  }
): Promise<PriceCalculationResult> {
  // ... logica esistente per basePrice, surcharges ...

  // ✨ NUOVO: Gestione VAT (ADR-001)
  const vatMode = getVATModeWithFallback(priceList.vat_mode); // null → 'excluded'
  const vatRate = priceList.vat_rate || 22.0;

  // Normalizza basePrice a IVA esclusa per calcoli
  let basePriceExclVAT = basePrice;
  if (vatMode === 'included') {
    basePriceExclVAT = normalizePrice(basePrice, 'included', 'excluded', vatRate);
  }

  // Surcharges sono sempre IVA esclusa (assunzione)
  const totalCostExclVAT = basePriceExclVAT + surcharges;

  // Calcola margine su base IVA esclusa (Invariant #1)
  let margin = 0;
  if (rule.margin_type === 'percent' && rule.margin_value) {
    margin = totalCostExclVAT * (rule.margin_value / 100);
  } else if (rule.margin_type === 'fixed' && rule.margin_value) {
    margin = rule.margin_value;
  }

  const finalPriceExclVAT = totalCostExclVAT + margin;

  // Se listino ha IVA inclusa, converti prezzo finale
  const finalPrice =
    vatMode === 'included' ? calculatePriceWithVAT(finalPriceExclVAT, vatRate) : finalPriceExclVAT;

  // Calcola importo IVA se necessario
  const vatAmount =
    vatMode === 'excluded'
      ? calculateVATAmount(finalPriceExclVAT, vatRate)
      : finalPrice - finalPriceExclVAT;

  return {
    basePrice: basePriceExclVAT, // Sempre IVA esclusa per consistenza
    surcharges,
    margin,
    totalCost: totalCostExclVAT, // Sempre IVA esclusa
    finalPrice, // Nella modalità IVA del listino
    vatMode: priceList.vat_mode || 'excluded', // Propaga vat_mode
    vatRate,
    vatAmount,
    totalPriceWithVAT: vatMode === 'excluded' ? finalPrice + vatAmount : finalPrice,
    // ... altri campi esistenti ...
  };
}
```

**Validazione:**

- ✅ Test esistenti continuano a passare (backward compatibility)
- ✅ Nuovi test per `vat_mode = 'included'` passano
- ✅ Comportamento con `vat_mode = null` identico a prima

---

#### Step 3.2: Update calculateWithDefaultMargin

**File:** `lib/db/price-lists-advanced.ts`

**Stessa strategia:** Aggiungere logica VAT mantenendo comportamento esistente

```typescript
async function calculateWithDefaultMargin(
  priceList: PriceList,
  params: {
    /* ... */
  }
): Promise<PriceCalculationResult> {
  // ... logica esistente ...

  // ✨ NUOVO: Gestione VAT (stessa logica di calculatePriceWithRule)
  const vatMode = getVATModeWithFallback(priceList.vat_mode);
  const vatRate = priceList.vat_rate || 22.0;

  // Normalizza basePrice a IVA esclusa
  let basePriceExclVAT = basePrice;
  if (vatMode === 'included') {
    basePriceExclVAT = normalizePrice(basePrice, 'included', 'excluded', vatRate);
  }

  const totalCostExclVAT = basePriceExclVAT + surcharges;

  // Margine sempre su base IVA esclusa
  let margin = 0;
  if (priceList.default_margin_percent) {
    margin = totalCostExclVAT * (priceList.default_margin_percent / 100);
  } else if (priceList.default_margin_fixed) {
    margin = priceList.default_margin_fixed;
  }

  const finalPriceExclVAT = totalCostExclVAT + margin;
  const finalPrice =
    vatMode === 'included' ? calculatePriceWithVAT(finalPriceExclVAT, vatRate) : finalPriceExclVAT;

  // ... resto della logica ...
}
```

---

### FASE 4: Quote API Update (Backward Compatible)

**Durata Stimata:** 2-3 giorni  
**Rischio:** 🟢 BASSO (aggiunta campi opzionali alla risposta)

#### Step 4.1: Update Quote API Response

**File:** `app/api/quotes/db/route.ts`

**Strategia:** Aggiungere campi VAT alla risposta senza modificare struttura esistente

```typescript
if (quoteResult && quoteResult.finalPrice) {
  const rate = {
    // ... campi esistenti (non modificati) ...
    total_price: quoteResult.finalPrice.toString(),
    weight_price: supplierPrice.toString(),
    base_price: quoteResult.basePrice?.toString() || supplierPrice.toString(),
    surcharges: quoteResult.surcharges?.toString() || '0',
    margin: quoteResult.margin?.toString() || '0',

    // ✨ NUOVO: VAT Semantics (ADR-001) - Campi opzionali
    vat_mode: quoteResult.vatMode || 'excluded', // Default per retrocompatibilità
    vat_rate: (quoteResult.vatRate || 22.0).toString(),
    vat_amount: quoteResult.vatAmount?.toString() || '0',
    total_price_with_vat:
      quoteResult.totalPriceWithVAT?.toString() || quoteResult.finalPrice.toString(),

    // ... altri campi esistenti ...
  };

  rates.push(rate);
}
```

**Validazione:**

- ✅ Frontend esistente continua a funzionare (campi VAT ignorati se non usati)
- ✅ Nuovo frontend può leggere campi VAT
- ✅ Test API esistenti passano

---

### FASE 5: UI Updates (Feature Flag)

**Durata Stimata:** 4-5 giorni  
**Rischio:** 🟡 MEDIO (modifica UI, ma con feature flag)

#### Step 5.1: Feature Flag Setup

**File:** `lib/config/feature-flags.ts` (nuovo o esistente)

```typescript
export const featureFlags = {
  // ... altri flag ...

  /**
   * Abilita visualizzazione semantica IVA (ADR-001)
   * Default: false (gradual rollout)
   */
  showVATSemantics: process.env.NEXT_PUBLIC_SHOW_VAT_SEMANTICS === 'true',
};
```

**File:** `.env.local` (esempio)

```bash
# Feature Flag: VAT Semantics
NEXT_PUBLIC_SHOW_VAT_SEMANTICS=false  # Abilitare gradualmente
```

---

#### Step 5.2: Update Quote Comparator

**File:** `components/shipments/intelligent-quote-comparator.tsx`

**Strategia:** Aggiungere badge VAT solo se feature flag abilitato

```typescript
import { featureFlags } from "@/lib/config/feature-flags";

function QuoteTableRow({ quote /* ... */ }) {
  // ... logica esistente ...

  const showVAT = featureFlags.showVATSemantics;
  const vatMode = quote.vat_mode || "excluded"; // Default per retrocompatibilità
  const vatRate = parseFloat(quote.vat_rate || "22.00");

  return (
    <tr>
      {/* ... colonne esistenti ... */}

      {/* Colonna Prezzo Vendita */}
      <td className="px-3 py-2.5 text-right">
        <span className="text-base font-bold text-[#FF9500]">
          €{totalPrice.toFixed(2)}
        </span>

        {/* ✨ NUOVO: Badge VAT (solo se feature flag abilitato) */}
        {showVAT && (
          <div className="text-xs text-gray-500 mt-0.5">
            {vatMode === "excluded" ? (
              <span>+ IVA {vatRate}%</span>
            ) : (
              <span className="text-green-600">IVA incl.</span>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}
```

**Validazione:**

- ✅ Con feature flag OFF: UI identica a prima
- ✅ Con feature flag ON: Badge VAT visibili
- ✅ Test UI esistenti passano

---

#### Step 5.3: Update Dashboard

**File:** `app/dashboard/spedizioni/page.tsx`

**Stessa strategia:** Feature flag + badge VAT

```typescript
import { featureFlags } from "@/lib/config/feature-flags";

// Nel rendering prezzo
{
  spedizione.prezzoFinale > 0 && (
    <div>
      <span className="text-sm font-medium text-gray-900">
        {formatPrice(spedizione.prezzoFinale)}
      </span>

      {/* ✨ NUOVO: Badge VAT (solo se feature flag abilitato) */}
      {featureFlags.showVATSemantics && spedizione.vat_mode && (
        <span className="text-xs text-gray-500 ml-1">
          {spedizione.vat_mode === "excluded"
            ? `+ IVA ${spedizione.vat_rate || 22}%`
            : "IVA incl."}
        </span>
      )}
    </div>
  );
}
```

---

### FASE 6: Shipment Creation Update

**Durata Stimata:** 2-3 giorni  
**Rischio:** 🟡 MEDIO (modifica persistenza, ma con fallback)

#### Step 6.1: Update Shipment Creation

**File:** `lib/shipments/create-shipment-core.ts`

**Strategia:** Salvare VAT context se disponibile, altrimenti NULL (legacy)

```typescript
// Nel insertShipmentFn
const { data, error } = await supabaseAdmin.from('shipments').insert({
  // ... campi esistenti ...
  total_cost: args.finalCost,

  // ✨ NUOVO: VAT Semantics (se disponibile dal quote)
  vat_mode: (args.validated as any).vat_mode || null, // NULL = legacy
  vat_rate: (args.validated as any).vat_rate || 22.0, // Default per retrocompatibilità
});
```

**File:** `app/api/shipments/create/route.ts`

**Strategia:** Passare VAT context dal quote selezionato

```typescript
// Quando si crea spedizione da quote selezionato
const validated = {
  // ... campi esistenti ...

  // ✨ NUOVO: Propaga VAT context dal quote
  vat_mode: (body as any).vat_mode || null,
  vat_rate: (body as any).vat_rate || 22.0,
};
```

**Validazione:**

- ✅ Spedizioni create senza VAT context funzionano (vat_mode = NULL)
- ✅ Spedizioni create con VAT context salvano correttamente
- ✅ Test esistenti passano

---

### FASE 7: Data Migration (Legacy → Explicit)

**Durata Stimata:** 1-2 giorni  
**Rischio:** 🟢 BASSO (solo UPDATE, non breaking)

#### Step 7.1: Migrazione Listini Esistenti

**Script SQL:** `supabase/migrations/XXX_migrate_legacy_vat_mode.sql`

```sql
-- ============================================
-- Migration: Set explicit vat_mode for legacy price lists
-- ============================================

-- Strategia conservativa: assume tutti i listini esistenti sono IVA esclusa
-- Superadmin può correggere manualmente se necessario

UPDATE price_lists
SET
  vat_mode = 'excluded',
  vat_rate = 22.00
WHERE vat_mode IS NULL;

-- Verifica
SELECT
  vat_mode,
  COUNT(*) as count
FROM price_lists
GROUP BY vat_mode;
```

**Nota:** Questo script è **conservativo**. Se alcuni listini hanno IVA inclusa, devono essere corretti manualmente.

---

#### Step 7.2: Migrazione Spedizioni Esistenti

**Script SQL:** `supabase/migrations/XXX_migrate_legacy_shipments_vat_mode.sql`

```sql
-- ============================================
-- Migration: Set explicit vat_mode for legacy shipments
-- ============================================

-- Strategia conservativa: assume tutte le spedizioni esistenti sono IVA esclusa
UPDATE shipments
SET
  vat_mode = 'excluded',
  vat_rate = 22.00
WHERE vat_mode IS NULL;

-- Verifica
SELECT
  vat_mode,
  COUNT(*) as count
FROM shipments
GROUP BY vat_mode;
```

---

### FASE 8: Testing e Validazione

**Durata Stimata:** 3-4 giorni  
**Rischio:** 🟢 BASSO (solo testing)

#### Step 8.1: Unit Tests

**File:** `tests/pricing/vat-semantics.test.ts`

- ✅ Calcolo prezzo con `vat_mode = 'excluded'`
- ✅ Calcolo prezzo con `vat_mode = 'included'`
- ✅ Normalizzazione prezzi
- ✅ Margine applicato su base IVA esclusa
- ✅ Retrocompatibilità (`vat_mode = null`)

**Comando:** `npm run test:vat-semantics`

---

#### Step 8.2: Integration Tests

**File:** `tests/integration/vat-semantics-flow.test.ts`

- ✅ Quote API restituisce campi VAT
- ✅ Shipment creation salva VAT context
- ✅ Dashboard mostra badge VAT (se feature flag ON)
- ✅ Comparatore normalizza prezzi per confronto

**Comando:** `npm run test:integration:vat`

---

#### Step 8.3: Regression Tests

**File:** `tests/regression/vat-backward-compatibility.test.ts`

- ✅ Quote API funziona senza campi VAT (retrocompatibilità)
- ✅ Shipment creation funziona senza VAT context
- ✅ Dashboard funziona senza badge VAT (feature flag OFF)
- ✅ Prezzi calcolati identici a prima (se `vat_mode = null`)

**Comando:** `npm run test:regression:vat`

---

#### Step 8.4: Manual Testing Checklist

- [ ] Creare listino con `vat_mode = 'excluded'` → Prezzi calcolati correttamente
- [ ] Creare listino con `vat_mode = 'included'` → Prezzi calcolati correttamente
- [ ] Comparatore mostra badge VAT (se feature flag ON)
- [ ] Creare spedizione → VAT context salvato correttamente
- [ ] Dashboard mostra badge VAT (se feature flag ON)
- [ ] Listini esistenti funzionano (vat_mode = null = 'excluded')

---

### FASE 9: Gradual Rollout

**Durata Stimata:** 1-2 settimane  
**Rischio:** 🟢 BASSO (rollout graduale)

#### Step 9.1: Internal Testing

**Settimana 1:**

- Feature flag ON per superadmin
- Test con listini reali
- Verifica calcoli
- Correzione eventuali bug

---

#### Step 9.2: Beta Users

**Settimana 2:**

- Feature flag ON per utenti beta selezionati
- Monitoraggio errori
- Feedback utenti
- Aggiustamenti UI se necessario

---

#### Step 9.3: Full Rollout

**Settimana 3:**

- Feature flag ON per tutti
- Monitoraggio produzione
- Documentazione utente
- Training se necessario

---

## 🔄 Rollback Strategy

### Scenario 1: Problemi in FASE 1-2 (Schema/Utils)

**Rollback:**

```sql
-- Rimuovi colonne (solo se necessario)
ALTER TABLE price_lists DROP COLUMN IF EXISTS vat_mode;
ALTER TABLE price_lists DROP COLUMN IF EXISTS vat_rate;
ALTER TABLE shipments DROP COLUMN IF EXISTS vat_mode;
ALTER TABLE shipments DROP COLUMN IF EXISTS vat_rate;
```

**Rischio:** 🟡 MEDIO (perdita dati VAT se già popolati)

---

### Scenario 2: Problemi in FASE 3-4 (Pricing/API)

**Rollback:**

- Revert commit FASE 3-4
- Feature flag OFF
- Sistema torna a comportamento precedente

**Rischio:** 🟢 BASSO (schema rimane, ma non usato)

---

### Scenario 3: Problemi in FASE 5 (UI)

**Rollback:**

- Feature flag OFF
- UI torna a versione precedente

**Rischio:** 🟢 BASSO (solo UI, logica backend intatta)

---

## 📊 Monitoring e Validazione

### Metriche da Monitorare

1. **Errori Pricing:**
   - Conteggio errori in calcolo prezzi
   - Confronto pre/post implementazione

2. **Performance:**
   - Tempo risposta Quote API
   - Tempo calcolo pricing engine

3. **Dati:**
   - % listini con `vat_mode` esplicito
   - % spedizioni con `vat_mode` esplicito

4. **UI:**
   - Errori rendering badge VAT
   - Feedback utenti

---

### Query Validazione

```sql
-- Verifica consistenza dati
SELECT
  'price_lists' as table_name,
  COUNT(*) as total,
  COUNT(CASE WHEN vat_mode IS NULL THEN 1 END) as null_vat_mode,
  COUNT(CASE WHEN vat_mode = 'excluded' THEN 1 END) as excluded,
  COUNT(CASE WHEN vat_mode = 'included' THEN 1 END) as included
FROM price_lists
UNION ALL
SELECT
  'shipments' as table_name,
  COUNT(*) as total,
  COUNT(CASE WHEN vat_mode IS NULL THEN 1 END) as null_vat_mode,
  COUNT(CASE WHEN vat_mode = 'excluded' THEN 1 END) as excluded,
  COUNT(CASE WHEN vat_mode = 'included' THEN 1 END) as included
FROM shipments;
```

---

## ✅ Checklist Finale

### Pre-Deploy

- [ ] Migration testata su ambiente staging
- [ ] Unit tests passano (100%)
- [ ] Integration tests passano
- [ ] Regression tests passano
- [ ] Manual testing completato
- [ ] Feature flag configurato
- [ ] Rollback strategy documentata

### Post-Deploy

- [ ] Migration applicata con successo
- [ ] Dati legacy migrati
- [ ] Feature flag OFF (gradual rollout)
- [ ] Monitoring attivo
- [ ] Documentazione aggiornata

### Post-Rollout

- [ ] Feature flag ON per tutti
- [ ] Nessun errore critico
- [ ] Performance invariata
- [ ] Feedback utenti positivo

---

## 📚 Documentazione

### Per Sviluppatori

- ADR-001: Decisione architetturale
- Questo documento: Piano implementazione
- Code comments: Funzioni VAT utilities

### Per Utenti

- Guida: "Come configurare IVA nei listini"
- FAQ: "Cosa significa IVA inclusa/esclusa?"
- Changelog: Note di rilascio

---

**Fine Piano Implementazione**
