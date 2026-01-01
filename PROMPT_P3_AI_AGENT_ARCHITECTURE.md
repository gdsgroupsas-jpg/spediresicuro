# 🏗️ PROMPT IMPLEMENTAZIONE P3 - AI Agent Architecture & Technical Debt

**Data:** 1 Gennaio 2026  
**Obiettivo:** Miglioramenti architetturali, refactoring, ottimizzazioni, technical debt  
**Base:** P1 e P2 completati e testati

---

## 📋 CONTESTO

P1 e P2 hanno creato le feature base. **P3 deve migliorare l'architettura, ridurre technical debt, ottimizzare performance.**

**Principi P3:**
- ✅ **100% architettura** - Refactoring, pattern, ottimizzazioni
- ✅ **Technical debt** - Risolvere TODO, migliorare type safety
- ✅ **Performance** - Ottimizzare query, caching, state management
- ✅ **Scalabilità** - Preparare per crescita

**Focus:** Qualità codice, manutenibilità, performance

---

## 🎯 TODO P3 (Architecture & Technical Debt)

### Task 1: LangGraph Checkpointer - State Persistence (4 giorni)
**File:**
- `lib/agent/orchestrator/checkpointer.ts` (NUOVO)
- `lib/agent/orchestrator/pricing-graph.ts` (modificare)
- `lib/services/agent-session.ts` (NUOVO)

**Requisiti:**
- Implementare LangGraph `MemorySaver` checkpointer per persistenza stato
- Salvare `AgentState` completo in `agent_sessions` table (P1)
- Riprendere conversazione da checkpoint (utente riapre chat)
- Supporto per conversazioni multi-turn lunghe (10+ messaggi)

**Architettura:**
```typescript
// lib/agent/orchestrator/checkpointer.ts
import { MemorySaver } from '@langchain/langgraph';
import { supabaseAdmin } from '@/lib/db/client';

export class SupabaseCheckpointer extends MemorySaver {
  async get(config: RunnableConfig): Promise<AgentState | null> {
    // Recupera da agent_sessions
  }
  
  async put(config: RunnableConfig, checkpoint: AgentState): Promise<void> {
    // Salva in agent_sessions
  }
}
```

**Integrazione:**
- Modificare `pricing-graph.ts` per usare checkpointer
- Configurare `thread_id` = `session_id` da `agent_context`
- Salvare checkpoint dopo ogni worker completion

**Riferimenti:**
- `supabase/migrations/054_agent_sessions.sql` - Tabella esistente (P1)
- LangGraph docs: MemorySaver pattern
- `lib/agent/orchestrator/state.ts` - AgentState structure

**Pattern:**
```typescript
// In pricing-graph.ts
const checkpointer = new SupabaseCheckpointer();
const graph = new StateGraph(AgentState)
  .addNode('supervisor', supervisor)
  // ... altri nodi
  .compile({ checkpointer });
```

---

### Task 2: Wallet Integration - Verifica Credito Pre-Booking (3 giorni)
**File:**
- `lib/agent/orchestrator/supervisor.ts` (modificare)
- `lib/agent/workers/booking.ts` (modificare)
- `lib/wallet/credit-check.ts` (NUOVO)

**Requisiti:**
- Verificare credito disponibile PRIMA di procedere con booking
- Se credito insufficiente → `clarification_request` con messaggio chiaro
- Prevenire tentativi booking inutili (risparmio API calls)
- Integrare con `booking_worker` preflight checks

**Architettura:**
```typescript
// lib/wallet/credit-check.ts
export async function checkCreditBeforeBooking(
  userId: string,
  estimatedCost: number,
  actingContext: ActingContext
): Promise<{ sufficient: boolean; currentBalance: number; required: number }> {
  // Query wallet_balance
  // Verifica sufficiente per estimatedCost
  // Restituisce stato
}
```

**Integrazione:**
- Aggiungere check in `supervisor.ts` prima di routing a `booking_worker`
- Se credito insufficiente → `next_step: 'END'` con `clarification_request`
- Messaggio: "Credito insufficiente (€X disponibili, €Y richiesti). Vuoi ricaricare?"

**Riferimenti:**
- `lib/wallet/wallet.ts` - Funzioni wallet esistenti
- `lib/agent/workers/booking.ts` - Preflight checks
- `docs/MONEY_FLOWS.md` - Wallet invariants

**Pattern:**
```typescript
// In supervisor.ts
if (nextStep === 'booking_worker') {
  const creditCheck = await checkCreditBeforeBooking(
    state.userId,
    estimatedCost,
    state.agent_context?.acting_context
  );
  
  if (!creditCheck.sufficient) {
    return {
      next_step: 'END',
      clarification_request: `Credito insufficiente...`,
    };
  }
}
```

---

### Task 3: AgentSession Service - Abstraction Layer (2 giorni)
**File:**
- `lib/services/agent-session.ts` (NUOVO)

