# 📋 Logica Preventivatore con Listini Personalizzati

## 🎯 Comportamento Desiderato

### **Scenario: Reseller con Listini Personalizzati Attivi**

1. **Il preventivatore deve funzionare quando ci sono PIÙ listini personalizzati attivi**
2. **Se ne ha UNO per corriere, il preventivatore utilizza quello**
3. **Il listino utilizzerà per la creazione spedizione la configurazione API associata** (dal `metadata.courier_config_id`)
4. **Nel preventivatore vedremo**:
   - **Prezzo fornitore** (dal listino personalizzato, che è il costo base senza margine)
   - **Prezzo del listino personalizzato attivo** (con margine applicato)

---

## 📊 Logica Attuale Implementata

### **1. Calcolo Prezzo da Listino Personalizzato**

**Funzione**: `calculateBestPriceForReseller` in `lib/db/price-lists-advanced.ts`

**Priorità**:

1. ✅ **PRIORITÀ 1**: Listini personalizzati ATTIVI (`list_type='custom'`, `status='active'`)
2. PRIORITÀ 2: Listino fornitore reseller
3. PRIORITÀ 3: Listino assegnato (master)

**Comportamento**:

- Cerca tutti i listini personalizzati attivi del reseller
- Filtra per `courier_id` se specificato
- Prova ogni listino finché non trova uno valido (usa il primo che funziona)
- **Estrae `courier_config_id` dal metadata** del listino personalizzato
- Lo passa nel risultato come `_courierConfigId`

### **2. Formattazione Rate nel Preventivatore**

**Endpoint**: `/api/quotes/db/route.ts`

**Cosa viene mostrato**:

- `weight_price` = **Costo fornitore** (da `totalCost` o `basePrice` del listino personalizzato)
- `total_price` = **Prezzo finale** (da `finalPrice` = `totalCost + margin`)
- `_priceListId` = ID del listino personalizzato usato
- `_configId` = **`courier_config_id`** dal metadata del listino personalizzato ✨ **NUOVO**

### **3. Creazione Spedizione**

**Endpoint**: `/api/shipments/create/route.ts`

**Logica**:

- Se `configId` è fornito nel payload, usa quello specifico (priorità massima)
- Il `configId` viene passato dal preventivatore quando l'utente seleziona un corriere
- Usa la configurazione API corretta per creare la spedizione

---

## ✅ Cosa Funziona

1. ✅ Listini personalizzati attivi hanno priorità massima
2. ✅ Il preventivatore mostra solo corrieri con listino personalizzato attivo
3. ✅ Deduplicazione per `displayName` (evita duplicati "Poste Italiane")
4. ✅ Prezzo fornitore e prezzo finale vengono mostrati correttamente
5. ✅ `courier_config_id` viene estratto dal metadata e passato nel rate ✨ **NUOVO**

---

## ⚠️ Cosa da Verificare

### **1. Se ci sono PIÙ listini personalizzati attivi per lo stesso corriere**

**Comportamento attuale** ✅ **AGGIORNATO**:

- **Calcola il prezzo per TUTTI i listini attivi**
- **Sceglie il PIÙ ECONOMICO** (prezzo finale più basso)
- Log dei listini confrontati per debug
- Estrae `courier_config_id` dal listino scelto

### **2. Passaggio configId alla Creazione Spedizione**

**Flusso attuale** ✅ **VERIFICATO**:

1. ✅ Preventivatore calcola rate con `_configId` = `courier_config_id` dal metadata
2. ✅ Utente seleziona corriere → `onContractSelected` viene chiamato con `configId`
3. ✅ Form nuova spedizione riceve `selectedConfigId` e lo salva nello state
4. ✅ Payload spedizione include `configId` (solo se presente)
5. ✅ Creazione spedizione usa `configId` specifico (priorità massima)

**Implementazione**:

- `IntelligentQuoteComparator` estrae `_configId` da `bestRate?._configId`
- Passa `configId` a `onContractSelected` callback
- Form salva in `selectedConfigId` state
- Payload include `configId` solo se presente: `...(selectedConfigId && { configId: selectedConfigId })`

---

## 🔧 Modifiche Implementate

### **1. Selezione Listino con Priorità CUSTOM** ✨ **AGGIORNATO 2026-01-15**

