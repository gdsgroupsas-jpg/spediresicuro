# MIGRATION_MEMORY.md
# OBIETTIVO: Migrazione Anne -> LangGraph Supervisor
# STATO: 🟢 FASE 1-2 DONE | Sprint 2.5-2.8 DONE | P0-P1 Refactoring DONE | ✅ OCR Immagini COMPLETATO

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

### ✅ FASE 2.3: ADDRESS WORKER (DONE)
- [x] **Evidenza:**
  - File: `lib/address/shipment-draft.ts` (schema Zod), `lib/address/normalize-it-address.ts` (regex extraction)
  - Core esportato: `processAddressCore()` esportata per test diretti (`lib/agent/workers/address.ts:78`)
  - Merge non distruttivo: `extractAndMerge()` preserva dati esistenti
  - Verifica: `npm run test:unit -- tests/unit/address-worker.test.ts tests/unit/normalize-it-address.test.ts` → 107 test passati
- [x] **Come verificare:**
  ```bash
  grep -r "export.*processAddressCore" lib/agent/workers/address.ts
  # Expected: 1 match
  npm run test:unit -- tests/unit/normalize-it-address.test.ts
  # Expected: 67 test passed
  ```

### ✅ FASE 2.4: OCR WORKER (DONE)
- [x] **Evidenza:**
  - File: `lib/agent/workers/ocr.ts` (544+ righe)
  - Parsing deterministico: funzioni `extractPostalCode`, `extractProvince`, `extractCity`, `extractWeight` (regex, no LLM)
  - Core esportato: `processOcrCore()` esportata per test diretti
  - Immagini: **IMPLEMENTATO** (Sprint 2.5) - integrazione Gemini Vision con retry + fallback
  - Verifica: `npm run test:integration -- tests/integration/ocr-worker.test.ts` → 25 test passati
- [x] **Come verificare:**
  ```bash
  grep -r "extractPostalCode\|extractProvince\|extractCity" lib/agent/workers/ocr.ts
  # Expected: funzioni con implementazione regex
  grep -r "executeVisionWithRetry\|vision-fallback" lib/agent/workers/ocr.ts
  # Expected: integrazione Vision implementata (Sprint 2.5)
  ```

### ✅ P0 AUDIT: ADDRESS TEST COVERAGE (DONE)
- [x] **Evidenza:**
  - File: `tests/unit/normalize-it-address.test.ts` (552 righe, 67 test), `tests/unit/address-worker.test.ts` (527 righe, 40 test)
  - Verifica: `npm run test:unit -- tests/unit/normalize-it-address.test.ts tests/unit/address-worker.test.ts` → 107 test passati
- [x] **Come verificare:**
  ```bash
  wc -l tests/unit/normalize-it-address.test.ts tests/unit/address-worker.test.ts
  # Expected: ~1079 righe totali
  npm run test:unit -- tests/unit/normalize-it-address.test.ts
  # Expected: 67 test passed
  ```

### ✅ FASE 2.6: BOOKING WORKER (DONE)
- [x] **Evidenza:**
  - File: `lib/agent/workers/booking.ts` (527 righe)
  - Pre-flight check: `preflightCheck()` esportata, verifica recipient/parcel/pricing_option/idempotency_key
  - Conferma esplicita: `containsBookingConfirmation()` esportata, pattern regex in `BOOKING_CONFIRMATION_PATTERNS`
  - Verifica: `npm run test:integration -- tests/integration/booking-worker.test.ts` → 30 test passati
- [x] **Come verificare:**
  ```bash
  grep -r "preflightCheck\|containsBookingConfirmation" lib/agent/workers/booking.ts
  # Expected: funzioni esportate con implementazione
  npm run test:integration -- tests/integration/booking-worker.test.ts
  # Expected: 30 test passed
  ```

### ✅ P0: TEST UNITARI REALI (DONE)
- [x] **Evidenza:**
  - File: `tests/unit/processAddressCore.test.ts` (26 test)
  - File: `tests/unit/ocr-worker.test.ts` (21 test)
  - File: `tests/unit/booking-worker.test.ts` (24 test)
  - Funzioni esportate per test diretti: `processAddressCore`, `processOcrCore`, `callBookingAdapter`
  - Verifica: `npm run test:unit` → `Test Files 11 passed (11), Tests 264 passed (264)`
- [x] **Come verificare:**
  ```bash
  npm run test:unit
  # Expected: Test Files 11 passed (11), Tests 264 passed (264)
  grep -r "export.*processAddressCore\|export.*processOcrCore\|export.*callBookingAdapter" lib/agent/workers/
  # Expected: 3 matches (address.ts, ocr.ts, booking.ts)
  ```

