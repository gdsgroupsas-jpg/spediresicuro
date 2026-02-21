# Anne V2 — Architettura e Guida Implementativa

## Panoramica

Anne V2 e' l'evoluzione dell'orchestratore AI. Aggiunge:

1. **Staged Orchestration** (`@ss/domain-ai`) — Pipeline a 8 stage con contratti JSON tipizzati
2. **Multi-Provider LLM** — Routing tra DeepSeek, Gemini, Anthropic, Ollama
3. **Flow System** — 9 macro flow + 30 specific flow
4. **Tool Safety & Approval** — Policy di rischio, whitelist argomenti, approvazione esplicita

## V1 vs V2

| Aspetto   | V1 (LangGraph)     | V2 (@ss/domain-ai)       |
| --------- | ------------------ | ------------------------ |
| Router    | Supervisor singolo | Pipeline 8 stage         |
| Provider  | Hardcoded (1 LLM)  | Multi-provider router    |
| Flussi    | Worker diretti     | Macro -> Specific flow   |
| Contratti | Stato implicito    | Zod-validated JSON       |
| Sicurezza | Logica inline      | Policy + approval gate   |
| Costo     | Fisso              | Ottimizzabile (env vars) |

**V1 NON e' deprecato.** Il pattern e' strangler fig: V2 cresce accanto a V1.

## Struttura File

```
packages/domain-ai/           # Package standalone (NO dipendenze @/)
  src/
    orchestrator/              # Pipeline runner + stages
    policies/                  # approval, risk, tool-safety
    tools/                     # catalog, executor
    models/                    # LLM model resolver
    types/                     # TypeScript interfaces
    prompts/                   # Template prompts

lib/agent/
  supervisor.ts                # Classificatore macro (9 flow)
  specific-flows.ts            # 30 specific flow + mappatura
  chains/run-flow-chain.ts     # Dispatcher principale (catena lineare)
  flows/                       # Flow handlers (richiesta-preventivo, types)
  workers/shipment-creation-v2 # Worker LLM per creazione spedizione
  v2/                          # Runner, tool executor, multi-provider LLM

lib/ai/ollama.ts               # Client Ollama locale
```

## Flow System

### 9 Macro Flow (Supervisor)

| FlowId                 | Tipo    | Specifici   |
| ---------------------- | ------- | ----------- |
| `richiesta_preventivo` | Diretto | —           |
| `crea_spedizione`      | Diretto | —           |
| `support`              | Macro   | 6 specifici |
| `crm`                  | Macro   | 6 specifici |
| `outreach`             | Macro   | 6 specifici |
| `listini`              | Macro   | 4 specifici |
| `mentor`               | Macro   | 2 specifici |
| `debug`                | Macro   | 2 specifici |
| `explain`              | Macro   | 2 specifici |

### Routing

```
Messaggio utente
  -> supervisorRoute() [Ollama, classificazione]
  -> runFlowChain(flowId, input)
      -> Se diretto: handler dedicato
      -> Se macro: resolveSpecificFlowId() [Ollama] -> worker
```

## Multi-Provider LLM

### Gerarchia Env Vars

```
ANNE_PROVIDER_{DOMAIN}_{ROLE}    # Piu' specifico
ANNE_PROVIDER_{ROLE}             # Per ruolo
ANNE_PROVIDER                    # Globale
"ollama"                         # Fallback
```

### Strategia Consigliata

| Stage                   | Provider  | Motivo                      |
| ----------------------- | --------- | --------------------------- |
| supervisor/intermediary | gemini    | Flash, quasi gratis, ~200ms |
| extraction/tool\_\*     | deepseek  | JSON quality, ~$0.001       |
| finalizer               | anthropic | Claude Haiku, qualita'      |
| fallback                | ollama    | Locale, gratuito            |

### Configurazione

```bash
# Globale
export ANNE_PROVIDER=deepseek

# Per ruolo
export ANNE_PROVIDER_SUPERVISOR=gemini
export ANNE_PROVIDER_FINALIZER=anthropic

# Per dominio + ruolo
export ANNE_PROVIDER_QUOTE_SUPERVISOR=gemini
```

## Sicurezza

### Tool Safety

- **FORBIDDEN_ARG_KEYS**: `userId`, `user_id`, `workspaceId`, `workspace_id` — strippati SEMPRE dagli argomenti LLM
- **Domain check**: ogni tool dichiara i domini ammessi
- **Workspace check**: tool con `tenancy: 'workspace_required'` bloccati senza workspaceId
- **Required args**: validazione argomenti obbligatori pre-esecuzione

### Approval Policy

- Tool `requiresApproval: true` → richiedono conferma esplicita dall'utente
- Regex di conferma: messaggio deve INIZIARE con parola di conferma (`ok`, `confermo`, `procedi`, etc.)
- Payload di approvazione scade dopo 5 minuti
- **MAI inferire conferma da frasi ambigue** (es. "non ok" non e' una conferma)

### SessionState Whitelist

`createBaseAgentState()` usa whitelist esplicita:

- `shipmentDraft`, `shipment_creation_phase`, `missingFields`, `pricing_options`, `shipment_details`
- **MAI** propagare `userId`, `userEmail`, `processingStatus` dal client

## Test

```bash
# Contratti domain-ai
npm run test:unit -- tests/unit/domain-ai-contracts.test.ts

# Flow routing
npm run test:unit -- tests/unit/anne-v2-flows.test.ts

# Sicurezza V2
npm run test:unit -- tests/unit/anne-v2-security.test.ts

# Multi-provider LLM
npm run test:unit -- tests/unit/multi-provider-llm.test.ts
```

## Aggiungere un Nuovo Flow

1. Aggiungere flowId a `FLOW_IDS` in `lib/agent/supervisor.ts`
2. Se macro con specifici: aggiungere a `MACRO_TO_SPECIFICS` in `specific-flows.ts`
3. Aggiungere case in `runFlowChain()` e `runSpecificFlowChain()` in `run-flow-chain.ts`
4. Creare worker dedicato in `lib/agent/workers/`
5. Aggiornare test in `anne-v2-flows.test.ts`
6. Aggiornare FLOW_IDS count nel test

## Import Package domain-ai

```typescript
// Contratti
import { parseRequestManagerContract, ContractValidationError } from '@ss/domain-ai';

// Policy
import { evaluateToolSafety, evaluateApprovalPolicy } from '@ss/domain-ai';

// Tipi
import type { ToolSpec, ToolCall, AnneOrchestratorInput } from '@ss/domain-ai';

// Model resolver
import { resolveRoleModel, resolveDomainRoleModel } from '@ss/domain-ai';
```

**Path alias** configurato in `tsconfig.json` e `vitest.config.mts`:

```json
"@ss/domain-ai": ["./packages/domain-ai/src/index.ts"]
```
