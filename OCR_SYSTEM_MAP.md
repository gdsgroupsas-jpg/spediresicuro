# 🗺️ OCR System Map - Sistema Estrazione Esistente

## 📍 Panoramica

Il repository contiene **un sistema OCR ibrido** già funzionante che combina:
- **Gemini Vision** (multimodale, comprensione semantica)
- **Google Cloud Vision** (OCR professionale)
- **Claude Vision** (fallback)
- **Tesseract** (locale, fallback)
- **Mock** (sviluppo/test)

---

## 🎯 1. Punti di Ingresso OCR

### A. Endpoint API Standalone
**File:** `app/api/ocr/extract/route.ts`
- **Input:** `POST /api/ocr/extract` con `{ image: base64, options?: OCROptions }`
- **Output:** `{ success, confidence, extractedData, rawText }`
- **Uso:** Estrazione diretta senza agent orchestrator

### B. Agent Orchestrator (Graph Completo)
**File:** `app/api/agent/process-shipment/route.ts`
- **Input:** `POST /api/agent/process-shipment` con `{ image: base64, text?: string }`
- **Output:** `{ success, shipmentId, status, data, confidence, needsReview }`
- **Uso:** Flusso completo: OCR → Validazione → Selezione Corriere → Salvataggio

### C. Analisi Ricevute Bonifico (Caso Specifico)
**File:** `lib/ai/vision.ts`
- **Funzione:** `analyzeBankReceipt(fileBuffer, mimeType)`
- **Output:** `{ amount, cro, date, confidence }`
- **Uso:** Wallet top-up (estrazione importo/CRO da screenshot bonifico)

---

## 🔧 2. Architettura OCR Adapter

### Pattern: Adapter con Fallback Automatico

**File Base:** `lib/adapters/ocr/base.ts`
- **Interfaccia:** `OCRAdapter` (abstract class)
- **Factory:** `createOCRAdapter(type: 'auto' | 'google-vision' | 'claude' | 'tesseract' | 'mock')`
- **Priorità Auto:** Google Vision → Claude Vision → Tesseract → Mock

### Adapter Implementati

| Adapter | File | Tecnologia | Priorità |
|---------|------|------------|----------|
| **Google Vision** | `lib/adapters/ocr/google-vision.ts` | `@google-cloud/vision` | 1️⃣ |
| **Claude Vision** | `lib/adapters/ocr/claude.ts` | `@anthropic-ai/sdk` | 2️⃣ |
| **Tesseract** | `lib/adapters/ocr/tesseract.ts` | `tesseract.js` | 3️⃣ |
| **Mock** | `lib/adapters/ocr/mock.ts` | Dati fake | 4️⃣ |

---

## 🧠 3. Estrazione con Gemini Vision (Multimodale)

### Node: Extract Data
**File:** `lib/agent/orchestrator/nodes.ts`
**Funzione:** `extractData(state: AgentState): Promise<Partial<AgentState>>`

**Flusso:**
1. **Gemini Vision Direct** (priorità)
   - Usa `ChatGoogleGenerativeAI` con modello `gemini-2.0-flash-001`
   - Prompt strutturato per estrarre JSON con campi destinatario
   - Output: `shipmentData` popolato + `confidenceScore: 90`
   
2. **Fallback OCR Adapter** (se Gemini fallisce)
   - Chiama `createOCRAdapter('auto')`
   - Estrae testo grezzo con Google Vision/Claude/Tesseract
   - Parsing regex per indirizzi italiani
   
3. **LLM Cleanup** (opzionale, se OCR raw text disponibile)
   - Usa Gemini per strutturare testo OCR grezzo
   - Merge risultati con priorità LLM > regex

**Output Attuale:**
```typescript
{
  shipmentData: {
    recipient_name, recipient_address, recipient_city,
    recipient_zip, recipient_province, recipient_phone,
    recipient_email, cash_on_delivery_amount, notes
  },
  processingStatus: 'validating' | 'error',
  confidenceScore: number (0-100),
  validationErrors?: string[]
}
```

---

## 📦 4. Output Attuale

### OCRResult (Adapter)
**Interfaccia:** `lib/adapters/ocr/base.ts`
```typescript
{
  success: boolean;
  confidence: number; // 0-1
  extractedData: {
    recipient_name?, recipient_address?, recipient_city?,
    recipient_zip?, recipient_province?, recipient_phone?,
    recipient_email?, notes?
  };
  rawText?: string;
  error?: string;
}
```

### AgentState (Graph)
**File:** `lib/agent/orchestrator/state.ts`
- `shipmentData`: oggetto con campi spedizione
- `confidenceScore`: 0-100
- `processingStatus`: 'idle' | 'validating' | 'calculating' | 'complete' | 'error'
- `validationErrors`: string[]
- `needsHumanReview`: boolean
- **Salvataggio DB:** Se confidence > 80 → salva con `created_via_ocr: true`

---

## 🔄 5. Flusso Graph Completo

**File:** `lib/agent/orchestrator/graph.ts`

```
extract_data → validate_geo → [checkGeoValidation] 
  → select_courier → calculate_margins → [checkConfidence]
  → save_shipment | human_review
```

**Node Extract Data:**
- Input: `AgentState` con `messages[last]` contenente immagine base64
- Output: `AgentState` con `shipmentData` popolato

