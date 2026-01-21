# 🔍 Analisi Problema: Perché vedi 4.4 nel comparatore (GLS vs Poste Italiane)

## 📋 Problema

Nel comparatore preventivi:

- **GLS 5000**: Mostra costo fornitore €4.27 + margine €3.73 = prezzo vendita €8.00 ✅
- **Poste Italiane Express H24+**: Mostra costo fornitore €4.40 = prezzo vendita €4.40 (senza margine) ❌

## 🔬 Analisi Logica del Codice

### 1. Calcolo Prezzo (`lib/db/price-lists-advanced.ts`)

#### Funzione `calculateWithDefaultMargin` (linea 543-692)

**Logica per recupero `supplierPrice`:**

```typescript
// ✨ ENTERPRISE: Se è un listino personalizzato con master_list_id, recupera prezzo originale fornitore
if (priceList.master_list_id && priceList.list_type === 'custom') {
  // Recupera prezzo dal listino master
  supplierBasePrice = masterMatrixResult.basePrice;
  supplierSurcharges = masterMatrixResult.surcharges || 0;
  // ...
}
```

**Punti critici:**

- `supplierPrice` viene calcolato **SOLO** se:
  - `list_type === 'custom'` **E**
  - `master_list_id IS NOT NULL`
- Se il listino è `supplier` (senza `master_list_id`), `supplierPrice` rimane `undefined`

#### Calcolo Margine (linea 666-673)

```typescript
let margin = 0;
if (priceList.default_margin_percent) {
  margin = totalCost * (priceList.default_margin_percent / 100);
} else if (priceList.default_margin_fixed) {
  margin = priceList.default_margin_fixed;
}
const finalPrice = totalCost + margin;
```

**Se non c'è margine configurato:**

- `margin = 0`
- `finalPrice = totalCost`

### 2. Mapping nel Route (`app/api/quotes/db/route.ts`, linea 345)

```typescript
const supplierPrice =
  quoteResult.supplierPrice ?? quoteResult.totalCost ?? quoteResult.basePrice ?? 0;
```

**Problema del fallback:**

- Se `supplierPrice` è `undefined` → usa `totalCost`
- Se `totalCost = finalPrice` (senza margine) → `supplierPrice = finalPrice`
- **Risultato**: costo fornitore = prezzo vendita

### 3. Visualizzazione nel Comparatore (`components/shipments/intelligent-quote-comparator.tsx`, linea 1407-1410)

```typescript
const supplierPrice = bestRate ? parseFloat(bestRate.weight_price || '0') : 0;
const totalPrice = bestRate ? parseFloat(bestRate.total_price || '0') : 0;
const margin = totalPrice - supplierPrice;
```

**Se `weight_price = total_price`:**

- `margin = 0`
- Non viene mostrato il margine nella UI

## 🎯 Differenza tra GLS e Poste Italiane

### Scenario GLS (funziona correttamente)

1. **Listino tipo**: `custom`
2. **Ha `master_list_id`**: Sì → punta al listino fornitore originale
3. **Logica**:
   - Recupera costo fornitore dal master → `supplierPrice = 4.27`
   - Applica margine → `finalPrice = 4.27 + 3.73 = 8.00`
   - Nel route: `supplierPrice = quoteResult.supplierPrice` (4.27)
   - **Risultato**: costo ≠ prezzo vendita ✅

### Scenario Poste Italiane (problema)

1. **Listino tipo**: `supplier` (dalle immagini: "Pdb 5000 postedeliverybusiness")
2. **Ha `master_list_id`**: No → è il listino master stesso
3. **Ha margine configurato**: No (dalle immagini: "Margine Default: -")
4. **Logica**:
   - Non recupera `supplierPrice` (linea 570: solo se `master_list_id` e `custom`)
   - `supplierPrice = undefined`
   - `margin = 0` (nessun margine configurato)
   - `finalPrice = totalCost = 4.40`
   - Nel route: `supplierPrice = quoteResult.totalCost` (fallback errato)
   - **Risultato**: costo = prezzo vendita = 4.40 ❌

## 🔍 Verifica nel Database

Esegui le query SQL in `scripts/verify-price-lists-config.sql` nel Supabase SQL Editor per verificare:

1. **Tipo listino** (`list_type`): `supplier` vs `custom`
2. **Master List ID** (`master_list_id`): Se presente, il listino ha un master
3. **Margini** (`default_margin_percent`, `default_margin_fixed`): Se configurati
4. **Metadata** (`contract_code`, `carrier_code`): Per matching

### Query da eseguire:

