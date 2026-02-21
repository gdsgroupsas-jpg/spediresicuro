# AUDIT ENTERPRISE - SpedisciSicuro

**Data**: 2026-02-16
**Stato**: IN PROGRESS (7.5/10 → target 9.2/10)
**Infra**: Vercel Pro ✅ | Supabase Pro ✅ (appena acquistato) | Upstash Redis Free ✅

---

## STATO FIX PRECEDENTI (tutti applicati)

| ID    | Fix                                           | File                               | Stato   |
| ----- | --------------------------------------------- | ---------------------------------- | ------- |
| P0-1  | Encryption fail-closed in produzione          | `lib/security/encryption.ts`       | ✅ DONE |
| P1-1  | Ownership UUID-based (rimosso fallback email) | `lib/couriers/factory.ts`          | ✅ DONE |
| P1-2  | Middleware zero DB query (onboarding da JWT)  | `middleware.ts`                    | ✅ DONE |
| P1-3  | Logging sanitizzato (SHA256 su ID)            | `lib/couriers/factory.ts`          | ✅ DONE |
| P1-4  | Idempotency lock per sync listini             | `actions/spedisci-online-rates.ts` | ✅ DONE |
| INFRA | Supabase Pro (risolve egress 2GB limit)       | Dashboard Supabase                 | ✅ DONE |

---

## FASE 1: FONDAMENTA (rischio zero, nessun file business toccato)

### 1.1 — Attivare Rate Limiter sulle Route Critiche

**Problema**: `lib/security/rate-limit.ts` è implementato e testato ma NON collegato a nessuna API route. Le write operations e l'auth non hanno protezione contro abuse/brute force.

**File da modificare**: Creare un helper e usarlo nelle route.

**Crea** `lib/security/rate-limit-middleware.ts`:

```typescript
/**
 * Rate Limit Middleware Helper per API Routes
 *
 * Wrapper che integra lib/security/rate-limit.ts nelle Next.js API routes.
 * Fail-open: se il rate limiter ha problemi, la request passa.
 *
 * Uso:
 *   import { withRateLimit } from '@/lib/security/rate-limit-middleware';
 *
 *   // All'inizio del handler:
 *   const rlResult = await withRateLimit(request, 'shipments-create', { limit: 60, windowSeconds: 60 });
 *   if (rlResult) return rlResult; // 429 già formattato
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, type RateLimitOptions } from '@/lib/security/rate-limit';
import { auth } from '@/lib/auth-config';

export async function withRateLimit(
  request: NextRequest,
  route: string,
  options: RateLimitOptions = {}
): Promise<NextResponse | null> {
  // Feature flag per disabilitare
  if (process.env.RATE_LIMIT_ENABLED === 'false') return null;

  try {
    // Identifica utente: userId da session, fallback su IP
    const session = await auth();
    const identifier =
      session?.user?.id ||
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.ip ||
      'anonymous';

    const result = await rateLimit(route, identifier, options);

    if (!result.allowed) {
      return NextResponse.json(
        {
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Troppe richieste. Riprova tra qualche secondo.',
          retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Remaining': String(result.remaining),
          },
        }
      );
    }

    return null; // Allowed
  } catch (error) {
    // Fail-open: non bloccare mai per errori del rate limiter
    console.warn('⚠️ [RATE-LIMIT-MW] Error, allowing request:', error);
    return null;
  }
}
```

**Applicare nelle route critiche** (aggiungere in testa al handler):

| Route                 | File                                  | Limite        | Motivo                  |
| --------------------- | ------------------------------------- | ------------- | ----------------------- |
| POST shipments/create | `app/api/shipments/create/route.ts`   | 60/min        | Write operation costosa |
| POST quotes/\*        | `app/api/quotes/*/route.ts`           | 120/min       | Chiama API esterne      |
| POST auth/login       | `app/api/auth/[...nextauth]/route.ts` | 10/min per IP | Brute force protection  |
| POST auth/register    | `app/api/auth/register/route.ts`      | 5/min per IP  | Spam protection         |
| POST ai/agent-chat    | `app/api/ai/agent-chat/route.ts`      | 20/min        | LLM API costosa         |

**Esempio di applicazione** (prima riga del handler):

