# 🚀 PROMPT IMPLEMENTAZIONE AI AGENT INTEGRATION

**Data:** 1 Gennaio 2026  
**Obiettivo:** Implementare P1 prerequisites per AI Agent Integration  
**Base:** Audit verificato e approvato

---

## 📋 CONTESTO

Ho completato l'audit dell'integrazione AI Agent (`AUDIT_AI_AGENT_INTEGRATION.md`) e la verifica della codebase (`VERIFICA_AUDIT_AI_AGENT.md`). L'audit è **corretto e accurato** (95% conformità).

**Verdetto:** ✅ Pronto per implementazione P1 prerequisites

---

## 🎯 TODO P1 (Prima del Rollout Agent)

**STATO:** ✅ **TUTTI I TASK COMPLETATI** (1 Gennaio 2026)

### ✅ Task 1: Tabella agent_sessions (2 giorni) - COMPLETATO
**File:** `supabase/migrations/051_agent_sessions.sql`

**Requisiti:**
- Tabella per persistenza conversazioni multi-turn
- Campi: `id`, `user_id`, `session_id`, `conversation_history` (JSONB), `created_at`, `updated_at`, `metadata` (JSONB)
- RLS policy: utente vede solo le proprie sessioni
- Index su `user_id` e `session_id`

**Riferimenti:**
- Audit sezione 2.2: "Missing Abstractions"
- Audit sezione 4.3: "Required State Fields"

---

### ✅ Task 2: Iniettare ActingContext in AgentState (1 giorno) - COMPLETATO
**File:** 
- `lib/agent/orchestrator/supervisor-router.ts`
- `lib/agent/orchestrator/state.ts`

**Requisiti:**
- `supervisorRouter()` deve ricevere `ActingContext` come parametro
- Iniettare `ActingContext` in `AgentState` all'inizializzazione
- Tutti i worker devono ricevere `ActingContext` tramite `AgentState`

**Riferimenti:**
- Audit sezione 5.3: "Acting Context ✅"
- `lib/safe-auth.ts` - funzione `getSafeAuth()` esistente
- `app/api/ai/agent-chat/route.ts` - chiamare `getSafeAuth()` prima di `supervisorRouter()`

**Pattern da seguire:**
```typescript
// In app/api/ai/agent-chat/route.ts
const actingContext = await getSafeAuth();
if (!actingContext) {
  return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
}

const supervisorResult = await supervisorRouter({
  message: cleanMessage,
  userId: actingContext.target.id, // ⚠️ Usa target, non actor
  userEmail: actingContext.target.email || '',
  traceId,
  actingContext, // ⚠️ NUOVO parametro
});
```

---

### ✅ Task 3: Estendere AgentState con agent_context (0.5 giorni) - COMPLETATO
**File:** `lib/agent/orchestrator/state.ts`

**Requisiti:**
Aggiungere a `AgentState`:

```typescript
// Nuovi campi per AI Agent
agent_context?: {
  session_id: string;
  conversation_history: Message[];
  user_role: UserRole;
  current_page?: string;
  is_impersonating: boolean;
  acting_context?: ActingContext; // ⚠️ Iniettato da supervisor-router
};

// Mentor-specific
mentor_response?: {
  answer: string;
  sources: string[]; // file paths referenced
  confidence: number;
};
```

**Riferimenti:**
- Audit sezione 4.3: "Required State Fields"
- `lib/agent/orchestrator/state.ts` - struttura esistente

---

### ✅ Task 4: Implementare mentor_worker (3 giorni) - COMPLETATO
**File:**
- `lib/agent/workers/mentor.ts` (NUOVO)
- `lib/agent/orchestrator/pricing-graph.ts` (aggiungere routing)
- `lib/agent/orchestrator/supervisor.ts` (aggiungere intent detection)

**Requisiti:**
- Worker per Q&A tecnico su architettura, wallet, RLS, business flows
- RAG su documentazione: `docs/MONEY_FLOWS.md`, `docs/ARCHITECTURE.md`, `docs/DB_SCHEMA.md`
- Risposta con `sources` (file paths referenziati)
- Routing in `pricing-graph.ts`: `mentor_worker` → supervisor → END
- Intent detection in `supervisor.ts`: domande tipo "Come funziona...", "Spiega...", "Perché..."

**Riferimenti:**
- Audit sezione 2.3: "Gap Analysis - Orchestrator Gaps"
- Audit sezione 4.2: "Required New Nodes/Workers"
- Pattern esistente: `lib/agent/workers/pricing.ts`

**Esempio intent:**
```typescript
// In lib/agent/orchestrator/supervisor.ts
function detectMentorIntent(message: string): boolean {
  const mentorPatterns = [
    /come funziona/i,
    /spiega/i,
    /perché/i,
    /che cos'è/i,
    /come si/i,
  ];
  return mentorPatterns.some(pattern => pattern.test(message));
}
```

---

### ✅ Task 5: Unificare API endpoints (3 giorni) - COMPLETATO
**File:**
- `app/api/anne/chat/route.ts` (modificare per usare supervisor)
- `components/anne/AnneAssistant.tsx` (cambiare endpoint a `/api/ai/agent-chat`)

