# AI Orchestrator Architecture - SpedireSicuro

## Overview

Questo documento descrive l'architettura dell'AI Orchestrator (Anne) basata su LangGraph, che gestisce richieste complesse multi-step per preventivi, normalizzazione indirizzi, booking e altre operazioni AI.

## Target Audience

- [x] Developers
- [ ] DevOps
- [ ] Business/PM
- [x] AI Agents
- [x] Nuovi team member

## Prerequisites

- LangGraph basics
- AI/LLM concepts
- TypeScript familiarity
- Understanding of state machines

## Quick Reference

| Sezione               | Pagina                                 | Link                                   |
| --------------------- | -------------------------------------- | -------------------------------------- |
| Architecture Overview | docs/2-ARCHITECTURE/AI_ORCHESTRATOR.md | [Architecture](#architecture-overview) |
| Supervisor Pattern    | docs/2-ARCHITECTURE/AI_ORCHESTRATOR.md | [Supervisor](#supervisor-pattern)      |
| Workers               | docs/2-ARCHITECTURE/AI_ORCHESTRATOR.md | [Workers](#workers)                    |
| State Management      | docs/2-ARCHITECTURE/AI_ORCHESTRATOR.md | [State](#state-management)             |
| Safety Invariants     | docs/2-ARCHITECTURE/AI_ORCHESTRATOR.md | [Safety](#safety-invariants)           |

## Content

### Architecture Overview

**Problema:** Gestire richieste complesse multi-step (preventivi, normalizzazione indirizzi, booking) con decisioni dinamiche basate su stato.

**Soluzione:** Architettura LangGraph Supervisor con worker specializzati e Single Decision Point.

#### Architettura Logica

```text
User Input (messaggio)
    │
    ▼
supervisorRouter()  ← Entry point UNICO (/api/ai/agent-chat)
    │
    ├─── Support Intent Detection → Support Worker (gestito direttamente)
    ├─── CRM Intent Detection → CRM Worker (gestito direttamente, Sprint S1)
    ├─── Outreach Intent Detection → Outreach Worker (gestito direttamente, Sprint S3)
    ├─── Pricing/OCR Intent Detection → Pricing Graph (LangGraph)
    ├─── Booking Confirmation Detection
    │
    ▼ (se pricing/OCR)
supervisor.decideNextStep()  ← SINGLE DECISION POINT (funzione pura)
    │
    ├─── next_step: 'ocr_worker' → OCR Worker → arricchisce shipmentDraft
    ├─── next_step: 'address_worker' → Address Worker → normalizza indirizzi
    ├─── next_step: 'pricing_worker' → Pricing Worker → calcola preventivi
    ├─── next_step: 'booking_worker' → Booking Worker → prenota spedizione
    ├─── next_step: 'legacy' → Claude Legacy Handler
    └─── next_step: 'END' → Risposta finale al client
    │
    ▼ (dopo ogni worker, torna a supervisor)
supervisor.decideNextStep()  ← Valuta nuovo stato, decide prossimo step
    │
    └─── ... (loop fino a END o MAX_ITERATIONS raggiunto)
```

#### Data Flow Pattern

1. **Input Utente** → `supervisorRouter()` rileva intent/pattern
2. **Direct Workers** → Support, CRM e Outreach intent gestiti direttamente (no LangGraph):
   - Support intent → `supportWorker()` → risposta diretta
   - CRM intent → `crmWorker()` → risposta con knowledge enrichment
   - Outreach intent → `outreachWorker()` → gestione sequenze multi-canale
3. **Pricing/OCR** → `decideNextStep()` (funzione pura) decide routing basato su stato
4. **Worker Execution** → Worker arricchisce `AgentState` (merge non distruttivo in `shipmentDraft`)
5. **Loop Back** → Torna a supervisor, valuta nuovo stato
6. **Termination** → `next_step: 'END'` → Risposta al client o azione DB (booking)

---

### Componenti

#### 1. Supervisor Router

**File:** `lib/agent/orchestrator/supervisor-router.ts`

- Entry point unico per `/api/ai/agent-chat`
- Rileva intent, pattern OCR, conferma booking
- Invoca pricing graph o legacy handler
- Emette telemetria finale (`supervisorRouterComplete`)

#### 2. Supervisor

**File:** `lib/agent/orchestrator/supervisor.ts`

- `decideNextStep()` - Funzione pura, SINGLE DECISION POINT
- `supervisor()` - Node LangGraph che estrae dati e decide routing
- Estrae dati spedizione dal messaggio (LLM opzionale, fallback regex)
- Determina routing basato su stato e intent
- **Nessun altro componente decide routing** (verificabile con grep)

#### 3. Pricing Graph

**File:** `lib/agent/orchestrator/pricing-graph.ts`

- LangGraph StateGraph con nodi: supervisor, ocr_worker, address_worker, pricing_worker, booking_worker
- Conditional edges basati su `next_step` dallo stato
- MAX_ITERATIONS guard (2) per prevenire loop infiniti
- Configurazione: `lib/config.ts` (`graphConfig.MAX_ITERATIONS`)

#### 4. Workers Specializzati

**Address Worker** (`lib/agent/workers/address.ts`)

- Normalizza indirizzi italiani (CAP, provincia, città)
- Usa regex e validazione CAP

**Pricing Worker** (`lib/agent/workers/pricing.ts`)

- Calcola preventivi multi-corriere
- Integra con sistema listini

**OCR Worker** (`lib/agent/workers/ocr.ts`)

- Estrae dati da testo OCR
- Immagini: placeholder (TODO Sprint 2.5)

**Booking Worker** (`lib/agent/workers/booking.ts`)

- Prenota spedizioni (preflight + adapter)
- Verifica credito wallet prima di booking

**Support Worker** (`lib/agent/workers/support-worker.ts`)

- Gestisce richieste di assistenza (tracking, giacenze, cancellazioni, rimborsi)
- Invocato direttamente dal supervisor-router (non dal LangGraph)

**CRM Worker** (`lib/agent/workers/crm-worker.ts`) — Sprint S1 + S2

- Sales Partner con accesso read + write alla pipeline CRM con conoscenza commerciale senior
- 9 sub-intent: 6 read (pipeline_overview, entity_detail, today_actions, health_check, search, conversion_analysis) + 3 write (update_status, add_note, record_contact)
- Arricchisce risposte con `sales-knowledge.ts` (35 entry settoriali)
- Admin vede leads, Reseller vede prospects (RLS via workspace_id)
- Invocato direttamente dal supervisor-router (non dal LangGraph)
- Data layer read: `lib/crm/crm-data-service.ts` (9 funzioni read-only)
- Data layer write: `lib/crm/crm-write-service.ts` (3 funzioni: updateEntityStatus, addEntityNote, recordEntityContact)
- Sicurezza write: workspace obbligatorio per reseller, optimistic locking, input sanitizzato, eventi best-effort
- 5 tool read: get_pipeline_summary, get_entity_details, get_crm_health_alerts, get_today_actions, search_crm_entities
- 3 tool write: update_crm_status, add_crm_note, record_crm_contact

**Outreach Worker** (`lib/agent/workers/outreach-worker.ts`) — Sprint S3

- Motore outreach multi-canale (Email via Resend, WhatsApp via Meta Cloud API, Telegram)
- 10 sub-intent: enroll_entity, cancel_enrollment, pause_enrollment, resume_enrollment, send_message, check_status, manage_channels, list_templates, list_sequences, outreach_metrics
- Sequenze DAG lineari con step condizionali (no_reply, no_open, replied, opened)
- Cron executor ogni 5 min (`/api/cron/outreach-executor`) con batch 20 enrollment
- Safety: GDPR consent pre-invio, rate limiting giornaliero, cool-down 24h, idempotency key
- Kill switch globale via `OUTREACH_KILL_SWITCH` env var (blocca write, permette read)
- Pilot rollout via `OUTREACH_PILOT_WORKSPACES` env var
- Template engine Handlebars con variabili CRM (company_name, contact_name, sector, etc.)
- Delivery tracking via webhook (Resend Svix + WhatsApp status events)
- Structured JSON logging via `outreach-logger.ts`
- Invocato direttamente dal supervisor-router (non dal LangGraph)
- Data layer: `lib/outreach/outreach-data-service.ts`, `lib/outreach/enrollment-service.ts`
- 3 tool: schedule_outreach, manage_outreach_channels, get_outreach_status

---

### State Management

**File:** `lib/agent/orchestrator/state.ts`

`AgentState` - Stato centralizzato con:

```typescript
interface AgentState {
  shipmentDraft?: {
    sender?: Address;
    recipient?: Address;
    packages?: Package[];
    // ... altri campi
  };
  pricing_options?: PricingOption[];
  booking_result?: BookingResult;
  next_step:
    | 'ocr_worker'
    | 'address_worker'
    | 'pricing_worker'
    | 'booking_worker'
    | 'support_worker'
    | 'crm_worker'
    | 'outreach_worker'
    | 'legacy'
    | 'END';
  crm_response?: { message: string; toolsUsed: string[] };
  support_response?: { message: string; toolsUsed: string[] };
  outreach_response?: { message: string; toolsUsed: string[] };
  clarification_request?: string;
  messages: Message[];
  // ... altri campi
}
```

**Key Insight:** `shipmentDraft` usa merge non distruttivo - ogni worker arricchisce senza sovrascrivere.

---

### Safety Invariants (CRITICO)

#### 1. No Silent Booking

**Regola:** Booking richiede conferma esplicita utente (`containsBookingConfirmation()`)

**Pattern:** "procedi", "conferma", "ok prenota", "sì procedi"

**Verifica:**

```bash
grep -r "containsBookingConfirmation\|booking_worker" lib/agent/orchestrator/supervisor.ts
```

#### 2. Pre-flight Check Obbligatorio

**Regola:** Booking worker esegue `preflightCheck()` prima di chiamare adapter

**Verifica:**

- recipient completo
- parcel completo
- pricing_option
- idempotency_key

**Se fallisce:** ritorna `PREFLIGHT_FAILED`, no adapter call

**Verifica:**

```bash
grep -A5 "preflightCheck" lib/agent/workers/booking.ts
```

#### 3. Single Decision Point

**Regola:** Solo `supervisor.ts` imposta `next_step`

**Altri componenti non decidono routing autonomamente**

**Verifica:**

```bash
grep -r "next_step.*=" lib/agent/orchestrator/ lib/agent/workers/ | grep -v "supervisor.ts"
```

#### 4. No PII nei Log

**Regola:** Mai loggare dati sensibili

**Non loggare:**

- `addressLine1`
- `postalCode`
- `fullName`
- `phone`
- Testo OCR raw

**Loggare solo:**

- `trace_id`
- `user_id_hash`
- Conteggi

**Verifica:**

```bash
grep -r "logger\.\(log\|info\|warn\|error\)" lib/agent/ | grep -i "addressLine\|postalCode\|fullName\|phone"
```

---

### Known Limits

- **LangGraph typing constraints:** Alcuni cast `as any` necessari per nomi nodi (documentati in codice)
- **OCR immagini:** Placeholder, ritorna clarification request (TODO Sprint 2.5)
- **MAX_ITERATIONS:** Limite hardcoded a 2 (configurabile in `lib/config.ts`)

---

### State Persistence (P3 Architecture Improvements)

**File:** `lib/agent/orchestrator/checkpointer.ts`

- LangGraph checkpointer per persistenza stato
- `lib/services/agent-session.ts` - Service layer con cache in-memory (TTL 5 min)
- Persistenza conversazioni multi-turn in `agent_sessions` table
- Ripristino stato da checkpoint quando utente riapre chat

---

### Wallet Integration

**File:** `lib/wallet/credit-check.ts`

- Verifica credito pre-booking
- Check in `supervisor.ts` prima di routing a `booking_worker`
- Prevenzione tentativi booking con credito insufficiente

---

### Tool Registry

**File:** `lib/agent/tools/registry.ts`

- Registry centralizzato per tools
- Auto-discovery e validazione input/output con Zod
- Compatibilità con tools esistenti

---

### Performance Optimizations

**File:** `lib/services/cache.ts`

- Cache in-memory per RAG (TTL 1 ora) e pricing (TTL 5 min)
- Integrato in `mentor_worker.ts`, `explain_worker.ts`, `pricing_worker.ts`
- Query Supabase ottimizzate (select solo campi necessari)

---

## Examples

### Invocare Agent

```typescript
// API Route: /api/ai/agent-chat
import { supervisorRouter } from '@/lib/agent/orchestrator/supervisor-router';

export async function POST(request: Request) {
  const { message, sessionId } = await request.json();

  const result = await supervisorRouter({
    message,
    sessionId,
    userId: context.target.id,
  });

  return Response.json(result);
}
```

### Aggiungere Nuovo Worker

```typescript
// lib/agent/workers/custom-worker.ts
export async function customWorker(state: AgentState): Promise<Partial<AgentState>> {
  // Arricchisci shipmentDraft (merge non distruttivo)
  return {
    shipmentDraft: {
      ...state.shipmentDraft,
      customField: 'value',
    },
  };
}

// Aggiungi a pricing-graph.ts
graph.addNode('custom_worker', customWorker);
graph.addConditionalEdges('supervisor', (state) => {
  if (state.next_step === 'custom_worker') return 'custom_worker';
  // ... altri edge
});
```

---

## Common Issues

| Issue                  | Soluzione                                                      |
| ---------------------- | -------------------------------------------------------------- |
| Loop infinito          | Verifica MAX_ITERATIONS e che `next_step` sia sempre impostato |
| Booking senza conferma | Verifica `containsBookingConfirmation()` prima di routing      |
| Stato perso            | Verifica che checkpointer sia configurato correttamente        |
| PII nei log            | Verifica pattern di logging, usa solo hash/conteggi            |

---

## Related Documentation

- [MIGRATION_MEMORY.md](../../MIGRATION_MEMORY.md) - Anne AI overview, architettura completa (Single Source of Truth)
- [Backend Architecture](BACKEND.md) - API routes e Server Actions

---

## Changelog

| Date       | Version | Changes                                                            | Author   |
| ---------- | ------- | ------------------------------------------------------------------ | -------- |
| 2026-01-12 | 1.0.0   | Initial version                                                    | AI Agent |
| 2026-02-07 | 1.1.0   | Added CRM Worker, Support Worker, updated routing                  | AI Agent |
| 2026-02-07 | 1.2.0   | Added Outreach Worker (Sprint S3), multi-channel sequences, safety | AI Agent |

---

_Last Updated: 2026-02-07_  
_Status: 🟢 Active_  
_Maintainer: Team_