```typescript
const rlResult = await withRateLimit(request, 'shipments-create', { limit: 60, windowSeconds: 60 });
if (rlResult) return rlResult;
```

**Env var**: `RATE_LIMIT_ENABLED=true` (default true, settare false per disabilitare)

**Test da scrivere**: `tests/unit/security/rate-limit-middleware.test.ts`

- Request allowed sotto il limite
- Request bloccata sopra il limite (429 con headers corretti)
- Fail-open se Redis non disponibile
- Feature flag RATE_LIMIT_ENABLED=false bypassa

---

### 1.2 — Introdurre Log Levels

**Problema**: `factory.ts` e le actions usano `console.log` per tutto. In produzione genera ~100K righe/mese di log non necessari (config loaded, contract mapping keys, ecc.). Vercel filtra per livello — basta usare i livelli corretti.

**Regola**:
| Livello | Quando usarlo | Visibile in prod |
|---------|--------------|-----------------|
| `console.debug` | Dettagli tecnici (config loaded, mapping keys) | No (filtrato) |
| `console.info` | Operazioni business significative (spedizione creata) | Sì |
| `console.warn` | Anomalie non bloccanti (fallback usato, legacy data) | Sì |
| `console.error` | Errori che richiedono intervento | Sì |

**File da modificare**:

**`lib/couriers/factory.ts`** — cambiare i seguenti log:

- Riga ~161 `console.log('🔍 [FACTORY] Fallback query...')` → `console.debug`
- Riga ~175 `console.log('✅ [FACTORY] Trovata config personale...')` → `console.debug`
- Riga ~194 `console.log('✅ [FACTORY] Trovata config assegnata...')` → `console.debug`
- Riga ~212 `console.log('ℹ️ [FACTORY] Nessuna config personale...')` → `console.debug`
- Riga ~310 `console.log('🔐 [FACTORY] API key è criptata...')` → `console.debug`
- Riga ~342 `console.log('🔑 [FACTORY] Spedisci.Online config loaded...')` → `console.debug`
- Riga ~390 `console.log('🔐 [FACTORY] Poste API key...')` → `console.debug`

**`lib/security/encryption.ts`** — cambiare:

- Riga ~201 `console.log('✅ [ENCRYPTION] Decrypt riuscito...')` → `console.debug`
- Riga ~230 `console.log('✅ [ENCRYPTION] Decrypt riuscito (chiave legacy)...')` → `console.debug`

**Regola generale per tutte le actions/**: ogni `console.log` che descrive il "percorso felice" diventa `console.debug`. Solo anomalie e operazioni business restano `console.info` o superiore.

**Nessun test richiesto**: è solo un cambio di livello log, non di logica.

---

### 1.3 — Verificare Sentry Performance Monitoring

**Problema**: `sentry.server.config.ts` ha tracesSampleRate al 10% e filtra health/cron. Ma non c'è `sentry.client.config.ts` — il frontend non ha performance monitoring.

**Crea** `sentry.client.config.ts`:

```typescript
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Performance Monitoring: 5% di transazioni tracciate (client = più volume)
  tracesSampleRate: 0.05,

  // Replay: cattura sessioni su errore (molto utile per debug UX)
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0.01, // 1% sessioni normali

  environment: process.env.NODE_ENV || 'development',
  release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

  // Ignora errori di rete e browser noise
  ignoreErrors: ['ResizeObserver loop', 'Network request failed', 'Load failed', 'AbortError'],
});
```

**Env var da aggiungere su Vercel**: `NEXT_PUBLIC_SENTRY_DSN` (stesso valore di `SENTRY_DSN`)

---

## FASE 2: RESILIENZA (nuovi file, pattern decorator)

### 2.1 — Creare withRetry() Generico per API Esterne

**Problema**: Il retry esiste solo per wallet lock contention (`lib/wallet/retry.ts`). Le chiamate a Spedisci.Online e Poste non hanno retry. Un timeout di rete di 2s fa fallire una spedizione che al secondo tentativo andrebbe a buon fine.

**Crea** `lib/resilience/retry.ts`:

```typescript
/**
 * Generic Retry Wrapper per chiamate API esterne
 *
 * REGOLE:
 * - Retry SOLO su errori transienti (5xx, timeout, network error)
 * - MAI retry su 4xx (bad request, unauthorized, not found)
 * - Backoff esponenziale con jitter per evitare thundering herd
 * - Feature flag: RETRY_ENABLED env var
 *
 * DESIGN: Pattern identico a lib/wallet/retry.ts ma per HTTP
 */

