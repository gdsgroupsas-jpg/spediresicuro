# Rate Limiting - SpedireSicuro

## Overview

Rate limiting distribuito per protezione anti-abuse su tutte le API route.
Implementazione: Upstash Redis (sliding window bucket) con fallback in-memory.

## Infrastruttura

### Stack

| Componente  | Tecnologia                    | Note                                 |
| ----------- | ----------------------------- | ------------------------------------ |
| Distribuito | Upstash Redis (INCR + EXPIRE) | Funziona su Vercel serverless        |
| Fallback    | In-memory Map                 | Per quando Redis non disponibile     |
| Policy      | Fail-open                     | Mai bloccare per errori interni      |
| Timeout     | 1s                            | Non rallenta la route se Redis lento |

### File chiave

| File                         | Ruolo                              |
| ---------------------------- | ---------------------------------- |
| `lib/security/rate-limit.ts` | Core: `rateLimit()` function       |
| `lib/db/redis.ts`            | Singleton Redis client (lazy init) |

### Env vars

```
UPSTASH_REDIS_REST_URL=...    # oppure KV_REST_API_URL (Vercel Marketplace)
UPSTASH_REDIS_REST_TOKEN=...  # oppure KV_REST_API_TOKEN
```

## Utilizzo

```typescript
import { rateLimit } from '@/lib/security/rate-limit';

const rl = await rateLimit('route-name', userId, {
  limit: 20, // richieste permesse
  windowSeconds: 60, // finestra temporale
});

if (!rl.allowed) {
  return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 });
}
```

### Posizionamento

Il rate limit va **dopo auth** e **prima della business logic**:

```
Request → UUID validation → Auth → Membership → RATE LIMIT → Business logic
```

### Key format

```
rl:{route}:{userHash(12)}:{windowBucket}
```

- `userHash`: SHA-256 troncato a 12 char (no PII in Redis)
- `windowBucket`: `floor(timestamp / windowSeconds)` per raggruppare nella stessa finestra

## Configurazione per route

### FASE 5 — Custom Email Domain

| Route                                       | Method | Limit  | Window | Key                      |
| ------------------------------------------- | ------ | ------ | ------ | ------------------------ |
| `/api/workspaces/[id]/custom-domain`        | GET    | 30/min | 60s    | `custom-domain-info`     |
| `/api/workspaces/[id]/custom-domain`        | POST   | 3/min  | 60s    | `custom-domain-register` |
| `/api/workspaces/[id]/custom-domain`        | DELETE | 3/min  | 60s    | `custom-domain-remove`   |
| `/api/workspaces/[id]/custom-domain/verify` | POST   | 5/min  | 60s    | `custom-domain-verify`   |
| `/api/workspaces/[id]/email-addresses`      | GET    | 30/min | 60s    | `email-addr-list`        |
| `/api/workspaces/[id]/email-addresses`      | POST   | 10/min | 60s    | `email-addr-create`      |
| `/api/workspaces/[id]/email-addresses`      | DELETE | 10/min | 60s    | `email-addr-remove`      |

### FASE 4 — Bacheca (Announcements)

| Route                                      | Method | Limit  | Window | Key                    | Note                    |
| ------------------------------------------ | ------ | ------ | ------ | ---------------------- | ----------------------- |
| `/api/workspaces/[id]/announcements`       | GET    | 60/min | 60s    | `announcements-list`   |                         |
| `/api/workspaces/[id]/announcements`       | POST   | 20/ora | 3600s  | `announcements-create` | Key: `ws:{workspaceId}` |
| `/api/workspaces/[id]/announcements/[aid]` | GET    | 60/min | 60s    | `announcements-read`   | Include mark-read       |
| `/api/workspaces/[id]/announcements/[aid]` | PATCH  | 20/min | 60s    | `announcements-update` |                         |
| `/api/workspaces/[id]/announcements/[aid]` | DELETE | 10/min | 60s    | `announcements-delete` |                         |

### FASE 3 — Workspace Email Service

| Route                                | Limit  | Window | Key                    | Note                    |
| ------------------------------------ | ------ | ------ | ---------------------- | ----------------------- |
| `workspace-email-service.ts` (invio) | 10/min | 60s    | `workspace-email-send` | Key: `ws:{workspaceId}` |

Nota: il servizio email ha anche un **daily limit** da DB (`outreach_channel_config.daily_limit`, default 100/giorno) che funge da business rule, oltre al rate limit distribuito anti-burst.

### Altre route (pre-esistenti)

Le route del core (COD, AI chat, support, spedizioni, wallet, ecc.) usavano gia' `rateLimit()` prima di questo hardening. Totale: 29+ endpoint protetti.

## Razionale dei limiti

| Tipo operazione        | Range     | Motivazione                        |
| ---------------------- | --------- | ---------------------------------- |
| Lettura (GET)          | 30-60/min | Uso normale UI, permissivo         |
| Scrittura (POST/PATCH) | 3-20/min  | Protegge API esterne (Resend) e DB |
| Distruttiva (DELETE)   | 3-10/min  | Operazioni rare, limiti stretti    |
| Business critical      | 20/ora    | Annunci: previene spam             |

## Fail strategy

| Scenario                  | Comportamento                                   |
| ------------------------- | ----------------------------------------------- |
| Redis disponibile         | Rate limit distribuito (source: `redis`)        |
| Redis down/timeout        | Fallback in-memory (source: `memory`)           |
| Errore critico            | Fail-open, richiesta permessa (source: `error`) |
| DB check fallisce (email) | Fail-closed, invio bloccato                     |

**Nota:** Il fail-open del rate limiter e' intenzionale — preferiamo servire richieste piuttosto che bloccare utenti legittimi per un errore infra. Il daily limit email usa fail-closed perche' proteggere il budget Resend e' piu' critico.

## Test

Ogni route con rate limit ha un test 429 dedicato:

```
tests/unit/custom-domain-api.test.ts     → 7 test 429 (FASE 5)
tests/unit/announcements-api.test.ts     → 5 test 429 (FASE 4)
tests/unit/workspace-email-service.test.ts → mock rateLimit (FASE 3)
tests/unit/rate-limit.test.ts            → 17 test core utility
```

Pattern di test:

```typescript
mockRateLimit.mockResolvedValueOnce({
  allowed: false,
  remaining: 0,
  resetAt: Date.now() + 60000,
  source: 'redis',
});
// ... call route handler ...
expect(res.status).toBe(429);
```

## Storico

| Data        | Modifica                                                                                           |
| ----------- | -------------------------------------------------------------------------------------------------- |
| 2026-02-09  | Hardening FASI 2-5: aggiunto `rateLimit()` a 12 endpoint, migrato email da in-memory a distribuito |
| Pre-2026-02 | Rate limit gia' presente su 29+ route core (COD, AI chat, support, ecc.)                           |

---

_Last Updated: 2026-02-09_
_Status: Active_
_Maintainer: Engineering Team_
