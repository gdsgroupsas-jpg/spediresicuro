# ANNE V3 Runbook

## Env Minime
- `ANNE_ORCHESTRATOR_MODE=shadow|canary|v2`
- `ANNE_ORCHESTRATOR_CANARY_PERCENT` (solo canary)
- `ANNE_ORCHESTRATOR_CANARY_WORKSPACES` (solo canary)

Modelli (priorita):
1. `OLLAMA_MODEL_<DOMAIN>_<ROLE>`
2. `OLLAMA_MODEL_<ROLE>`
3. `OLLAMA_MODEL`

Domini: `QUOTE|SHIPMENT|SUPPORT|CRM|OUTREACH|LISTINI|MENTOR|DEBUG|EXPLAIN`
Ruoli: `REQUEST_MANAGER|DOMAIN_DECOMPOSER|TASK_PLANNER|PLANNER|TOOL_ANALYSIS|TOOL_ARGUMENT|TOOL_CALLER|COMMAND_BUILDER|AGGREGATOR|FINALIZER`

## Modalita Deploy
- `shadow`: risposta legacy, esecuzione V3 in ombra per osservabilita.
- `canary`: quota workspace/user su V3, senza fallback legacy su failure V3.
- `v2`: 100% V3, nessun fallback legacy.

## Verifiche Operative
- Type check:
  - `npm run -w @ss/domain-ai typecheck`
  - `npm run -w @ss/web type-check`
- Test smoke utili:
  - `npx vitest run tests/unit/support-worker.test.ts tests/unit/outreach-worker.test.ts --silent` (in `apps/web`)

## Telemetria Minima da Monitorare
- Success/failure per stage (`stageTrace`).
- Retry count stage.
- Approval hit-rate.
- Clarification rate.
- Tool error rate.

## Incident Handling
- Se modello non disponibile: risposta controllata, nessun fallback legacy in canary/v2.
- Se output stage invalido ripetuto: clarification guided all'utente.
- Se tool bloccato da safety/tenancy: richiedere dati corretti o tool alternativo.
