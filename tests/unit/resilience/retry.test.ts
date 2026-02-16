/**
 * Test withRetry - FASE 2.1 Audit Enterprise
 *
 * Verifica retry con exponential backoff + jitter,
 * retryable vs non-retryable errors, feature flag.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, isRetryableError } from '@/lib/resilience/retry';

// Speed up tests: no real delays
vi.useFakeTimers({ shouldAdvanceTime: true });

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  delete process.env.RETRY_ENABLED;
});

describe('isRetryableError', () => {
  const defaultStatuses = [500, 502, 503, 504, 408, 429];

  it('ritorna true per errori di rete (ECONNRESET, ETIMEDOUT, ENOTFOUND)', () => {
    expect(isRetryableError({ code: 'ECONNRESET' }, defaultStatuses)).toBe(true);
    expect(isRetryableError({ code: 'ETIMEDOUT' }, defaultStatuses)).toBe(true);
    expect(isRetryableError({ code: 'ENOTFOUND' }, defaultStatuses)).toBe(true);
  });

  it('ritorna true per messaggi timeout/network', () => {
    expect(isRetryableError({ message: 'Request timeout exceeded' }, defaultStatuses)).toBe(true);
    expect(isRetryableError({ message: 'network error' }, defaultStatuses)).toBe(true);
  });

  it('ritorna true per status 5xx e 408/429', () => {
    expect(isRetryableError({ status: 500 }, defaultStatuses)).toBe(true);
    expect(isRetryableError({ status: 502 }, defaultStatuses)).toBe(true);
    expect(isRetryableError({ status: 503 }, defaultStatuses)).toBe(true);
    expect(isRetryableError({ response: { status: 504 } }, defaultStatuses)).toBe(true);
    expect(isRetryableError({ status: 429 }, defaultStatuses)).toBe(true);
  });

  it('ritorna false per errori 4xx (non retryable)', () => {
    expect(isRetryableError({ status: 400 }, defaultStatuses)).toBe(false);
    expect(isRetryableError({ status: 401 }, defaultStatuses)).toBe(false);
    expect(isRetryableError({ status: 404 }, defaultStatuses)).toBe(false);
    expect(isRetryableError({ status: 422 }, defaultStatuses)).toBe(false);
  });

  it('ritorna false per errori generici senza status/code', () => {
    expect(isRetryableError(new Error('generic error'), defaultStatuses)).toBe(false);
    expect(isRetryableError({ message: 'something went wrong' }, defaultStatuses)).toBe(false);
  });
});

describe('withRetry', () => {
  it('ritorna immediatamente su successo', async () => {
    const op = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(op, { maxRetries: 3 });
    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('retries su errore 500 e riesce al secondo tentativo', async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce({ status: 500, message: 'Internal Server Error' })
      .mockResolvedValue('recovered');

    const result = await withRetry(op, { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10 });
    expect(result).toBe('recovered');
    expect(op).toHaveBeenCalledTimes(2);
  });

  it('NON retries su errore 400 (non retryable)', async () => {
    const op = vi.fn().mockRejectedValue({ status: 400, message: 'Bad Request' });

    await expect(withRetry(op, { maxRetries: 3, baseDelayMs: 1 })).rejects.toEqual(
      expect.objectContaining({ status: 400 })
    );
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('rispetta maxRetries e lancia errore dopo tutti i tentativi', async () => {
    const op = vi.fn().mockRejectedValue({ status: 503, message: 'Service Unavailable' });

    await expect(withRetry(op, { maxRetries: 2, baseDelayMs: 1 })).rejects.toEqual(
      expect.objectContaining({ status: 503 })
    );
    // 1 tentativo iniziale + 2 retry = 3 chiamate totali
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('feature flag RETRY_ENABLED=false bypassa retry', async () => {
    process.env.RETRY_ENABLED = 'false';
    const op = vi.fn().mockRejectedValue({ status: 500, message: 'error' });

    await expect(withRetry(op, { maxRetries: 3 })).rejects.toEqual(
      expect.objectContaining({ status: 500 })
    );
    // Solo 1 tentativo, nessun retry
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('retries su errore di rete (ECONNRESET)', async () => {
    const op = vi
      .fn()
      .mockRejectedValueOnce({ code: 'ECONNRESET', message: 'Connection reset' })
      .mockResolvedValue('ok');

    const result = await withRetry(op, { maxRetries: 3, baseDelayMs: 1, maxDelayMs: 10 });
    expect(result).toBe('ok');
    expect(op).toHaveBeenCalledTimes(2);
  });
});

describe('withRetry - Struttura file', () => {
  it('esporta withRetry e isRetryableError', async () => {
    const mod = await import('@/lib/resilience/retry');
    expect(typeof mod.withRetry).toBe('function');
    expect(typeof mod.isRetryableError).toBe('function');
  });
});
