# ✅ Fix: Priorità Listini CUSTOM su SUPPLIER nel Preventivatore Intelligente

**Data**: 2026-01-15  
**Commit**: `d6a4806`  
**Stato**: ✅ Implementato e Testato

## 📋 Problema Identificato

Nel preventivatore intelligente, il prezzo di vendita mostrava lo stesso valore del costo fornitore invece di riflettere il listino personalizzato configurato.

**Causa Root**:

- Il sistema confrontava tutti i listini attivi (CUSTOM e SUPPLIER) e sceglieva il prezzo più basso
- Sceglieva il listino SUPPLIER (€4.27) invece del listino CUSTOM (€8.00) perché era più economico
- Il prezzo di vendita risultava identico al costo fornitore

**Esempio del Problema**:

- **GLS 5000**:
  - Listino CUSTOM "gls 5000 rivendita": €8.00 (fornitore €4.27)
  - Listino SUPPLIER "gls 5000": €4.27
  - **Sistema sceglieva**: SUPPLIER (€4.27) ❌
  - **Doveva scegliere**: CUSTOM (€8.00) ✅

## 🔧 Soluzione Implementata

### Modifica in `calculateBestPriceForReseller`

**File**: `lib/db/price-lists-advanced.ts` (linee 992-1020)

**Prima**:

```typescript
// Ordina per prezzo finale crescente e scegli il più economico
priceResults.sort((a, b) => a.price.finalPrice - b.price.finalPrice);
const bestResult = priceResults[0]; // Sceglie sempre il più economico
```

**Dopo**:

```typescript
// ✨ FIX: Priorità ai listini CUSTOM rispetto ai SUPPLIER
const customLists = priceResults.filter((r) => r.list.list_type === "custom");
const supplierLists = priceResults.filter(
  (r) => r.list.list_type === "supplier"
);

let bestResult;
if (customLists.length > 0) {
  // Se ci sono listini CUSTOM, scegli il più economico tra quelli CUSTOM
  customLists.sort((a, b) => a.price.finalPrice - b.price.finalPrice);
  bestResult = customLists[0];
  console.log(
    `✅ [RESELLER] Priorità a listini CUSTOM: scelto "${bestResult.list.name}"`
  );
} else {
  // Se non ci sono listini CUSTOM, usa il più economico tra i SUPPLIER
  supplierLists.sort((a, b) => a.price.finalPrice - b.price.finalPrice);
  bestResult = supplierLists[0];
  console.log(
    `⚠️ [RESELLER] Nessun listino CUSTOM disponibile, usato SUPPLIER`
  );
}
```

## 🎯 Comportamento Dopo il Fix

### Scenario 1: Listini CUSTOM e SUPPLIER Disponibili

**Input**:

- Listino CUSTOM "gls 5000 rivendita": €8.00
- Listino SUPPLIER "gls 5000": €4.27

**Comportamento**:

1. Filtra listini CUSTOM: 1 trovato
2. Filtra listini SUPPLIER: 1 trovato
3. **Sceglie**: Listino CUSTOM (€8.00) ✅
4. **Ignora**: Listino SUPPLIER (€4.27)

**Risultato**:

- Costo Fornitore: €4.27 (dal master del listino CUSTOM)
- Prezzo Vendita: €8.00 (dal listino CUSTOM)
- Margine: €3.73 ✅

### Scenario 2: Solo Listini SUPPLIER Disponibili

**Input**:

- Listino SUPPLIER "gls 5000": €4.27
- Nessun listino CUSTOM

**Comportamento**:

1. Filtra listini CUSTOM: 0 trovati
2. Filtra listini SUPPLIER: 1 trovato
3. **Sceglie**: Listino SUPPLIER (€4.27) ⚠️

**Risultato**:

- Costo Fornitore: €4.27
- Prezzo Vendita: €4.27 (senza margine)
- **Nota**: Questo scenario dovrebbe essere evitato creando listini CUSTOM

## 📊 Logging Aggiunto

### Log di Selezione Listino

```
✅ [RESELLER] Priorità a listini CUSTOM: scelto "gls 5000 rivendita" (€8.00) tra 1 listini CUSTOM
📊 [RESELLER] Confrontati 2 listini attivi per corriere:
  - gls 5000 rivendita (CUSTOM): €8.00 ✅ SCELTO
  - gls 5000 (SUPPLIER): €4.27
```

### Log di Calcolo Prezzo

```
🔍 [PRICE CALC] Calcolo prezzo per listino "gls 5000 rivendita" (custom):
   - Total Cost (listino personalizzato): €8.00
   - Supplier Total Cost (master): €4.27
   - Is Manually Modified: true
✅ [PRICE CALC] Prezzi modificati manualmente:
   - Final Price (usando totalCost listino personalizzato): €8.00
   - ✅ RISULTATO: Fornitore €4.27 → Vendita €8.00 (margine €3.73)
```

## ✅ Verifica Fix

### Test Case 1: GLS 5000

**Prima del Fix**:

- Costo Fornitore: €4.27
- Prezzo Vendita: €4.27 ❌
- Listino usato: SUPPLIER

**Dopo il Fix**:

- Costo Fornitore: €4.27 ✅
- Prezzo Vendita: €8.00 ✅
- Listino usato: CUSTOM "gls 5000 rivendita" ✅

### Test Case 2: Poste Italiane Express H24+

**Prima del Fix**:

- Costo Fornitore: €4.40
- Prezzo Vendita: €4.40 ❌
- Listino usato: SUPPLIER

**Dopo il Fix**:

- Costo Fornitore: €4.40 ✅
- Prezzo Vendita: €10.00 ✅
- Listino usato: CUSTOM "Pdb 5000 rivendita" ✅

## 📝 Note Importanti

1. **Listini SUPPLIER**: Dovrebbero essere usati **solo come master** per listini CUSTOM
2. **Listini CUSTOM**: Sono quelli configurati per la rivendita e devono sempre avere priorità
3. **Fallback**: Se non ci sono listini CUSTOM, il sistema usa il SUPPLIER (ma questo scenario dovrebbe essere evitato)

## 🔗 File Modificati

1. `lib/db/price-lists-advanced.ts` - Priorità listini CUSTOM
2. `app/api/quotes/db/route.ts` - Logging dettagliato
3. `components/shipments/intelligent-quote-comparator.tsx` - Logging aggiunto

## 🎯 Risultato Finale

**Il preventivatore intelligente ora**:

- ✅ Usa sempre i listini CUSTOM quando disponibili
- ✅ Mostra correttamente il prezzo di vendita del listino personalizzato
- ✅ Calcola correttamente il margine (differenza tra prezzo CUSTOM e costo fornitore)
- ✅ Ignora i listini SUPPLIER quando esiste un listino CUSTOM

**Nessun corriere mostrerà più costo = prezzo vendita** quando esiste un listino CUSTOM configurato.