**Requisiti:**
- `/api/anne/chat` deve chiamare `supervisorRouter()` invece di Gemini diretto
- `AnneAssistant` deve usare `/api/ai/agent-chat` (unificato)
- Mantenere compatibilità con context esistente
- Deprecare `/api/anne/chat` (redirect a `/api/ai/agent-chat`)

**Riferimenti:**
- Audit sezione 3.3: "UI Inconsistencies"
- Audit sezione 3.4: "Where AI Agent Could Live"
- `app/api/ai/agent-chat/route.ts` - implementazione esistente

**Pattern:**
```typescript
// In app/api/anne/chat/route.ts
export async function POST(request: NextRequest) {
  // Redirect a endpoint unificato
  // OPPURE chiamare supervisorRouter() direttamente
  const actingContext = await getSafeAuth();
  // ... stesso pattern di /api/ai/agent-chat
}
```

---

### ✅ Task 6: Aggiungere AUDIT_ACTIONS per Agent (0.5 giorni) - COMPLETATO
**File:** `lib/security/audit-actions.ts`

**Requisiti:**
Aggiungere a `AUDIT_ACTIONS`:

```typescript
// ============================================
// AI AGENT OPERATIONS
// ============================================
AGENT_QUERY: 'agent_query',
AGENT_MENTOR_RESPONSE: 'agent_mentor_response',
AGENT_SESSION_CREATED: 'agent_session_created',
AGENT_SESSION_UPDATED: 'agent_session_updated',
```

Aggiungere a `AUDIT_RESOURCE_TYPES`:

```typescript
AGENT_SESSION: 'agent_session',
```

**Riferimenti:**
- Audit sezione 5.4: "Audit Trail ✅"
- `lib/security/audit-actions.ts` - struttura esistente

---

## 🔒 VINCOLI E REGOLE

### Sicurezza (NON NEGOZIABILI)
1. ✅ **Wallet:** MAI modificare `wallet_balance` direttamente - solo RPC functions
2. ✅ **RLS:** Tutte le query devono rispettare RLS (usare `supabaseAdmin` solo server-side)
3. ✅ **ActingContext:** Sempre usare `target.id` per operazioni, non `actor.id`
4. ✅ **Audit:** Loggare tutte le azioni agent con `writeAuditLog()`

### Architettura
1. ✅ **Strangler Fig:** Non eliminare codice legacy, coesistenza sicura
2. ✅ **Supervisor Pattern:** Routing deciso ESCLUSIVAMENTE da `supervisor.decideNextStep()`
3. ✅ **Type Safety:** NO `any` o `unknown` - usare type guards o Zod

### Testing
1. ✅ **Critical Path:** Testare wallet atomicity, RLS, ActingContext
2. ✅ **Integration:** Testare flusso completo: AnneAssistant → supervisor → worker → response

---

## 📚 DOCUMENTAZIONE DA CONSULTARE

- `AUDIT_AI_AGENT_INTEGRATION.md` - Audit completo
- `VERIFICA_AUDIT_AI_AGENT.md` - Verifica codebase
- `docs/ARCHITECTURE.md` - Architettura LangGraph Supervisor
- `docs/MONEY_FLOWS.md` - Wallet invariants
- `lib/safe-auth.ts` - ActingContext implementation
- `lib/agent/orchestrator/supervisor-router.ts` - Entry point esistente

---

## ✅ DEFINITION OF DONE

Ogni task è considerato completo quando:

- [x] Codice implementato e type-safe (no `any`)
- [x] Test critici passano (wallet, RLS, ActingContext)
- [x] Documentazione aggiornata (`MIGRATION_MEMORY.md`)
- [x] Audit trail attivo per azioni agent
- [x] Nessuna regressione (test esistenti passano)

**STATO:** ✅ **TUTTI I TASK P1 COMPLETATI** (1 Gennaio 2026)

---

## 🚀 ORDINE DI IMPLEMENTAZIONE CONSIGLIATO

1. **Task 6** (0.5d) - AUDIT_ACTIONS - Base per audit trail
2. **Task 3** (0.5d) - Estendere AgentState - Base per altri task
3. **Task 2** (1d) - Iniettare ActingContext - Prerequisito per worker
4. **Task 1** (2d) - Tabella agent_sessions - Base per persistenza
5. **Task 4** (3d) - mentor_worker - Core feature
6. **Task 5** (3d) - Unificare endpoints - Integrazione finale

**Totale:** ~10 giorni

---

## 💬 ISTRUZIONI PER AI AGENT

1. **Lavora in autonomia** - Implementa i task seguendo l'ordine consigliato
2. **Chiedi solo per decisioni di business/architettura** - Per il resto procedi
3. **Spiega in italiano semplice** - Cosa fai, perché, cosa cambia
4. **Testa invarianti critici** - Wallet, RLS, ActingContext prima di ogni commit
5. **Documenta in MIGRATION_MEMORY.md** - Decisioni e cambiamenti

**Inizia con Task 6 (AUDIT_ACTIONS) - è il più semplice e crea la base per gli altri.**

---

*Prompt creato per implementazione AI Agent Integration P1 prerequisites*  
*Data: 1 Gennaio 2026*

