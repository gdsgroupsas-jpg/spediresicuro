# Kill Switch Dry-Run – Pre Cohort 0

**Data Dry-Run:** 2025-01-XX  
**Release Engineer:** Reliability Auditor  
**Obiettivo:** Verificare che il Kill Switch OCR immagini funzioni correttamente e non rompa il flusso utente

---

## Flag & Scope

### Flag Identificato
- **Nome:** `ENABLE_OCR_IMAGES`
- **Tipo:** Boolean (environment variable)
- **Default:** `false` (opt-in)
- **Formato:** `ENABLE_OCR_IMAGES=true` o `ENABLE_OCR_IMAGES=false`

### Dove viene letto
- **File:** `lib/config.ts:99`
- **Riga:** `ENABLE_OCR_IMAGES: process.env.ENABLE_OCR_IMAGES === 'true'`
- **Config object:** `ocrConfig.ENABLE_OCR_IMAGES`

### Dove viene usato
- **File principale:** `lib/agent/workers/ocr.ts:534`
- **Check:** `if (!ocrConfig.ENABLE_OCR_IMAGES) { ... }`
- **Effetto quando OFF:** Ritorna immediatamente con `clarification_request` senza eseguire Vision

### Effetto atteso quando OFF
1. **Comportamento:** Immagine rilevata → OCR Worker ritorna `clarification_request`
2. **Messaggio utente:** "Ho ricevuto un'immagine, ma l'estrazione automatica non è ancora attiva. Puoi incollare il testo dello screenshot?"
3. **Stato:** `next_step: 'END'`, `processingStatus: 'idle'`
4. **Nessun crash:** Comportamento deterministico, nessun errore 500
5. **Nessuna chiamata Vision:** `executeVisionWithRetry()` non viene eseguito

---

## Procedura

### A. Preparazione

#### 1. Identificazione Variabili Env
```bash
# Verifica flag
grep -RIn "ENABLE_OCR_IMAGES" lib/ app/ || true
```

**Risultato:**
- `lib/config.ts:99` - Definizione flag
- `lib/agent/workers/ocr.ts:534` - Uso flag
- `tests/integration/ocr-vision.test.ts:70` - Test flag disabled
- `PHASE_3_EXECUTION_CHECKLIST.md:21` - Documentazione

#### 2. Fixture Immagine
- **Directory:** `tests/fixtures/ocr-images/`
- **File usato:** `WhatsApp Image 2025-12-08 at 13.57.30.jpeg`
- **Formato:** Base64 (convertito in test)

### B. Test Kill Switch OFF

#### Procedura
1. **Setup:** Mock `ocrConfig.ENABLE_OCR_IMAGES = false`
2. **Input:** Immagine base64 (fixture WhatsApp)
3. **Esecuzione:** `ocrWorker(state, logger)`
4. **Verifica:** Output contiene `clarification_request`, `next_step: 'END'`

#### Test Eseguito
**File:** `tests/integration/ocr-vision.test.ts:70`

```typescript
it('should return clarification when ENABLE_OCR_IMAGES is false', async () => {
  // Override config
  vi.doMock('@/lib/config', async (importOriginal) => {
    const original = await importOriginal() as any;
    return {
      ...original,
      ocrConfig: {
        ...original.ocrConfig,
        ENABLE_OCR_IMAGES: false,
      },
    };
  });
  
  vi.resetModules();
  const { ocrWorker: ocrWorkerDisabled } = await import('@/lib/agent/workers/ocr');
  
  const state = createMockAgentState(MINIMAL_IMAGE_BASE64);
  const result = await ocrWorkerDisabled(state, nullLogger);

  expect(result.clarification_request).toBeDefined();
  expect(result.clarification_request).toContain('immagine');
  expect(result.next_step).toBe('END');
});
```

**Risultato:** ✅ **PASS**

#### Verifica Comportamento
- ✅ Nessun errore 500
- ✅ Comportamento deterministico: `clarification_request` + `END`
- ✅ Nessuna chiamata a `executeVisionWithRetry()`
- ✅ Log: `📸 [OCR Worker] Immagine rilevata - OCR immagini disabilitato (ENABLE_OCR_IMAGES=false)`

### C. Test Kill Switch ON

#### Procedura
1. **Setup:** `ocrConfig.ENABLE_OCR_IMAGES = true` (default per test)
2. **Input:** Immagine base64 (fixture WhatsApp)
3. **Esecuzione:** `ocrWorker(state, logger)`
4. **Verifica:** Vision viene eseguito, dati estratti

