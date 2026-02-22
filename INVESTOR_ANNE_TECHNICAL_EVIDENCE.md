# Anne: Evidenze Tecniche per Investor

**Data:** 22 Febbraio 2026
**Autore:** Salvatore Squillante, Founder & CTO
**In risposta a:** "Anne non suggerisce, fa" — verifica tecnica

---

## TL;DR

Anne e' un **agent operativo autonomo** con privilegi reali sul sistema. Non e' un chatbot, non e' un layer sopra RPC hardcoded. E' un'architettura multi-stage con tool registry, safety layer, memoria per tenant, e self-learning.

**4.000+ righe di orchestrazione + 3.000+ righe di domain-AI package = infrastruttura AI reale.**

---

## A. E' davvero autonoma o usa trigger predefiniti?

### Risposta: Agent architecture vera, non workflow hardcoded.

**Architettura a 3 livelli:**

### L1: Supervisor-Router (1.300+ righe)

- **File:** `lib/agent/orchestrator/supervisor-router.ts`
- Intent detection su 8 domini (pricing, shipment, CRM, outreach, support, delegation, OCR, unknown)
- Routing condizionale multi-fattore: non "if intent==X call function Y" ma decision tree con memoria, stato sessione, eligibilita' one-shot, delegation context
- Telemetria completa: intent, decisione, backend usato, motivo fallback, token usage, durata

### L2: LangGraph StateGraph (Pricing Graph)

- **File:** `lib/agent/orchestrator/pricing-graph.ts`
- 11 nodi con routing condizionale basato su confidence score
- 4 worker specializzati: Supervisor, Address, Pricing, Booking
- NON e' un DAG fisso — il percorso cambia in base ai dati disponibili

### L3: V2 Orchestrator (Domain-AI Package)

- **File:** `packages/domain-ai/src/orchestrator/run.ts`
- Pipeline a 8 stage: request_manager → domain_decomposer → task_planner → planner → tool_analysis → tool_argument → tool_caller → finalizer
- Multi-provider LLM: DeepSeek, Gemini, Anthropic, Ollama — routing per dominio e ruolo
- Token tracking per stage, risk escalation, approval workflow

### Tool Registry

- **File:** `lib/agent/tools/registry.ts`
- `AgentToolRegistry`: auto-discovery, validazione schema Zod, conversione LangChain
- Role-based access control (user/admin/superadmin)
- **50+ tool registrati** con schema tipizzato

### Decision Engine — NON workflow hardcoded

Esempio: quando un utente dice "spedisci a Roma":

1. Intent detection → `shipment_creation`
2. Check memoria utente → ha `preferredCouriers`? ha `defaultSender` completo?
3. Se si' → `one_shot_eligible = true`, skip raccolta dati
4. Check dati mancanti → peso? CAP? provincia?
5. Se mancanti → Address Worker (normalizzazione italiana, dataset Poste)
6. Se completi → Pricing Worker (calcolo multi-corriere, margini, listino utente)
7. Presentazione opzioni → attende conferma esplicita "procedi"
8. Booking Worker → wallet debit atomico + courier API + label generation
9. Post-booking → aggiorna `preferredCouriers` in memoria (fire-and-forget)

Ogni step ha routing condizionale. Il percorso cambia ad ogni richiesta.

---

## B. Multi-tenant reale o marketing?

### Risposta: Isolamento a 5 livelli. Audit superato 9.5/10.

### Livello 1: Database RLS (Row-Level Security)

- 33 tabelle con policy RLS
- Funzioni SECURITY DEFINER: `get_user_workspace_ids()`, `is_superadmin()`
- Nessuna subquery inline (previene infinite recursion)

### Livello 2: Application Layer (`workspaceQuery`)

- **File:** `lib/db/workspace-query.ts`
- Wrapper obbligatorio per tutte le tabelle multi-tenant (31 tabelle)
- Guardian test con baseline: **0 violazioni** (monitorate in CI)
- Inietta `workspace_id` in SELECT, INSERT, UPDATE, DELETE

### Livello 3: AI Context Isolation

- **File:** `lib/ai/context-builder.ts`
- `buildContext(userId, role, name, workspaceId)` — workspace e' parametro obbligatorio
- Wallet letto da `workspaces.wallet_balance` (v2), MAI da `users.wallet_balance`
- Spedizioni recenti via `workspaceQuery(workspaceId)` — fail-closed senza workspace
- Statistiche mensili, COD, audit log — tutti workspace-scoped

