/**
 * Unit Tests: Value Stats Calculation (P4 Task 1)
 *
 * Test per il calcolo delle statistiche di valore (minuti risparmiati, errori evitati).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateValueStats } from '@/lib/services/value-stats';
import { supabase } from '@/lib/db/client';

// Mock Supabase
vi.mock('@/lib/db/client', () => ({
  supabase: {
    from: vi.fn(),
  },
}));

describe('Value Stats Calculation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dovrebbe restituire stats vuote se non ci sono abbastanza richieste', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: [{ state: { confidenceScore: 80 }, created_at: new Date().toISOString() }],
                error: null,
              }),
            }),
          }),
        }),
      }),
    });

    (supabase.from as any) = mockFrom;

    const result = await calculateValueStats('test-user');
    expect(result.hasEnoughData).toBe(false);
    expect(result.totalRequests).toBe(1);
    expect(result.minutesSaved).toBe(0);
  });

  it('dovrebbe calcolare minuti risparmiati con abbastanza richieste', async () => {
    const mockSessions = Array(5)
      .fill(null)
      .map((_, i) => ({
        state: {
          confidenceScore: 80 + i,
          validationErrors: i < 2 ? ['test'] : [],
        },
        created_at: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
      }));

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockSessions,
                error: null,
              }),
            }),
          }),
        }),
      }),
    });

    (supabase.from as any) = mockFrom;

    const result = await calculateValueStats('test-user');
    expect(result.hasEnoughData).toBe(true);
    expect(result.totalRequests).toBe(5);
    expect(result.minutesSaved).toBeGreaterThan(0);
    expect(result.errorsAvoided).toBeGreaterThan(0);
    expect(result.averageConfidence).toBeGreaterThan(0);
  });

  it('dovrebbe gestire errori di query gracefully', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'Database error' },
              }),
            }),
          }),
        }),
      }),
    });

    (supabase.from as any) = mockFrom;

    const result = await calculateValueStats('test-user');
    expect(result.hasEnoughData).toBe(false);
    expect(result.totalRequests).toBe(0);
    expect(result.minutesSaved).toBe(0);
  });

  it('dovrebbe calcolare confidence media correttamente', async () => {
    const mockSessions = [
      { state: { confidenceScore: 80 }, created_at: new Date().toISOString() },
      { state: { confidenceScore: 90 }, created_at: new Date().toISOString() },
      { state: { confidenceScore: 85 }, created_at: new Date().toISOString() },
      { state: { confidenceScore: 95 }, created_at: new Date().toISOString() },
      { state: { confidenceScore: 75 }, created_at: new Date().toISOString() },
    ];

    const mockFrom = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: mockSessions,
                error: null,
              }),
            }),
          }),
        }),
      }),
    });

    (supabase.from as any) = mockFrom;

    const result = await calculateValueStats('test-user');
    expect(result.hasEnoughData).toBe(true);
    expect(result.averageConfidence).toBeCloseTo(85, 0); // Media di 80, 90, 85, 95, 75 = 85
  });
});