```sql
-- Listini GLS attivi
SELECT
  pl.id,
  pl.name,
  pl.list_type,
  pl.master_list_id,
  pl.default_margin_percent,
  pl.default_margin_fixed,
  CASE
    WHEN pl.list_type = 'custom' AND pl.master_list_id IS NOT NULL THEN
      '✅ CUSTOM con master → supplierPrice calcolato'
    WHEN pl.list_type = 'supplier' AND pl.master_list_id IS NULL THEN
      CASE
        WHEN pl.default_margin_percent IS NULL AND pl.default_margin_fixed IS NULL THEN
          '❌ SUPPLIER senza master e senza margine → PROBLEMA'
        ELSE
          '⚠️ SUPPLIER senza master ma con margine'
      END
  END as analisi_logica
FROM price_lists pl
WHERE pl.status = 'active'
  AND (pl.metadata->>'carrier_code' ILIKE '%gls%' OR pl.name ILIKE '%gls%')
ORDER BY pl.created_at DESC;

-- Listini Poste Italiane attivi
SELECT
  pl.id,
  pl.name,
  pl.list_type,
  pl.master_list_id,
  pl.default_margin_percent,
  pl.default_margin_fixed,
  CASE
    WHEN pl.list_type = 'custom' AND pl.master_list_id IS NOT NULL THEN
      '✅ CUSTOM con master → supplierPrice calcolato'
    WHEN pl.list_type = 'supplier' AND pl.master_list_id IS NULL THEN
      CASE
        WHEN pl.default_margin_percent IS NULL AND pl.default_margin_fixed IS NULL THEN
          '❌ SUPPLIER senza master e senza margine → PROBLEMA'
        ELSE
          '⚠️ SUPPLIER senza master ma con margine'
      END
  END as analisi_logica
FROM price_lists pl
WHERE pl.status = 'active'
  AND (pl.metadata->>'carrier_code' ILIKE '%poste%' OR pl.name ILIKE '%pdb%' OR pl.name ILIKE '%poste%')
ORDER BY pl.created_at DESC;
```

## 💡 Soluzioni Possibili

### Soluzione 1: Creare Listino CUSTOM per Poste (Consigliata)

1. Clonare il listino SUPPLIER "Pdb 5000 postedeliverybusiness"
2. Creare nuovo listino CUSTOM con:
   - `list_type = 'custom'`
   - `master_list_id = <id_listino_supplier>`
   - `default_margin_percent = 10` (o valore desiderato)
3. Attivare il listino CUSTOM

**Vantaggi:**

- ✅ `supplierPrice` viene calcolato correttamente dal master
- ✅ Separazione tra listino fornitore e listino vendita
- ✅ Tracciabilità completa

### Soluzione 2: Aggiungere Margine al Listino SUPPLIER

1. Aggiornare il listino "Pdb 5000 postedeliverybusiness":
   ```sql
   UPDATE price_lists
   SET default_margin_percent = 10  -- o valore desiderato
   WHERE name ILIKE '%pdb 5000%'
     AND list_type = 'supplier'
     AND status = 'active';
   ```

**Svantaggi:**

- ⚠️ `supplierPrice` rimane `undefined` (non viene calcolato)
- ⚠️ Nel route, fallback usa ancora `totalCost`
- ⚠️ Non mostra correttamente il costo fornitore

### Soluzione 3: Correggere Fallback nel Route

Modificare `app/api/quotes/db/route.ts` (linea 345):

```typescript
// ✨ FIX: Se listino è SUPPLIER senza master, usa basePrice invece di totalCost
const supplierPrice =
  quoteResult.supplierPrice ??
  (quoteResult.appliedPriceList?.list_type === 'supplier' &&
  !quoteResult.appliedPriceList?.master_list_id
    ? quoteResult.basePrice // Per listini supplier, usa basePrice come costo fornitore
    : quoteResult.totalCost) ??
  quoteResult.basePrice ??
  0;
```

**Svantaggi:**

- ⚠️ `basePrice` potrebbe non essere il costo fornitore reale
- ⚠️ Non risolve il problema se non c'è margine configurato

## ✅ Soluzione Implementata (2026-01-15)

**Fix**: Priorità listini CUSTOM su SUPPLIER in `calculateBestPriceForReseller`

**Comportamento**:

- Se ci sono listini CUSTOM disponibili, vengono sempre preferiti rispetto ai SUPPLIER
- Anche se un listino SUPPLIER è più economico, viene scelto il listino CUSTOM
- I listini CUSTOM sono quelli configurati per la rivendita e riflettono il prezzo di vendita corretto

**Risultato**:

- ✅ GLS 5000: Usa listino CUSTOM "gls 5000 rivendita" (€8.00) invece di SUPPLIER (€4.27)
- ✅ Poste Italiane: Usa listino CUSTOM "Pdb 5000 rivendita" (€10.00) invece di SUPPLIER (€4.40)
- ✅ Prezzo vendita ora riflette correttamente il listino personalizzato configurato

**File Modificato**: `lib/db/price-lists-advanced.ts` - `calculateBestPriceForReseller`

**Documentazione**: Vedi `docs/FIX_PRIORITA_LISTINI_CUSTOM.md` per dettagli completi

## 📝 Note

- Il listino SUPPLIER dovrebbe essere usato **solo come master** per listini CUSTOM
- I listini SUPPLIER senza margine non dovrebbero essere usati direttamente nel comparatore
- **Fix implementato**: I listini CUSTOM hanno sempre priorità sui SUPPLIER nel preventivatore
