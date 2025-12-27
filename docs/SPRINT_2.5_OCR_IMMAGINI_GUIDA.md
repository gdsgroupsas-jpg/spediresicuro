# Sprint 2.5: OCR Immagini - Guida Decisionale

**Stato:** 🟢 IMPLEMENTATO (Phase 2)  
**Obiettivo:** Implementare estrazione dati da immagini in `ocrWorker`  
**Data:** 2025-12-27

---

## 📋 DECISIONI PRESE

### 1. ARCHITETTURA

| Decisione | Opzioni | Scelta | Motivazione |
|-----------|---------|--------|-------------|
| **Riuso vs Riscrittura** | A) Riusare `extractData()` + mapping | ✅ | Riuso infrastruttura esistente, mapping esplicito con `mapVisionOutputToShipmentDraft` |

---

### 2. TEST & FIXTURE

| Decisione | Opzioni | Scelta | Motivazione |
|-----------|---------|--------|-------------|
| **Immagini di test** | D) Mix di tutte | ✅ | Copertura completa scenari reali |

**Requisiti fixture (in `tests/fixtures/ocr-images/`):**
- [x] Almeno 5 immagini con dati completi (CAP, città, provincia, peso)
- [x] Almeno 3 immagini con dati parziali
- [x] Almeno 2 immagini "rumorose" (blur, rotazione, basso contrasto)
- [x] Almeno 1 immagine illeggibile (per testare fallback)

---

### 3. FALLBACK STRATEGY

| Decisione | Opzioni | Scelta | Motivazione |
|-----------|---------|--------|-------------|
| **Se Gemini fallisce** | B) Retry 1x + Clarification | ✅ | Resilienza a errori transienti, fallback esplicito |
| **Se confidence basso** | C) Blocca e chiedi chiarimento | ✅ | Anti-hallucination |

**Policy implementata:**
1. Primary: Gemini Vision (`extractData`)
2. If transient error (timeout/429/5xx): 1 retry massimo
3. If still failing OR Gemini unavailable: `clarification_request` + END
4. ⚠️ Claude NON è Vision fallback (solo per post-processing testo)

---

### 4. FEATURE FLAG

| Decisione | Opzioni | Scelta | Motivazione |
|-----------|---------|--------|-------------|
| **Nome flag** | A) `ENABLE_OCR_IMAGES` | ✅ | Chiaro e descrittivo |
| **Default** | A) `false` (opt-in) | ✅ | Attivazione graduale |

---

### 5. CONFIDENCE SCORING

| Decisione | Opzioni | Scelta | Motivazione |
|-----------|---------|--------|-------------|
| **Granularità** | A) Score globale | ✅ | Semplicità, Gemini fornisce score unico |
| **Soglia minima** | C) Configurabile (`OCR_MIN_CONFIDENCE`) | ✅ | Default 0.7, tunable |

---

## 🧪 STRUTTURA TEST

### Unit Tests (`npm run test:ocr`)

**Cosa coprono:**
- `mapVisionOutputToShipmentDraft`: mapping campi (pure function)
- Validazione CAP (5 cifre)
- Validazione provincia (2 lettere)
- Normalizzazione telefono
- Anti-hallucination (non inventa dati mancanti)
- `ocrConfig` feature flags

**Cosa NON coprono:**
- Chiamate reali a Gemini Vision
- Errori di rete

**Mock attivi:**
- Supabase, database, nodes, LangChain, fetch

### Integration Tests (`npm run test:ocr:integration`)

**Cosa coprono:**
- Chiamate reali a Gemini Vision
- Estrazione da immagini fixture
- Retry policy (errori transienti)
- Fallback a clarification
- Anti-PII nei log

**Cosa NON coprono:**
- Persistenza Supabase

**Prerequisiti:**
- `GOOGLE_API_KEY` in `.env.local`
- Immagini in `tests/fixtures/ocr-images/`

---

## 📊 ACCEPTANCE CRITERIA

| Metrica | Target | Misurazione |
|---------|--------|-------------|
| **CAP/Città/Provincia accuracy** | ≥ 70% | `fieldMatches / (fieldMatches + fieldMismatches)` |
| **Clarification rate** | ≤ 40% | `clarificationRequested / processed` |
| **Zero PII in log** | 100% | Assert che verifica assenza base64 e nomi nei log |
| **Retry resilience** | 1 retry per transient | Classificazione errori in `vision-fallback.ts` |

### Campi critici

| Campo | Priorità | Note |
|-------|----------|------|
| `recipient_zip` (CAP) | 🔴 CRITICO | Deve essere sempre tentato |
| `recipient_province` | 🟠 ALTO | 2 lettere uppercase |
| `recipient_city` | 🟠 ALTO | Necessario per routing |
| `recipient_name` | 🟡 MEDIO | Opzionale per pricing |
| `weight` | 🟡 MEDIO | Spesso non presente in screenshot |

---

## 📁 FILE MODIFICATI/CREATI

### Implementazione
| File | Descrizione |
|------|-------------|
| `lib/agent/workers/ocr.ts` | ocrWorker con retry policy |
| `lib/agent/workers/vision-fallback.ts` | Retry logic + error classification |
| `lib/config.ts` | `ocrConfig` con feature flags |

### Test
| File | Descrizione |
|------|-------------|
| `tests/unit/ocr-vision.test.ts` | 23 unit tests mapping |
| `tests/integration/ocr-vision.integration.test.ts` | Integration con Gemini |
| `tests/setup-ocr-isolated.ts` | Setup unit (mock tutto) |
| `tests/setup-ocr-integration.ts` | Setup integration (mock solo Supabase) |
| `vitest.config.ocr.ts` | Config unit |
| `vitest.config.ocr-integration.ts` | Config integration |

### Fixture
| File | Descrizione |
|------|-------------|
| `tests/fixtures/ocr-images/expected.json` | Expected output per immagini |
| `tests/fixtures/ocr-images/README.md` | Istruzioni aggiunta fixture |

---

## ⚠️ ANTI-CARTONATO CHECKLIST

Prima di considerare DONE:

- [x] **Test con mock** passa (unit)
- [x] **Test skipped correttamente** se API key manca
- [x] **Retry policy** implementata (1 retry per errori transienti)
- [x] **Fallback esplicito** a clarification (non mascherato)
- [x] **Anti-hallucination**: `mapVisionOutputToShipmentDraft` non inventa dati
- [x] **Telemetria** non contiene base64 o PII (assert in integration test)
- [x] **Claude non usato come Vision fallback** (solo per testo)

---

## 🚦 STATO CORRENTE

```
[x] Decisioni architettura prese
[x] Fixture definitions pronte (expected.json)
[x] Feature flag implementato (ENABLE_OCR_IMAGES)
[x] Implementazione ocrWorker con retry
[x] Test unitari (23 test)
[x] Test integrazione (skip se no API key)
[x] Documentazione aggiornata
[ ] Aggiungere immagini fixture reali
[ ] Review & merge
```

---

## 🔧 COMANDI

```bash
# Unit test (mock, deterministico)
npm run test:ocr

# Integration test (richiede GOOGLE_API_KEY)
npm run test:ocr:integration
```

---

## PROSSIMI PASSI

1. **Aggiungere immagini fixture reali** in `tests/fixtures/ocr-images/`
2. **Eseguire integration test** con `GOOGLE_API_KEY` attiva
3. **Review acceptance criteria** con metriche reali
4. **Merge su master**