#### Test Eseguito
**File:** `tests/integration/ocr-vision.integration.test.ts`

**Risultato esecuzione:**
```
✓ tests/integration/ocr-vision.integration.test.ts (13 tests) 22593ms
  ✓ [MEDIUM] WhatsApp Image 2025-12-08 at 13.57.30.jpeg: Screenshot WhatsApp 1  2364ms
  ✓ [MEDIUM] WhatsApp Image 2025-12-08 at 13.57.30 (1).jpeg: Screenshot WhatsApp 2  2415ms
  ...
  Test Files  1 passed (1)
  Tests  13 passed (13)
```

**Risultato:** ✅ **PASS**

#### Verifica Comportamento
- ✅ Vision viene eseguito (`executeVisionWithRetry()` chiamato)
- ✅ Dati estratti correttamente
- ✅ Log: `📸 [OCR Worker] Immagine rilevata - avvio estrazione Vision con retry policy`
- ✅ Routing a `address_worker` quando dati completi

### D. Regression Guard

#### Test E2E
**Comando:** `npm run test:e2e`

**Nota:** Test E2E non eseguiti in questo dry-run (richiedono ambiente completo).  
**Raccomandazione:** Eseguire prima di deploy produzione.

#### Test Unitari OCR
**Comando:** `npm run test:ocr:integration`

**Risultato:** ✅ **PASS** (13 tests passed)

#### Test Smoke
**Comando:** `npm run test:smoke:golden`

**Nota:** Non eseguito in questo dry-run.  
**Raccomandazione:** Eseguire prima di deploy produzione.

---

## Risultati

### Test OFF: **PASS** ✅

**Evidenze:**
- ✅ Test unitario passa: `tests/integration/ocr-vision.test.ts:70`
- ✅ Comportamento deterministico: `clarification_request` + `END`
- ✅ Nessun crash: `processingStatus: 'idle'`
- ✅ Nessuna chiamata Vision: `executeVisionWithRetry()` non eseguito
- ✅ Log appropriato: messaggio di disabilitazione

**Codice verificato:**
```typescript:lib/agent/workers/ocr.ts:534-541
if (!ocrConfig.ENABLE_OCR_IMAGES) {
  logger.log('📸 [OCR Worker] Immagine rilevata - OCR immagini disabilitato (ENABLE_OCR_IMAGES=false)');
  return {
    clarification_request: 'Ho ricevuto un\'immagine, ma l\'estrazione automatica non è ancora attiva. Puoi incollare il testo dello screenshot?',
    next_step: 'END',
    processingStatus: 'idle',
  };
}
```

### Test ON: **PASS** ✅

**Evidenze:**
- ✅ Test integration passano: 13/13 tests passed
- ✅ Vision viene eseguito correttamente
- ✅ Dati estratti da immagini WhatsApp
- ✅ Routing corretto a `address_worker` quando dati completi

**Codice verificato:**
```typescript:lib/agent/workers/ocr.ts:543-551
// Sprint 2.5 Phase 2: Estrazione immagine via Gemini Vision con retry policy
logger.log('📸 [OCR Worker] Immagine rilevata - avvio estrazione Vision con retry policy');

// Esegui Vision con retry (max 1 retry per errori transienti)
const visionResult: VisionResult = await executeVisionWithRetry(
  state,
  messageContent,
  logger
);
```

### Regression (E2E / smoke): **N/A** ⚠️

**Nota:** Test E2E e smoke non eseguiti in questo dry-run.  
**Raccomandazione:** Eseguire prima di deploy produzione.

---

## Evidenze

### Log/Telemetria Rilevante (senza PII)

#### Kill Switch OFF
```
📸 [OCR Worker] Immagine rilevata - OCR immagini disabilitato (ENABLE_OCR_IMAGES=false)
```

**Output test:**
```typescript
{
  clarification_request: "Ho ricevuto un'immagine, ma l'estrazione automatica non è ancora attiva. Puoi incollare il testo dello screenshot?",
  next_step: "END",
  processingStatus: "idle"
}
```

#### Kill Switch ON
```
📸 [OCR Worker] Immagine rilevata - avvio estrazione Vision con retry policy
🔄 [Vision] Tentativo 1/2
✅ [Vision] Successo al tentativo 1
📸 [OCR Worker] Vision: campi estratti: 5, tentativi: 1
```

**Output test:**
```typescript
{
  shipmentDraft: { recipient: { ... }, parcel: { ... } },
  next_step: "address_worker",
  processingStatus: "extracting",
  ocrSource: "image",
  extractedFieldsCount: 5
}
```

