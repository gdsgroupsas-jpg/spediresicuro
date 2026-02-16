/**
 * Test Circuit Breaker - FASE 2.2 Audit Enterprise
 *
 * Verifica transizioni di stato CLOSED → OPEN → HALF_OPEN → CLOSED,
 * fallback in-memory, feature flag.
 */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock Redis prima dell'import
vi.mock('@/lib/db/redis', () => ({
  getRedis: vi.fn().mockReturnValue(null), // Forza in-memory fallback
}));

import { CircuitBreaker, CircuitOpenError } from '@/lib/resilience/circuit-breaker';

beforeEach(() => {
  vi.restoreAllMocks();
  delete process.env.CIRCUIT_BREAKER_ENABLED;
});

describe('CircuitBreaker - Stato CLOSED', () => {
  it('le richieste passano normalmente', async () => {
    const cb = new CircuitBreaker({ name: 'test-closed' });
    const result = await cb.execute(() => Promise.resolve('ok'));
    expect(result).toBe('ok');
  });

  it('lo stato iniziale e CLOSED con 0 failures', async () => {
    const cb = new CircuitBreaker({ name: 'test-state' });
    const state = await cb.getState();
    expect(state.state).toBe('CLOSED');
    expect(state.failures).toBe(0);
  });

  it('reset failures su successo', async () => {
    const cb = new CircuitBreaker({ name: 'test-reset', failureThreshold: 5 });

    // 3 fallimenti
    for (let i = 0; i < 3; i++) {
      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    }
    const afterFail = await cb.getState();
    expect(afterFail.failures).toBe(3);

    // 1 successo → reset
    await cb.execute(() => Promise.resolve('ok'));
    const afterSuccess = await cb.getState();
    expect(afterSuccess.failures).toBe(0);
  });
});

describe('CircuitBreaker - Transizione CLOSED → OPEN', () => {
  it('apre il circuito dopo N failures consecutive', async () => {
    const cb = new CircuitBreaker({ name: 'test-open', failureThreshold: 3 });

    for (let i = 0; i < 3; i++) {
      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    }

    const state = await cb.getState();
    expect(state.state).toBe('OPEN');
    expect(state.failures).toBe(3);
  });
});

describe('CircuitBreaker - Stato OPEN', () => {
  it('rifiuta richieste con CircuitOpenError', async () => {
    const cb = new CircuitBreaker({
      name: 'test-open-reject',
      failureThreshold: 2,
      cooldownMs: 60000,
    });

    // Apri il circuito
    for (let i = 0; i < 2; i++) {
      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    }

    // Prossima richiesta deve essere rifiutata
    try {
      await cb.execute(() => Promise.resolve('should not reach'));
      expect.fail('Dovrebbe lanciare CircuitOpenError');
    } catch (error) {
      expect(error).toBeInstanceOf(CircuitOpenError);
      expect((error as CircuitOpenError).provider).toBe('test-open-reject');
      expect((error as CircuitOpenError).retryAfterMs).toBeGreaterThan(0);
    }
  });
});

describe('CircuitBreaker - Transizione OPEN → HALF_OPEN', () => {
  it('passa a HALF_OPEN dopo il cooldown', async () => {
    const cb = new CircuitBreaker({
      name: 'test-halfopen',
      failureThreshold: 2,
      cooldownMs: 100, // Cooldown molto breve per test
      successThreshold: 1,
    });

    // Apri il circuito
    for (let i = 0; i < 2; i++) {
      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    }

    // Aspetta il cooldown
    await new Promise((r) => setTimeout(r, 150));

    // Ora dovrebbe passare (HALF_OPEN)
    const result = await cb.execute(() => Promise.resolve('recovered'));
    expect(result).toBe('recovered');
  });
});

describe('CircuitBreaker - Transizione HALF_OPEN → CLOSED', () => {
  it('chiude dopo N successi in HALF_OPEN', async () => {
    const cb = new CircuitBreaker({
      name: 'test-recovery',
      failureThreshold: 2,
      cooldownMs: 50,
      successThreshold: 2,
    });

    // Apri
    for (let i = 0; i < 2; i++) {
      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    }

    await new Promise((r) => setTimeout(r, 100));

    // 2 successi in HALF_OPEN → CLOSED
    await cb.execute(() => Promise.resolve('ok'));
    await cb.execute(() => Promise.resolve('ok'));

    const state = await cb.getState();
    expect(state.state).toBe('CLOSED');
    expect(state.failures).toBe(0);
  });
});

describe('CircuitBreaker - HALF_OPEN → OPEN su fallimento', () => {
  it('torna OPEN se fallisce in HALF_OPEN', async () => {
    const cb = new CircuitBreaker({
      name: 'test-halfopen-fail',
      failureThreshold: 2,
      cooldownMs: 50,
      successThreshold: 2,
    });

    // Apri
    for (let i = 0; i < 2; i++) {
      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    }

    await new Promise((r) => setTimeout(r, 100));

    // Fallimento in HALF_OPEN → torna OPEN
    await cb.execute(() => Promise.reject(new Error('still failing'))).catch(() => {});

    const state = await cb.getState();
    expect(state.state).toBe('OPEN');
  });
});

describe('CircuitBreaker - Feature Flag', () => {
  it('CIRCUIT_BREAKER_ENABLED=false bypassa completamente', async () => {
    process.env.CIRCUIT_BREAKER_ENABLED = 'false';
    const cb = new CircuitBreaker({ name: 'test-flag', failureThreshold: 1 });

    // Anche con fallimento, non apre il circuito
    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});

    // Deve ancora passare (feature disabilitata)
    const result = await cb.execute(() => Promise.resolve('bypassed'));
    expect(result).toBe('bypassed');
  });
});

describe('CircuitBreaker - Reset manuale', () => {
  it('reset riporta a CLOSED', async () => {
    const cb = new CircuitBreaker({ name: 'test-manual-reset', failureThreshold: 2 });

    // Apri
    for (let i = 0; i < 2; i++) {
      await cb.execute(() => Promise.reject(new Error('fail'))).catch(() => {});
    }
    expect((await cb.getState()).state).toBe('OPEN');

    // Reset
    await cb.reset();
    const state = await cb.getState();
    expect(state.state).toBe('CLOSED');
    expect(state.failures).toBe(0);
  });
});

describe('CircuitBreaker - In-memory fallback', () => {
  it('funziona senza Redis (in-memory)', async () => {
    // Redis e' gia' mockato come null
    const cb = new CircuitBreaker({ name: 'test-inmemory' });
    const result = await cb.execute(() => Promise.resolve('works'));
    expect(result).toBe('works');
  });
});
