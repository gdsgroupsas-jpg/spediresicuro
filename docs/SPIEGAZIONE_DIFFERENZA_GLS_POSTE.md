# 🔍 Spiegazione: Perché GLS funziona e Poste no (stessa logica ma comportamento diverso)

## ✅ La Logica è la STESSA

Entrambi (GLS e Poste) seguono **la stessa logica** nel codice:

- Entrambi hanno listini `custom` con `master_list_id`
- Entrambi recuperano `supplierPrice` dal master
- Entrambi usano la funzione `calculateWithDefaultMargin`

## ⚠️ MA c'è una Logica Speciale: `isManuallyModified`

Nel codice (`lib/db/price-lists-advanced.ts`, linea 620-640) c'è una logica speciale:

```typescript
const supplierTotalCost = supplierBasePrice > 0 ? supplierBasePrice + supplierSurcharges : 0;
const isManuallyModified = supplierTotalCost > 0 && Math.abs(totalCost - supplierTotalCost) > 0.01;

if (isManuallyModified) {
  // ✅ PREZZI MODIFICATI MANUALMENTE
  // Il prezzo nel listino CUSTOM è diverso dal master
  // Il margine è già incluso nel prezzo personalizzato
  margin = totalCost - supplierTotalCost;
  finalPrice = totalCost; // Non aggiungiamo margine, è già incluso
} else {
  // ⚠️ PREZZI NON MODIFICATI
  // Il prezzo nel listino CUSTOM è identico al master
  // Applica margine di default dal listino
  if (priceList.default_margin_percent) {
    margin = totalCost * (priceList.default_margin_percent / 100);
  } else if (priceList.default_margin_fixed) {
    margin = priceList.default_margin_fixed;
  }
  finalPrice = totalCost + margin;
}
```

## 🎯 Differenza tra GLS e Poste

### Scenario GLS (funziona)

1. **Listino CUSTOM**: Ha prezzi **modificati manualmente** rispetto al master
2. **`isManuallyModified = true`**:
   - `totalCost` (dal CUSTOM) = 8.00
   - `supplierTotalCost` (dal master) = 4.27
   - Differenza > 0.01 → `isManuallyModified = true`
3. **Calcolo**:
   - `margin = 8.00 - 4.27 = 3.73` ✅
   - `finalPrice = 8.00` ✅
   - `supplierPrice = 4.27` ✅
4. **Risultato**: costo ≠ prezzo vendita ✅

### Scenario Poste Italiane (non funziona)

1. **Listino CUSTOM**: Ha prezzi **identici** al master (non modificati)
2. **`isManuallyModified = false`**:
   - `totalCost` (dal CUSTOM) = 4.40
   - `supplierTotalCost` (dal master) = 4.40
   - Differenza < 0.01 → `isManuallyModified = false`
3. **Calcolo**:
   - Entra nel branch `else`
   - Verifica `default_margin_percent` → **NULL** ❌
   - Verifica `default_margin_fixed` → **NULL** ❌
   - `margin = 0` ❌
   - `finalPrice = 4.40 + 0 = 4.40` ❌
   - `supplierPrice = 4.40` (dal master) ✅
4. **Risultato**: costo = prezzo vendita = 4.40 ❌

## 💡 Soluzione

Il listino CUSTOM di Poste ha due opzioni:

### Opzione 1: Modificare i prezzi manualmente (come GLS)

- Modifica i prezzi nel listino CUSTOM per differenziarli dal master
- Es: Master = 4.40, CUSTOM = 4.84 (con +10% margine incluso)
- Il sistema calcolerà automaticamente: `margin = 4.84 - 4.40 = 0.44`

### Opzione 2: Aggiungere margine di default (più semplice)

```sql
UPDATE price_lists
SET default_margin_percent = 10  -- 10% = 0.44€ su 4.40€
WHERE id = '<id_listino_custom_poste>'
  AND list_type = 'custom'
  AND master_list_id IS NOT NULL;
```

## 📊 Riepilogo

| Aspetto                     | GLS                     | Poste                 |
| --------------------------- | ----------------------- | --------------------- |
| Listino tipo                | `custom`                | `custom`              |
| Ha `master_list_id`         | ✅ Sì                   | ✅ Sì                 |
| Prezzi modificati vs master | ✅ Sì (diversi)         | ❌ No (identici)      |
| `isManuallyModified`        | ✅ `true`               | ❌ `false`            |
| `default_margin_percent`    | N/A (non serve)         | ❌ NULL               |
| Calcolo margine             | Automatico (differenza) | ❌ 0 (nessun margine) |
| Risultato                   | ✅ Funziona             | ❌ Non funziona       |

## ✅ Conclusione

**Sì, seguono la stessa logica**, ma:

- **GLS**: Prezzi modificati manualmente → margine calcolato automaticamente
- **Poste**: Prezzi identici al master + nessun margine configurato → margine = 0

**Soluzione**: Aggiungere `default_margin_percent` al listino CUSTOM di Poste, oppure modificare i prezzi per differenziarli dal master.
