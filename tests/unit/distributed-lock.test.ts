/**
 * Unit Tests: Distributed Lock
 *
 * Verifica fail-open/fail-closed, observability (trackError + Sentry metrics),
 * e comportamento corretto del lock distribuito.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock delle dipendenze PRIMA degli import
const mockGetRedis = vi.fn();
vi.mock('@/lib/db/redis', () => ({
  getRedis: (...args: unknown[]) => mockGetRedis(...args),
}));

const mockTrackError = vi.fn();
vi.mock('@/lib/error-tracker', () => ({
  trackError: (...args: unknown[]) => mockTrackError(...args),
}));

const mockSentryMetricsCount = vi.fn();
vi.mock('@sentry/nextjs', () => ({
  metrics: {
    count: (...args: unknown[]) => mockSentryMetricsCount(...args),
  },
}));

import {
  acquireAutomationLock,
  releaseAutomationLock,
  __setFailModeForTesting,
  __resetFailModeForTesting,
} from '@/lib/automations/distributed-lock';

describe('Distributed Lock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetFailModeForTesting();
  });

  afterEach(() => {
    __resetFailModeForTesting();
  });

  describe('acquireAutomationLock', () => {
    it('dovrebbe acquisire lock quando Redis ritorna OK', async () => {
      const mockRedis = { set: vi.fn().mockResolvedValue('OK'), del: vi.fn() };
      mockGetRedis.mockReturnValue(mockRedis);

      const result = await acquireAutomationLock('test-automation');

      expect(result).toBe(true);
      expect(mockRedis.set).toHaveBeenCalledWith(
        'automation:lock:test-automation',
        expect.any(String),
        { nx: true, ex: 300 }
      );
    });

    it('dovrebbe ritornare false quando lock gia in uso', async () => {
      const mockRedis = { set: vi.fn().mockResolvedValue(null), del: vi.fn() };
      mockGetRedis.mockReturnValue(mockRedis);

      const result = await acquireAutomationLock('test-automation');

      expect(result).toBe(false);
    });

    it('dovrebbe rispettare TTL custom', async () => {
      const mockRedis = { set: vi.fn().mockResolvedValue('OK'), del: vi.fn() };
      mockGetRedis.mockReturnValue(mockRedis);

      await acquireAutomationLock('test-automation', 600);

      expect(mockRedis.set).toHaveBeenCalledWith(
        'automation:lock:test-automation',
        expect.any(String),
        { nx: true, ex: 600 }
      );
    });

    // ─── FAIL-OPEN (default) ───

    it('dovrebbe fare fail-open quando Redis non disponibile (default)', async () => {
      mockGetRedis.mockReturnValue(null);

      const result = await acquireAutomationLock('test-automation');

      expect(result).toBe(true);
    });

    it('dovrebbe fare fail-open su errore Redis (default)', async () => {
      const mockRedis = {
        set: vi.fn().mockRejectedValue(new Error('Connection refused')),
        del: vi.fn(),
      };
      mockGetRedis.mockReturnValue(mockRedis);

      const result = await acquireAutomationLock('test-automation');

      expect(result).toBe(true);
    });

    // ─── FAIL-CLOSED (opt-in) ───

    it('dovrebbe fare fail-closed quando LOCK_FAIL_MODE=closed e Redis non disponibile', async () => {
      __setFailModeForTesting('closed');
      mockGetRedis.mockReturnValue(null);

      const result = await acquireAutomationLock('test-automation');

      expect(result).toBe(false);
    });

    it('dovrebbe fare fail-closed su errore Redis quando LOCK_FAIL_MODE=closed', async () => {
      __setFailModeForTesting('closed');
      const mockRedis = {
        set: vi.fn().mockRejectedValue(new Error('Connection refused')),
        del: vi.fn(),
      };
      mockGetRedis.mockReturnValue(mockRedis);

      const result = await acquireAutomationLock('test-automation');

      expect(result).toBe(false);
    });

    // ─── OBSERVABILITY ───

    it('dovrebbe chiamare trackError quando Redis non disponibile', async () => {
      mockGetRedis.mockReturnValue(null);

      await acquireAutomationLock('test-automation');

      expect(mockTrackError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          context: 'DistributedLock',
          metadata: expect.objectContaining({
            slug: 'test-automation',
            reason: 'redis_unavailable',
          }),
        })
      );
    });

    it('dovrebbe chiamare Sentry.metrics.count su fail-open per Redis non disponibile', async () => {
      mockGetRedis.mockReturnValue(null);

      await acquireAutomationLock('test-automation');

      expect(mockSentryMetricsCount).toHaveBeenCalledWith(
        'distributed_lock.fail_open',
        1,
        expect.objectContaining({
          attributes: expect.objectContaining({
            slug: 'test-automation',
            reason: 'redis_unavailable',
          }),
        })
      );
    });

    it('dovrebbe chiamare trackError su errore Redis', async () => {
      const error = new Error('Connection timeout');
      const mockRedis = { set: vi.fn().mockRejectedValue(error), del: vi.fn() };
      mockGetRedis.mockReturnValue(mockRedis);

      await acquireAutomationLock('test-automation');

      expect(mockTrackError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          context: 'DistributedLock',
          metadata: expect.objectContaining({
            slug: 'test-automation',
            reason: 'redis_error',
          }),
        })
      );
    });

    it('dovrebbe chiamare Sentry.metrics.count su errore Redis', async () => {
      const mockRedis = { set: vi.fn().mockRejectedValue(new Error('timeout')), del: vi.fn() };
      mockGetRedis.mockReturnValue(mockRedis);

      await acquireAutomationLock('test-automation');

      expect(mockSentryMetricsCount).toHaveBeenCalledWith(
        'distributed_lock.fail_open',
        1,
        expect.objectContaining({
          attributes: expect.objectContaining({
            slug: 'test-automation',
            reason: 'redis_error',
          }),
        })
      );
    });

    it('NON dovrebbe chiamare trackError quando lock acquisito con successo', async () => {
      const mockRedis = { set: vi.fn().mockResolvedValue('OK'), del: vi.fn() };
      mockGetRedis.mockReturnValue(mockRedis);

      await acquireAutomationLock('test-automation');

      expect(mockTrackError).not.toHaveBeenCalled();
    });
  });

  describe('releaseAutomationLock', () => {
    it('dovrebbe rilasciare lock con successo', async () => {
      const mockRedis = { del: vi.fn().mockResolvedValue(1), set: vi.fn() };
      mockGetRedis.mockReturnValue(mockRedis);

      await releaseAutomationLock('test-automation');

      expect(mockRedis.del).toHaveBeenCalledWith('automation:lock:test-automation');
    });

    it('dovrebbe non fare nulla quando Redis non disponibile', async () => {
      mockGetRedis.mockReturnValue(null);

      // Non dovrebbe lanciare errore
      await expect(releaseAutomationLock('test-automation')).resolves.toBeUndefined();
    });

    it('dovrebbe chiamare trackError su errore e non lanciare eccezione', async () => {
      const error = new Error('Redis error');
      const mockRedis = { del: vi.fn().mockRejectedValue(error), set: vi.fn() };
      mockGetRedis.mockReturnValue(mockRedis);

      // Non dovrebbe lanciare eccezione
      await expect(releaseAutomationLock('test-automation')).resolves.toBeUndefined();

      expect(mockTrackError).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          context: 'DistributedLock.release',
          metadata: { slug: 'test-automation' },
        })
      );
    });
  });
});
