# ANNE V2 Tool Policy

## Scope
ANNE V2 can use only platform business tools:
- shipment/pricing/support
- CRM/outreach
- listini
- mentor/debug/explain business helpers

Code-editing or filesystem agent tools are out of scope.

## Tool Catalog Layers
1. Flow tools (`flow_quote`, `flow_create_shipment`, `flow_support`, `flow_crm`, `flow_outreach`, `flow_listini`, `flow_mentor`, `flow_debug`, `flow_explain`)
2. Existing business tools from `ANNE_TOOLS` (legacy list) exposed through V2 catalog

## Risk Levels
- `low`: read/query and non-destructive operations
- `medium`: regular business operations with limited side effects
- `high`: sensitive write/admin/cost-impacting actions
- `critical`: irreversible or financially sensitive operations

## Approval Gate
Approval is mandatory for `high` and `critical` tools.

Without explicit confirmation, orchestrator returns:
- `metadata.approvalRequired = true`
- `metadata.approvalPayload`
- `metadata.agentState.pendingAction`

Execution is blocked until confirmation.

## Multi-tenant Rule
All tool execution paths must preserve workspace isolation and use workspace-scoped services/query guards where required.