export interface RetryOptions {
  maxRetries?: number; // Default: 3
  baseDelayMs?: number; // Default: 100
  maxDelayMs?: number; // Default: 5000
  operationName?: string; // Per logging
  retryableStatuses?: number[]; // Default: [500, 502, 503, 504, 408, 429]
}

export function isRetryableError(error: any, retryableStatuses: number[]): boolean {
  // Network errors (fetch failed, timeout)
  if (error?.code === 'ECONNRESET' || error?.code === 'ETIMEDOUT' || error?.code === 'ENOTFOUND') {
    return true;
  }
  if (error?.message?.includes('timeout') || error?.message?.includes('network')) {
    return true;
  }
  // Axios-style errors
  const status = error?.response?.status || error?.status;
  if (status && retryableStatuses.includes(status)) {
    return true;
  }
  return false;
}

/**
 * Calcola delay con exponential backoff + jitter
 * jitter evita thundering herd quando multipli client retryano insieme
 */
function calculateDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseDelayMs;
  return Math.min(exponentialDelay + jitter, maxDelayMs);
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  // Feature flag
  if (process.env.RETRY_ENABLED === 'false') {
    return operation();
  }

  const {
    maxRetries = 3,
    baseDelayMs = 100,
    maxDelayMs = 5000,
    operationName = 'api_call',
    retryableStatuses = [500, 502, 503, 504, 408, 429],
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();

      if (attempt > 0) {
        console.info(
          `✅ [RETRY] ${operationName} succeeded on attempt ${attempt + 1}/${maxRetries + 1}`
        );
      }

      return result;
    } catch (error: any) {
      lastError = error;

      const isRetryable = isRetryableError(error, retryableStatuses);
      const isLastAttempt = attempt === maxRetries;

      if (!isRetryable || isLastAttempt) {
        if (attempt > 0) {
          console.error(`❌ [RETRY] ${operationName} failed after ${attempt + 1} attempts`, {
            error: error?.message,
            status: error?.response?.status || error?.status,
            retryable: isRetryable,
          });
        }
        throw error;
      }

      const delay = calculateDelay(attempt, baseDelayMs, maxDelayMs);
      console.warn(
        `⚠️ [RETRY] ${operationName} attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${Math.round(delay)}ms`,
        { error: error?.message, status: error?.response?.status || error?.status }
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
```

**Env var**: `RETRY_ENABLED=true` (default true, settare false per disabilitare)

**Test da scrivere**: `tests/unit/resilience/retry.test.ts`

- Ritorna immediatamente su successo
- Retry su 500/502/503, successo al secondo tentativo
- NON retry su 400/401/404
- Rispetta maxRetries
- Feature flag RETRY_ENABLED=false bypassa
- Backoff delay cresce esponenzialmente

---

### 2.2 — Implementare Circuit Breaker con Upstash Redis

**Problema**: Se Spedisci.Online va giù per 10 minuti, ogni tentativo di spedizione fa una chiamata che va in timeout (30s). Con 50 utenti attivi, si accumulano decine di richieste appese che saturano le serverless function.

**Crea** `lib/resilience/circuit-breaker.ts`:

```typescript
/**
 * Circuit Breaker per API Esterne - Stato in Upstash Redis
 *
 * STATI:
 * - CLOSED: normale, le richieste passano
 * - OPEN: provider giù, le richieste falliscono immediatamente (no timeout)
 * - HALF_OPEN: dopo cooldown, una singola richiesta di test passa
 *
 * STORAGE: Upstash Redis (condiviso tra tutte le serverless function Vercel)
 * FALLBACK: In-memory se Redis non disponibile
 *
 * Feature flag: CIRCUIT_BREAKER_ENABLED env var
 *
 * CONFIGURAZIONE PER PROVIDER:
 * - failureThreshold: N fallimenti consecutivi per aprire il circuito
 * - cooldownMs: tempo in OPEN prima di passare a HALF_OPEN
 * - successThreshold: N successi in HALF_OPEN per chiudere il circuito
 */

import { getRedis } from '@/lib/db/redis';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerOptions {
  name: string; // es. 'spedisci_online', 'poste'
  failureThreshold?: number; // Default: 5
  cooldownMs?: number; // Default: 60000 (1 minuto)
  successThreshold?: number; // Default: 2
}

interface CircuitData {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailureAt: number;
  openedAt: number;
}

const REDIS_PREFIX = 'cb:';
const DEFAULT_FAILURE_THRESHOLD = 5;
const DEFAULT_COOLDOWN_MS = 60_000;
const DEFAULT_SUCCESS_THRESHOLD = 2;

// In-memory fallback per quando Redis non è disponibile
const inMemoryCircuits = new Map<string, CircuitData>();

function getDefaultCircuitData(): CircuitData {
  return { state: 'CLOSED', failures: 0, successes: 0, lastFailureAt: 0, openedAt: 0 };
}

async function getCircuitData(name: string): Promise<CircuitData> {
  const redis = getRedis();
  if (redis) {
    try {
      const data = await redis.get(`${REDIS_PREFIX}${name}`);
      if (data && typeof data === 'object') return data as CircuitData;
    } catch {
      /* fallback to in-memory */
    }
  }
  return inMemoryCircuits.get(name) || getDefaultCircuitData();
}

async function setCircuitData(name: string, data: CircuitData): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      // TTL: 10 minuti (auto-cleanup se non usato)
      await redis.set(`${REDIS_PREFIX}${name}`, data, { ex: 600 });
    } catch {
      /* fallback */
    }
  }
  inMemoryCircuits.set(name, data);
}

