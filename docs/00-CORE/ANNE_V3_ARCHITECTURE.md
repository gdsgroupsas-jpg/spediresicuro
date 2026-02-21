# ANNE V3 Architecture

## Runtime Canonico
ANNE V3 usa un unico orchestratore model-driven, senza routing deterministico e senza fallback legacy in canary/v2.

Pipeline obbligatoria:
`request_manager -> domain_decomposer -> task_planner -> planner -> tool_analysis -> tool_argument -> tool_caller -> command_builder -> tool_executor -> aggregator -> finalizer`

## Entrypoint
- Web: `apps/web/app/api/ai/agent-chat/route.ts`
- WhatsApp: `apps/web/app/api/webhooks/whatsapp/route.ts`
- Runner mode-aware: `apps/web/lib/agent/v2/runner.ts`

## Core Orchestrator
- Entry: `packages/domain-ai/src/orchestrator/run.ts`
- Stage contract strict: `packages/domain-ai/src/orchestrator/contracts.ts`
- Stage runtime: `packages/domain-ai/src/orchestrator/stages/*`
- Model resolver domain+role: `packages/domain-ai/src/models/resolver.ts`
- Prompt registry: `packages/domain-ai/src/prompts/index.ts`

## FlowId Pubblico
`metadata.flowId` formato canonico:
`orch.<domain>.<intent>`

Esempi:
- `orch.support.support.request`
- `orch.crm.crm.pipeline_overview`
- `orch.quote.shipment.quote`

## Metadata V3
Shape API invariata (`success/message/metadata`), con metadata V3:
- `flowId`
- `intentId`
- `channel`
- `domain`
- `pipelineId`
- `stageTrace`
- `riskLevel`
- `approvalRequired`
- `toolPlanId`
- `approvalPayload` (se richiesto)

`metadata.agentState` resta supportato (incl. `pendingAction`).
