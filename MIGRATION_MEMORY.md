# MIGRATION_MEMORY.md
# OBIETTIVO: Migrazione Anne -> LangGraph Supervisor
# STATO: 🟢 FASE 1-2 DONE | Sprint 2.5-2.8 DONE | P0-P1 Refactoring DONE | ✅ OCR Immagini COMPLETATO | ✅ P3 Architecture DONE | ✅ P4 Business Value DONE | ✅ FASE 4 Gestione Clienti UI DONE | ✅ FASE 3 Reseller Tier System DONE | ✅ SPRINT 1 FINANCIAL TRACKING DONE | ✅ SPRINT 2 UX UNIFICATION DONE | ✅ SPRINT 3 OPTIMIZATION DONE

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
- [x] **Wallet Balance nel contesto:** Aggiunto wallet_balance al contesto fiscale e context-builder per Anne (commit 2b892af)
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

### ✅ P2: AI AGENT FEATURES - UX E DEBUGGING (COMPLETATA - 1 Gennaio 2026)
- [x] **Task 4: Mobile Anne** - Icona ghost nel menu mobile per aprire Anne Assistant
- [x] **Task 1: AgentDebugPanel** - Componente UI per telemetria (solo admin/superadmin)
- [x] **Task 2: debug_worker** - Worker per analisi errori e troubleshooting
- [x] **Task 3: explain_worker** - Worker per spiegare business flows (wallet, spedizioni, margini)
- [x] **Task 5: compensation_queue processor** - CRON job per cleanup orphan records

**Evidenza:**
- File: `components/agent/AgentDebugPanel.tsx`, `lib/agent/workers/debug.ts`, `components/dashboard-mobile-nav.tsx`
- Modifiche: `components/anne/AnneAssistant.tsx` (listener evento), `app/api/ai/agent-chat/route.ts` (telemetria admin)
- Routing: `lib/agent/orchestrator/supervisor.ts` (intent detection), `lib/agent/orchestrator/pricing-graph.ts` (routing)

**Dettagli implementazione:**
- **Mobile Anne:** Evento `openAnneAssistant` dispatchato da menu mobile, listener in AnneAssistant
- **AgentDebugPanel:** Toggle localStorage, mostra telemetria supervisor (intent, decision, backend, fallback), agent state (iterations, status, confidence), mentor response (sources, confidence)
- **debug_worker:** Analizza `validationErrors`, `processingStatus`, `confidenceScore`; suggerisce fix comuni, link documentazione, retry strategies; restituisce `debug_response` con analysis, suggestions, links
- **explain_worker:** RAG su documentazione business (MONEY_FLOWS.md, ARCHITECTURE.md, DB_SCHEMA.md, README.md); spiega flussi wallet, processo spedizione, calcolo margini; genera diagrammi testuali; restituisce `explain_response` con explanation e diagram
- **compensation_queue processor:** CRON job `/api/cron/compensation-queue` per cleanup automatico; verifica records con `status='pending'` e `created_at > 7 giorni`; marca come `expired` (mantiene audit trail); logga tutte le operazioni con `SYSTEM_MAINTENANCE` audit action; Authorization Bearer token obbligatorio (fail-closed)

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

## ✅ P3: AI AGENT ARCHITECTURE (COMPLETATO - 1 Gennaio 2026)

### Task 1: LangGraph Checkpointer - State Persistence
- [x] **Checkpointer:** `lib/agent/orchestrator/checkpointer.ts` - Estende MemorySaver, salva in Supabase
- [x] **Service Layer:** `lib/services/agent-session.ts` - Abstraction layer con cache in-memory (TTL 5 min)
- [x] **Integrazione:** Checkpointer integrato in `pricing-graph.ts` e `supervisor-router.ts`
- [x] **Persistenza:** Stato completo salvato in `agent_sessions` table (migration 054)
- [x] **Ripristino:** Conversazioni multi-turn riprendono da checkpoint

### Task 2: Wallet Integration - Verifica Credito Pre-Booking
- [x] **Credit Check:** `lib/wallet/credit-check.ts` - Verifica credito prima di booking
- [x] **Integrazione:** Check in `supervisor.ts` prima di routing a `booking_worker`
- [x] **Prevenzione:** Blocca tentativi booking con credito insufficiente (risparmio API calls)
- [x] **Messaggi:** Formattazione chiara per utente ("Credito insufficiente: €X disponibili, €Y richiesti")