---

## 🎯 6. Proposta: Wrapper OCR Worker

### Obiettivo
Wrappare il sistema esistente in un **OCR Worker** che produce output standardizzato:
- `shipmentDraft` (schema Zod già esistente)
- `missingFields` (array stringhe)
- `clarification_request` (stringa opzionale)

### File da Creare/Modificare

#### A. Nuovo Worker: `lib/agent/workers/ocr.ts`
**Scopo:** Wrapper attorno a `extractData()` esistente

**Input:**
```typescript
{
  image: Buffer | string (base64),
  text?: string,
  existingDraft?: ShipmentDraft
}
```

**Output:**
```typescript
{
  shipmentDraft: ShipmentDraft, // Parziale, con campi estratti
  missingFields: string[],      // Campi mancanti per booking
  clarification_request?: string // Se dati insufficienti
}
```

**Implementazione:**
1. Chiama `extractData()` esistente (o estrae direttamente da adapter)
2. Converte `shipmentData` → `ShipmentDraft` usando `mergeShipmentDraft()`
3. Calcola `missingFields` con `calculateMissingFieldsForShipment()`
4. Se `missingFields.length > 0` → genera `clarification_request`

#### B. Modifiche Minime

**File:** `lib/agent/orchestrator/nodes.ts`
- **Opzione 1:** Estrarre logica `extractData()` in funzione helper riutilizzabile
- **Opzione 2:** Creare `ocrWorker()` che chiama `extractData()` internamente

**File:** `lib/agent/workers/address.ts` (già esistente)
- **Nessuna modifica:** Address Worker già gestisce `shipmentDraft` + `missingFields`
- **Integrazione:** OCR Worker può essere chiamato PRIMA di Address Worker

**File:** `lib/address/shipment-draft.ts` (già esistente)
- **Nessuna modifica:** Schema già supporta `missingFields`
- **Funzioni utili:** `calculateMissingFieldsForShipment()`, `mergeShipmentDraft()`

---

## 📋 7. Piano File Changes (Minime)

### File da Creare
1. **`lib/agent/workers/ocr.ts`** (nuovo)
   - Funzione `ocrWorker(state: AgentState): Promise<Partial<AgentState>>`
   - Wrapper attorno a logica esistente in `nodes.ts::extractData()`
   - Output: `shipmentDraft` + `missingFields` + `clarification_request`

### File da Modificare
2. **`lib/agent/orchestrator/nodes.ts`**
   - **Opzione A:** Estrarre `extractData()` in `lib/agent/workers/ocr.ts` e chiamarlo da qui
   - **Opzione B:** Mantenere `extractData()` e creare `ocrWorker()` che lo usa internamente
   - **Raccomandazione:** Opzione B (minimo impatto)

3. **`lib/agent/orchestrator/graph.ts`** (opzionale)
   - Aggiungere node `ocr_worker` se si vuole separare da `extract_data`
   - **Alternativa:** Mantenere `extract_data` e modificarlo per produrre `shipmentDraft`

### File da NON Toccare
- ✅ `lib/adapters/ocr/*` (adapter esistenti funzionano)
- ✅ `app/api/ocr/extract/route.ts` (endpoint standalone OK)
- ✅ `lib/address/shipment-draft.ts` (schema già corretto)
- ✅ `lib/agent/workers/address.ts` (già gestisce `shipmentDraft`)

---

## 🎯 8. Output Standard OCR Worker

### Input
```typescript
{
  image: string (base64) | Buffer,
  text?: string,
  existingDraft?: ShipmentDraft
}
```

### Output
```typescript
{
  shipmentDraft: {
    recipient: { name?, address?, city?, postalCode?, province?, phone?, email? },
    parcel: { weight?, dimensions? },
    service: { cashOnDelivery?, notes? },
    missingFields: string[] // ['postalCode', 'weight', ...]
  },
  missingFields: string[], // Alias per shipmentDraft.missingFields
  clarification_request?: string // "Per completare la spedizione servono: CAP, peso"
}
```

### Logica Missing Fields
- **Per Booking:** `calculateMissingFieldsForShipment()` (già esistente)
- **Campi obbligatori:** `postalCode`, `city`, `address`, `name`, `weight`
- **Campi opzionali:** `province`, `phone`, `email`, `dimensions`

---

## ✅ 9. Vantaggi Wrapper

1. **Riutilizzo:** Sistema OCR esistente rimane invariato
2. **Standardizzazione:** Output coerente con Address Worker
3. **Integrazione:** OCR Worker → Address Worker → Pricing Worker (flusso naturale)
4. **Minimo Impatto:** Solo 1-2 file nuovi, nessuna breaking change

---

## 📝 10. Note Implementative

- **Gemini Vision** è già il metodo primario (alta qualità)
- **OCR Adapter** è fallback robusto (Google Vision → Claude → Tesseract)
- **ShipmentDraft** schema già supporta `missingFields`
- **Clarification pattern** già implementato in Address Worker (riutilizzabile)

**Raccomandazione:** Creare `ocrWorker()` che:
1. Usa `extractData()` internamente (o estrae direttamente da adapter)
2. Converte output in `ShipmentDraft`
3. Calcola `missingFields`
4. Genera `clarification_request` se necessario