**Requisiti:**
- Service layer per gestione `agent_sessions` (astrazione da Supabase)
- Metodi: `createSession()`, `getSession()`, `updateSession()`, `listSessions()`
- Cache in-memory per sessioni attive (TTL 5 minuti)
- Type-safe con `AgentState` serialization

**Architettura:**
```typescript
// lib/services/agent-session.ts
export class AgentSessionService {
  private cache = new Map<string, { state: AgentState; expires: number }>();
  
  async createSession(userId: string, sessionId: string): Promise<AgentSession> {
    // Crea in DB, salva in cache
  }
  
  async getSession(userId: string, sessionId: string): Promise<AgentState | null> {
    // Check cache, fallback DB
  }
  
  async updateSession(userId: string, sessionId: string, state: AgentState): Promise<void> {
    // Update DB, invalidate cache
  }
  
  async listSessions(userId: string, limit = 10): Promise<AgentSession[]> {
    // Query DB, ordine updated_at DESC
  }
}
```

**Riferimenti:**
- `supabase/migrations/054_agent_sessions.sql` - Schema table
- `lib/agent/orchestrator/state.ts` - AgentState type
- Audit: "Missing Abstractions" - AgentSession service

**Pattern:**
```typescript
// In supervisor-router.ts
const sessionService = new AgentSessionService();
const session = await sessionService.getSession(userId, sessionId);
if (session) {
  // Riprendi da checkpoint
}
```

---

### Task 4: AgentTool Registry - Unificazione Tools (2 giorni)
**File:**
- `lib/agent/tools/registry.ts` (NUOVO)
- `lib/agent/tools/index.ts` (NUOVO)
- Refactor: `lib/ai/tools.ts` → `lib/agent/tools/`

**Requisiti:**
- Unificare tools sparsi in `lib/ai/tools.ts` e `lib/agent/tools.ts`
- Registry centralizzato con type safety
- Auto-discovery tools (decorator pattern)
- Validazione input/output con Zod

**Architettura:**
```typescript
// lib/agent/tools/registry.ts
export class AgentToolRegistry {
  private tools = new Map<string, AgentTool>();
  
  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }
  
  get(name: string): AgentTool | null {
    return this.tools.get(name) || null;
  }
  
  list(): AgentTool[] {
    return Array.from(this.tools.values());
  }
}

// lib/agent/tools/index.ts
export const toolRegistry = new AgentToolRegistry();

// Auto-register all tools
toolRegistry.register(new GetShipmentTool());
toolRegistry.register(new GetWalletBalanceTool());
// ...
```

**Refactoring:**
- Spostare tools da `lib/ai/tools.ts` a `lib/agent/tools/`
- Creare `lib/agent/tools/shipment.ts`, `lib/agent/tools/wallet.ts`, etc.
- Aggiornare import in `supervisor-router.ts`

**Riferimenti:**
- `lib/ai/tools.ts` - Tools esistenti
- Audit: "Missing Abstractions" - AgentTool registry
- LangGraph tools pattern

---

### Task 5: Type Safety Improvements - Rimuovere TODO (1 giorno)
**File:**
- `lib/agent/orchestrator/pricing-graph.ts` (modificare)
- `lib/agent/orchestrator/graph.ts` (modificare)
- `lib/agent/orchestrator/supervisor-router.ts` (modificare)

**Requisiti:**
- Rimuovere tutti i `// TODO: Rimuovere quando LangGraph migliorerà i tipi`
- Creare type guards per `AgentState` in LangGraph context
- Migliorare type safety senza `as any` o `unknown`

**TODO da risolvere:**
```typescript
// lib/agent/orchestrator/pricing-graph.ts:340
// TODO: Rimuovere quando LangGraph migliorerà i tipi.

// lib/agent/orchestrator/graph.ts:70
// TODO: Rimuovere quando LangGraph migliorerà i tipi.

// lib/agent/orchestrator/supervisor-router.ts:253
// TODO: Migliorare quando LangGraph avrà tipi più precisi.
```

**Soluzione:**
- Creare `lib/agent/orchestrator/type-guards.ts`
- Type guards per `AgentState` in LangGraph context
- Wrapper functions con type safety

**Pattern:**
```typescript
// lib/agent/orchestrator/type-guards.ts
export function isAgentState(value: unknown): value is AgentState {
  return (
    typeof value === 'object' &&
    value !== null &&
    'userId' in value &&
    'messages' in value
  );
}

// In pricing-graph.ts
const state = isAgentState(result) ? result : throw new Error('Invalid state');
```

---

### Task 6: Performance Optimization - Query & Caching (2 giorni)
**File:**
- `lib/agent/orchestrator/supervisor-router.ts` (modificare)
- `lib/agent/workers/mentor.ts` (modificare)
- `lib/services/cache.ts` (NUOVO)

**Requisiti:**
- Cache RAG results (mentor_worker, explain_worker) - TTL 1 ora
- Cache pricing calculations - TTL 5 minuti (stesso input = stesso output)
- Ottimizzare query Supabase (index, select solo campi necessari)
- Lazy loading documentazione (carica solo se necessario)