### ✅ P1: CONFIGURAZIONE ESTERNA (DONE)
- [x] **Evidenza:**
  - File: `lib/config.ts` (122 righe)
  - Costanti spostate: 15 da 6 file
  - Sezioni: `graphConfig`, `llmConfig`, `bookingConfig`, `pricingConfig`, `parcelDefaults`
  - Verifica: `grep -r "MAX_ITERATIONS\|RECURSION_LIMIT\|MIN_CONFIDENCE" lib/agent/orchestrator/` → solo import da config
- [x] **Come verificare:**
  ```bash
  cat lib/config.ts | grep -E "MAX_ITERATIONS|RECURSION_LIMIT|MIN_CONFIDENCE|RETRY_AFTER_MS|DEFAULT_MARGIN_PERCENT"
  # Expected: tutte le costanti presenti
  grep -r "const MAX_ITERATIONS\|const RECURSION_LIMIT" lib/agent/orchestrator/
  # Expected: 0 matches (tutte sostituite con import)
  ```

### ✅ REFACTORING SPRINT: DEBITO ARCHITETTURALE P1 (DONE)
- [x] **P1-1: Logging Disaccoppiato**
  - Evidenza: `lib/agent/logger.ts` (51 righe), interfaccia `ILogger` esportata
  - Verifica: `grep -r "console\.\(log\|warn\|error\)" lib/agent/orchestrator/` → 0 matches
  - Come verificare:
    ```bash
    grep -r "console\.\(log\|warn\|error\)" lib/agent/orchestrator/ lib/agent/workers/
    # Expected: 0 matches (solo in lib/agent/logger.ts come implementazione ConsoleLogger)
    ```
- [x] **P1-2: Rimozione Duplicazione Sync/Async**
  - Evidenza: `lib/agent/workers/address.ts:78` (`export function processAddressCore`), `lib/agent/workers/ocr.ts:378` (`export function processOcrCore`)
  - Verifica: `grep -A5 "function processAddressSync\|function processOcrSync" lib/agent/workers/*.ts` → chiamano core
  - Come verificare:
    ```bash
    grep -A3 "function processAddressSync" lib/agent/workers/address.ts
    # Expected: chiama processAddressCore
    ```
- [x] **P1-3: Type Safety Hardening**
  - Evidenza: `lib/agent/orchestrator/pricing-graph.ts` contiene commenti `// NOTE: I cast 'as any'` con spiegazione LangGraph
  - Verifica: `npm run type-check` → exit code 0
  - Come verificare:
    ```bash
    npm run type-check
    # Expected: exit code 0, no errors
    ```

### ✅ FASE 2.7: DYNAMIC PLATFORM FEES (DONE)
- [x] **DB Migration 050:**
  - File: `supabase/migrations/050_dynamic_platform_fees.sql`
  - Rollback: `supabase/migrations/050_dynamic_platform_fees_rollback.sql`
  - Colonne aggiunte a `users`: `platform_fee_override`, `platform_fee_notes`
  - Tabella audit: `platform_fee_history`
  - Funzioni RPC: `get_platform_fee(user_id)`, `update_user_platform_fee(user_id, fee, notes)`
  - RLS: solo SUPERADMIN vede history
  - Default: €0.50 per spedizione
  - ✅ **Migrazione applicata in produzione** (2025-12-27)
- [x] **Service Layer:** `lib/services/pricing/platform-fee.ts`
  - Funzioni: `getPlatformFee`, `getPlatformFeeSafe`, `updatePlatformFee`, `getPlatformFeeHistory`
  - Costante: `DEFAULT_PLATFORM_FEE = 0.50`
  - Tipi: `PlatformFeeResult`, `PlatformFeeHistoryEntry`, etc.
  - Type-check: ✅ passa
- [x] **Worker Integration:** BookingWorker applica fee dinamica
  - `lib/agent/workers/booking.ts`: calcola `getPlatformFeeSafe(userId)` prima del booking
  - `lib/agent/workers/pricing.ts`: aggiunge fee MVP (€0.50) ai preventivi
  - `lib/shipments/create-shipment-core.ts`: include platform fee nel wallet debit
  - `BookingResult.cost_breakdown`: { courier_cost, platform_fee, total_charged }
- [x] **Test:** Unit 264/264 ✅, Integration 90/90 ✅

**Come verificare:**
```bash
npm run test:unit      # → 264 test passati
npm run test:integration # → 90 test passati
npm run type-check     # → 0 errori
```