### Task 3: AgentSession Service - Abstraction Layer
- [x] **Service:** `lib/services/agent-session.ts` - Metodi: `createSession()`, `getSession()`, `updateSession()`, `listSessions()`
- [x] **Cache:** In-memory cache con TTL 5 minuti per sessioni attive
- [x] **Serializzazione:** Supporto BaseMessage[] serialization/deserialization
- [x] **Type Safety:** Type-safe con AgentState serialization

### Task 4: AgentTool Registry - Unificazione Tools
- [x] **Registry:** `lib/agent/tools/registry.ts` - Registry centralizzato con type safety
- [x] **Auto-discovery:** Supporto per decorator pattern (preparato)
- [x] **Validazione:** Input/output con Zod schema
- [x] **Compatibilità:** Mantenuta compatibilità con tools esistenti (`lib/ai/tools.ts`, `lib/agent/tools.ts`)

### Task 5: Type Safety Improvements - Rimuovere TODO
- [x] **Type Guards:** `lib/agent/orchestrator/type-guards.ts` - Type guards per AgentState
- [x] **TODO Risolti:** Rimossi tutti i TODO identificati (pricing-graph.ts, graph.ts, supervisor-router.ts)
- [x] **Type Safety:** Sostituiti cast `as any` con type guards dove possibile
- [x] **Documentazione:** Cast necessari documentati (compatibilità LangGraph API)

### Task 6: Performance Optimization - Query & Caching
- [x] **Cache Service:** `lib/services/cache.ts` - Cache in-memory per RAG e pricing
- [x] **RAG Cache:** Integrato in `mentor_worker.ts` e `explain_worker.ts` (TTL 1 ora)
- [x] **Pricing Cache:** Integrato in `pricing_worker.ts` (TTL 5 minuti)
- [x] **Query Optimization:** Select specifici in `agent-session.ts` (solo campi necessari)

**Evidenza:**
- File: `lib/services/agent-session.ts`, `lib/agent/orchestrator/checkpointer.ts`, `lib/wallet/credit-check.ts`
- File: `lib/agent/tools/registry.ts`, `lib/agent/orchestrator/type-guards.ts`, `lib/services/cache.ts`
- Integrazione cache: `lib/agent/workers/mentor.ts`, `lib/agent/workers/explain.ts`, `lib/agent/workers/pricing.ts`

**Come verificare:**
```bash
# Checkpointer
grep -r "SupabaseCheckpointer\|createCheckpointer" lib/agent/orchestrator/
# Expected: checkpointer.ts, pricing-graph.ts, supervisor-router.ts

# Credit Check
grep -r "checkCreditBeforeBooking" lib/agent/orchestrator/supervisor.ts
# Expected: check prima di booking_worker routing

# Cache
grep -r "agentCache\.\(get\|set\)" lib/agent/workers/
# Expected: mentor.ts, explain.ts, pricing.ts
```

---

## ✅ P4: AI AGENT BUSINESS VALUE & USER EXPERIENCE (COMPLETATO - 2 Gennaio 2026)

### Task 1: Value Dashboard - "Hai risparmiato X minuti"
- [x] **Componente UI:** `components/anne/ValueDashboard.tsx` - Mostra minuti risparmiati, errori evitati, confidence media
- [x] **API Route:** `app/api/ai/value-stats/route.ts` - Endpoint GET per statistiche utente
- [x] **Service:** `lib/services/value-stats.ts` - Logica calcolo statistiche (separato per testabilità)
- [x] **Cache:** localStorage con TTL 5 minuti (non query ogni render)
- [x] **Soglia:** Mostra solo dopo 3+ richieste utente (configurabile via env)
- [x] **Calcolo:** Minuti risparmiati = (tempo manuale * richieste) - (tempo Anne stimato)
- [x] **Errori evitati:** Conta validationErrors gestiti da Anne
- [x] **Confidence media:** Aggregazione confidenceScore da sessioni

### Task 2: Auto-Proceed - Kill Friction
- [x] **Logica Supervisor:** `lib/agent/orchestrator/supervisor.ts` - Auto-proceed per pricing (operazione sicura)
- [x] **Guardrail Critico:** MAI auto-proceed per booking/wallet/LDV/giacenze (sempre conferma umana)
- [x] **Componente UI:** `components/anne/AutoProceedBanner.tsx` - Banner con countdown annullamento
- [x] **Configurazione:** `lib/config.ts` - Soglie configurabili (85% auto-proceed, 70% suggerimento)
- [x] **State:** `lib/agent/orchestrator/state.ts` - Campi `autoProceed` e `suggestProceed` aggiunti
- [x] **Finestra annullamento:** 5 secondi (configurabile via env)
- [x] **Soglie:** 
  - `AUTO_PROCEED_CONFIDENCE_THRESHOLD = 85` (default)
  - `SUGGEST_PROCEED_CONFIDENCE_THRESHOLD = 70` (default)
