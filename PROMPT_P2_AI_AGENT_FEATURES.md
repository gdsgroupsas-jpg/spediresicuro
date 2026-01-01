# 🚀 PROMPT IMPLEMENTAZIONE P2 - AI Agent Features

**Data:** 1 Gennaio 2026  
**Obiettivo:** Implementare feature P2 per migliorare UX e debugging AI Agent  
**Base:** P1 prerequisites completati e testati

---

## 📋 CONTESTO

Tutti i task P1 per AI Agent Integration sono stati completati con successo:
- ✅ Tabella `agent_sessions` per persistenza conversazioni
- ✅ `ActingContext` iniettato in `AgentState`
- ✅ `agent_context` e `mentor_response` estesi
- ✅ `mentor_worker` implementato con RAG
- ✅ API endpoints unificati
- ✅ AUDIT_ACTIONS per operazioni agent
- ✅ 325 test unit + 121 test integrazione passati

**Sistema pronto per:** Conversazioni multi-turn, Q&A tecnico, audit trail, impersonation**

---

## 🎯 TODO P2 (Nice to Have - Miglioramenti UX e Debugging)

### Task 1: AgentDebugPanel (2 giorni)
**File:** `components/agent/AgentDebugPanel.tsx`

**Requisiti:**
- Componente UI per mostrare routing decisions del supervisor
- Mostra: `intent_detected`, `supervisor_decision`, `backend_used`, `fallback_reason`
- Mostra: `iteration_count`, `processingStatus`, `confidenceScore`
- Mostra: `mentor_response` con sources e confidence (se presente)
- Visibile solo per admin/superadmin (usare `UserRole` check)
- Toggle on/off con localStorage per persistenza preferenza utente

**Riferimenti:**
- `lib/agent/orchestrator/supervisor-router.ts` - telemetry data
- `lib/agent/orchestrator/state.ts` - AgentState structure
- `components/anne/AnneAssistant.tsx` - integrazione UI

**Pattern da seguire:**
```typescript
// In AnneAssistant.tsx
{isAdmin && (
  <AgentDebugPanel 
    telemetry={lastTelemetry}
    agentState={currentAgentState}
  />
)}
```

---

### Task 2: debug_worker (3 giorni)
**File:** 
- `lib/agent/workers/debug.ts`
- `lib/agent/orchestrator/supervisor.ts` (intent detection)
- `lib/agent/orchestrator/pricing-graph.ts` (routing)

**Requisiti:**
- Worker per analisi log e suggerimenti fix
- Intent detection: "perché non funziona", "errore", "debug", "log"
- Analizza: `validationErrors`, `processingStatus`, `confidenceScore`
- Suggerisce: fix comuni, link documentazione, retry strategies
- Restituisce: `debug_response` con analysis e suggestions

**Riferimenti:**
- `lib/agent/workers/mentor.ts` - pattern worker con RAG
- `lib/agent/orchestrator/state.ts` - AgentState con error fields

**Pattern da seguire:**
```typescript
export async function debugWorker(
  state: AgentState,
  logger: ILogger = defaultLogger
): Promise<Partial<AgentState>> {
  // Analizza errori
  // Suggerisce fix
  return {
    debug_response: {
      analysis: '...',
      suggestions: ['...'],
      links: ['...'],
    },
    next_step: 'END',
  };
}
```

---

### Task 3: explain_worker (3 giorni)
**File:**
- `lib/agent/workers/explain.ts`
- `lib/agent/orchestrator/supervisor.ts` (intent detection)
- `lib/agent/orchestrator/pricing-graph.ts` (routing)

**Requisiti:**
- Worker per spiegare business flows (wallet, spedizioni, margini)
- Intent detection: "spiega come", "come funziona il business", "flusso"
- Usa RAG su: `docs/MONEY_FLOWS.md`, `docs/ARCHITECTURE.md`, `docs/DB_SCHEMA.md`
- Spiega: flussi wallet, processo spedizione, calcolo margini
- Restituisce: `explain_response` con explanation e diagrammi testuali

**Riferimenti:**
- `lib/agent/workers/mentor.ts` - pattern RAG su documentazione
- `docs/MONEY_FLOWS.md` - business flows

---

### Task 4: Mobile Anne (1 giorno)
**File:** 
- `components/mobile/MobileNav.tsx` (o equivalente)
- `app/(mobile)/layout.tsx` (se esiste)

**Requisiti:**
- Aggiungere ghost icon per Anne Assistant nella navigazione mobile
- Icon: ghost/chat bubble
- Click: apre Anne Assistant (stesso comportamento desktop)
- Posizionamento: bottom nav o hamburger menu

