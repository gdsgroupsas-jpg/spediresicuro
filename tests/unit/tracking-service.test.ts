import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the Supabase client before importing the service
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
        not: vi.fn(() => ({
          not: vi.fn(() => ({
            not: vi.fn(() => ({
              or: vi.fn(() => ({
                gte: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn(),
                  })),
                })),
              })),
            })),
          })),
        })),
        order: vi.fn(),
      })),
      upsert: vi.fn(),
    })),
  })),
}));

// Import after mocking
import {
  TrackingService,
  getTrackingService,
  normalizeStatus,
} from '@/lib/services/tracking/tracking-service';
import type { SyncMetrics } from '@/lib/services/tracking/tracking-service';

describe('TrackingService', () => {
  let trackingService: TrackingService;

  beforeEach(() => {
    vi.clearAllMocks();
    trackingService = new TrackingService();
  });

  describe('getTrackingService', () => {
    it('ritorna singleton', () => {
      const instance1 = getTrackingService();
      const instance2 = getTrackingService();
      expect(instance1).toBe(instance2);
    });
  });

  describe('getTracking', () => {
    it('ritorna errore se spedizione non trovata', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Not found' },
              }),
            })),
          })),
        })),
      };

      // @ts-expect-error - Accessing private property for testing
      trackingService.supabaseAdmin = mockSupabase as any;

      const result = await trackingService.getTracking('non-existent-id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('Shipment not found');
    });

    it('ritorna errore se tracking number mancante', async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: {
                  id: 'test-id',
                  tracking_number: null,
                  carrier: 'GLS',
                  tracking_status: null,
                  tracking_last_update: null,
                },
                error: null,
              }),
            })),
          })),
        })),
      };

      // @ts-expect-error - Accessing private property for testing
      trackingService.supabaseAdmin = mockSupabase as any;

      const result = await trackingService.getTracking('test-id');
      expect(result.success).toBe(false);
      expect(result.error).toBe('No tracking number available');
    });
  });

  describe('shouldRefreshTracking', () => {
    it('refresh se mai fetchato', () => {
      // @ts-expect-error - Accessing private method for testing
      const result = trackingService.shouldRefreshTracking({
        tracking_status: null,
        tracking_last_update: null,
      });
      expect(result).toBe(true);
    });

    it('no refresh se delivered', () => {
      // @ts-expect-error - Accessing private method for testing
      const result = trackingService.shouldRefreshTracking({
        tracking_status: 'delivered',
        tracking_last_update: new Date().toISOString(),
      });
      expect(result).toBe(false);
    });

    it('refresh se cache stale (>30 min)', () => {
      const staleDate = new Date(Date.now() - 35 * 60 * 1000).toISOString();
      // @ts-expect-error - Accessing private method for testing
      const result = trackingService.shouldRefreshTracking({
        tracking_status: 'in_transit',
        tracking_last_update: staleDate,
      });
      expect(result).toBe(true);
    });

    it('no refresh se cache fresca (<30 min)', () => {
      const freshDate = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      // @ts-expect-error - Accessing private method for testing
      const result = trackingService.shouldRefreshTracking({
        tracking_status: 'in_transit',
        tracking_last_update: freshDate,
      });
      expect(result).toBe(false);
    });
  });

  describe('fetchAndCacheTracking — batch upsert e retry', () => {
    it('ritorna eventsCount su successo API', async () => {
      // Mock fetch API
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            TrackingDettaglio: [
              { Data: '01/01/2026 10:00', Stato: 'In transito', Luogo: 'Milano' },
              { Data: '02/01/2026 14:00', Stato: 'Consegnata', Luogo: 'Roma' },
            ],
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const mockSupabase = {
        from: vi.fn(() => ({
          upsert: vi.fn().mockResolvedValue({ error: null }),
        })),
      };
      // @ts-expect-error - Accessing private property for testing
      trackingService.supabaseAdmin = mockSupabase as any;

      const result = await trackingService.fetchAndCacheTracking('ship-1', 'TRK123', 'GLS');
      expect(result.eventsCount).toBe(2);
      expect(result.errorType).toBeUndefined();

      // Verifica che upsert sia chiamato UNA sola volta (batch)
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);

      vi.unstubAllGlobals();
    });

    it('ritorna errorType permanent su 404', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await trackingService.fetchAndCacheTracking('ship-1', 'TRK404', 'GLS');
      expect(result.eventsCount).toBe(0);
      expect(result.errorType).toBe('permanent');

      vi.unstubAllGlobals();
    });

    it('ritorna errorType transient su 500', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await trackingService.fetchAndCacheTracking('ship-1', 'TRK500', 'GLS');
      expect(result.eventsCount).toBe(0);
      expect(result.errorType).toBe('transient');

      vi.unstubAllGlobals();
    });

    it('ritorna errorType transient su network error', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network timeout'));
      vi.stubGlobal('fetch', mockFetch);

      const result = await trackingService.fetchAndCacheTracking('ship-1', 'TRK-NET', 'GLS');
      expect(result.eventsCount).toBe(0);
      expect(result.errorType).toBe('transient');

      vi.unstubAllGlobals();
    });

    it('ritorna errorType permanent su response senza TrackingDettaglio', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ something: 'else' }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const result = await trackingService.fetchAndCacheTracking('ship-1', 'TRK-BAD', 'GLS');
      expect(result.eventsCount).toBe(0);
      expect(result.errorType).toBe('permanent');

      vi.unstubAllGlobals();
    });

    it('ritorna errorType transient su errore upsert DB', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            TrackingDettaglio: [
              { Data: '01/01/2026 10:00', Stato: 'In transito', Luogo: 'Milano' },
            ],
          }),
      });
      vi.stubGlobal('fetch', mockFetch);

      const mockSupabase = {
        from: vi.fn(() => ({
          upsert: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
        })),
      };
      // @ts-expect-error - Accessing private property for testing
      trackingService.supabaseAdmin = mockSupabase as any;

      const result = await trackingService.fetchAndCacheTracking('ship-1', 'TRK-DB', 'GLS');
      expect(result.eventsCount).toBe(0);
      expect(result.errorType).toBe('transient');

      vi.unstubAllGlobals();
    });
  });

  describe('runWithConcurrency — parallelismo controllato', () => {
    it('esegue task in parallelo rispettando la concorrenza', async () => {
      const order: number[] = [];
      const tasks = [0, 1, 2, 3, 4].map((i) => async () => {
        order.push(i);
        await new Promise((resolve) => setTimeout(resolve, 10));
        return i;
      });

      // @ts-expect-error - Accessing private method for testing
      const results = await trackingService.runWithConcurrency(tasks, 2);

      expect(results).toEqual([0, 1, 2, 3, 4]);
      expect(results).toHaveLength(5);
    });

    it('gestisce array vuoto', async () => {
      // @ts-expect-error - Accessing private method for testing
      const results = await trackingService.runWithConcurrency([], 5);
      expect(results).toEqual([]);
    });

    it('gestisce concorrenza maggiore dei task', async () => {
      const tasks = [1, 2].map((i) => async () => i);
      // @ts-expect-error - Accessing private method for testing
      const results = await trackingService.runWithConcurrency(tasks, 10);
      expect(results).toEqual([1, 2]);
    });

    it('propaga errori nei task', async () => {
      const tasks = [
        async () => 'ok',
        async () => {
          throw new Error('boom');
        },
      ];

      // @ts-expect-error - Accessing private method for testing
      await expect(trackingService.runWithConcurrency(tasks, 2)).rejects.toThrow('boom');
    });
  });

  describe('syncActiveShipments — metriche', () => {
    // Helper per creare mock Supabase con chain .not().not().not().or()...
    function createSyncMock(resolveValue: { data: any; error: any }) {
      const mockLimit = vi.fn().mockResolvedValue(resolveValue);
      return {
        from: vi.fn(() => ({
          select: vi.fn().mockReturnThis(),
          not: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: mockLimit,
        })),
      };
    }

    it('ritorna SyncMetrics con struttura corretta', async () => {
      const mockSupabase = createSyncMock({ data: [], error: null });

      // @ts-expect-error - Accessing private property for testing
      trackingService.supabaseAdmin = mockSupabase as any;

      const result: SyncMetrics = await trackingService.syncActiveShipments();

      // Verifica struttura metriche
      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('skipped');
      expect(result).toHaveProperty('totalShipments');
      expect(result).toHaveProperty('totalEventsUpserted');
      expect(result).toHaveProperty('durationMs');
      expect(result).toHaveProperty('avgApiCallMs');
      expect(result).toHaveProperty('permanentErrors');
      expect(result).toHaveProperty('transientErrors');
      expect(result).toHaveProperty('retriesUsed');

      // Zero spedizioni trovate
      expect(result.synced).toBe(0);
      expect(result.errors).toBe(0);
      expect(result.totalShipments).toBe(0);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('ritorna errore se query DB fallisce', async () => {
      const mockSupabase = createSyncMock({
        data: null,
        error: { message: 'DB connection error' },
      });

      // @ts-expect-error - Accessing private property for testing
      trackingService.supabaseAdmin = mockSupabase as any;

      const result = await trackingService.syncActiveShipments();
      expect(result.errors).toBe(1);
      expect(result.synced).toBe(0);
    });
  });
});

describe('normalizeStatus', () => {
  const testCases = [
    { input: 'CONSEGNATA', expected: 'delivered' },
    { input: 'Delivered to recipient', expected: 'delivered' },
    { input: 'IN TRANSITO', expected: 'in_transit' },
    { input: 'Partita dalla sede', expected: 'in_transit' },
    { input: 'In consegna', expected: 'out_for_delivery' },
    { input: 'Spedizione generata', expected: 'created' },
    { input: 'Reso al mittente', expected: 'returned' },
    { input: 'Annullata', expected: 'cancelled' },
    { input: 'Unknown status xyz', expected: 'unknown' },
    { input: 'In giacenza presso filiale', expected: 'in_giacenza' },
    { input: 'Mancata consegna', expected: 'in_giacenza' },
    { input: 'Fermo deposito', expected: 'in_giacenza' },
    { input: 'Destinatario assente', expected: 'in_giacenza' },
    { input: 'In attesa di ritiro', expected: 'pending_pickup' },
    { input: 'Arrivata in sede destinazione', expected: 'at_destination' },
  ];

  it.each(testCases)('normalizza "$input" → "$expected"', ({ input, expected }) => {
    expect(normalizeStatus(input)).toBe(expected);
  });
});