- [x] **Integrazione:** SupervisorRouter restituisce `agentState` con flag auto-proceed

### Task 3: Human Error Messages - Errori spiegati come umani
- [x] **Service:** `lib/agent/error-translator.ts` - Traduzione errori tecnici in messaggi umani (già implementato)
- [x] **Componente UI:** `components/anne/HumanError.tsx` - Mostra messaggi errori comprensibili
- [x] **Traduzione:** Errori validazione, sistema, preflight, confidence → messaggi user-friendly
- [x] **Auto-risoluzione:** Nasconde errore quando risolto (timeout 2 secondi)
- [x] **Severity:** Info, warning, error (colori diversi)
- [x] **Actionable:** Indica campo mancante per auto-focus UI

### Task 4: Smart Suggestions - Suggerimenti proattivi
- [x] **Service:** `lib/agent/smart-suggestions.ts` - Pattern detection e generazione suggerimenti (già implementato)
- [x] **Componente UI:** `components/anne/SmartSuggestions.tsx` - Mostra suggerimenti proattivi
- [x] **Pattern Detection:** Analizza spedizioni recenti per pattern ricorrenti (recipient, courier, weight)
- [x] **Priorità:** recipient > courier > weight
- [x] **Rate Limiting:** Max 1 suggerimento ogni 24h per tipo (localStorage)
- [x] **RLS Enforcement:** Query Supabase con RLS (usa `user_id` da `requireSafeAuth()`)
- [x] **NO PII:** Mai mostrare indirizzi completi, solo "destinatario a Milano"

### Integrazione
- [x] **AnneAssistant:** `components/anne/AnneAssistant.tsx` - Tutti i componenti P4 integrati
- [x] **AgentState:** Passato ai componenti dalla risposta API (`metadata.agentState`)
- [x] **SupervisorRouter:** Restituisce `agentState` nel risultato per componenti P4
- [x] **API Route:** `app/api/ai/agent-chat/route.ts` - Include `agentState` nei metadata

### Test
- [x] **29 test P4** passati (25 unit + 3 integration + 1 esistente)
  - `tests/unit/error-translator.test.ts` - 8 test (già esistente)
  - `tests/unit/smart-suggestions.test.ts` - 8 test (nuovo)
  - `tests/unit/auto-proceed.test.ts` - 6 test (nuovo)
  - `tests/unit/value-stats.test.ts` - 4 test (nuovo)
  - `tests/integration/p4-auto-proceed.test.ts` - 3 test (nuovo)
- [x] **Type-check:** 0 errori
- [x] **Build:** passato su Vercel
- [x] **Nessuna regressione:** Test esistenti passano

### Guardrail Implementati
- [x] **Auto-proceed SOLO per operazioni sicure:** Pricing (calcolo preventivi), address normalization
- [x] **MAI auto-proceed per:** Booking, wallet, LDV, giacenze (sempre conferma umana)
- [x] **RLS enforcement:** Query Supabase con RLS (usa `user_id` da `requireSafeAuth()`)
- [x] **NO PII nei log:** Solo aggregazioni, mai dati raw (indirizzi, nomi, telefoni)
- [x] **Type safety:** Zero `any` non gestiti, type guards dove necessario

**Evidenza:**
- File: `components/anne/ValueDashboard.tsx`, `components/anne/AutoProceedBanner.tsx`, `components/anne/HumanError.tsx`, `components/anne/SmartSuggestions.tsx`
- File: `lib/services/value-stats.ts`, `lib/agent/error-translator.ts`, `lib/agent/smart-suggestions.ts`
- File: `lib/agent/orchestrator/supervisor.ts` (auto-proceed logic), `lib/config.ts` (configurazioni)
- File: `lib/agent/orchestrator/state.ts` (campi autoProceed/suggestProceed)
- Test: `tests/unit/auto-proceed.test.ts`, `tests/unit/smart-suggestions.test.ts`, `tests/unit/value-stats.test.ts`, `tests/integration/p4-auto-proceed.test.ts`
- Commit: `037590a` - "feat(P4): Implementazione completa Business Value & User Experience"

**Come verificare:**
```bash
# Auto-proceed logic
grep -r "autoProceed\|AUTO_PROCEED" lib/agent/orchestrator/supervisor.ts lib/config.ts
# Expected: logica auto-proceed solo per pricing, mai per booking

# Value Dashboard
grep -r "ValueDashboard\|value-stats" components/anne/AnneAssistant.tsx
# Expected: componente integrato

# Human Error
grep -r "HumanError\|translateError" components/anne/AnneAssistant.tsx
# Expected: componente integrato

# Smart Suggestions
grep -r "SmartSuggestions\|getSmartSuggestion" components/anne/AnneAssistant.tsx
# Expected: componente integrato
```