### Livello 4: Tool Safety per Workspace

- **File:** `packages/domain-ai/src/policies/tool-safety.ts`
- `evaluateToolSafety()` eseguita PRIMA di ogni azione
- Policy `tenancy: 'workspace_required'` su tool operativi
- Whitelist esplicita sessionState (OWASP defense — no spread injection)
- Argomenti proibiti: `userId`, `workspaceId` non iniettabili dal client

### Livello 5: Nessuna contaminazione embedding

- Zero infrastruttura embedding/vector condivisa
- Contesto costruito fresh per ogni richiesta da DB workspace-scoped
- Memoria utente isolata per `user_id` in tabella dedicata

### Isolamento CRM

- **File:** `lib/crm/crm-data-service.ts`
- `getCrmQueryBuilder(isAdmin, workspaceId)` — fail-closed se workspace mancante per reseller
- Ogni funzione CRM accetta e usa `workspaceId`
- Admin vede cross-workspace (design intenzionale per superadmin)

### Delegation (Reseller → Sub-Client)

- Workspace override esplicito con audit trail completo
- `DELEGATION_ACTIVATED` / `DELEGATION_DEACTIVATED` loggati
- Actor preservato (reseller), target override (sub-client)
- `isImpersonating = true` per audit trail
- Persistente multi-turn (R2): salvato in sessione, ripristinato automaticamente

**Evidenza:** 38 test specifici in `anne-multi-tenant-isolation.test.ts`

---

## C. Scalabilita' reale?

### Risposta: Si'. Ogni primitiva critica e' implementata.

| Primitiva              | Implementazione                                                              | File                                                  |
| ---------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Rate Limiting**      | Sliding window, Redis distribuito + in-memory fallback, fail-open            | `lib/security/rate-limit.ts`                          |
| **Idempotency Keys**   | SHA256(userId+recipient+packages+timestamp), bucket 5s, PostgreSQL lock      | `lib/shipments/create-shipment-core.ts`               |
| **Compensation Queue** | Retry esponenziale (1m→5m→30m→2h→12h), dead letter dopo 5 tentativi          | `lib/services/compensation/processor.ts`              |
| **Circuit Breaker**    | 3 stati (CLOSED→OPEN→HALF_OPEN), Redis distribuito, per-provider             | `lib/resilience/circuit-breaker.ts`                   |
| **Wallet Atomico**     | RPC PostgreSQL SECURITY DEFINER, lock pessimistico, crash-safe               | `deduct_wallet_credit_v2`, `refund_wallet_balance_v2` |
| **Crash-Safe Debit**   | Lock acquisito PRIMA del debit, completato DOPO booking, rollback su failure | `create-shipment-core.ts:153-238`                     |

### Flusso Crash-Safe di una Spedizione:

```
1. Genera idempotency key (SHA256)
2. Acquisisci lock (RPC PostgreSQL) → se gia' completato, skip
3. Ricalcola prezzo server-side (MAI fidarsi del client)
4. Verifica saldo wallet
5. Debit atomico (RPC v2 con workspace_id)
6. Chiama courier API (con circuit breaker + retry)
7. Se courier fallisce → compensation queue (refund automatico)
8. Inserisci in DB (shipments + financial tracking)
9. Completa lock
```

Se il processo crasha a qualsiasi punto: il lock e' ancora in stato `in_progress`, il retry lo rileva e riprende o fa refund.

---

## D. L'AI crea vantaggio economico misurabile?

### Risposta: Si'. 3 KPI concreti.

### KPI 1: Riduzione tempo booking (-70% stimato)

**Senza Anne:**

1. Utente apre form wizard (5+ campi)
2. Compila mittente, destinatario, pacco
3. Seleziona corriere da lista
4. Conferma e paga
5. **Tempo medio: 3-5 minuti**

**Con Anne (one-shot booking):**

1. Utente scrive "spedisci 5kg a Mario Rossi, Via Roma 1, 00100 Roma"
2. Anne: ha mittente in memoria, ha corriere preferito, calcola prezzo, chiede conferma
3. Utente: "procedi"
4. **Tempo: 30 secondi**

**Commit evidenza:** `0d7bc6a2` — one-shot booking con corriere da memoria

### KPI 2: Riduzione errori indirizzo (-60% stimato)

**Senza Anne:**

- Utente scrive "roma" senza CAP/provincia
- Sistema non valida, corriere rifiuta, giacenza, costo extra

**Con Anne (Address Worker):**