export class CircuitBreaker {
  private name: string;
  private failureThreshold: number;
  private cooldownMs: number;
  private successThreshold: number;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? DEFAULT_FAILURE_THRESHOLD;
    this.cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS;
    this.successThreshold = options.successThreshold ?? DEFAULT_SUCCESS_THRESHOLD;
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Feature flag
    if (process.env.CIRCUIT_BREAKER_ENABLED === 'false') {
      return operation();
    }

    const circuit = await getCircuitData(this.name);
    const now = Date.now();

    // OPEN: rifiuta immediatamente, check se è ora di HALF_OPEN
    if (circuit.state === 'OPEN') {
      const elapsed = now - circuit.openedAt;
      if (elapsed < this.cooldownMs) {
        console.warn(
          `🔴 [CB:${this.name}] OPEN - request rejected (cooldown ${Math.round((this.cooldownMs - elapsed) / 1000)}s remaining)`
        );
        throw new CircuitOpenError(this.name, this.cooldownMs - elapsed);
      }
      // Cooldown scaduto → HALF_OPEN
      circuit.state = 'HALF_OPEN';
      circuit.successes = 0;
      await setCircuitData(this.name, circuit);
      console.info(`🟡 [CB:${this.name}] Transitioned to HALF_OPEN`);
    }

    // CLOSED o HALF_OPEN: esegui operazione
    try {
      const result = await operation();
      await this.onSuccess(circuit);
      return result;
    } catch (error) {
      await this.onFailure(circuit, now);
      throw error;
    }
  }

  private async onSuccess(circuit: CircuitData): Promise<void> {
    if (circuit.state === 'HALF_OPEN') {
      circuit.successes++;
      if (circuit.successes >= this.successThreshold) {
        circuit.state = 'CLOSED';
        circuit.failures = 0;
        circuit.successes = 0;
        console.info(`🟢 [CB:${this.name}] HALF_OPEN → CLOSED (provider recovered)`);
      }
    } else {
      // CLOSED: reset failures on success
      circuit.failures = 0;
    }
    await setCircuitData(this.name, circuit);
  }

  private async onFailure(circuit: CircuitData, now: number): Promise<void> {
    circuit.failures++;
    circuit.lastFailureAt = now;

    if (circuit.state === 'HALF_OPEN') {
      // Fallimento in HALF_OPEN → torna OPEN
      circuit.state = 'OPEN';
      circuit.openedAt = now;
      console.warn(`🔴 [CB:${this.name}] HALF_OPEN → OPEN (test request failed)`);
    } else if (circuit.failures >= this.failureThreshold) {
      circuit.state = 'OPEN';
      circuit.openedAt = now;
      console.warn(`🔴 [CB:${this.name}] CLOSED → OPEN after ${circuit.failures} failures`);
    }

    await setCircuitData(this.name, circuit);
  }

  /** Stato corrente (per health check / dashboard) */
  async getState(): Promise<{ state: CircuitState; failures: number }> {
    const circuit = await getCircuitData(this.name);
    return { state: circuit.state, failures: circuit.failures };
  }

  /** Reset manuale (per admin/debug) */
  async reset(): Promise<void> {
    await setCircuitData(this.name, getDefaultCircuitData());
    console.info(`🔄 [CB:${this.name}] Manually reset to CLOSED`);
  }
}