---

## 🚀 NEXT STEPS

1. **P4 Post-Launch (Opzionali)**
   - A/B testing per soglie auto-proceed (85% vs 80% vs 90%)
   - Metriche reali: minuti risparmiati da telemetria (non stima)
   - Feedback utenti: survey per valutare messaggi errori
   - Smart suggestions: salvataggio destinatari/corrieri predefiniti

2. **Ottimizzazioni Future (Opzionali)**

1. **P4 Post-Launch (Opzionali)**
   - A/B testing per soglie auto-proceed (85% vs 80% vs 90%)
   - Metriche reali: minuti risparmiati da telemetria (non stima)
   - Feedback utenti: survey per valutare messaggi errori
   - Smart suggestions: salvataggio destinatari/corrieri predefiniti

2. **Ottimizzazioni Future (Opzionali)**
   - Batch reads Supabase quando possibile
   - Lazy loading documentazione (carica solo se necessario)
   - Metriche cache hit rate per monitoring

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

---

## 🔧 MODIFICHE RECENTI

### ✅ AI Provider Selection - Supporto Multi-Provider (Gennaio 2026)

**Feature:** Sistema per selezionare il provider AI (Anthropic Claude, DeepSeek o Google Gemini) per Anne tramite UI Superadmin.

**Implementazione:**
- **Migration Database:** `058_ai_provider_preferences.sql`
  - Tabella `system_settings` per preferenze globali
  - Funzioni helper `get_ai_provider()` e `get_ai_model()`
  - RLS policies (solo superadmin può modificare)
  
- **Adapter Pattern:** `lib/ai/provider-adapter.ts`
  - Supporto per Anthropic Claude, DeepSeek e Google Gemini
  - Interfaccia unificata `AIClient` per tutti i provider
  - Gestione automatica del formato API (Anthropic, OpenAI-compatible, Gemini)
  
- **Server Actions:** `actions/ai-settings.ts`
  - `getAIProviderSetting()` - Legge configurazione corrente
  - `updateAIProviderSetting()` - Aggiorna provider (solo superadmin)
  - `getAvailableAIProviders()` - Lista provider disponibili con stato API keys
  
- **UI Superadmin:** `app/dashboard/super-admin/_components/ai-provider-selector.tsx`
  - Componente per selezionare provider AI
  - Mostra stato API keys (configurata/non configurata)
  - Feedback visivo per provider selezionato
  
- **Route Agent Chat:** `app/api/ai/agent-chat/route.ts`
  - Modificata per usare adapter invece di chiamare direttamente Anthropic
  - Supporto automatico per provider configurato dal database
  - Fallback automatico se provider non disponibile

**File creati/modificati:**
- `supabase/migrations/058_ai_provider_preferences.sql` - Migration database
- `lib/ai/provider-adapter.ts` - Adapter per provider AI
- `actions/ai-settings.ts` - Server actions
- `app/dashboard/super-admin/_components/ai-provider-selector.tsx` - UI componente
- `app/api/ai/agent-chat/route.ts` - Route modificata per usare adapter
- `app/dashboard/super-admin/page.tsx` - Aggiunto componente AI selector
- `SETUP_DEEPSEEK_AI_PROVIDER.md` - Documentazione setup (aggiornata con Gemini)
- `VERIFICA_DEEPSEEK_IMPLEMENTATION.md` - Verifica conformità DeepSeek
- `VERIFICA_API_KEYS_AI.md` - Guida verifica API keys (include Gemini)
- `scripts/verify-ai-api-keys.ts` - Script verifica automatica API keys

**Variabili d'ambiente:**
- `ANTHROPIC_API_KEY` - Chiave API Anthropic (obbligatorio per default)
- `DEEPSEEK_API_KEY` - Chiave API DeepSeek (opzionale)
- `GOOGLE_API_KEY` - Chiave API Google Gemini (opzionale)

**Come usare:**
1. Vai su `/dashboard/super-admin`
2. Nella sezione "Provider AI per Anne" seleziona il provider desiderato
3. Il sistema salva automaticamente la preferenza nel database
4. Le prossime conversazioni con Anne useranno il provider selezionato

**Note:**
- Retrocompatibile: se non configurato, default a Anthropic
- Fallback automatico se provider selezionato non ha API key configurata
- Solo superadmin può modificare il provider
- La preferenza viene letta dal database ad ogni richiesta (cacheable in futuro)

