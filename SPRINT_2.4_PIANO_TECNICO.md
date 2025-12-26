# 📋 Sprint 2.4 - Piano Tecnico OCR Worker

## ✅ CONFERMA: Nessun Nuovo Sistema OCR

**Sistema OCR esistente rimane INVARIATO:**
- ✅ Gemini Vision (multimodale) - già funzionante
- ✅ Google Cloud Vision adapter - già funzionante  
- ✅ Claude Vision adapter - già funzionante
- ✅ Tesseract adapter - già funzionante
- ✅ Mock adapter - già funzionante
- ✅ `extractData()` in `nodes.ts` - già funzionante

**Sprint 2.4 è SOLO un wrapper** che:
1. Chiama `extractData()` esistente
2. Converte output `shipmentData` → `ShipmentDraft`
3. Calcola `missingFields` con funzioni esistenti
4. Genera `clarification_request` se necessario

---

## 🎯 Implementazione: Wrapper sopra extractData()

### Funzione Base da Riutilizzare
**File:** `lib/agent/orchestrator/nodes.ts`
**Funzione:** `extractData(state: AgentState): Promise<Partial<AgentState>>`

**Cosa fa già:**
- Estrae immagine da `state.messages[last]`
- Usa Gemini Vision (priorità) o OCR adapter (fallback)
- Ritorna `{ shipmentData, confidenceScore, processingStatus }`

**Cosa NON cambia:**
- ❌ Nessuna modifica a `extractData()`
- ❌ Nessuna modifica agli adapter OCR
- ❌ Nessuna modifica al flusso Gemini Vision

---

## 📁 File da NON Modificare

### ❌ Adapter OCR (TUTTI)
- `lib/adapters/ocr/base.ts` - Interfaccia base
- `lib/adapters/ocr/google-vision.ts` - Google Vision
- `lib/adapters/ocr/claude.ts` - Claude Vision
- `lib/adapters/ocr/tesseract.ts` - Tesseract
- `lib/adapters/ocr/mock.ts` - Mock
- `lib/adapters/ocr/index.ts` - Export

### ❌ Endpoint API
- `app/api/ocr/extract/route.ts` - Endpoint standalone OCR
- `app/api/agent/process-shipment/route.ts` - Endpoint graph completo

### ❌ Schema e Helper
- `lib/address/shipment-draft.ts` - Schema Zod ShipmentDraft (già corretto)
- `lib/address/normalize-it-address.ts` - Funzioni normalizzazione (già corrette)

### ❌ Worker Esistenti
- `lib/agent/workers/address.ts` - Address Worker (già gestisce shipmentDraft)
- `lib/agent/workers/pricing.ts` - Pricing Worker

### ❌ Graph e State
- `lib/agent/orchestrator/graph.ts` - Graph orchestrator
- `lib/agent/orchestrator/state.ts` - AgentState type
- `lib/agent/orchestrator/supervisor.ts` - Supervisor
- `lib/agent/orchestrator/supervisor-router.ts` - Router

### ❌ Vision AI (Caso Specifico)
- `lib/ai/vision.ts` - analyzeBankReceipt() (per wallet, non per spedizioni)

### ❌ Componenti UI
- `components/ocr/ocr-upload.tsx` - Componente upload immagine

---

## ✅ File da Creare/Modificare (MAX 2)

### 1. NUOVO: `lib/agent/workers/ocr.ts`
**Tipo:** Creazione nuovo file
**Scopo:** Wrapper OCR Worker che standardizza output

**Funzione principale:**
```typescript
export async function ocrWorker(
  state: AgentState
): Promise<Partial<AgentState>>
```

**Logica:**
1. **Chiama `extractData()`** (import da `nodes.ts`)
   - Passa `state` esistente
   - Riceve `{ shipmentData, confidenceScore, ... }`

2. **Converte `shipmentData` → `ShipmentDraft`**
   - Usa `mergeShipmentDraft()` da `shipment-draft.ts`
   - Mapping: `recipient_name` → `recipient.fullName`, `recipient_zip` → `recipient.postalCode`, ecc.

3. **Calcola `missingFields`**
   - Usa `calculateMissingFieldsForShipment()` da `shipment-draft.ts`
   - Ritorna array stringhe: `['recipient.postalCode', 'parcel.weightKg', ...]`

4. **Genera `clarification_request`** (se necessario)
   - Se `missingFields.length > 0`
   - Pattern simile a `address.ts::generateClarificationQuestion()`
   - Esempio: "Per completare la spedizione servono: CAP, peso del pacco"

**Output:**
```typescript
{
  shipmentDraft: ShipmentDraft,        // Parziale con campi estratti
  missingFields: string[],             // Campi mancanti per booking
  clarification_request?: string,      // Domanda se dati insufficienti
  confidenceScore: number,             // Pass-through da extractData()
  processingStatus: 'validating'       // O 'error' se fallisce
}
```

