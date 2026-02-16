/**
 * Circuit Breaker per API Esterne - Stato in Upstash Redis
 *
 * STATI:
 * - CLOSED: normale, le richieste passano
 * - OPEN: provider giu', le richieste falliscono immediatamente (no timeout)
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

// In-memory fallback per quando Redis non e' disponibile
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

    // OPEN: rifiuta immediatamente, check se e' ora di HALF_OPEN
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