**Verifica:**
```bash
# Test locale: riavvia server e vai su /dashboard/super-admin
# Expected: Componente AI Provider Selector visibile e funzionante
```

### ✅ Wallet Balance nel Contesto Anne (2 Gennaio 2026 - Commit 2b892af)

**Problema:** Anne non poteva rispondere a domande sul wallet perché non aveva accesso al `wallet_balance` nel contesto.

**Soluzione:**
- Aggiunto `wallet_balance` al contesto fiscale (`lib/agent/fiscal-data.ts` - `getFiscalContext()`)
- Aggiunto `walletBalance` al context-builder (`lib/ai/context-builder.ts` - `buildContext()`)
- Aggiornato prompt base (`lib/ai/prompts.ts`) per menzionare accesso al wallet balance
- Aggiornato `formatContextForPrompt()` per includere wallet balance nel contesto formattato

**File modificati:**
- `lib/agent/fiscal-data.ts`: Recupero wallet_balance da database e inclusione nel contesto fiscale
- `lib/ai/context-builder.ts`: Aggiunto walletBalance a UserContext e recupero da database
- `lib/ai/prompts.ts`: Aggiornato prompt per indicare ad Anne di usare walletBalance dal contesto

**Come verificare:**
```bash
# Test manuale: chiedere ad Anne "quanto ho nel wallet"
# Expected: Anne risponde con il saldo reale dell'utente dal contesto
```

**Note:**
- Il wallet_balance viene recuperato dal database ad ogni chiamata (non cached)
- Gestione errori: se il recupero fallisce, continua con valore 0 (non critico)
- Il wallet balance è disponibile sia nel contesto fiscale che nel context-builder standard

### ✅ FASE 3: RESELLER TIER SYSTEM (7 Gennaio 2026 - Commit a6a7bac, 172dc2f, 7644b0c, da5fb07)

**Obiettivo:** Implementare sistema categorizzazione automatica reseller in 3 tier (small, medium, enterprise) basato su numero sub-users.

**Soluzione:**
- **Database:** Enum `reseller_tier`, campo in `users`, funzione `get_reseller_tier()` per calcolo automatico
- **Backend:** Helper TypeScript `lib/db/tier-helpers.ts` con funzioni per gestire tier
- **Frontend:** Componente `TierBadge` per visualizzazione tier in UI
- **UI:** Integrazione tier badge in `ClientsHierarchyView` per superadmin

**File creati/modificati:**
- `supabase/migrations/088_reseller_tier_enum_and_column.sql` - Enum e campo
- `supabase/migrations/089_get_reseller_tier_function.sql` - Funzione calcolo automatico
- `supabase/migrations/090_populate_reseller_tier.sql` - Popolamento iniziale
- `lib/db/tier-helpers.ts` - Helper TypeScript (nuovo)
- `tests/tier-helpers.test.ts` - Test unit completi (17/17 passati)
- `lib/utils/tier-badge.tsx` - Componente badge (nuovo)
- `app/dashboard/reseller-team/_components/clients-hierarchy-view.tsx` - Integrazione tier badge
- `actions/admin-reseller.ts` - Query aggiornata per includere `reseller_tier`
- `docs/DEVELOPMENT_PLAN_FASE3.md` - Piano sviluppo completo
- `scripts/test-migrations-088-090.sql` - Script verifica database

**Funzionalità:**
- Tier automatico: small (<10 sub-users), medium (10-100), enterprise (>100)
- Calcolo automatico se `reseller_tier` è NULL nel database
- Visualizzazione tier badge in UI (colori distintivi)
- Limiti configurabili per tier (max sub-users, features)

**Test:**
- ✅ Backend: 17/17 test passati (`tests/tier-helpers.test.ts`)
- ✅ Regressione: 782/786 suite completa, 0 regressioni
- ✅ Type-check: nessun errore

**Note:**
- Non breaking: Campo nullable, funziona anche se NULL
- Idempotente: Tutte le migration idempotenti
- Performance: Indice su `reseller_tier` per query veloci
- Fallback: Se tier è NULL, calcola automatico da numero sub-users

**Come verificare:**
```bash
# Eseguire migrations su Supabase Dashboard (088, 089, 090)
# Verificare con script: scripts/test-migrations-088-090.sql
# Test locale: vai su /dashboard/reseller-team come superadmin
# Expected: Tier badge visibile su ogni reseller card
```

### ✅ FASE 4: GESTIONE CLIENTI UI GERARCHICA (7 Gennaio 2026 - Commit 14e57b3, 70930cc, 65b4bde)