### ✅ FASE 2.8: SUPERADMIN UI - PLATFORM FEE MANAGEMENT (DONE)
- [x] **Componenti React:** `components/admin/platform-fee/`
  - `CurrentFeeDisplay`: Mostra fee corrente con badge Custom/Default
  - `UpdateFeeDialog`: Dialog modifica fee con quick presets (Enterprise €0.30, Standard €0.50, VIP €0.00, Reset)
  - `FeeHistoryTable`: Tabella storico modifiche con audit trail
- [x] **API Route:** `app/api/admin/platform-fee/update/route.ts`
  - POST endpoint per aggiornare fee
  - Verifica autenticazione + ruolo SUPERADMIN
  - Validazione input (fee >= 0 o null per reset)
- [x] **User Detail Page:** `app/dashboard/admin/users/[userId]/page.tsx`
  - Mostra informazioni utente (email, ruolo, wallet, data registrazione)
  - Sezione "Platform Fee (BYOC)" con CurrentFeeDisplay
  - Storico modifiche con FeeHistoryTable
- [x] **Admin Page Update:** Link da tabella utenti a pagina dettaglio
  - Icona ExternalLink per accesso rapido a gestione fee

**SuperAdmin può ora gestire le fee via UI senza SQL!**

**Come verificare:**
```bash
npm run type-check     # → 0 errori
npm run dev            # → Naviga a /dashboard/admin → click icona su utente → sezione Platform Fee
```

### ✅ FASE 2.5: OCR IMMAGINI (DONE - 27/12/2025)
- [x] **Vision Support con Gemini:**
  - File: `lib/agent/workers/ocr.ts` - integrazione con Gemini Vision
  - File: `lib/agent/workers/vision-fallback.ts` - retry logic + clarification fallback
  - `extractData()` con input immagine base64 → Gemini 2.0 Flash Vision
  - Confidence score: 90% su tutte le immagini test
- [x] **Fallback Policy:**
  - Primary: Gemini Vision con max 1 retry per errori transient (timeout/429/5xx)
  - Se fallisce: `clarification_request` immediata + END (no Claude Vision fallback)
  - Claude usato SOLO per post-processing testo, MAI per Vision
- [x] **Test Infrastructure Isolati:**
  - `vitest.config.ocr.ts` - config unit test isolati
  - `tests/setup-ocr-isolated.ts` - mock Supabase/database/LLM per unit test
  - `npm run test:ocr` - comando deterministico per unit test
- [x] **Integration Test Reali:**
  - `vitest.config.ocr-integration.ts` - config integration test
  - `tests/setup-ocr-integration.ts` - mock solo Supabase, LLM reale
  - `tests/integration/ocr-vision.integration.test.ts` - 13 test con immagini reali
  - `npm run test:ocr:integration` - richiede GOOGLE_API_KEY
- [x] **Fixture Immagini:**
  - 10 immagini WhatsApp reali in `tests/fixtures/ocr-images/`
  - `expected.json` con definizioni expected fields
- [x] **Acceptance Criteria Verificati:**
  - Immagini processate: 10/10 ✅
  - Clarification rate: 0% (target ≤60%) ✅
  - Confidence: 90% su tutte ✅
  - Zero PII nei log ✅

**Come verificare:**
```bash
# Unit test isolati (mock, deterministici)
npm run test:ocr
# Expected: 6 test passed

# Integration test reali (richiede GOOGLE_API_KEY in .env.local)
npm run test:ocr:integration
# Expected: 13 test passed, ~27 secondi
```

### ✅ P1: AI AGENT INTEGRATION PREREQUISITES (COMPLETATA - 1 Gennaio 2026)
- [x] **Tabella agent_sessions:** Persistenza conversazioni multi-turn con RLS
- [x] **ActingContext injection:** ActingContext iniettato in AgentState
- [x] **AgentState esteso:** agent_context e mentor_response aggiunti
- [x] **mentor_worker:** Worker Q&A tecnico con RAG su documentazione
- [x] **API endpoints unificati:** /api/ai/agent-chat come entry point unico
- [x] **AUDIT_ACTIONS:** Costanti per audit trail operazioni agent
- [x] **Test completi:** 325 unit + 121 integration test passati
- [x] **Type safety:** Type-check passa (0 errori), type guards per proprietà opzionali

**Evidenza:**
- File: `supabase/migrations/054_agent_sessions.sql`, `lib/agent/workers/mentor.ts`, `lib/agent/orchestrator/state.ts`
- Test: `tests/unit/mentor-worker.test.ts` (13 test), `tests/integration/mentor-worker.test.ts` (8 test)
- Commit: 11 commit atomizzati con scope chiaro

