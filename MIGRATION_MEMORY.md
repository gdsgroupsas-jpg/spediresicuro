# MIGRATION_MEMORY.md
# OBIETTIVO: Migrazione Anne -> LangGraph Supervisor
# STATO: 🟢 FASE 1-2 COMPLETE | Sprint 2.4 OCR Worker COMPLETATO | 🟡 Sprint 2.5 PROSSIMO (OCR immagini)

## 🛑 REGOLE D'INGAGGIO
1. **Strangler Fig:** Il codice Legacy è il paracadute. Non cancellarlo mai.
2. **Single Source of Truth:** Logica di calcolo condivisa in `lib/pricing/calculator.ts`.
3. **Test First:** Ogni nuovo worker deve avere il suo test.
4. **No PII nei log:** Mai loggare indirizzi, nomi, telefoni. Solo user_id_hash e trace_id.

---

## ✅ DEFINITION OF DONE

### Fase 1: Preventivi
- [x] Pricing graph funzionante con supervisor routing
- [x] Intent detector con pattern matching + fallback legacy
- [x] Rate limiting distribuito (Upstash Redis) con fallback in-memory
- [x] Telemetria strutturata: `usingPricingGraph`, `graphFailed`, `fallbackToLegacy`
- [x] Single source of truth: `lib/pricing/calculator.ts`
- [x] Test: 86 unit, 35 integration, tutti verdi
- [x] Build: passa senza errori

### Fase 2: Supervisor Hardening + Address Worker
- [x] Supervisor Router come entry point unico (`supervisor-router.ts`)
- [x] Telemetria finale unificata: `supervisorRouterComplete` con tutti i campi
- [x] Guardrail: pricing intent → pricing_graph SEMPRE; legacy solo se graph_error
- [x] Address Worker: estrazione/normalizzazione indirizzi italiani
- [x] Schema `ShipmentDraft` con validazione Zod (CAP 5 cifre, provincia 2 lettere)
- [x] Semantica clarification: `next_step = 'END'` + `clarification_request` (deprecato `request_clarification`)
- [x] Telemetria estesa: `worker_run`, `missing_fields_count`, `address_normalized`

---

## 📋 TODO LIST (LIVE TRACKING)

### ✅ FASE 1: PREVENTIVI (COMPLETATA & BLINDATA)
- [x] **1.1 Architettura:** Supervisor, Workers, Graph, State (Pydantic-like)
- [x] **1.2 Routing Sicuro:** Intent Detector con regole rigide + Fallback Legacy
- [x] **1.3 Testing & Quality:**
  - Unit & Integration passati con rate limit distribuito
  - **Single Source of Truth:** `lib/pricing/calculator.ts` (funzione pura)
  - Contract tests per `pricing-engine.ts` (18 test)
  - Semi-real tests per `price-lists.ts` (4 test con fixture JSON)

### ✅ FASE 2.1: SUPERVISOR ROUTER (COMPLETATA)
- [x] Supervisor Router come entry point unico
- [x] Routing: `pricing_worker` | `address_worker` | `legacy` | `END`
- [x] MAX_ITERATIONS guard (2) per evitare loop infiniti

### ✅ FASE 2.2: TELEMETRIA & GUARDRAIL (COMPLETATA)
- [x] Evento finale `supervisorRouterComplete` con:
  - `intent_detected`: pricing | non_pricing | unknown
  - `supervisor_decision`: pricing_worker | address_worker | legacy | end
  - `backend_used`: pricing_graph | legacy
  - `fallback_to_legacy`: boolean
  - `fallback_reason`: graph_error | non_pricing | unknown_intent | intent_error | null
- [x] Guardrail: pricing intent → SEMPRE pricing_graph prima
- [x] Legacy path marcato con commenti `// LEGACY PATH (temporary)`

### ✅ FASE 2.3: ADDRESS WORKER (COMPLETATA)
- [x] **Schema `ShipmentDraft`:** `lib/address/shipment-draft.ts`
  - Zod validation per CAP (5 cifre), provincia (2 lettere)
  - `missingFields` array per tracking campi mancanti
- [x] **Normalizzatore IT:** `lib/address/normalize-it-address.ts`
  - Estrazione regex: CAP, provincia, città, via, peso
  - Nessuna dipendenza esterna (no LLM, no API)
- [x] **Address Worker:** `lib/agent/workers/address.ts`
  - Input: messaggio utente + state esistente
  - Output: `shipmentDraft` aggiornato + `next_step`
  - Merge non distruttivo dei dati
- [x] **State evoluto:** `shipmentDraft` in `AgentState`
- [x] **Telemetria:** `worker_run`, `missing_fields_count`, `address_normalized`
- [x] **Test:** 3 integration test per address worker

### ✅ FASE 2.4: OCR WORKER (COMPLETATA)
- [x] **OCR Worker (`lib/agent/workers/ocr.ts`):**
  - Wrapper sopra pipeline OCR esistente (`extractData()` / adapters). **NON riscritto sistema OCR.**
  - Input: testo OCR raw (immagini: placeholder con TODO per Sprint 2.5)
  - Output standard: `shipmentDraft` + `missingFields` + `clarification_request`
  - Parsing deterministico regex: CAP, provincia, città, via, peso (no LLM per inventare dati)
