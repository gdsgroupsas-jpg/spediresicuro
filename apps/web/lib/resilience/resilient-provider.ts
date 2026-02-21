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
 * NON modifica l'adapter — sovrascrive i metodi con wrapper.
 */
export function withResilience(adapter: CourierAdapter, providerName: string): CourierAdapter {
  const cb = getCircuitBreaker(providerName);

  // Override createShipment (chiamata esterna critica)
  const originalCreateShipment = adapter.createShipment.bind(adapter);
  adapter.createShipment = async (data: any) => {
    return cb.execute(() =>
      withRetry(() => originalCreateShipment(data), {
        ...RETRY_DEFAULTS,
        operationName: `${providerName}.createShipment`,
      })
    );
  };

  // Override getTracking
  const originalGetTracking = adapter.getTracking.bind(adapter);
  adapter.getTracking = async (trackingNumber: string) => {
    return cb.execute(() =>
      withRetry(() => originalGetTracking(trackingNumber), {
        ...RETRY_DEFAULTS,
        operationName: `${providerName}.getTracking`,
      })
    );
  };

  // Override calculateQuote (se presente)
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

  // Override cancelShipment (se presente)
  if (adapter.cancelShipment) {
    const originalCancelShipment = adapter.cancelShipment.bind(adapter);
    adapter.cancelShipment = async (trackingNumber: string) => {
      return cb.execute(() =>
        withRetry(() => originalCancelShipment(trackingNumber), {
          ...RETRY_DEFAULTS,
          operationName: `${providerName}.cancelShipment`,
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
