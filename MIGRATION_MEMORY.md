# MIGRATION_MEMORY.md
# OBIETTIVO: Migrazione Anne -> LangGraph Supervisor
# STATO: 🟢 FASE 1-2 COMPLETE | Sprint 2.6 Booking Worker COMPLETATO | 🟡 Sprint 2.5 PROSSIMO (OCR immagini)

## 🛑 REGOLE D'INGAGGIO
1. **Strangler Fig:** Il codice Legacy è il paracadute. Non cancellarlo mai.
2. **Single Source of Truth:** Logica di calcolo condivisa in `lib/pricing/calculator.ts`.
3. **Test First:** Ogni nuovo worker deve avere il suo test.
4. **No PII nei log:** Mai loggare indirizzi, nomi, telefoni. Solo user_id_hash e trace_id.
5. **Mai più feature irreversibili senza test P0 prima.**

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

### ✅ P0 AUDIT: ADDRESS TEST COVERAGE — RESOLVED
- [x] **Audit Issue:** Nessun test per Address Worker e normalize-it-address (~395 LOC)
- [x] **Resolution:** Creati 107 test unitari:
  - `tests/unit/normalize-it-address.test.ts` (67 test)
  - `tests/unit/address-worker.test.ts` (40 test)
- [x] **Copertura:**
  - Normalizzazione: CAP, provincia (lowercase→uppercase), città, via, peso
  - Merge non distruttivo: stato esistente + input parziale
  - missingFields: calcolo corretto campi mancanti
  - Edge cases: input rumoroso, unicode, casing, spazi, province lowercase, CAP invalido
- [x] **Build:** TypeScript type-check passa, 193 test unit verdi

### ✅ FASE 2.6: BOOKING WORKER (COMPLETATA)
- [x] **Booking Worker (`lib/agent/workers/booking.ts`):**
  - Wrapper sopra `SpedisciOnlineAdapter.createShipment()`
  - NON riscrive logica booking esistente
  - Pre-flight check obbligatori: recipient, parcel, pricing_option, idempotency_key
- [x] **BookingResult type:**
  - `status: 'success' | 'failed' | 'retryable'`
  - `shipment_id`, `carrier_reference`, `error_code`, `user_message`, `retry_after_ms`
- [x] **Conferma esplicita obbligatoria:**
  - Pattern: "procedi", "conferma", "ok prenota", "sì procedi"
  - `containsBookingConfirmation()` rileva conferma
  - Nessun booking silenzioso
- [x] **Routing:**
  - Supervisor: `hasPricingOptions + hasBookingConfirmation + preflightPassed → booking_worker`
  - Booking sempre termina con `next_step='END'`
- [x] **Telemetria (NO PII):**
  - `bookingAttempt`, `bookingSuccess`, `bookingFailed`
  - Campi: `trace_id`, `carrier`, `shipment_id`, `duration_ms`, `failure_reason`
- [x] **Test:** 30 test integration nel file `tests/integration/booking-worker.test.ts`
- [x] **Build:** TypeScript type-check passa

### ✅ REFACTORING SPRINT: DEBITO ARCHITETTURALE P1 (COMPLETATO)
- [x] **P1-1: Logging Disaccoppiato**
  - Creata interfaccia `ILogger` in `lib/agent/logger.ts`
  - Implementazione default `ConsoleLogger` e `NullLogger` per test
  - Sostituiti tutti i `console.log/warn/error` nei worker con `logger.*`
  - Worker ora accettano `logger` come parametro opzionale (default: `defaultLogger`)
  - Wrapper per LangGraph che passano solo `state` (LangGraph non supporta parametri aggiuntivi)
- [x] **P1-2: Rimozione Duplicazione Sync/Async**
  - Estratta logica core condivisa in `processAddressCore()` e `processOcrCore()`
  - `processAddressSync()` e `processOcrSync()` ora usano la stessa logica dei worker async
  - Eliminata duplicazione di codice tra versioni sync e async
- [x] **P1-3: Type Safety Hardening**
  - Migliorato cast in `supervisor-router.ts` con commento esplicativo
  - Sostituito `as any` in `nodes.ts` con tipo esplicito `CorrierePerformance`
  - Documentati `as any` necessari in `pricing-graph.ts` (limiti LangGraph)
  - Sostituiti `error: any` con `error: unknown` e type guards appropriati
- [x] **Test Suite:** 193 unit + 90 integration = 283 test, tutti verdi
- [x] **Type Check:** `tsc --noEmit` passa senza errori

