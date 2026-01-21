# Soluzioni per Calcolo Prezzi Anne: API Dirette, Cache, Costi Reali

## 📋 Domande Chiave

1. **Abbiamo un agent che può fare chiamate API e dirlo ad Anne? (Non costerebbe molto)**
2. **Anne può scrivere nel database per ricordarsi il prezzo se manca nel database sincronizzato?**
3. **Se Anne ha accesso può controllare perfettamente anche i costi reali e report fatture o altro?**
4. **Ci sono altre soluzioni?**

---

## 🔍 Analisi Situazione Attuale

### ✅ **Cosa Abbiamo Già**

1. **Funzione API Diretta**: `testSpedisciOnlineRates()` in `actions/spedisci-online-rates.ts`
   - ✅ Può chiamare API Spedisci.Online `/shipping/rates`
   - ✅ Restituisce rates real-time
   - ✅ Costo: 1 chiamata API per preventivo

2. **Sistema Fatture**: Tabella `invoices` e `invoice_items`
   - ✅ Ha costi reali delle spedizioni (`total`, `unit_price`)
   - ✅ Collegato a `shipments` via `shipment_id`

3. **Costi Reali nelle Spedizioni**: Campo `total_cost`, `final_price` in `shipments`
   - ✅ Costo effettivo pagato al corriere
   - ✅ Prezzo finale applicato al cliente

4. **Anne Tools**: Sistema di tools per Anne
   - ✅ `calculate_price`: Calcola da DB
   - ✅ `track_shipment`: Traccia spedizioni
   - ❌ **NON ha tool per chiamate API dirette**
   - ❌ **NON ha tool per scrivere nel DB**
   - ❌ **NON ha tool per leggere costi reali**

---

## 💡 Soluzioni Proposte

### **Soluzione 1: Hybrid - DB + API Fallback (CONSIGLIATA)**

#### Come Funziona

1. **Prima**: Anne cerca prezzo nel DB (come ora)
2. **Se non trova**: Chiama API Spedisci.Online direttamente
3. **Cache**: Salva risultato API nel DB per prossime volte
4. **Costi reali**: Se spedizione già creata, usa costo reale da `shipments.total_cost`

#### Vantaggi

- ⚡ **Velocità**: DB cache per richieste comuni
- 💰 **Costi**: Solo 1 chiamata API quando necessario
- 📊 **Accuratezza**: Prezzi sempre aggiornati
- 🔄 **Auto-learning**: Cache si popola automaticamente

#### Implementazione

**Tool da aggiungere ad Anne**: `get_price_with_fallback`

```typescript
{
  name: 'get_price_with_fallback',
  description: 'Calcola prezzo spedizione. Prima cerca nel DB, se non trova chiama API Spedisci.Online e salva nel cache.',
  parameters: {
    weight: number,
    destinationZip: string,
    destinationProvince: string,
    courierCode?: string, // es. "postedeliverybusiness"
    serviceType?: 'standard' | 'express' | 'economy',
    // ... opzioni
  }
}
```

**Logica**:

1. Cerca in `price_list_entries` (come ora)
2. Se non trova, chiama `testSpedisciOnlineRates()`
3. Salva risultato in `price_list_entries` (cache)
4. Restituisce prezzo

**Costo**: ~0.01€ per chiamata API (solo quando necessario)

---

### **Soluzione 2: Anne Scrive nel Database (Cache Intelligente)**

#### Come Funziona

1. Anne ha tool `save_price_to_cache` che può scrivere in `price_list_entries`
2. Quando trova prezzo via API, lo salva automaticamente
3. Prossime volte trova subito nel DB

#### Vantaggi

- 🧠 **Auto-learning**: Anne "impara" i prezzi
- ⚡ **Performance**: Cache cresce nel tempo
- 💰 **Riduzione costi**: Meno chiamate API

#### Svantaggi

- ⚠️ **Sicurezza**: Anne può scrivere nel DB (serve validazione)
- ⚠️ **Qualità dati**: Prezzi potrebbero essere obsoleti
- ⚠️ **Manutenzione**: Cache può diventare inconsistente

#### Implementazione

**Tool da aggiungere**: `save_price_to_cache`