**Architettura:**
```typescript
// lib/services/cache.ts
export class AgentCache {
  private ragCache = new Map<string, { result: any; expires: number }>();
  private pricingCache = new Map<string, { result: PricingResult[]; expires: number }>();
  
  getRAG(query: string): RAGResult | null {
    const cached = this.ragCache.get(query);
    if (cached && cached.expires > Date.now()) {
      return cached.result;
    }
    return null;
  }
  
  setRAG(query: string, result: RAGResult, ttl = 3600000): void {
    this.ragCache.set(query, { result, expires: Date.now() + ttl });
  }
  
  // Similar for pricing cache
}
```

**Ottimizzazioni:**
- Query Supabase: `select('id, user_id, session_id')` invece di `*`
- Index su `agent_sessions(user_id, updated_at)` per listSessions
- Batch reads quando possibile

**Riferimenti:**
- `lib/agent/workers/mentor.ts` - RAG queries
- `lib/agent/workers/pricing.ts` - Pricing calculations
- `lib/telemetry/logger.ts` - Performance metrics

---

## 🔒 VINCOLI E REGOLE

### Architettura (NON NEGOZIABILI)
1. ✅ **Backward compatible:** Nessun breaking change per API esistenti
2. ✅ **Type safety:** Zero `any`, zero `unknown` non gestiti
3. ✅ **Performance:** Nessuna regressione performance (misurare prima/dopo)
4. ✅ **Test coverage:** Mantenere 446 test passati

### Technical Debt
1. ✅ **Risolvere TODO:** Tutti i TODO identificati devono essere risolti
2. ✅ **Pattern consistency:** Seguire pattern esistenti (non inventare nuovi)
3. ✅ **Documentazione:** Aggiornare `docs/ARCHITECTURE.md` con nuovi pattern

### Testing
1. ✅ **Test checkpointer:** Test persistenza/ripristino stato
2. ✅ **Test wallet integration:** Test credito insufficiente
3. ✅ **Test performance:** Benchmark prima/dopo ottimizzazioni

---

## 📚 DOCUMENTAZIONE DA CONSULTARE

- `AUDIT_AI_AGENT_INTEGRATION.md` - Gap analysis architetturali
- `lib/agent/orchestrator/state.ts` - AgentState structure
- `supabase/migrations/054_agent_sessions.sql` - Schema checkpointer
- `docs/ARCHITECTURE.md` - Pattern esistenti
- LangGraph docs: MemorySaver, checkpointer pattern

---

## ✅ DEFINITION OF DONE

Ogni task è considerato completo quando:

- [ ] Codice refactorato senza breaking changes
- [ ] Type safety migliorata (zero `any` aggiunti)
- [ ] Performance misurata (no regressioni)
- [ ] Test esistenti passano (446/446)
- [ ] TODO risolti (tutti i TODO identificati)
- [ ] Documentazione aggiornata (`docs/ARCHITECTURE.md`)

---

## 🚀 ORDINE DI IMPLEMENTAZIONE CONSIGLIATO

1. **Task 3** (2d) - AgentSession Service - Base per checkpointer
2. **Task 1** (4d) - LangGraph Checkpointer - State persistence
3. **Task 2** (3d) - Wallet Integration - Sicurezza finanziaria
4. **Task 4** (2d) - AgentTool Registry - Unificazione
5. **Task 5** (1d) - Type Safety - Rimuovere TODO
6. **Task 6** (2d) - Performance Optimization - Query & caching

**Totale:** ~14 giorni

---

## 💬 ISTRUZIONI PER AI AGENT

1. **Focus su architettura** - Refactoring, pattern, technical debt
2. **Mantieni compatibilità** - Nessun breaking change
3. **Misura performance** - Benchmark prima/dopo
4. **Risolvi TODO** - Tutti i TODO identificati
5. **Type safety** - Zero `any`, type guards ovunque

**Inizia con Task 3 (AgentSession Service) - è la base per checkpointer.**

---

## 📊 METRICHE DI SUCCESSO

### Task 1: Checkpointer
- Persistenza stato: 100% conversazioni salvate
- Ripristino: <100ms per recupero stato
- Storage: <1MB per conversazione media

### Task 2: Wallet Integration
- Prevenzione booking: 100% tentativi con credito insufficiente bloccati
- Messaggi chiari: 0% confusione utente su credito

### Task 3: AgentSession Service
- Cache hit rate: >80% per sessioni attive
- Query performance: <50ms per getSession

### Task 4: AgentTool Registry
- Tools unificati: 100% tools in registry
- Type safety: 0 `any` nei tools

### Task 5: Type Safety
- TODO risolti: 100% TODO identificati risolti
- Type safety: 0 `any` o `unknown` non gestiti

### Task 6: Performance
- RAG cache hit rate: >60%
- Pricing cache hit rate: >40%
- Query performance: -30% tempo medio

---

*Prompt creato per implementazione P3 AI Agent Architecture*  
*Data: 1 Gennaio 2026*  
*Prerequisiti: P1 e P2 completati*

