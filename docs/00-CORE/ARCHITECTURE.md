# Architecture

## Monorepo Layout
- `apps/web`: applicazione Next.js principale.
- `services/automation`: servizio automation separato.
- `packages/*`: moduli condivisi core/domain/ui/testing.
- `docs/00-CORE`: documentazione attiva canonica.
- `docs/archive`: documentazione storica.

## Dependency Contract
- `core-*` non dipende da `domain-*`.
- `domain-*` dipende solo da `core-*` e domini consentiti.
- `apps/web` dipende da `@ss/core-*`, `@ss/domain-*`, `@ss/ui-shared`.
- `services/automation` dipende da `@ss/core-*` e domini necessari.
- Import profondi in `@ss/*` vietati (solo entrypoint `src/index.ts`).

## Enforcement
- Check boundary: `npm run check:boundaries` (warning mode).
- Check file size: `npm run check:file-size` (warning mode, soglia 800 linee).