export class CircuitOpenError extends Error {
  public retryAfterMs: number;
  public provider: string;

  constructor(provider: string, retryAfterMs: number) {
    super(
      `Servizio ${provider} temporaneamente non disponibile. Riprova tra ${Math.ceil(retryAfterMs / 1000)} secondi.`
    );
    this.name = 'CircuitOpenError';
    this.provider = provider;
    this.retryAfterMs = retryAfterMs;
  }
}
```

**Env var**: `CIRCUIT_BREAKER_ENABLED=true` (default true, settare false per disabilitare)

**Test da scrivere**: `tests/unit/resilience/circuit-breaker.test.ts`

- CLOSED: request passano normalmente
- CLOSED → OPEN dopo N failures consecutive
- OPEN: request rifiutate con CircuitOpenError
- OPEN → HALF_OPEN dopo cooldown
- HALF_OPEN → CLOSED dopo N successi
- HALF_OPEN → OPEN su failure
- Feature flag disabilita
- Fallback in-memory se Redis non disponibile

---

### 2.3 — Creare Resilient Provider Wrapper

**Problema**: Applicare retry + circuit breaker ai courier adapter senza modificare la business logic degli adapter stessi.

**Crea** `lib/resilience/resilient-provider.ts`:

```typescript
/**
 * Resilient Provider Wrapper
 *
 * Avvolge un CourierAdapter con retry + circuit breaker.
 * Pattern Decorator: stessa interfaccia, comportamento aggiunto.
 * Non modifica gli adapter esistenti.
 */

import { CourierAdapter } from '@/lib/adapters/couriers/base';
import { CircuitBreaker } from './circuit-breaker';
import { withRetry, type RetryOptions } from './retry';
import type { CreateShipmentInput, Shipment } from '@/types/shipments';

// Circuit breaker instances (one per provider, shared across requests)
const circuitBreakers = new Map<string, CircuitBreaker>();

function getCircuitBreaker(providerName: string): CircuitBreaker {
  if (!circuitBreakers.has(providerName)) {
    circuitBreakers.set(
      providerName,
      new CircuitBreaker({
        name: providerName,
        failureThreshold: 5,
        cooldownMs: 60_000,
        successThreshold: 2,
      })
    );
  }
  return circuitBreakers.get(providerName)!;
}

const RETRY_DEFAULTS: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 100,
  maxDelayMs: 5000,
};

/**
 * Wrappa le chiamate esterne di un adapter con resilienza.
 * NON modifica l'adapter — crea un proxy.
 */
export function withResilience(adapter: CourierAdapter, providerName: string): CourierAdapter {
  const cb = getCircuitBreaker(providerName);

  // Override dei metodi che fanno chiamate esterne
  const originalCreateShipment = adapter.createShipment.bind(adapter);
  adapter.createShipment = async (data: CreateShipmentInput) => {
    return cb.execute(() =>
      withRetry(() => originalCreateShipment(data), {
        ...RETRY_DEFAULTS,
        operationName: `${providerName}.createShipment`,
      })
    );
  };

  if (adapter.getTracking) {
    const originalGetTracking = adapter.getTracking.bind(adapter);
    adapter.getTracking = async (trackingNumber: string) => {
      return cb.execute(() =>
        withRetry(() => originalGetTracking(trackingNumber), {
          ...RETRY_DEFAULTS,
          operationName: `${providerName}.getTracking`,
        })
      );
    };
  }

  if (adapter.calculateQuote) {
    const originalCalculateQuote = adapter.calculateQuote.bind(adapter);
    adapter.calculateQuote = async (data: any) => {
      return cb.execute(() =>
        withRetry(() => originalCalculateQuote(data), {
          ...RETRY_DEFAULTS,
          operationName: `${providerName}.calculateQuote`,
        })
      );
    };
  }

  return adapter;
}