- [x] **Routing (Single Decision Point):**
  - `supervisor-router.ts` rileva pattern OCR (`hasOcrPatterns`) ma NON decide routing
  - `supervisor.ts` è l'UNICA autorità che imposta `next_step='ocr_worker'`
  - `pricing-graph.ts` esegue nodi, non decide routing
- [x] **Semantica clarification:** `next_step='END'` + `clarification_request` se mancano campi (es. CAP)
- [x] **Telemetria (NO PII):**
  - `worker_run='ocr'`
  - `ocr_source='image'|'text'`
  - `ocr_extracted_fields_count`
  - `missing_fields_count`
- [x] **Test:** 39 test integration nel file `tests/integration/ocr-worker.test.ts`
- [x] **Build:** TypeScript type-check passa (`npx tsc --noEmit` exit 0)

### 🟡 FASE 2.5: OCR IMMAGINI (NEXT)
- [ ] **Vision Support:**
  - Implementare processamento immagini in `ocrWorker` (attualmente placeholder)
  - Riusare `extractData()` con input immagine base64/buffer
  - Confidence score per campo estratto

### FASE 3: BOOKING WORKER (FUTURE)
- [ ] **Booking Worker:** integrazione `spedisci-online`
- [ ] **Stato:** `booking_result`, `booking_status`
- [ ] **Routing:** Address completo + conferma utente -> Booking Worker

---

## 📊 METRICHE TEST ATTUALI

| Suite | Passati | Totale |
|-------|---------|--------|
| Unit | 86 | 86 |
| Integration | 74 | 74 |
| **Totale** | **160** | **160** |

> Nota: Integration include 39 test OCR worker aggiunti in Sprint 2.4

---

## 🏗️ ARCHITETTURA ATTUALE

```
app/api/ai/agent-chat/route.ts
           │
           ▼
  supervisorRouter()  ← Entry point UNICO
           │
           ├─── Intent Detection + OCR Pattern Detection
           │
           ▼
    decideNextStep()  ← Funzione pura (SINGLE DECISION POINT)
           │
     ┌─────┼─────┬─────────┬─────────┐
     ▼     ▼     ▼         ▼         ▼
  legacy  END  ocr     address   pricing
           │  _worker  _worker   _worker
           │     │        │         │
           │     ▼        ▼         ▼
           │  ShipmentDraft (merge non distruttivo)
           │  + missingFields
           │  + clarification_request
           │     │        │         │
           └─────┴────────┴─────────┘
                        │
                        ▼
                Response to client
```

---

## 🔧 FILE CHIAVE

| File | Responsabilità |
|------|----------------|
| `lib/agent/orchestrator/supervisor-router.ts` | Entry point, telemetria finale, rileva OCR patterns |
| `lib/agent/orchestrator/supervisor.ts` | `decideNextStep()` funzione pura (SINGLE DECISION POINT) |
| `lib/agent/orchestrator/pricing-graph.ts` | LangGraph con nodi supervisor/ocr/address/pricing |
| `lib/agent/orchestrator/state.ts` | `AgentState` con `shipmentDraft`, `next_step` include `'ocr_worker'` |
| `lib/agent/workers/pricing.ts` | Calcolo preventivi |
| `lib/agent/workers/address.ts` | Normalizzazione indirizzi |
| `lib/agent/workers/ocr.ts` | Wrapper OCR: parsing testo, output `ShipmentDraft` + `missingFields` |
| `lib/address/shipment-draft.ts` | Schema Zod `ShipmentDraft` |
| `lib/address/normalize-it-address.ts` | Estrazione regex indirizzi IT |
| `lib/pricing/calculator.ts` | Single source of truth calcolo prezzi |
| `lib/telemetry/logger.ts` | Log strutturati (no PII), include metriche OCR |
| `lib/security/rate-limit.ts` | Rate limiting distribuito (Upstash Redis) |

---

## 🚀 NEXT STEPS

1. **OCR Immagini (Sprint 2.5)**
   - Implementare supporto immagini in `ocrWorker` (attualmente placeholder)
   - Riusare `extractData()` / Gemini Vision per input base64/buffer
   - Aggiungere confidence score per campo

2. **Booking Worker (Sprint 2.6)**
   - Integrazione SpedisciOnline per prenotazione
   - Stato `booking_result` con tracking
   - Routing: address completo + conferma utente → booking

3. **Checkpointer (Future)**
   - Memoria conversazione multi-turn
   - Persistenza stato tra messaggi

---

## ⚠️ BREAKING CHANGES RECENTI

| Versione | Cambiamento |
|----------|-------------|
| Sprint 2.4 | Aggiunto `'ocr_worker'` a `next_step` in `AgentState`. Routing OCR centralizzato in `supervisor.ts` |
| Sprint 2.3 | `request_clarification` DEPRECATO → usa `next_step: 'END'` + `clarification_request` |
| Sprint 2.2 | Rate limiting ora distribuito (Upstash Redis) |
| Sprint 2.1 | `supervisorRouter()` è l'entry point unico (non più branching sparso) |

---

## 📝 NOTE OPERATIVE

- **Rate Limit:** 20 req/min per user, distribuito via Upstash Redis. Fallback in-memory se Redis down.
- **Telemetria:** Ogni request emette 1 evento `supervisorRouterComplete`. Query con `trace_id`.
- **Legacy Path:** Sempre disponibile. Usato se `!isPricingIntent` o `graph_error`.
- **Test Isolation:** `vi.resetModules()` in `beforeEach` per reset rate limiter tra test.
