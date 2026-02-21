# AI Rules

## 1) Multi-tenant safety (obbligatoria)
Ogni query su tabelle multi-tenant deve usare `workspaceQuery(workspaceId)`.

## 2) Auth safety
Per contesto server usare `getSafeAuth/requireSafeAuth` quando richiesto dal flusso impersonation.

## 3) Delivery definition
Una modifica e considerata completa solo con:
- `npm run type-check` verde
- test rilevanti verdi

## 4) Boundary rules
- Niente import profondi da `@ss/*`.
- Niente dipendenze non autorizzate tra domini.
- `core-*` non dipende da `domain-*`.

## 5) Repo hygiene
- Mantenere file nuovi piccoli e focalizzati.
- Evitare crescita di file monolitici (>800 linee) senza split.
- Documentazione attiva solo in `docs/00-CORE`.

## 6) ANNE V3 orchestration
- Runtime canonico ANNE: single-flow model-driven (`orch.<domain>.<intent>`).
- Pipeline canonica obbligatoria:
  `request_manager -> domain_decomposer -> task_planner -> planner -> tool_analysis -> tool_argument -> tool_caller -> command_builder -> tool_executor -> aggregator -> finalizer`.
- Nessun fallback deterministico nei stage.
- Nessun fallback legacy su failure in `canary`/`v2`.
- Approval obbligatoria per operazioni `high`/`critical` o write sensibili.
