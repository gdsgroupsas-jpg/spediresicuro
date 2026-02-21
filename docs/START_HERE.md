# START HERE

Last updated: February 20, 2026

## Context Snapshot

- Repository migrated to npm workspaces monorepo.
- Web app path: `apps/web`.
- Automation service path: `services/automation`.
- Shared/domain packages path: `packages/*`.
- Active documentation source of truth: `docs/00-CORE/*`.

## Read In Order

1. `docs/00-CORE/ARCHITECTURE.md`
2. `docs/00-CORE/DOMAIN_MAP.md`
3. `docs/00-CORE/AI_RULES.md`
4. `docs/00-CORE/RUNBOOK.md`
5. `docs/00-CORE/TEST_STRATEGY.md`

## Fast Commands

```bash
npm install
npm run type-check
npm run test:unit
npm run check:boundaries
npm run check:file-size
```

## Important Constraints

- No breaking changes to existing HTTP API in `apps/web/app/api/**`.
- No DB schema/RPC behavior changes during refactor unless explicitly planned.
- Keep wallet invariants unchanged: atomicity, idempotency, audit, no negative drift.
- No deep imports across `@ss/*` packages.

## Current Guardrails

- `npm run check:boundaries`: dependency/import contract checks (warning mode by default).
- `npm run check:file-size`: warns for oversized files in UI/actions/lib.

## Documentation Policy

- `docs/00-CORE/*` = active/canonical.
- `docs/archive/*` = historical.
