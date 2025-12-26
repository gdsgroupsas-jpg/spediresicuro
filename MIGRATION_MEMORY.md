# MIGRATION_MEMORY.md
# OBIETTIVO: Migrazione Anne -> LangGraph Supervisor
# STATO: 🟡 FASE 2 ATTIVA (Address & OCR)

## 🛑 REGOLE D'INGAGGIO
1. **Strangler Fig:** Il codice Legacy è il paracadute. Non cancellarlo mai.
2. **Single Source of Truth:** Logica di calcolo condivisa in `lib/pricing/calculator.ts`.
3. **Test First:** Ogni nuovo worker deve avere il suo test.

## 📋 TODO LIST (LIVE TRACKING)

### ✅ FASE 1: PREVENTIVI (COMPLETATA & BLINDATA)
- [x] **1.1 Architettura:** Supervisor, Workers, Graph, State (Pydantic-like).
- [x] **1.2 Routing Sicuro:** Intent Detector con regole rigide + Fallback Legacy.
- [x] **1.3 Testing & Quality:**
  - Unit & Integration (30/30 passati con rate limit isolato).
  - **Refactoring Critico:** Creata `lib/pricing/calculator.ts` (Funzione Pura) usata sia da Prod che da Test.
  - Nessuna duplicazione di logica.
  - Contract tests per `pricing-engine.ts` (18 test).
  - Semi-real tests per `price-lists.ts` (4 test con fixture JSON).

### 🚀 FASE 2: INDIRIZZI & OCR (NEXT STEP)
- [ ] **2.1 OCR Worker (`workers/ocr.ts`):**
  - Integrare `lib/ai/vision.ts` esistente.
  - Input: Immagine/PDF -> Output: JSON grezzo (mittente/destinatario).
- [ ] **2.2 Address Worker (`workers/address.ts`):**
  - Validazione CAP/Città (Google Maps o DB locale).
  - Normalizzazione indirizzi (es. "milano" -> "Milano (MI)").
- [ ] **2.3 Stato Evoluto (`state.ts`):**
  - Aggiungere `shipment_draft` (struttura unica per i dati).
  - Aggiungere `ocr_confidence` e flag `is_address_valid`.
- [ ] **2.4 Routing Supervisor:**
  - Aggiornare il cervello: Input -> (OCR) -> Address -> Pricing.

### FASE 3: BOOKING (FUTURE)
- [ ] Implementazione Booking Worker (integrazione `spedisci-online`).

## 📝 LOG PROGRESSI / NOTE

### ✅ FASE 1: COMPLETATA & BLINDATA
- **Architettura:** Supervisor, Workers, Graph, State implementati
- **Routing Sicuro:** Intent Detector con pattern matching + fallback legacy
- **Testing Completo:**
  - Unit tests: 58/58 passati (intent-detector, pricing-graph-routing, pricing-engine, price-lists)
  - Integration tests: 30/30 passati (agent-chat pricing flow)
  - Rate limit isolato: `vi.resetModules()` in beforeEach per evitare flakiness
- **Refactoring Critico:**
  - **Single Source of Truth:** `lib/pricing/calculator.ts` (funzione pura)
  - Eliminata duplicazione: logica di calcolo in un solo posto
  - Usata sia da produzione (`lib/db/price-lists.ts`) che da test (`tests/unit/price-lists.semi-real.test.ts`)
- **Decisioni tecniche:**
  - Creato nuovo grafo `pricing-graph.ts` separato da `graph.ts` (OCR/spedizioni)
  - Supervisor usa LLM opzionale per estrazione dati, fallback a regex
  - Intent detector usa pattern matching veloce (LLM opzionale)
  - Stato esteso con campi per preventivi, mantenendo compatibilità con OCR

### 🚀 FASE 2: PROSSIMI STEP
- OCR Worker: integrare `lib/ai/vision.ts` esistente
- Address Worker: validazione e normalizzazione indirizzi
- Stato evoluto: aggiungere `shipment_draft`, `ocr_confidence`, `is_address_valid`
- Routing Supervisor: estendere logica per OCR -> Address -> Pricing

### ⚠️ TODO FUTURO
- Implementare checkpointer per memoria conversazione multi-turn
- Migliorare estrazione dati con LLM più accurato
- Aggiungere test end-to-end per flusso completo OCR -> Address -> Pricing