/** Per health check endpoint: stato di tutti i circuit breaker */
export async function getAllCircuitStates(): Promise<Record<string, any>> {
  const states: Record<string, any> = {};
  for (const [name, cb] of circuitBreakers) {
    states[name] = await cb.getState();
  }
  return states;
}
```

**File da modificare**: `lib/couriers/factory.ts`

Nella funzione `getShippingProvider()` (riga ~260), dopo `instantiateProviderFromConfig`, avvolgere con resilienza:

```typescript
// PRIMA (riga ~273):
return instantiateProviderFromConfig(providerId, config);

// DOPO:
import { withResilience } from '@/lib/resilience/resilient-provider';

const adapter = instantiateProviderFromConfig(providerId, config);
if (!adapter) return null;
return withResilience(adapter, providerId);
```

**Questo è l'UNICO punto di modifica nel codice esistente.** Una riga cambiata. Se qualcosa va storto, si toglie la riga e si torna allo stato precedente.

---

## FASE 3: OBSERVABILITY (configurazione, zero rischio)

### 3.1 — Custom Sentry Metrics per Business KPI

**Problema**: Sentry cattura errori ma non metriche business. Non si sa il tasso di successo delle spedizioni per provider, né il tempo medio di risposta delle API esterne.

**Crea** `lib/observability/metrics.ts`:

```typescript
/**
 * Business Metrics via Sentry Custom Instrumentation
 *
 * Traccia KPI di business come custom transactions e breadcrumbs.
 * Zero dipendenze aggiuntive — usa Sentry già integrato.
 */

import * as Sentry from '@sentry/nextjs';

export function trackShipmentCreated(provider: string, durationMs: number, success: boolean) {
  Sentry.metrics.increment('shipment.created', 1, {
    tags: { provider, status: success ? 'success' : 'failure' },
  });
  Sentry.metrics.distribution('shipment.duration_ms', durationMs, {
    tags: { provider },
    unit: 'millisecond',
  });
}

export function trackExternalApiCall(
  provider: string,
  endpoint: string,
  durationMs: number,
  statusCode: number
) {
  Sentry.metrics.distribution('external_api.duration_ms', durationMs, {
    tags: { provider, endpoint, status_group: `${Math.floor(statusCode / 100)}xx` },
    unit: 'millisecond',
  });
  if (statusCode >= 500) {
    Sentry.metrics.increment('external_api.server_error', 1, {
      tags: { provider, endpoint },
    });
  }
}

export function trackCircuitBreakerState(provider: string, state: string) {
  Sentry.metrics.gauge('circuit_breaker.state', state === 'OPEN' ? 1 : 0, {
    tags: { provider },
  });
}

export function trackWalletLowBalance(userId: string, balance: number) {
  if (balance < 10) {
    Sentry.metrics.increment('wallet.low_balance', 1, {
      tags: { threshold: balance < 0 ? 'negative' : 'below_10' },
    });
  }
}
```

**Dove usare** (aggiungere nelle actions esistenti come singole righe):

- `actions/create-shipment.ts`: dopo successo/fallimento chiamare `trackShipmentCreated()`
- `lib/resilience/retry.ts`: nel wrapper, misurare durata e chiamare `trackExternalApiCall()`
- `lib/resilience/circuit-breaker.ts`: nei cambi di stato chiamare `trackCircuitBreakerState()`

---

### 3.2 — Health Check Completo

**File da modificare**: `app/api/health/route.ts`

L'attuale health check verifica solo Supabase. Deve verificare anche Redis e lo stato dei circuit breaker.

```typescript
// Aggiungere dopo il check Supabase esistente:

// Check Redis
import { getRedis } from '@/lib/db/redis';
import { getAllCircuitStates } from '@/lib/resilience/resilient-provider';