**Come verificare:**
```bash
npm run test:unit # 325 test passed
npm run test:integration # 121 test passed
npm run type-check # 0 errori
```

### ✅ P2: AI AGENT FEATURES - UX E DEBUGGING (IN CORSO - 1 Gennaio 2026)
- [x] **Task 4: Mobile Anne** - Icona ghost nel menu mobile per aprire Anne Assistant
- [x] **Task 1: AgentDebugPanel** - Componente UI per telemetria (solo admin/superadmin)
- [x] **Task 2: debug_worker** - Worker per analisi errori e troubleshooting
- [ ] **Task 3: explain_worker** - Worker per spiegare business flows (wallet, spedizioni, margini)
- [ ] **Task 5: compensation_queue processor** - CRON job per cleanup orphan records

**Evidenza:**
- File: `components/agent/AgentDebugPanel.tsx`, `lib/agent/workers/debug.ts`, `components/dashboard-mobile-nav.tsx`
- Modifiche: `components/anne/AnneAssistant.tsx` (listener evento), `app/api/ai/agent-chat/route.ts` (telemetria admin)
- Routing: `lib/agent/orchestrator/supervisor.ts` (intent detection), `lib/agent/orchestrator/pricing-graph.ts` (routing)

**Dettagli implementazione:**
- **Mobile Anne:** Evento `openAnneAssistant` dispatchato da menu mobile, listener in AnneAssistant
- **AgentDebugPanel:** Toggle localStorage, mostra telemetria supervisor (intent, decision, backend, fallback), agent state (iterations, status, confidence), mentor response (sources, confidence)
- **debug_worker:** Analizza `validationErrors`, `processingStatus`, `confidenceScore`; suggerisce fix comuni, link documentazione, retry strategies; restituisce `debug_response` con analysis, suggestions, links

**Come verificare:**
```bash
npm run type-check # 0 errori
# Test manuale: aprire Anne Assistant su mobile, verificare debug panel (admin), testare debug_worker con messaggi tipo "perché non funziona"
```

---

### FASE 3: ADVANCED FEATURES (FUTURE)
- [ ] **Checkpointer:** Memoria conversazione multi-turn (base: agent_sessions ✅)
- [ ] **Wallet Integration:** Verifica credito prima di booking

---

## 📊 METRICHE TEST (VERIFICABILE)

**Come verificare:**
```bash
npm run test:unit
npm run test:integration
```

**Output atteso (ultima esecuzione verificata):**
- Unit: `Test Files 11 passed (11), Tests 264 passed (264)`
- Integration: `Test Files 3 passed (3), Tests 90 passed (90)`

**File test verificabili:**
- `tests/unit/processAddressCore.test.ts` (26 test)
- `tests/unit/ocr-worker.test.ts` (21 test)
- `tests/unit/booking-worker.test.ts` (24 test)
- `tests/unit/normalize-it-address.test.ts` (67 test)
- `tests/unit/address-worker.test.ts` (40 test)
- `tests/integration/ocr-worker.test.ts` (25 test)
- `tests/integration/booking-worker.test.ts` (30 test)
- `tests/integration/agent-chat.pricing.test.ts` (35 test)

**Nota:** I numeri possono variare tra esecuzioni. Verificare sempre con i comandi sopra.

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

1. **Wallet Integration (Sprint 2.7)**
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
  - Verifica: `grep -r "rateLimit\|RATE_LIMIT" lib/security/rate-limit.ts`
- **Telemetria:** Ogni request emette 1 evento `supervisorRouterComplete`. Query con `trace_id`.
  - Verifica: `grep -r "supervisorRouterComplete" lib/agent/orchestrator/supervisor-router.ts`
- **Legacy Path:** Sempre disponibile. Usato se `!isPricingIntent` o `graph_error`.
  - Verifica: `grep -r "LEGACY PATH" lib/agent/orchestrator/supervisor-router.ts`
- **Test Isolation:** `vi.resetModules()` in `beforeEach` per reset rate limiter tra test.
  - Verifica: `grep -r "resetModules" tests/`

---

## ⚠️ KNOWN LIMITS / NON-GARANTITO

### Dipendenze Esterne
- **LangGraph typing constraints:** Alcuni cast `as any` necessari per nomi nodi (vedi `lib/agent/orchestrator/pricing-graph.ts:269-272`)
  - Verifica: `grep -r "as any" lib/agent/orchestrator/pricing-graph.ts`
  - Motivo: LangGraph non ha tipi perfetti per string literal types dei nomi nodi
  - Status: Documentato con commenti, da rimuovere quando LangGraph migliorerà i tipi