**Problema:** Superadmin vedeva tutti gli utenti in modo "piatta", senza gerarchia Reseller → Sub-Users. Manca vista unificata per gestione clienti completa.

**Soluzione:**
- **Backend:** `getAllClientsForUser()` - Restituisce struttura gerarchica (Reseller con Sub-Users nested + BYOC standalone)
- **Backend:** `canViewAllClients()` - Verifica capability `can_view_all_clients` o `account_type === 'superadmin'`
- **Backend:** `getSubUsers()` aggiornato - Supporta superadmin (vede tutti i sub-users) mantenendo comportamento originale per reseller
- **Frontend:** `ClientsHierarchyView` - Componente gerarchico con ResellerCard expandable e BYOCSection
- **Frontend:** `useAllClients()` - Hook React Query per fetch dati gerarchici
- **Frontend:** Page `reseller-team` - Rileva superadmin e mostra vista appropriata (gerarchica vs originale)

**File creati/modificati:**
- `actions/admin-reseller.ts` - Aggiunte funzioni `getAllClientsForUser()`, `canViewAllClients()`, aggiornato `getSubUsers()`
- `tests/admin-reseller.test.ts` - Test completi (5/5 passati)
- `lib/queries/use-sub-users.ts` - Aggiunto hook `useAllClients()`
- `app/dashboard/reseller-team/_components/clients-hierarchy-view.tsx` - Nuovo componente gerarchico
- `app/dashboard/reseller-team/page.tsx` - Aggiornato per supportare superadmin
- `docs/DEVELOPMENT_PLAN_FASE4.md` - Piano sviluppo
- `docs/FASE4_COMPLETE_REPORT.md` - Report completo

**Funzionalità:**
- Superadmin vede tutti i clienti in modo gerarchico (Reseller → Sub-Users nested + BYOC standalone)
- Reseller mantiene vista originale (solo propri Sub-Users) - **non breaking**
- Stats aggregate: Reseller, Sub-Users, BYOC, Wallet Totale
- ResellerCard expandable per ogni reseller con lista sub-users nested
- BYOCSection dedicata per clienti BYOC standalone
- Access control: capability `can_view_all_clients` o `account_type === 'superadmin'`

**Test:**
- ✅ Backend: 5/5 test passati
- ✅ Regressione: 3/3 test passati
- ✅ Suite completa: 765/765 test passati
- ✅ Type-check: nessun errore

**Note:**
- Non breaking: Reseller mantiene comportamento originale
- Retrocompatibile: Fallback a `parent_id` se `tenant_id` non disponibile
- Capability System: Usa nuovo sistema con fallback a `role`/`account_type`
- Performance: Query ottimizzate con `Promise.all` per reseller paralleli

**Operatività Completa (8 Gennaio 2026):**
- ✅ Menu azioni Reseller: Ricarica Wallet, Crea Sub-User, Elimina Reseller
- ✅ Menu azioni Sub-Users: Gestisci Wallet, Elimina Cliente
- ✅ Menu azioni BYOC: Gestisci Wallet, Elimina Cliente
- ✅ Pulsante "Crea Reseller" con `CreateResellerDialog` integrato
- ✅ Dialog `CreateUserDialog` per creazione sub-user da reseller specifico
- ✅ Integrazione completa `WalletRechargeDialog` per gestione wallet
- ✅ `ConfirmActionDialog` per conferma eliminazioni
- ✅ Refresh automatico dati dopo operazioni con `useInvalidateSubUsers()`

**Query Resilienti (8 Gennaio 2026):**
- ✅ Fallback automatico se colonne opzionali mancanti (`company_name`, `phone`, `reseller_tier`)
- ✅ Compatibilità con database locali senza tutte le migrations applicate
- ✅ Logging dettagliato per debug (autenticazione, permessi, query steps)

**UI/UX Miglioramenti (8 Gennaio 2026):**
- ✅ Fix contrasti: testi grigi → neri (`text-gray-900`) per massima leggibilità
- ✅ Dropdown menu: `DropdownMenuItem` con `text-gray-900 font-medium` di default
- ✅ Dropdown label: `text-gray-700` invece di `text-gray-500`
- ✅ Card hover effects e transizioni smooth
- ✅ Badge e icone con colori distintivi e leggibili

**File modificati (8 Gennaio 2026):**
- `app/dashboard/reseller-team/_components/clients-hierarchy-view.tsx` - Operatività completa, menu azioni
- `components/ui/dropdown-menu.tsx` - Fix contrasti menu items
- `app/dashboard/reseller-team/_components/user-actions-menu.tsx` - Fix contrasti
- `app/dashboard/reseller-team/_components/create-user-dialog.tsx` - Supporto controllo esterno
- `actions/admin-reseller.ts` - Query resilienti con fallback colonne opzionali

