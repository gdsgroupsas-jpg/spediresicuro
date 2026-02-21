# SpedireSicuro - Logistics OS Monorepo

Last updated: February 20, 2026

SpedireSicuro e un Logistics Operating System B2B/B2C con core finanziario wallet, multi-tenant RLS e orchestrazione AI.

## Stato Refactor

- Monorepo npm workspace attivo.
- Web app rilocata in `apps/web`.
- Automation service rilocato in `services/automation`.
- Package modulari introdotti in `packages/*`.
- Baseline tecnica ripristinata: type-check e test unitari verdi.

## Layout

```text
/
  apps/
    web/
  services/
    automation/
  packages/
    core-*
    domain-*
    ui-shared
    testing-shared
  docs/
    00-CORE/
    archive/
```

## Regole Architetturali

- `core-*` non dipende da `domain-*`.
- `domain-*` dipende solo da `core-*` e domini permessi.
- Import profondi vietati su `@ss/*` (solo `src/index.ts`).
- API HTTP in `apps/web/app/api/**` e schema DB restano invariati durante il refactor.
- Invarianti wallet: "No Credit, No Label", atomicita, idempotenza, audit trail.

Documentazione canonica:
- `docs/00-CORE/ARCHITECTURE.md`
- `docs/00-CORE/DOMAIN_MAP.md`
- `docs/00-CORE/RUNBOOK.md`
- `docs/00-CORE/TEST_STRATEGY.md`
- `docs/00-CORE/AI_RULES.md`
- `docs/00-CORE/index.json`

## Setup Rapido

```bash
npm install
cp .env.example .env.local
npm run setup:check
npm run dev
```

## Comandi Principali

```bash
# sviluppo
npm run dev:web
npm run dev:automation

# quality gates
npm run type-check
npm run test:unit
npm run lint
npm run ci:guardrails

# build
npm run build:web
npm run build:automation
```

Compatibilita legacy: gli script storici principali al root sono mantenuti come wrapper verso `@ss/web` (es. `npm run setup:supabase`, `npm run test:integration`, `npm run smoke:wallet`).

## Note Deploy

- Web: Vercel (config in `vercel.json`, path monorepo su `apps/web`).
- Automation: Railway (sorgente in `services/automation`).

## Policy Docs

- `docs/00-CORE/*`: fonte attiva.
- `docs/archive/*`: storico.

## Contribuire

Leggi `CONTRIBUTING.md` e `docs/00-CORE/AI_RULES.md` prima di aprire PR.