```typescript
{
  name: 'save_price_to_cache',
  description: 'Salva prezzo nel database per cache futura. Solo per admin/reseller.',
  parameters: {
    courierId: string,
    weight: number,
    destinationZip: string,
    zoneCode: string,
    basePrice: number,
    // ... altri campi
  }
}
```

**Sicurezza**: Solo admin/reseller possono usare questo tool

---

### **Soluzione 3: Anne Legge Costi Reali da Spedizioni/Fatture**

#### Come Funziona

1. Anne ha tool `get_actual_costs` che legge da `shipments` o `invoices`
2. Per spedizioni simili già create, usa costo reale
3. Più accurato dei listini sincronizzati

#### Vantaggi

- 📊 **Accuratezza massima**: Costi reali pagati
- 💰 **Margini reali**: Vede margine effettivo applicato
- 📈 **Analisi**: Può fare report su costi reali vs preventivati

#### Implementazione

**Tool da aggiungere**: `get_actual_costs`

```typescript
{
  name: 'get_actual_costs',
  description: 'Recupera costi reali da spedizioni o fatture per analisi prezzi.',
  parameters: {
    courierId?: string,
    destinationZip?: string,
    weightRange?: { min: number, max: number },
    dateFrom?: string,
    dateTo?: string,
  }
}
```

**Query esempio**:

```sql
SELECT
  courier_id,
  weight,
  recipient_zip,
  total_cost,
  final_price,
  (final_price - total_cost) as margin
FROM shipments
WHERE courier_id = ?
  AND weight BETWEEN ? AND ?
  AND recipient_zip LIKE ?
  AND created_at >= ?
ORDER BY created_at DESC
LIMIT 10
```

---

### **Soluzione 4: Sistema Ibrido Completo (BEST)**

#### Architettura

```
Richiesta Prezzo
  ↓
1. Cerca in DB (price_list_entries) ← Veloce, gratis
  ↓ (se non trova)
2. Cerca costi reali (shipments) ← Accuratezza massima
  ↓ (se non trova)
3. Chiama API Spedisci.Online ← Sempre aggiornato
  ↓
4. Salva in cache (price_list_entries) ← Auto-learning
  ↓
5. Restituisce prezzo + fonte (DB/API/Real)
```

#### Tool Unico: `get_price_smart`

```typescript
{
  name: 'get_price_smart',
  description: 'Calcola prezzo usando strategia ibrida: DB cache → costi reali → API → cache risultato.',
  parameters: {
    weight: number,
    destinationZip: string,
    destinationProvince: string,
    courierCode?: string,
    preferRealCosts?: boolean, // Se true, preferisce costi reali
    allowAPICall?: boolean, // Se true, può chiamare API
  }
}
```

#### Logica Completa

```typescript
async function getPriceSmart(params) {
  // 1. Cerca in DB cache
  const dbPrice = await getPriceFromDB(params);
  if (dbPrice && isRecent(dbPrice)) {
    return { price: dbPrice, source: 'db_cache' };
  }

  // 2. Cerca costi reali (se preferRealCosts)
  if (params.preferRealCosts) {
    const realCost = await getActualCostFromShipments(params);
    if (realCost) {
      return { price: realCost, source: 'actual_cost' };
    }
  }

  // 3. Chiama API (se allowAPICall)
  if (params.allowAPICall) {
    const apiPrice = await testSpedisciOnlineRates(params);
    if (apiPrice) {
      // 4. Salva in cache
      await savePriceToCache(params, apiPrice);
      return { price: apiPrice, source: 'api_cached' };
    }
  }

  // 5. Fallback: usa DB anche se vecchio
  if (dbPrice) {
    return { price: dbPrice, source: 'db_old' };
  }

  return null;
}
```

---

## 📊 Confronto Soluzioni

| Soluzione              | Velocità | Accuratezza | Costo API               | Complessità | Auto-Learning |
| ---------------------- | -------- | ----------- | ----------------------- | ----------- | ------------- |
| **1. Hybrid DB+API**   | ⚡⚡⚡   | ⭐⭐⭐      | 💰 (solo se necessario) | 🟡 Media    | ✅            |
| **2. Anne Scrive DB**  | ⚡⚡⚡   | ⭐⭐        | 💰💰 (iniziale)         | 🔴 Alta     | ✅✅          |
| **3. Costi Reali**     | ⚡⚡     | ⭐⭐⭐⭐⭐  | 💰💰💰 (zero)           | 🟢 Bassa    | ❌            |
| **4. Ibrido Completo** | ⚡⚡⚡   | ⭐⭐⭐⭐⭐  | 💰 (solo se necessario) | 🔴 Alta     | ✅✅          |