**Riferimenti:**
- `components/anne/AnneAssistant.tsx` - componente esistente
- Pattern mobile navigation esistente

---

### Task 5: compensation_queue processor (2 giorni)
**File:**
- `app/api/cron/compensation-queue/route.ts` (nuovo)
- `lib/services/compensation/processor.ts` (nuovo)

**Requisiti:**
- CRON job per cleanup orphan records in `compensation_queue`
- Verifica: records con `status = 'pending'` e `created_at > 7 giorni`
- Azione: marca come `expired` o cancella (decisione business)
- Audit: logga tutte le operazioni
- Sicurezza: Authorization Bearer token (stesso pattern CRON esistenti)

**Riferimenti:**
- `docs/SECURITY.md` - pattern CRON endpoints
- `app/api/cron/*/route.ts` - esempi esistenti
- `supabase/migrations/*.sql` - schema `compensation_queue`

---

## 🔒 VINCOLI E REGOLE

### Sicurezza (NON NEGOZIABILI)
1. ✅ **Wallet:** MAI modificare `wallet_balance` direttamente - solo RPC functions
2. ✅ **RLS:** Tutte le query devono rispettare RLS (usare `supabaseAdmin` solo server-side)
3. ✅ **ActingContext:** Sempre usare `target.id` per operazioni, non `actor.id`
4. ✅ **Audit:** Loggare tutte le azioni agent con `writeAuditLog()`
5. ✅ **CRON:** Authorization Bearer token obbligatorio, fail-closed 401

### Architettura
1. ✅ **Strangler Fig:** Non eliminare codice legacy, coesistenza sicura
2. ✅ **Supervisor Pattern:** Routing deciso ESCLUSIVAMENTE da `supervisor.decideNextStep()`
3. ✅ **Type Safety:** NO `any` o `unknown` - usare type guards o Zod
4. ✅ **Worker Pattern:** Ogni worker restituisce `Partial<AgentState>` con `next_step`

### Testing
1. ✅ **Critical Path:** Testare wallet atomicity, RLS, ActingContext
2. ✅ **Integration:** Testare flusso completo: AnneAssistant → supervisor → worker → response
3. ✅ **Type Safety:** `npm run type-check` deve passare (0 errori)

---

## 📚 DOCUMENTAZIONE DA CONSULTARE

- `PROMPT_IMPLEMENTAZIONE_AI_AGENT.md` - Implementazione P1 completata
- `AUDIT_AI_AGENT_INTEGRATION.md` - Audit completo
- `docs/ARCHITECTURE.md` - Architettura LangGraph Supervisor
- `docs/MONEY_FLOWS.md` - Wallet invariants e business flows
- `docs/SECURITY.md` - Pattern CRON e sicurezza
- `lib/agent/orchestrator/supervisor-router.ts` - Entry point esistente
- `lib/agent/workers/mentor.ts` - Pattern worker con RAG

---

## ✅ DEFINITION OF DONE

Ogni task è considerato completo quando:

- [ ] Codice implementato e type-safe (no `any`)
- [ ] Test critici passano (wallet, RLS, ActingContext)
- [ ] Documentazione aggiornata (`MIGRATION_MEMORY.md`)
- [ ] Audit trail attivo per azioni agent (se applicabile)
- [ ] Nessuna regressione (test esistenti passano)
- [ ] Type-check passa (`npm run type-check` = 0 errori)

---

## 🚀 ORDINE DI IMPLEMENTAZIONE CONSIGLIATO

1. **Task 4** (1d) - Mobile Anne - Più semplice, impatto UX immediato
2. **Task 1** (2d) - AgentDebugPanel - Utile per debugging altri task
3. **Task 2** (3d) - debug_worker - Core feature debugging
4. **Task 3** (3d) - explain_worker - Core feature business explanation
5. **Task 5** (2d) - compensation_queue processor - CRON job, isolato

**Totale:** ~11 giorni

---

## 💬 ISTRUZIONI PER AI AGENT

1. **Lavora in autonomia** - Implementa i task seguendo l'ordine consigliato
2. **Chiedi solo per decisioni di business/architettura** - Per il resto procedi
3. **Spiega in italiano semplice** - Cosa fai, perché, cosa cambia
4. **Testa invarianti critici** - Wallet, RLS, ActingContext prima di ogni commit
5. **Documenta in MIGRATION_MEMORY.md** - Decisioni e cambiamenti
6. **Rispetta THE ENGINEERING CHARTER** - Type safety, test critici, no regressioni

**Inizia con Task 4 (Mobile Anne) - è il più semplice e migliora UX immediatamente.**

---

*Prompt creato per implementazione P2 AI Agent Features*  
*Data: 1 Gennaio 2026*  
*Prerequisiti: P1 completato*

