# Baseline Metrics - 2026-02-20

## Technical baseline
- `npm run type-check`: PASS (circa 16s)
- `npm run test:unit`: PASS (circa 46s)

## Structural baseline
- File oltre soglia 800 linee (actions/components/lib): 28
- Principali monoliti:
  - `apps/web/lib/db/database.types.ts`
  - `apps/web/lib/database.ts`
  - `apps/web/actions/price-lists.ts`
  - `apps/web/lib/adapters/couriers/spedisci-online.ts`

## Note
Queste metriche sono la baseline per misurare il delta durante gli split incrementali.