---

## 🎯 Raccomandazione: Soluzione 4 (Ibrido Completo)

### Perché?

1. **Best of All Worlds**: Combina tutte le soluzioni
2. **Performance**: Cache DB per velocità
3. **Accuratezza**: Costi reali quando disponibili
4. **Aggiornamento**: API quando necessario
5. **Auto-learning**: Cache si popola automaticamente

### Implementazione Step-by-Step

#### Step 1: Aggiungere Tool `get_price_smart`

**File**: `lib/ai/tools.ts`

```typescript
{
  name: 'get_price_smart',
  description: 'Calcola prezzo spedizione usando strategia ibrida intelligente: cerca prima nel DB, poi costi reali, poi API se necessario. Salva automaticamente in cache per prossime volte.',
  parameters: {
    type: 'object',
    properties: {
      weight: { type: 'number', description: 'Peso in kg' },
      destinationZip: { type: 'string', description: 'CAP destinazione' },
      destinationProvince: { type: 'string', description: 'Provincia (2 lettere)' },
      courierCode: { type: 'string', description: 'Codice corriere (es. "postedeliverybusiness")' },
      serviceType: { type: 'string', enum: ['standard', 'express', 'economy'] },
      preferRealCosts: { type: 'boolean', description: 'Se true, preferisce costi reali da spedizioni esistenti' },
      allowAPICall: { type: 'boolean', description: 'Se true, può chiamare API se prezzo non trovato' },
      cashOnDelivery: { type: 'number' },
      declaredValue: { type: 'number' },
    },
    required: ['weight', 'destinationZip', 'destinationProvince'],
  },
}
```

#### Step 2: Implementare Logica Ibrida

**File**: `lib/ai/pricing-engine.ts` (nuova funzione)

```typescript
export async function getPriceSmart(params: {
  weight: number;
  destinationZip: string;
  destinationProvince: string;
  courierCode?: string;
  serviceType?: 'standard' | 'express' | 'economy';
  preferRealCosts?: boolean;
  allowAPICall?: boolean;
  cashOnDelivery?: number;
  declaredValue?: number;
}): Promise<{
  price: number;
  source: 'db_cache' | 'actual_cost' | 'api_cached' | 'db_old';
  details: any;
} | null> {
  // 1. Cerca in DB
  const dbResult = await calculatePrice(...);
  if (dbResult && isRecent(dbResult)) {
    return { price: dbResult.totalCost, source: 'db_cache', details: dbResult };
  }

  // 2. Cerca costi reali
  if (params.preferRealCosts) {
    const realCost = await getActualCostFromShipments(params);
    if (realCost) {
      return { price: realCost.total_cost, source: 'actual_cost', details: realCost };
    }
  }

  // 3. Chiama API
  if (params.allowAPICall) {
    const apiResult = await testSpedisciOnlineRates({
      packages: [{ weight: params.weight, ... }],
      shipTo: { postalCode: params.destinationZip, state: params.destinationProvince, ... },
      // ...
    });

    if (apiResult.success && apiResult.rates) {
      // Salva in cache
      await savePriceToCache(params, apiResult.rates[0]);
      return { price: parseFloat(apiResult.rates[0].total_price), source: 'api_cached', details: apiResult };
    }
  }

  // 4. Fallback DB vecchio
  if (dbResult) {
    return { price: dbResult.totalCost, source: 'db_old', details: dbResult };
  }

  return null;
}
```

#### Step 3: Aggiungere Funzione Costi Reali

**File**: `lib/db/price-lists.ts` (nuova funzione)