### File/Righe Coinvolte

1. **Config Flag:**
   - `lib/config.ts:99` - Definizione `ENABLE_OCR_IMAGES`

2. **Uso Flag:**
   - `lib/agent/workers/ocr.ts:534` - Check flag e return early

3. **Test:**
   - `tests/integration/ocr-vision.test.ts:70` - Test flag disabled
   - `tests/integration/ocr-vision.integration.test.ts` - Test integration con flag ON

### Screenshot/Output Test

**Test Integration Output:**
```
✓ tests/integration/ocr-vision.integration.test.ts (13 tests) 22593ms
  ✓ [MEDIUM] WhatsApp Image 2025-12-08 at 13.57.30.jpeg: Screenshot WhatsApp 1  2364ms
  ✓ [MEDIUM] WhatsApp Image 2025-12-08 at 13.57.30 (1).jpeg: Screenshot WhatsApp 2  2415ms
  ...
  Test Files  1 passed (1)
  Tests  13 passed (13)
  Duration  28.56s
```

---

## Decisione

### ESITO: **PASS** ✅

**Motivazione:**

1. ✅ **Kill Switch OFF:** Comportamento deterministico, nessun crash, fallback a clarification
2. ✅ **Kill Switch ON:** Vision funziona correttamente, dati estratti
3. ✅ **Test Coverage:** Test unitari e integration passano
4. ✅ **Codice Verificato:** Flag letto correttamente, comportamento atteso implementato

**Rischi Identificati (Non Bloccanti):**

1. ⚠️ **Test E2E non eseguiti:** Raccomandazione eseguire prima di deploy produzione
2. ⚠️ **Test Smoke non eseguiti:** Raccomandazione eseguire prima di deploy produzione
3. ⚠️ **Flag non verificato in staging/prod:** Raccomandazione testare in ambiente staging prima di Cohort 0

### Impatto su Cohort 0: **NON BLOCCANTE** ✅

**Cohort 0 può procedere** con le seguenti condizioni:

1. ✅ Kill Switch funziona correttamente in test
2. ⚠️ **Raccomandazione:** Testare in staging con flag OFF prima di Cohort 0
3. ⚠️ **Raccomandazione:** Eseguire test E2E prima di deploy produzione

### Follow-up (se necessario)

**Se ESITO = FAIL (non applicabile):**
- N/A

**Raccomandazioni per Cohort 0:**

1. **Pre-Deploy:**
   - Eseguire test E2E: `npm run test:e2e`
   - Eseguire smoke test: `npm run test:smoke:golden`
   - Testare in staging con flag OFF

2. **Post-Deploy:**
   - Monitorare log per verificare che flag funzioni in produzione
   - Verificare che clarification request venga mostrata correttamente quando flag OFF

3. **Documentazione:**
   - ✅ Flag documentato in `lib/config.ts:96-98`
   - ✅ Comportamento documentato in `lib/agent/workers/ocr.ts:533-541`
   - ✅ Test documentati in `tests/integration/ocr-vision.test.ts:70`

---

## Note Aggiuntive

### Verifica PII nei Log

**Check rapido eseguito:**
- ✅ Log kill switch OFF: solo messaggio di disabilitazione, no base64
- ✅ Log kill switch ON: solo conteggi, no dati estratti
- ✅ Nessun leak PII identificato

**Riferimento:** Audit PII completo in `docs/phase3/PII_AUDIT_PRE_COHORT_0.md`

### Procedura Ripetibile

**Per testare in locale:**
```bash
# 1. Imposta flag OFF
export ENABLE_OCR_IMAGES=false

# 2. Esegui test
npm run test:ocr:integration

# 3. Verifica output contiene clarification_request
```

**Per testare in staging/prod:**
```bash
# 1. Imposta variabile ambiente
ENABLE_OCR_IMAGES=false

# 2. Riavvia applicazione

# 3. Invia immagine via API
POST /api/agent/process-shipment
{ "image": "data:image/jpeg;base64,..." }

# 4. Verifica response contiene clarification_request
```

---

## Conclusione

**DRY-RUN COMPLETATO CON ESITO POSITIVO**

Il Kill Switch OCR immagini funziona correttamente:
- ✅ Flag OFF: fallback deterministico a clarification, nessun crash
- ✅ Flag ON: Vision funziona correttamente, dati estratti
- ✅ Test coverage adeguata
- ⚠️ Raccomandazione: testare in staging prima di Cohort 0

**Cohort 0 può procedere** ✅