### 🟡 FASE 2.5: OCR IMMAGINI (NEXT)
- [ ] **Vision Support:**
  - Implementare processamento immagini in `ocrWorker` (attualmente placeholder)
  - Riusare `extractData()` con input immagine base64/buffer
  - Confidence score per campo estratto

### FASE 3: ADVANCED FEATURES (FUTURE)
- [ ] **Checkpointer:** Memoria conversazione multi-turn
- [ ] **Wallet Integration:** Verifica credito prima di booking

---

## 📊 METRICHE TEST ATTUALI

| Suite | Passati | Totale |
|-------|---------|--------|
| Unit | 193 | 193 |
| Integration | 104 | 104 |
| **Totale** | **297** | **297** |

> Nota: 
> - Unit include 67 test normalize-it-address + 40 test address-worker (P0 audit)
> - Integration include 39 test OCR + 30 test Booking

---

## 🏗️ ARCHITETTURA ATTUALE

```
app/api/ai/agent-chat/route.ts
           │
           ▼
  supervisorRouter()  ← Entry point UNICO
           │
           ├─── Intent + OCR + Booking Confirmation Detection
           │
           ▼
    decideNextStep()  ← Funzione pura (SINGLE DECISION POINT)
           │
     ┌─────┼─────┬─────────┬─────────┬─────────┐
     ▼     ▼     ▼         ▼         ▼         ▼
  legacy  END  ocr     address   pricing   booking
           │  _worker  _worker   _worker   _worker
           │     │        │         │         │
           │     ▼        ▼         ▼         ▼
           │  ShipmentDraft ───────────> BookingResult
           │  + missingFields              + shipment_id
           │  + clarification_request      + carrier_reference
           │     │        │         │         │
           └─────┴────────┴─────────┴─────────┘
                        │
                        ▼
                Response to client
```

**FLOW TIPICO:**
1. OCR/Address estrae dati → shipmentDraft
2. Pricing calcola opzioni → pricing_options  
3. Utente conferma ("procedi") → booking_worker
4. Booking prenota → booking_result + shipment_id

---

## 🔧 FILE CHIAVE

| File | Responsabilità |
|------|----------------|
| `lib/agent/orchestrator/supervisor-router.ts` | Entry point, telemetria finale, rileva OCR patterns |
| `lib/agent/orchestrator/supervisor.ts` | `decideNextStep()` funzione pura (SINGLE DECISION POINT) |
| `lib/agent/orchestrator/pricing-graph.ts` | LangGraph con nodi supervisor/ocr/address/pricing/booking |
| `lib/agent/orchestrator/state.ts` | `AgentState` con `shipmentDraft`, `booking_result`, `next_step` include `'booking_worker'` |
| `lib/agent/workers/pricing.ts` | Calcolo preventivi |
| `lib/agent/workers/address.ts` | Normalizzazione indirizzi |
| `lib/agent/workers/ocr.ts` | Wrapper OCR: parsing testo, output `ShipmentDraft` + `missingFields` |
| `lib/agent/workers/booking.ts` | Prenotazione spedizione: preflight + SpedisciOnline + BookingResult |
| `lib/address/shipment-draft.ts` | Schema Zod `ShipmentDraft` |
| `lib/address/normalize-it-address.ts` | Estrazione regex indirizzi IT |
| `lib/pricing/calculator.ts` | Single source of truth calcolo prezzi |
| `lib/telemetry/logger.ts` | Log strutturati (no PII), include metriche OCR + Booking |
| `lib/security/rate-limit.ts` | Rate limiting distribuito (Upstash Redis) |

---

## 🚀 NEXT STEPS

1. **OCR Immagini (Sprint 2.5)**
   - Implementare supporto immagini in `ocrWorker` (attualmente placeholder)
   - Riusare `extractData()` / Gemini Vision per input base64/buffer
   - Aggiungere confidence score per campo

2. **Wallet Integration (Sprint 2.7)**
   - Verifica credito prima di booking
   - `INSUFFICIENT_CREDIT` error handling migliorato

3. **Checkpointer (Future)**
   - Memoria conversazione multi-turn
   - Persistenza stato tra messaggi

---

## ⚠️ BREAKING CHANGES RECENTI

| Versione | Cambiamento |
|----------|-------------|
| Sprint 2.6 | Aggiunto `'booking_worker'` a `next_step`, `booking_result: BookingResult` in `AgentState` |
| Sprint 2.6 | Nuovo telemetria: `bookingAttempt`, `bookingSuccess`, `bookingFailed` |
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
