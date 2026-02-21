# ANNE V2 Runbook

## Rollout Flags
- `ANNE_ORCHESTRATOR_MODE=legacy|shadow|canary|v2`
- `ANNE_ORCHESTRATOR_CANARY_PERCENT=0..100`
- `ANNE_ORCHESTRATOR_CANARY_WORKSPACES=<csv workspace ids>`

Default if unset: `ANNE_ORCHESTRATOR_MODE=v2`.

## Modes
1. `legacy`
- Source of truth is legacy runtime.
- V2 is disabled.

2. `shadow`
- User response still from legacy runtime.
- V2 executes in background for comparison and logging.

3. `canary`
- V2 serves only allowlisted or sampled traffic.
- Automatic fallback to legacy on V2 failure.

4. `v2`
- V2 is the only runtime.
- No automatic legacy fallback.

## Operational Checks
Before enabling `canary`:
- `npm run -w @ss/domain-ai typecheck`
- `npm run -w @ss/web type-check`
- Relevant unit/integration suites for support, CRM, outreach, shipments

Before enabling `v2`:
- Canary error rate stable and below agreed threshold
- Latency within target envelope
- Approval flow validated end-to-end

## Incident Fallback
If degradation is detected in canary/shadow:
1. Set `ANNE_ORCHESTRATOR_MODE=legacy`
2. Redeploy web runtime
3. Collect failing traces (`trace_id`, `toolPlanId`, `intentId`)
4. Patch and re-run canary