- **Google Gemini API:** Dipendenza esterna per LLM. Fallback a logica base se `GOOGLE_API_KEY` mancante.
  - Verifica: `grep -r "GOOGLE_API_KEY" lib/agent/orchestrator/supervisor.ts`
  - Comportamento: Se API key mancante, usa estrazione regex invece di LLM

- **SpedisciOnlineAdapter:** Dipendenza esterna per booking. Errore di rete → `retryable` status.
  - Verifica: `grep -r "SpedisciOnlineAdapter\|NETWORK_ERROR" lib/agent/workers/booking.ts`
  - Comportamento: `retry_after_ms: 30000` (configurabile in `lib/config.ts`)

### Limiti Runtime
- **MAX_ITERATIONS:** Limite hardcoded a 2 iterazioni per pricing graph (configurabile in `lib/config.ts`)
  - Verifica: `grep -r "MAX_ITERATIONS" lib/config.ts`
  - Comportamento: Se superato, grafo termina con `END` e log warning

- **OCR immagini:** ✅ **IMPLEMENTATO** (Sprint 2.5 - 27/12/2025)
  - Verifica: `grep -r "executeVisionWithRetry\|vision-fallback" lib/agent/workers/ocr.ts`
  - Status: Gemini Vision con retry (max 1) + clarification fallback se fallisce
  - Test: `npm run test:ocr:integration` → 13 test passati, 10/10 immagini processate, 90% confidence

### Non Verificabile Automaticamente
- **Performance:** [DATO NON DISPONIBILE] Nessun benchmark automatizzato
- **Coverage:** [DATO NON DISPONIBILE] Nessuno strumento di coverage configurato
- **Production metrics:** [DATO NON DISPONIBILE] Nessun sistema di monitoring production configurato

---

## 🔒 SAFETY INVARIANTS

### 1. NO PII nei Log
**Invariante:** Mai loggare `addressLine1`, `postalCode`, `fullName`, `phone`, testo OCR raw.

**Evidenza:**
- `lib/agent/logger.ts` definisce interfaccia, ma non garantisce contenuto
- Test verificano: `tests/unit/ocr-worker.test.ts` contiene test "should not log addressLine1 in logs"

**Come verificare:**
```bash
grep -r "logger\.\(log\|info\|warn\|error\)" lib/agent/workers/ lib/agent/orchestrator/ | grep -i "addressLine\|postalCode\|fullName\|phone"
# Expected: 0 matches (o solo in commenti)
```

**Limite:** Verifica statica non garantisce runtime. Test unitari verificano spy logger.

### 2. Single Decision Point
**Invariante:** Solo `supervisor.ts` imposta `next_step`. Altri componenti non decidono routing.

**Evidenza:**
- `lib/agent/orchestrator/supervisor.ts` contiene `decideNextStep()` (funzione pura)
- `lib/agent/orchestrator/supervisor-router.ts` rileva pattern ma non decide (vedi commento `// UNICO PUNTO DECISIONALE`)

**Come verificare:**
```bash
grep -r "next_step.*=" lib/agent/orchestrator/ lib/agent/workers/ | grep -v "supervisor.ts"
# Expected: solo letture o assegnazioni in base a decisione supervisor
```

**Limite:** Verifica statica. Test integration verificano comportamento end-to-end.

### 3. No Silent Booking
**Invariante:** Booking richiede conferma esplicita utente (`containsBookingConfirmation()`).

**Evidenza:**
- `lib/agent/workers/booking.ts:164` contiene `containsBookingConfirmation()`
- `lib/agent/orchestrator/supervisor.ts` verifica conferma prima di routing a `booking_worker`

**Come verificare:**
```bash
grep -r "containsBookingConfirmation\|booking_worker" lib/agent/orchestrator/supervisor.ts
# Expected: booking_worker solo se hasBookingConfirmation === true
```

**Limite:** Pattern matching regex può avere falsi positivi/negativi. Test unitari verificano pattern.

### 4. Pre-flight Check Obbligatorio
**Invariante:** Booking worker esegue `preflightCheck()` prima di chiamare adapter.

**Evidenza:**
- `lib/agent/workers/booking.ts:209` chiama `preflightCheck()`
- Se fallisce, ritorna `PREFLIGHT_FAILED` senza chiamare adapter

**Come verificare:**
```bash
grep -A5 "preflightCheck" lib/agent/workers/booking.ts
# Expected: se !preflight.passed, return con PREFLIGHT_FAILED, no adapter call
```

**Limite:** Verifica statica. Test integration verificano comportamento.