// Dentro GET():
const redis = getRedis();
if (redis) {
  try {
    await redis.ping();
    healthStatus.redis = { working: true, message: 'Redis connesso' };
  } catch (error: any) {
    healthStatus.redis = { working: false, message: error.message };
    healthStatus.status = 'degraded';
  }
} else {
  healthStatus.redis = { working: false, message: 'Redis non configurato' };
}

// Circuit breaker states
try {
  healthStatus.circuitBreakers = await getAllCircuitStates();
} catch {
  healthStatus.circuitBreakers = {};
}

// Aggiungere uptime
healthStatus.uptime = process.uptime();
healthStatus.version = process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'dev';
```

---

## ENV VARS DA AGGIUNGERE SU VERCEL

| Variabile                 | Valore                 | Descrizione                    |
| ------------------------- | ---------------------- | ------------------------------ |
| `RATE_LIMIT_ENABLED`      | `true`                 | Feature flag rate limiting     |
| `RETRY_ENABLED`           | `true`                 | Feature flag retry API esterne |
| `CIRCUIT_BREAKER_ENABLED` | `true`                 | Feature flag circuit breaker   |
| `NEXT_PUBLIC_SENTRY_DSN`  | (stesso di SENTRY_DSN) | Sentry client-side             |

In caso di problemi, settare a `false` la feature flag corrispondente e fare redeploy. **Rollback in 30 secondi, zero codice da cambiare.**

---

## NUOVI FILE DA CREARE (nessun file esistente cancellato)

```
lib/
  security/
    rate-limit-middleware.ts          ← FASE 1.1
  resilience/
    retry.ts                          ← FASE 2.1
    circuit-breaker.ts                ← FASE 2.2
    resilient-provider.ts             ← FASE 2.3
  observability/
    metrics.ts                        ← FASE 3.1
sentry.client.config.ts              ← FASE 1.3

tests/
  unit/
    security/
      rate-limit-middleware.test.ts   ← FASE 1.1
    resilience/
      retry.test.ts                   ← FASE 2.1
      circuit-breaker.test.ts         ← FASE 2.2
```

## FILE ESISTENTI DA MODIFICARE (modifiche minime)

| File                                | Modifica                                    | Rischio                              |
| ----------------------------------- | ------------------------------------------- | ------------------------------------ |
| `lib/couriers/factory.ts`           | 1 riga: wrap adapter con `withResilience()` | Basso (togliamo 1 riga per rollback) |
| `lib/couriers/factory.ts`           | ~10 righe: `console.log` → `console.debug`  | Zero                                 |
| `lib/security/encryption.ts`        | ~3 righe: `console.log` → `console.debug`   | Zero                                 |
| `app/api/health/route.ts`           | ~20 righe: aggiunta check Redis + CB states | Zero                                 |
| `app/api/shipments/create/route.ts` | 2 righe: rate limit check in testa          | Zero (fail-open)                     |
| `app/api/quotes/*/route.ts`         | 2 righe: rate limit check in testa          | Zero (fail-open)                     |
| `app/api/auth/register/route.ts`    | 2 righe: rate limit check in testa          | Zero (fail-open)                     |

---

## CHECKLIST PRE-DEPLOY PER OGNI FASE

- [ ] `npm run type-check` passa
- [ ] `npm run test:unit` passa (tutti i 185+ test)
- [ ] `npm run build` passa
- [ ] `npm run test:e2e` security suite passa
- [ ] Feature flag testato ON e OFF su Vercel Preview
- [ ] `git diff --stat` conferma: nessun file di business logic core modificato
- [ ] Smoke test su staging: crea spedizione, controlla tracking, verifica wallet

---

## SCORING

| Area          | Prima      | Dopo Fase 1 | Dopo Fase 2 | Dopo Fase 3 |
| ------------- | ---------- | ----------- | ----------- | ----------- |
| Security      | 8/10       | 8.5/10      | 8.5/10      | 8.5/10      |
| Resilienza    | 5/10       | 5/10        | 9/10        | 9/10        |
| Observability | 6/10       | 7/10        | 7.5/10      | 9/10        |
| Performance   | 8/10       | 8.5/10      | 8.5/10      | 9/10        |
| **Totale**    | **7.5/10** | **7.8/10**  | **8.5/10**  | **9.2/10**  |