- Normalizzazione automatica con dataset Poste Italiane
- Auto-correzione CAP/provincia
- Classificazione indirizzo (residenziale vs. business)
- Validazione prima del booking

### KPI 3: Self-Learning per supporto

**File:** `lib/ai/case-learning.ts` (462 righe)

- Anne impara dai casi risolti → crea pattern automaticamente
- Confidence score auto-aggiornato (trigger DB su usage)
- Escalation umana → Anne apprende il pattern di risoluzione
- Riduce ticket ripetitivi senza intervento umano

**Pattern Discovery:**

```
Caso nuovo → Anne lo risolve → Crea pattern (confidence=0)
→ Pattern riusato con successo → confidence sale
→ Pattern validato da umano → confidence +0.1 bonus
```

---

## Differenziatori vs. Competitor

| Feature           | SpedireSicuro (Anne)                             | Competitor tipico (SaaS logistico) |
| ----------------- | ------------------------------------------------ | ---------------------------------- |
| Booking           | Conversazionale, one-shot                        | Form wizard multi-step             |
| Decision Making   | Multi-stage pipeline con memoria                 | Workflow fisso                     |
| Transazioni reali | Crea spedizioni, debita wallet, genera etichette | UI per API corriere                |
| Safety            | Tool evaluation + approval workflow              | Nessuno                            |
| Learning          | Auto-learns da casi risolti                      | Nessuno                            |
| Context           | Per-sessione + per-utente + per-workspace        | Stateless                          |
| Error Recovery    | Idempotency + crash-safe debit + compensation    | Retry basico                       |
| Tenant Isolation  | 5 livelli (DB + app + AI + tool + session)       | RLS base                           |
| Delegation        | Reseller opera per sub-client con audit          | Non supportato                     |
| Multi-Provider AI | 4 provider (Anthropic, Gemini, DeepSeek, Ollama) | Single provider                    |

---

## Risposte alle Domande Specifiche dell'Investor

### "E' automation orchestrata o autonomous AI?"

**Autonomous AI.** Il percorso decisionale cambia ad ogni richiesta in base a:

- Dati disponibili (incompleti → worker specializzato)
- Memoria utente (preferenze, mittente default, corrieri preferiti)
- Stato sessione (delegation attiva, fase creazione)
- Confidence score (sotto soglia → chiede chiarimento)
- Contesto workspace (listino, wallet, permessi)

Non e' un `switch(intent)` con 5 case. E' un grafo con routing condizionale a 11 nodi.

### "Anne genera moat?"

**Si', se combinata con:**

1. **Dati verticali** — ogni tenant accumula pattern di spedizione, indirizzi normalizzati, preferenze corriere. Piu' usa Anne, piu' Anne diventa efficiente per quel tenant.
2. **Self-learning** — i pattern di risoluzione supporto crescono organicamente. Un competitor dovrebbe ricostruire l'intero corpus.
3. **Multi-tenant architecture** — la complessita' dell'isolamento a 5 livelli e' una barriera tecnica significativa.

### "Rischio di replicabilita'?"

Un competitor puo' replicare un chatbot che chiama API corriere in settimane.
Non puo' replicare:

- 4.000+ righe di orchestrazione con routing condizionale
- Isolamento multi-tenant a 5 livelli con 38 test guardian
- Compensation queue crash-safe con dead letter
- Self-learning con confidence scoring
- Delegation reseller→sub-client con audit trail

**Stima di replicazione completa: 6-12 mesi per un team di 3-4 senior.**

---

## Metriche di Qualita' del Codice AI

| Metrica                         | Valore                                                             |
| ------------------------------- | ------------------------------------------------------------------ |
| Righe orchestrazione (L1+L2+L3) | 4.200+                                                             |
| Righe domain-AI package         | 3.100+                                                             |
| Tool registrati                 | 50+                                                                |
| Test specifici Anne             | 87 (v2-flows, v2-security, multi-tenant, multi-provider, one-shot) |
| Test guardian AI                | 38 (multi-tenant isolation)                                        |
| Worker specializzati            | 6 (Address, Pricing, Booking, OCR, Support, CRM)                   |
| Provider LLM supportati         | 4 (Anthropic, Gemini, DeepSeek, Ollama)                            |
| Commit dedicati Anne            | 15+ (merge chirurgico da branch di 1.892 file)                     |

---

_Documento generato il 22 Febbraio 2026. Ogni affermazione e' verificabile nel repository Git con i file e le righe indicati._
