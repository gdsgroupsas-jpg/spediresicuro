# ✅ Fix: Margine Default per Tutti i Corrieri nel Comparatore

## 🎯 Obiettivo

Garantire che **OGNI corriere nel comparatore** (ora e in futuro) segua la **stessa logica** e mostri sempre un margine, anche se non configurato esplicitamente nel listino.

## 🔧 Modifiche Implementate

### File: `lib/db/price-lists-advanced.ts`

#### 1. Import Configurazione Margine Globale

```typescript
import { pricingConfig } from '@/lib/config';
```

Usa `pricingConfig.DEFAULT_MARGIN_PERCENT = 20%` come margine di fallback.

#### 2. Fix in `calculateWithDefaultMargin` - Branch `else` (prezzi identici al master)

**Prima:**

```typescript
} else {
  // Prezzi non modificati: applica margine di default
  if (priceList.default_margin_percent) {
    margin = totalCost * (priceList.default_margin_percent / 100)
  } else if (priceList.default_margin_fixed) {
    margin = priceList.default_margin_fixed
  }
  // Se non c'è margine configurato → margin = 0 ❌
  finalPrice = totalCost + margin
}
```

**Dopo:**

```typescript
} else {
  // Prezzi non modificati: applica margine di default
  if (priceList.default_margin_percent) {
    margin = totalCost * (priceList.default_margin_percent / 100)
  } else if (priceList.default_margin_fixed) {
    margin = priceList.default_margin_fixed
  } else {
    // ✨ FIX: Se listino CUSTOM con master ma senza margine configurato,
    // applica margine di default globale per garantire consistenza nel comparatore
    if (priceList.list_type === 'custom' && priceList.master_list_id) {
      margin = totalCost * (pricingConfig.DEFAULT_MARGIN_PERCENT / 100)
      console.log(`⚠️ [PRICE CALC] Listino CUSTOM senza margine configurato, applicato margine default globale ${pricingConfig.DEFAULT_MARGIN_PERCENT}%: €${margin.toFixed(2)}`)
    }
  }
  finalPrice = totalCost + margin
}
```

#### 3. Fix nel Fallback (quando non trova entry nella matrice)

**Prima:**

```typescript
let margin = 0;
if (priceList.default_margin_percent) {
  margin = totalCost * (priceList.default_margin_percent / 100);
} else if (priceList.default_margin_fixed) {
  margin = priceList.default_margin_fixed;
}
// Se non c'è margine → margin = 0 ❌
```

**Dopo:**

```typescript
let margin = 0;
if (priceList.default_margin_percent) {
  margin = totalCost * (priceList.default_margin_percent / 100);
} else if (priceList.default_margin_fixed) {
  margin = priceList.default_margin_fixed;
} else {
  // ✨ FIX: Se listino CUSTOM con master ma senza margine configurato,
  // applica margine di default globale
  if (priceList.list_type === 'custom' && priceList.master_list_id) {
    margin = totalCost * (pricingConfig.DEFAULT_MARGIN_PERCENT / 100);
    console.log(
      `⚠️ [PRICE CALC] Listino CUSTOM senza margine configurato (fallback), applicato margine default globale ${pricingConfig.DEFAULT_MARGIN_PERCENT}%: €${margin.toFixed(2)}`
    );
  }
}
```

#### 4. Aggiunto `supplierPrice` nel Return

Aggiunto `supplierPrice` nel risultato anche quando `isManuallyModified = false`, per garantire che il costo fornitore sia sempre disponibile nel comparatore.

## 📊 Comportamento Dopo la Fix

### Scenario: Listino CUSTOM con Master, Prezzi Identici, Senza Margine Configurato

**Prima della fix:**

- `isManuallyModified = false` (prezzi identici al master)
- `default_margin_percent = NULL`
- `margin = 0` ❌
- `finalPrice = totalCost = 4.40` ❌
- `supplierPrice = 4.40` (dal master)
- **Risultato**: costo = prezzo vendita = 4.40 ❌

**Dopo la fix:**

- `isManuallyModified = false` (prezzi identici al master)
- `default_margin_percent = NULL`
- **`margin = totalCost * 20% = 0.88`** ✅ (margine default globale)
- `finalPrice = totalCost + margin = 4.40 + 0.88 = 5.28` ✅
- `supplierPrice = 4.40` (dal master)
- **Risultato**: costo (4.40) ≠ prezzo vendita (5.28) ✅

## ✅ Garantisce

1. **Consistenza**: Tutti i corrieri nel comparatore seguono la stessa logica
2. **Margine sempre presente**: Anche se non configurato, viene applicato il margine default globale (20%)
3. **Retrocompatibilità**: Listini con margine configurato continuano a funzionare come prima
4. **Futuro-proof**: Nuovi corrieri aggiunti seguiranno automaticamente questa logica

## 🔍 Log di Debug

Quando viene applicato il margine default globale, viene loggato:

```
⚠️ [PRICE CALC] Listino CUSTOM senza margine configurato, applicato margine default globale 20%: €0.88
```

Questo aiuta a identificare listini che potrebbero beneficiare di una configurazione esplicita del margine.

## 📝 Note

- Il margine default globale è configurato in `lib/config.ts`: `pricingConfig.DEFAULT_MARGIN_PERCENT = 20`
- La fix si applica **solo** a listini `custom` con `master_list_id` (listini personalizzati)
- Listini `supplier` senza master continuano a comportarsi come prima (non hanno `supplierPrice`)

## 🎯 Risultato

**OGNI corriere nel comparatore** (GLS, Poste Italiane, e qualsiasi futuro corriere) mostrerà sempre:

- ✅ Costo fornitore (dal master)
- ✅ Margine (configurato o default globale)
- ✅ Prezzo vendita (costo + margine)

**Nessun corriere mostrerà più costo = prezzo vendita** (a meno che non sia intenzionale).