**Test Produzione (8 Gennaio 2026):**
- ✅ **Test Completo:** Tutte le 6 fasi testate con successo
- ✅ **Navigazione:** Pagina carica correttamente, titolo "Gestione Clienti" visibile
- ✅ **UI/UX:** Tutti i testi NERI e leggibili, contrasti eccellenti
- ✅ **Menu Azioni:** Tutti funzionanti (Gestisci Wallet, Crea Sub-User, Elimina Reseller)
- ✅ **Dialog Wallet:** Apertura corretta con form ricarica/prelievo
- ✅ **Dialog Sub-User:** Apertura corretta con form completo
- ✅ **Dialog Elimina:** Richiede conferma (protezione eliminazioni accidentali)
- ✅ **Espansione Reseller:** Card espandibile funziona, mostra Sub-Users
- ✅ **Creazione Reseller:** Dialog completo con tutti i campi (Nome, Email, Password, Credito, Note)
- ✅ **Statistiche:** Tutte 4 card presenti e corrette
- ✅ **Performance:** Caricamento veloce (2-3 secondi), responsività fluida
- ✅ **Errori:** Nessuno osservato
- **Risultato:** Fase 4 pronta per produzione ✅

**Come verificare:**
```bash
# Test locale: vai su /dashboard/reseller-team come superadmin
# Expected: Vista gerarchica con Reseller → Sub-Users + BYOC
# Expected: Menu azioni funzionanti (ricarica wallet, crea, elimina)
# Expected: Testi neri leggibili, contrasto ottimizzato
# Test come reseller: stessa pagina
# Expected: Vista originale (solo propri Sub-Users)
```

### ✅ SPRINT 1: FINANCIAL TRACKING INFRASTRUCTURE (7 Gennaio 2026)

**Obiettivo:** Tracciare i costi reali che SpedireSicuro paga ai corrieri quando i Reseller/BYOC usano contratti piattaforma, per calcolo P&L e riconciliazione.

**Database Migrations (6 file SQL):**
- `090_platform_provider_costs.sql` - Tabella principale costi piattaforma con margini calcolati via trigger
- `091_shipments_api_source.sql` - Campo `api_source` su shipments per tracking fonte contratto
- `092_platform_pnl_views.sql` - 5 viste per P&L giornaliero/mensile, alert margini, riconciliazione
- `093_financial_audit_log.sql` - Audit log finanziario immutabile per compliance
- `094_fix_record_platform_provider_cost_alert.sql` - Fix bug alert margini negativi (WHERE EXISTS LIMIT 0)
- `095_secure_rpc_functions.sql` - 🔒 SECURITY HOTFIX: Revoca permessi pubblici su RPC critiche (solo service_role)

**Business Logic TypeScript:**
- `lib/shipments/platform-cost-recorder.ts` - Recording costi con graceful degradation
- `lib/pricing/platform-cost-calculator.ts` - Determinazione api_source + calcolo provider_cost
- `lib/shipments/create-shipment-core.ts` - Integrazione (linee 363-410): detection + recording

**Funzionalità:**
- **API Source Detection:** platform | reseller_own | byoc_own | unknown
- **Cost Source Fallback Chain:** api_realtime → master_list → historical_avg → estimate
- **Margini automatici:** Calcolati via trigger PostgreSQL (no IMMUTABLE issues)
- **RLS:** Solo SuperAdmin vede dati finanziari
- **Graceful Degradation:** Errori non bloccano creazione spedizione

**Test:**
- ✅ `tests/unit/platform-cost-recorder.test.ts` - 13 test
- ✅ `tests/unit/platform-cost-calculator.test.ts` - 16 test
- ✅ Suite completa: 590/590 test passati, 0 regressioni

**Deploy Status:**
- [x] Migrations 090-094 applicate con successo ✅
- [x] Migration 095 (Security Hotfix) applicata ✅
- [x] Database pronto per financial tracking
- [x] Fix bug alert margini negativi applicato ✅
- [x] 🔒 Vulnerabilità sicurezza RPC risolta (solo service_role può eseguire) ✅
- [ ] Backfill api_source per shipments esistenti (opzionale, post-launch)

**Come verificare:**
```bash
# Test unitari
npx vitest run tests/unit/platform-cost-recorder.test.ts tests/unit/platform-cost-calculator.test.ts
# Expected: 29 test passed

# Verificare integrazione in create-shipment-core.ts
grep -A20 "SPRINT 1: FINANCIAL TRACKING" lib/shipments/create-shipment-core.ts
# Expected: sezione con determineApiSource, updateShipmentApiSource, recordPlatformCost
```

