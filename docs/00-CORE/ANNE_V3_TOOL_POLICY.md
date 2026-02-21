# ANNE V3 Tool Policy

## Principi
- Nessun `flow_*` wrapper monolitico nel catalogo V3.
- Planner model-driven sceglie tool capability-level.
- Tool non ammesso o args incompleti -> blocco + clarification (mai fallback deterministico).

## Moduli Policy
- Safety: `packages/domain-ai/src/policies/tool-safety.ts`
- Approval: `packages/domain-ai/src/policies/approval.ts`

## Regole Safety
- Tool ammessi solo se presenti nel catalogo e autorizzati per dominio.
- Validazione required args e tipo base.
- Tenancy gate (`workspace_required` dove previsto).
- Chiavi sensibili (`userId`, `workspaceId`, varianti snake_case) filtrate dagli args.

## Regole Approval
- Approval obbligatoria per tool high-risk/write sensibili.
- Nessuna esecuzione high-risk senza conferma esplicita.
- Payload pending action in `metadata.approvalPayload` e `agentState.pendingAction`.

## Failure Policy
- JSON stage invalido: retry stage (max N), poi clarification.
- Tool non consentito: blocco con richiesta alternativa.
- Arg incompleti: clarification guidata.
- Modello non disponibile: errore controllato, nessun fallback legacy in canary/v2.