```typescript
export async function getActualCostFromShipments(params: {
  courierId?: string;
  weight: number;
  destinationZip: string;
  weightTolerance?: number; // kg di tolleranza (default: 2)
}): Promise<{
  total_cost: number;
  final_price: number;
  margin: number;
  shipment_count: number;
} | null> {
  const { data, error } = await supabaseAdmin
    .from('shipments')
    .select('total_cost, final_price, courier_id, weight, recipient_zip')
    .eq('courier_id', params.courierId || '')
    .gte('weight', params.weight - (params.weightTolerance || 2))
    .lte('weight', params.weight + (params.weightTolerance || 2))
    .like('recipient_zip', `${params.destinationZip.substring(0, 3)}%`) // Match primi 3 CAP
    .not('total_cost', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error || !data || data.length === 0) {
    return null;
  }

  // Media costi reali
  const avgCost = data.reduce((sum, s) => sum + (s.total_cost || 0), 0) / data.length;
  const avgPrice = data.reduce((sum, s) => sum + (s.final_price || 0), 0) / data.length;

  return {
    total_cost: avgCost,
    final_price: avgPrice,
    margin: avgPrice - avgCost,
    shipment_count: data.length,
  };
}
```

#### Step 4: Aggiungere Funzione Cache

**File**: `lib/db/price-lists.ts` (nuova funzione)

```typescript
export async function savePriceToCache(
  params: {
    courierId: string;
    weight: number;
    destinationZip: string;
    zoneCode: string;
    serviceType: string;
  },
  rate: {
    total_price: string;
    weight_price: string;
    fuel: string;
    // ...
  }
): Promise<void> {
  // Trova listino fornitore per corriere
  const priceList = await getActivePriceList(params.courierId);
  if (!priceList) {
    console.warn('Listino non trovato per cache');
    return;
  }

  // Crea entry cache
  await addPriceListEntries(priceList.id, [
    {
      weight_from: params.weight - 0.5,
      weight_to: params.weight + 0.5,
      zone_code: params.zoneCode,
      service_type: params.serviceType,
      base_price: parseFloat(rate.weight_price),
      fuel_surcharge_percent: calculateFuelPercent(rate),
      // ...
    },
  ]);
}
```

#### Step 5: Integrare in Anne Tools

**File**: `lib/ai/tools.ts` (aggiungere case)

```typescript
case 'get_price_smart': {
  const result = await getPriceSmart({
    weight: toolCall.arguments.weight,
    destinationZip: toolCall.arguments.destinationZip,
    destinationProvince: toolCall.arguments.destinationProvince,
    courierCode: toolCall.arguments.courierCode,
    serviceType: toolCall.arguments.serviceType,
    preferRealCosts: toolCall.arguments.preferRealCosts ?? true,
    allowAPICall: toolCall.arguments.allowAPICall ?? true,
    cashOnDelivery: toolCall.arguments.cashOnDelivery,
    declaredValue: toolCall.arguments.declaredValue,
  });

  if (!result) {
    return {
      success: false,
      result: null,
      error: 'Prezzo non disponibile',
    };
  }

  return {
    success: true,
    result: {
      price: result.price,
      source: result.source,
      message: `Prezzo: €${result.price.toFixed(2)} (fonte: ${result.source})`,
      details: result.details,
    },
  };
}
```

---

## 💰 Analisi Costi

### Scenario: 100 preventivi/giorno

**Soluzione Attuale (solo DB)**:

- Costo API: €0
- Problema: Prezzi obsoleti se sync non recente

**Soluzione 1 (Hybrid DB+API)**:

- Cache hit rate: 70% (70 preventivi da DB)
- API calls: 30/giorno
- Costo: 30 × €0.01 = €0.30/giorno = €9/mese

**Soluzione 4 (Ibrido Completo)**:

- Cache hit rate: 70% (70 da DB)
- Costi reali: 20% (20 da spedizioni esistenti)
- API calls: 10% (10/giorno)
- Costo: 10 × €0.01 = €0.10/giorno = €3/mese

**Risparmio**: 90% rispetto a chiamare API sempre

---

## 🚀 Prossimi Passi

1. ✅ **Implementare Soluzione 4** (Ibrido Completo)
2. ✅ **Aggiungere tool `get_price_smart` ad Anne**
3. ✅ **Testare con preventivi reali**
4. ✅ **Monitorare cache hit rate**
5. ✅ **Ottimizzare strategia in base a risultati**

---

## 📝 Note Finali

- **Costi API**: Molto bassi (~€0.01 per chiamata)
- **Performance**: Cache DB è istantanea
- **Accuratezza**: Costi reali sono la fonte più affidabile
- **Auto-learning**: Sistema migliora nel tempo

**Raccomandazione**: Implementare Soluzione 4 (Ibrido Completo) per best experience.