### ✅ SPRINT 2: UX UNIFICATION (7 Gennaio 2026)

**Obiettivo:** Unificare UX per gestione clienti e dashboard finanziaria con nuove funzionalità.

**TASK 2.1: Dashboard Unificata Clienti per Reseller**
- `app/dashboard/reseller/clienti/page.tsx` - Pagina principale unificata
- `app/dashboard/reseller/clienti/_components/client-stats-cards.tsx` - KPI cards clienti
- `app/dashboard/reseller/clienti/_components/client-card-with-listino.tsx` - Card cliente con listino inline
- `app/dashboard/reseller/clienti/_components/assign-listino-dialog.tsx` - Dialog assegnazione listini
- `actions/reseller-clients.ts` - Actions per clienti con listini

**Funzionalità Dashboard Clienti:**
- Lista clienti con badge listino assegnato inline
- Statistiche aggregate (totale clienti, wallet, spedizioni, con/senza listino)
- Assegnazione rapida listino da dropdown menu
- Filtri per nome/email, con/senza listino
- Ordinamento per data, nome, saldo, spedizioni
- Link rapido a wallet, spedizioni, creazione listino

**TASK 2.2: Financial Dashboard Enhanced**
- `app/dashboard/super-admin/financial/_components/period-selector.tsx` - Filtro periodo
- `app/dashboard/super-admin/financial/_components/margin-by-courier-chart.tsx` - Grafico margini per corriere
- `app/dashboard/super-admin/financial/_components/top-resellers-table.tsx` - Classifica top resellers
- `actions/platform-costs.ts` - Actions: getMarginByCourierAction, getTopResellersAction, exportFinancialCSVAction

**Nuove Features Financial Dashboard:**
- Period Selector (7d, 30d, 90d, YTD, all)
- Export CSV funzionante
- Tab Analytics con charts

**TASK 2.3: Navigation Update**
- `lib/config/navigationConfig.ts` - Aggiornata navigazione
- Nuova voce I Miei Clienti per Reseller
- Nuova sezione Finanza Piattaforma per SuperAdmin

**Come verificare:**
```bash
# Dashboard Clienti: /dashboard/reseller/clienti (come reseller)
# Financial Dashboard: /dashboard/super-admin/financial (come superadmin)
# Expected: Period selector, Export CSV, tab Analytics
```

### ✅ SPRINT 3: OPTIMIZATION & HARDENING (7 Gennaio 2026)

**Obiettivo:** Performance, monitoring e refactoring per produzione.

**TASK 3.1: Performance Optimization**
- `lib/services/pricing/pricing-service.ts` - PricingService con caching configurabile
- Singleton pattern per riuso servizi
- Cache TTL configurabile (default 5 min)

**TASK 3.2: Monitoring & Alerting**
- `lib/services/financial/financial-alerts-service.ts` - Alert automatici per:
  - Margini negativi (threshold -10€, severity warning/critical)
  - Riconciliazione scaduta (> 7 giorni pending)
- `app/api/cron/financial-alerts/route.ts` - Endpoint cron per alert
- `app/api/cron/auto-reconciliation/route.ts` - Auto-riconciliazione
- Integrazione Slack webhook per notifiche
- Vercel cron jobs configurati:
  - `/api/cron/financial-alerts` → 8:00 AM daily
  - `/api/cron/auto-reconciliation` → 2:00 AM daily

**TASK 3.3: Refactoring Tech Debt**
- `lib/services/financial/reconciliation-service.ts` - Servizio riconciliazione estratto
- Auto-match margini positivi > 7 giorni
- Auto-flag margini negativi come discrepancy
- `lib/services/financial/index.ts` - Export centralizzato

**Variabili ambiente richieste (opzionali):**
```env
SLACK_FINANCIAL_ALERTS_WEBHOOK=https://hooks.slack.com/...
CRON_SECRET=your-secret-token
SYSTEM_USER_ID=uuid-for-auto-operations
ALERT_NEGATIVE_MARGIN_THRESHOLD=-10
ALERT_RECONCILIATION_DAYS=7
```

**Test Results:**
- ✅ 811/811 test passati
- ✅ 54/55 file test passati (1 skipped)
- ✅ 0 regressioni

**Come verificare:**
```bash
# Test completo
npx vitest run
# Expected: 811 tests passed

# Test cron endpoints (locale)
curl http://localhost:3000/api/cron/financial-alerts
curl http://localhost:3000/api/cron/auto-reconciliation
```