**Dipendenze:**
- Import: `extractData` da `../orchestrator/nodes`
- Import: `ShipmentDraft`, `mergeShipmentDraft`, `calculateMissingFieldsForShipment` da `@/lib/address/shipment-draft`
- Import: `AgentState` da `../orchestrator/state`

---

### 2. VERIFICA: `lib/agent/orchestrator/nodes.ts`
**Tipo:** Nessuna modifica necessaria
**Stato:** ✅ `extractData()` è già esportata (linea 29: `export async function extractData`)

**Conferma:**
- ✅ `extractData()` è importabile da `workers/ocr.ts`
- ✅ Nessuna modifica a `nodes.ts` richiesta

---

## 📊 Riepilogo File Changes

| File | Tipo | Modifica | Priorità |
|------|------|----------|----------|
| `lib/agent/workers/ocr.ts` | **CREA** | Nuovo worker wrapper | 🔴 **OBBLIGATORIO** |
| `lib/agent/orchestrator/nodes.ts` | VERIFICA | ✅ `extractData()` già esportata | ✅ **Nessuna modifica** |

**Totale:** 1 file da creare, 0 file da modificare

---

## 🔄 Flusso OCR Worker

```
Input: AgentState con immagine in messages[last]
  ↓
ocrWorker() chiama extractData()
  ↓
extractData() usa Gemini Vision / OCR adapter
  ↓
extractData() ritorna { shipmentData, confidenceScore }
  ↓
ocrWorker() converte shipmentData → ShipmentDraft
  ↓
ocrWorker() calcola missingFields
  ↓
ocrWorker() genera clarification_request (se necessario)
  ↓
Output: { shipmentDraft, missingFields, clarification_request? }
```

---

## ✅ Vantaggi Approccio Wrapper

1. **Zero Breaking Changes:** Sistema OCR esistente invariato
2. **Riutilizzo Completo:** `extractData()` già testato e funzionante
3. **Standardizzazione:** Output coerente con Address Worker
4. **Minimo Impatto:** Solo 1 file nuovo (max 2 con verifica)
5. **Testabilità:** OCR Worker testabile isolatamente

---

## 🎯 Output Standard OCR Worker

### Input
```typescript
AgentState {
  messages: [HumanMessage con immagine base64],
  shipmentDraft?: ShipmentDraft,  // Opzionale, per merge
  ...
}
```

### Output
```typescript
Partial<AgentState> {
  shipmentDraft: {
    recipient: { fullName?, addressLine1?, city?, postalCode?, province?, phone?, email? },
    parcel: { weightKg?, dimensions? },
    service: { cashOnDelivery?, notes? },
    missingFields: string[]
  },
  missingFields: string[],  // Alias per shipmentDraft.missingFields
  clarification_request?: string,
  confidenceScore: number,
  processingStatus: 'validating' | 'error'
}
```

---

## 📝 Note Implementative

### Mapping shipmentData → ShipmentDraft
```typescript
{
  recipient_name → recipient.fullName
  recipient_address → recipient.addressLine1
  recipient_city → recipient.city
  recipient_zip → recipient.postalCode
  recipient_province → recipient.province
  recipient_phone → recipient.phone
  recipient_email → recipient.email
  cash_on_delivery_amount → service.cashOnDelivery?.amount
  notes → service.notes
}
```

### Missing Fields per Booking
Usa `calculateMissingFieldsForShipment()` che verifica:
- `recipient.postalCode` (obbligatorio)
- `recipient.city` (obbligatorio)
- `recipient.addressLine1` (obbligatorio)
- `recipient.fullName` (obbligatorio)
- `parcel.weightKg` (obbligatorio)

### Clarification Pattern
Riutilizza pattern da `address.ts`:
- Genera domanda user-friendly
- Elenca campi mancanti con label italiane
- Esempio: "Per completare la spedizione servono: **CAP**, **peso del pacco** e **indirizzo completo**."

---

## ✅ Checklist Implementazione

- [ ] Creare `lib/agent/workers/ocr.ts`
- [ ] Implementare `ocrWorker()` che chiama `extractData()`
- [ ] Implementare conversione `shipmentData` → `ShipmentDraft`
- [ ] Implementare calcolo `missingFields`
- [ ] Implementare generazione `clarification_request`
- [x] Verificare export `extractData()` in `nodes.ts` → ✅ Già esportata
- [ ] Test unitario OCR Worker
- [ ] Test integrazione con Address Worker

---

## 🚫 Cosa NON Fare

- ❌ NON modificare `extractData()`
- ❌ NON modificare adapter OCR
- ❌ NON creare nuovo sistema OCR
- ❌ NON modificare schema `ShipmentDraft`
- ❌ NON modificare `Address Worker`
- ❌ NON modificare endpoint API esistenti

