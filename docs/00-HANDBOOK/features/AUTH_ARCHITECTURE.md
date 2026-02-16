# Architettura Auth — Safe Auth vs Workspace Auth

> Ultimo aggiornamento: 2026-02-13 (Milestone 20)

## Overview

Il sistema auth di SpedireSicuro ha due livelli distinti:

```
┌──────────────────────────────────────────────┐
│               NextAuth (JWT)                 │
│         lib/auth-config.ts → auth()          │
└──────────────┬───────────────────────────────┘
               │
       ┌───────┴───────┐
       ▼               ▼
┌──────────────┐ ┌─────────────────┐
│  getSafeAuth │ │ getWorkspaceAuth│
│  (globale)   │ │ (workspace)     │
└──────────────┘ └─────────────────┘
```

## Quando usare quale

### `getSafeAuth()` / `requireSafeAuth()` — Operazioni globali

Usare per operazioni che NON dipendono da un workspace specifico:

- Auth endpoints (login, change-password, reset-password)
- Wallet (ricariche, trasferimenti — per-utente)
- Invite (accettazione inviti — pre-workspace)
- Debug endpoints (check account type)
- Integrazioni API (SpediamoPro, SpedisciOnline — per-utente)
- OCR consent (GDPR — per-utente)
- Fiscal data (dati fiscali — per-utente)
- Admin platform ops (leads, CRM, outreach — dati piattaforma)

**File:** `lib/safe-auth.ts`

### `getWorkspaceAuth()` / `requireWorkspaceAuth()` — Operazioni workspace

Usare per operazioni che operano su dati di un workspace specifico:

- Listini prezzi (CRUD, assegnazione)
- Spedizioni (creazione, lista, tracking)
- Team management (membri, ruoli)
- Email workspace (posta, bacheca)
- Annunci (broadcast)
- WMS (magazzino, ordini)
- Dashboard stats (filtrate per workspace)
- Qualsiasi query con `WHERE workspace_id = X`

**File:** `lib/workspace-auth.ts`

### `isSuperAdmin()` — Check permessi admin

Importare SEMPRE da `workspace-auth.ts`, MAI direttamente da `safe-auth.ts`:

```typescript
// CORRETTO
import { isSuperAdmin } from '@/lib/workspace-auth';

// SBAGLIATO
import { isSuperAdmin } from '@/lib/safe-auth';
```

## Flow di autenticazione

```
Request → Middleware
           │
           ├── Strip x-sec-workspace-id (prevent injection)
           ├── Strip x-test-mode (defense-in-depth)
           ├── Read workspace cookie → inject x-sec-workspace-id header
           │
           ▼
         API Route / Server Action
           │
           ├── getSafeAuth() → ActingContext { actor, target, isImpersonating }
           │     └── Impersonation: actor ≠ target
           │
           └── getWorkspaceAuth() → WorkspaceActingContext
                 ├── Chiama getSafeAuth() internamente
                 ├── Legge workspace da: header → cookie → DB (primary_workspace_id)
                 ├── Valida membership (o superadmin bypass)
                 └── Ritorna { actor, target, workspace, isImpersonating }
```

## E2E Test Mode

Il bypass E2E è centralizzato in `lib/test-mode.ts`:

```typescript
import { isE2ETestMode } from '@/lib/test-mode';

// Usato internamente da auth-config, workspace-auth, api-middleware, layout
if (isE2ETestMode(headers)) {
  // Ritorna context finto per test Playwright
}
```

### Condizioni di attivazione

1. `NODE_ENV !== 'production'` OPPURE `CI=true` OPPURE `PLAYWRIGHT_TEST_MODE=true`
2. Header `x-test-mode: playwright` OPPURE `PLAYWRIGHT_TEST_MODE=true`

### Protezioni in produzione

- `NODE_ENV=production` su Vercel blocca il bypass
- Middleware strippa `x-test-mode` header da tutte le request client
- L'header puo essere settato SOLO da Playwright test framework

## File di riferimento

| File                    | Ruolo                                                    |
| ----------------------- | -------------------------------------------------------- |
| `lib/auth-config.ts`    | Wrapper NextAuth con E2E bypass                          |
| `lib/safe-auth.ts`      | ActingContext globale (actor/target/impersonation)       |
| `lib/workspace-auth.ts` | WorkspaceActingContext (extends safe-auth con workspace) |
| `lib/test-mode.ts`      | `isE2ETestMode()` centralizzato                          |
| `lib/api-middleware.ts` | `requireAuth()` legacy con E2E bypass                    |
| `middleware.ts`         | Header injection/stripping, onboarding redirect          |

## Inventario post-migrazione (Feb 2026)

| Categoria           | File | Auth                                |
| ------------------- | ---- | ----------------------------------- |
| Workspace-scoped    | 113  | `getWorkspaceAuth()`                |
| Globali legittimi   | 31   | `getSafeAuth()`                     |
| Entrambi (corretto) | 7    | Mix (admin overview, impersonation) |
| Violazioni          | 0    | —                                   |
