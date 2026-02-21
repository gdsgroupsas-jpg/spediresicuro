# ANNE V2 Architecture

## Goal
ANNE V2 uses a single orchestrated runtime path:

`Input -> Request Manager -> Task Planner -> Tool Plan -> Approval Policy -> Tool Dispatch -> Finalizer`

No runtime dependency on legacy `supervisor + intermediary + macro flow chain`.

## Runtime Entry Points
- Web: `apps/web/app/api/ai/agent-chat/route.ts`
- WhatsApp: `apps/web/app/api/webhooks/whatsapp/route.ts`
- Shared runner: `apps/web/lib/agent/v2/runner.ts`

## Domain Package
- Public API: `packages/domain-ai/src/index.ts`
- Main entrypoint: `packages/domain-ai/src/orchestrator/run.ts`
- Request manager: `packages/domain-ai/src/orchestrator/request-manager.ts`
- Task planner: `packages/domain-ai/src/orchestrator/task-planner.ts`
- Tool plan pipeline: `packages/domain-ai/src/orchestrator/tool-plan.ts`
- Approval policy: `packages/domain-ai/src/orchestrator/approval.ts`
- Finalizer: `packages/domain-ai/src/orchestrator/finalizer.ts`
- Catalog: `packages/domain-ai/src/tools/catalog.ts`

## Models (Role-based)
Configured per role with fallback to `OLLAMA_MODEL`:
- `OLLAMA_MODEL_REQUEST_MANAGER`
- `OLLAMA_MODEL_TASK_PLANNER`
- `OLLAMA_MODEL_PLANNER`
- `OLLAMA_MODEL_TOOL_ANALYSIS`
- `OLLAMA_MODEL_TOOL_ARGUMENT`
- `OLLAMA_MODEL_TOOL_CALLER`
- `OLLAMA_MODEL_COMMAND_BUILDER`
- `OLLAMA_MODEL_DEBUGGER`
- `OLLAMA_MODEL_FINALIZER`

## Output Contract
API response shape remains:
- `success`
- `message`
- `metadata`

V2 metadata fields:
- `flowId: "orchestrator_v2"`
- `intentId`
- `channel`
- `riskLevel`
- `approvalRequired`
- `toolPlanId`

`metadata.agentState` remains supported for cards and pending actions.