**File**: `lib/db/price-lists-advanced.ts` - `calculateBestPriceForReseller`

**Comportamento**:

- Calcola il prezzo per **TUTTI** i listini attivi (CUSTOM e SUPPLIER)
- **PRIORITÀ 1**: Se ci sono listini CUSTOM, sceglie il più economico tra quelli CUSTOM
- **PRIORITÀ 2**: Se non ci sono listini CUSTOM, usa il più economico tra i SUPPLIER
- I listini CUSTOM hanno sempre priorità rispetto ai SUPPLIER, anche se il SUPPLIER è più economico
- Log dei listini confrontati per debug con indicazione del tipo (CUSTOM/SUPPLIER)

**Motivazione**: I listini CUSTOM sono quelli configurati per la rivendita e devono riflettere il prezzo di vendita corretto. I listini SUPPLIER sono i prezzi base del fornitore e non dovrebbero essere usati direttamente nel preventivatore quando esiste un listino CUSTOM.

```typescript
// Calcola prezzo per ogni listino attivo (CUSTOM e SUPPLIER)
const priceResults = [];
for (const priceList of filtered) {
  const calculatedPrice = await calculatePriceWithRules(
    userId,
    params,
    priceList.id
  );
  if (calculatedPrice) {
    priceResults.push({ price: calculatedPrice, list: priceList, metadata });
  }
}

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
} else {
  // Se non ci sono listini CUSTOM, usa il più economico tra i SUPPLIER
  supplierLists.sort((a, b) => a.price.finalPrice - b.price.finalPrice);
  bestResult = supplierLists[0];
}
```

### **2. Matching Geografico Migliorato** ✨ **NUOVO**

**File**: `lib/pricing/calculator.ts`

**Comportamento**:

- Aggiunta funzione `getZoneFromDestination` per mappare provincia/regione a zona geografica
- `calculatePriceFromList` ora accetta `destinationProvince` e `destinationRegion`
- Matching migliorato: considera `zone_code` e `province_code` oltre a peso, tipo servizio e CAP

**Impatto**: Prezzi più accurati basati sulla zona geografica corretta

### **3. Estrazione courier_config_id dal Listino Personalizzato**

**File**: `lib/db/price-lists-advanced.ts`

```typescript
// Estrae courier_config_id dal metadata del listino personalizzato SCELTO
const metadata = bestResult.metadata;
const courierConfigId = metadata.courier_config_id;

if (courierConfigId) {
  customPrice._courierConfigId = courierConfigId;
}
```

### **4. Passaggio configId nel Rate**

**File**: `app/api/quotes/db/route.ts`

```typescript
// Usa courier_config_id dal listino personalizzato se presente
if (quoteResult._courierConfigId) {
  quoteResult._configId = quoteResult._courierConfigId;
}

// Nel rate:
_configId: quoteResult._configId || quoteResult._courierConfigId;
```

### **5. Verifica Passaggio configId al Form** ✅

**File**: `components/shipments/intelligent-quote-comparator.tsx`

```typescript
// Estrae configId dal rate selezionato
const selectedConfigId = bestRate?._configId;
onContractSelected?.(
  courierName,
  contractCode,
  accessoryService,
  selectedConfigId
);
```

**File**: `app/dashboard/spedizioni/nuova/page.tsx`

```typescript
// Riceve configId e lo salva nello state
onContractSelected={(courierName, contractCode, accessoryService, configId) => {
  setSelectedConfigId(configId);
}}

// Include nel payload solo se presente
...(selectedConfigId && { configId: selectedConfigId })
```

### **6. Distinzione Costo Fornitore vs Prezzo Finale** ✨ **NUOVO**

**File**: `lib/db/price-lists-advanced.ts` - `calculateWithDefaultMargin`

**Comportamento**:

- Se il listino personalizzato ha `master_list_id` (clonato da fornitore):
  - Calcola il prezzo originale dal listino fornitore (`supplierTotalCost`)
  - Confronta con il prezzo del listino personalizzato (`totalCost`)
  - Se c'è una differenza significativa → prezzi modificati manualmente
  - In questo caso:
    - `totalCost` = `supplierTotalCost` (costo fornitore originale)
    - `finalPrice` = prezzo dal listino personalizzato (già include margine implicito)
    - `margin` = differenza tra prezzo personalizzato e costo fornitore

**Impatto**: "Costo Fornitore" e "Prezzo Base" ora sono distinti quando i prezzi sono stati modificati manualmente

### **7. Deduplicazione Corrieri nel Preventivatore** ✨ **NUOVO**

**File**: `app/api/quotes/db/route.ts`

**Comportamento**:

- **Fase 1**: Deduplicazione su `availableCouriers` per `displayName` (prima del calcolo quote)
- **Fase 2**: Deduplicazione finale su `rates` per `displayName` (dopo il calcolo)
  - Se ci sono più rates con stesso `displayName`, mantiene solo il più economico
  - Usa `getDisplayNameForRate` per normalizzare `carrierCode` a `displayName`

**Problema noto**: Potrebbero ancora apparire duplicati se:

- `carrierCode` non è mappato correttamente in `COURIER_DISPLAY_NAMES_FINAL`
- Ci sono varianti di nome non coperte (es. "PosteDeliveryBusiness" vs "Postedeliverybusiness")

### **8. UI Routing Corrieri** ✨ **NUOVO**

**File**: `app/dashboard/spedizioni/nuova/page.tsx`

**Comportamento**:

- Sezione "Routing Corrieri" si attiva **SOLO** se:
  1. Ci sono dati inseriti (peso > 0 e CAP destinazione)
  2. Ci sono più carrier code unici nei quote validi dal preventivatore
- Non si basa su `availableCouriers` ma su `validQuotesFromComparator` (quote validi ricevuti)
- Se c'è solo un listino personalizzato attivo, la sezione routing **NON** appare
- Mostra "Costo Esatto" solo quando un corriere è selezionato e ha un prezzo valido

**Stato**: `validQuotesFromComparator` viene popolato da `onQuoteReceived` e resettato quando cambiano peso/destinazione

---

## ✅ Stato Implementazione

1. ✅ **Priorità listini CUSTOM su SUPPLIER** (Fix 2026-01-15) - I listini personalizzati hanno sempre priorità
2. ✅ **Selezione listino più economico** quando ci sono più listini attivi dello stesso tipo
3. ✅ **Passaggio configId** dal preventivatore al form verificato
4. ✅ **Creazione spedizione** con `configId` dal listino personalizzato
5. ✅ **Matching geografico migliorato** (zone, province)
6. ✅ **Distinzione costo fornitore vs prezzo finale** per listini modificati manualmente
7. ✅ **UI Routing Corrieri** dinamica (solo se più carrier code disponibili)
8. ⚠️ **Deduplicazione corrieri** (problema noto: duplicati ancora visibili)

**Prossimi test**:

- Testare con reseller che ha più listini attivi per stesso corriere
- Verificare che il listino più economico venga effettivamente scelto
- Verificare che la creazione spedizione usi la config API corretta
- **Risolvere duplicati persistenti nel preventivatore**

---

## 🎯 Risposta alla Domanda

**"Nel sistema è chiara sta cosa?"**

**SÌ, ora è più chiaro** perché:

1. ✅ Il preventivatore usa listini personalizzati attivi
2. ✅ Estrae `courier_config_id` dal metadata
3. ✅ Passa `configId` nel rate
4. ✅ La creazione spedizione può usare la config corretta
5. ✅ UI semplificata: mostra solo carrier code (non contract code)
6. ✅ Routing dinamico: si attiva solo se necessario

**Problemi noti**:

- ⚠️ **Duplicati ancora visibili**: Nonostante deduplicazione, alcuni duplicati persistono
  - **Fix implementato**: Mapping esteso con più varianti (gls5000, glseuropa, ups internazionale, etc.)
  - **Fix implementato**: Match parziale per nomi che contengono la chiave
  - **Fix implementato**: Logging dettagliato per debug
  - Se persistono, verificare i log della console per vedere quali `carrierCode` non vengono mappati correttamente

**Da testare**:

- Il `configId` viene passato correttamente alla creazione spedizione? ✅ **VERIFICATO**
- Perché persistono duplicati nonostante la deduplicazione? ⚠️ **IN ANALISI**
