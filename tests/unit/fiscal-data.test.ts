import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getShipmentsByPeriod,
  getFiscalDeadlines,
  getPendingCOD,
  getFiscalContext,
} from '@/lib/agent/fiscal-data';
import * as supabaseServer from '@/lib/supabase-server';

// Mock Supabase client
vi.mock('@/lib/supabase-server', () => ({
  createServerActionClient: vi.fn(),
}));

describe('Fiscal Data Module', () => {
  let mockSupabaseClient: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock Supabase client
    mockSupabaseClient = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    vi.mocked(supabaseServer.createServerActionClient).mockReturnValue(
      mockSupabaseClient
    );
  });

  describe('getFiscalDeadlines', () => {
    it('returns Italian fiscal calendar deadlines', () => {
      const deadlines = getFiscalDeadlines();

      expect(deadlines).toBeInstanceOf(Array);
      expect(deadlines.length).toBeGreaterThan(0);

      // Check structure of first deadline
      const firstDeadline = deadlines[0];
      expect(firstDeadline).toHaveProperty('date');
      expect(firstDeadline).toHaveProperty('description');
      expect(firstDeadline).toHaveProperty('type');
    });

    it('includes F24 deadlines', () => {
      const deadlines = getFiscalDeadlines();
      const f24Deadlines = deadlines.filter((d) => d.type === 'F24');

      expect(f24Deadlines.length).toBeGreaterThan(0);
      expect(f24Deadlines[0].description).toContain('F24');
    });

    it('includes LIPE deadlines', () => {
      const deadlines = getFiscalDeadlines();
      const lipeDeadlines = deadlines.filter((d) => d.type === 'LIPE');

      expect(lipeDeadlines.length).toBeGreaterThan(0);
    });

    it('uses current year for all deadlines', () => {
      const currentYear = new Date().getFullYear();
      const deadlines = getFiscalDeadlines();

      deadlines.forEach((deadline) => {
        expect(deadline.date).toContain(currentYear.toString());
      });
    });
  });

  describe('getShipmentsByPeriod', () => {
    const mockShipments = [
      {
        id: '1',
        created_at: '2026-01-10',
        status: 'delivered',
        total_price: 10.5,
        courier_cost: 7.2,
        margin: 3.3,
        cash_on_delivery: false,
        cod_status: null,
        user_id: 'user-123',
      },
      {
        id: '2',
        created_at: '2026-01-12',
        status: 'in_transit',
        total_price: 15.0,
        courier_cost: 10.0,
        margin: 5.0,
        cash_on_delivery: true,
        cod_status: 'pending',
        user_id: 'user-123',
      },
    ];

    it('fetches shipments for standard user', async () => {
      mockSupabaseClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
      });

      const chainEnd = mockSupabaseClient.from();
      chainEnd.eq = vi.fn().mockResolvedValue({
        data: mockShipments,
        error: null,
      });

      const result = await getShipmentsByPeriod(
        'user-123',
        'user',
        '2026-01-01',
        '2026-01-31'
      );

      expect(result).toEqual(mockShipments);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('shipments');
    });

    it('filters by user_id for standard user', async () => {
      const eqMock = vi.fn().mockResolvedValue({
        data: mockShipments,
        error: null,
      });

      mockSupabaseClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: eqMock,
      });

      await getShipmentsByPeriod('user-123', 'user', '2026-01-01', '2026-01-31');

      expect(eqMock).toHaveBeenCalledWith('user_id', 'user-123');
    });

    it('includes sub-users for reseller role', async () => {
      const inMock = vi.fn().mockResolvedValue({
        data: mockShipments,
        error: null,
      });

      // Mock sub-users query
      const subUsersQuery = {
        data: [{ id: 'sub-user-1' }, { id: 'sub-user-2' }],
        error: null,
      };

      mockSupabaseClient.from = vi.fn((tableName: string) => {
        if (tableName === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue(subUsersQuery),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          in: inMock,
        };
      });

      await getShipmentsByPeriod(
        'reseller-123',
        'reseller',
        '2026-01-01',
        '2026-01-31'
      );

      expect(inMock).toHaveBeenCalledWith('user_id', [
        'reseller-123',
        'sub-user-1',
        'sub-user-2',
      ]);
    });

    it('throws error on database failure', async () => {
      mockSupabaseClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      await expect(
        getShipmentsByPeriod('user-123', 'user', '2026-01-01', '2026-01-31')
      ).rejects.toThrow('Errore recupero spedizioni: Database error');
    });
  });

  describe('getPendingCOD', () => {
    const mockCODShipments = [
      {
        id: '1',
        created_at: '2026-01-10',
        cash_on_delivery: 50.0,
        cod_status: 'pending',
        user_id: 'user-123',
      },
      {
        id: '2',
        created_at: '2026-01-12',
        cash_on_delivery: 75.5,
        cod_status: 'collected',
        user_id: 'user-123',
      },
    ];

    it('fetches pending COD shipments', async () => {
      mockSupabaseClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({
          data: mockCODShipments,
          error: null,
        }),
      });

      const result = await getPendingCOD('user-123', 'user');

      expect(result).toEqual(mockCODShipments);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('shipments');
    });

    it('filters by cash_on_delivery = true', async () => {
      const eqMock = vi.fn().mockReturnThis();
      mockSupabaseClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: eqMock,
        neq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({
          data: mockCODShipments,
          error: null,
        }),
      });

      await getPendingCOD('user-123', 'user');

      expect(eqMock).toHaveBeenCalledWith('cash_on_delivery', true);
    });

    it('excludes paid COD shipments', async () => {
      const neqMock = vi.fn().mockReturnThis();
      mockSupabaseClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: neqMock,
        is: vi.fn().mockResolvedValue({
          data: mockCODShipments,
          error: null,
        }),
      });

      await getPendingCOD('user-123', 'user');

      expect(neqMock).toHaveBeenCalledWith('cod_status', 'paid');
    });

    it('throws error on database failure', async () => {
      mockSupabaseClient.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'COD query failed' },
        }),
      });

      await expect(getPendingCOD('user-123', 'user')).rejects.toThrow(
        'Errore recupero COD: COD query failed'
      );
    });
  });

  describe('getFiscalContext', () => {
    it('returns complete fiscal context structure', async () => {
      // Mock all database calls
      mockSupabaseClient.from = vi.fn((tableName: string) => {
        if (tableName === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { wallet_balance: '1500.50' },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        };
      });

      const context = await getFiscalContext('user-123', 'user');

      expect(context).toHaveProperty('userId');
      expect(context).toHaveProperty('role');
      expect(context).toHaveProperty('period');
      expect(context).toHaveProperty('wallet');
      expect(context).toHaveProperty('shipmentsSummary');
      expect(context).toHaveProperty('pending_cod_count');
      expect(context).toHaveProperty('pending_cod_value');
      expect(context).toHaveProperty('deadlines');
    });

    it('calculates shipments summary correctly', async () => {
      const mockShipments = [
        { margin: 10.5, total_price: 50.0 },
        { margin: 5.0, total_price: 25.0 },
        { margin: 8.3, total_price: 40.0 },
      ];

      mockSupabaseClient.from = vi.fn((tableName: string) => {
        if (tableName === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { wallet_balance: '100.00' },
              error: null,
            }),
          };
        }
        if (tableName === 'shipments') {
          const chain = {
            select: vi.fn().mockReturnThis(),
            gte: vi.fn().mockReturnThis(),
            lte: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            eq: vi.fn(),
            neq: vi.fn(),
          };

          // First call returns shipments, second call returns empty COD
          let callCount = 0;
          chain.eq = vi.fn().mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
              return Promise.resolve({ data: mockShipments, error: null });
            }
            return Promise.resolve({ data: [], error: null });
          });

          return chain;
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const context = await getFiscalContext('user-123', 'user');

      expect(context.shipmentsSummary.count).toBe(3);
      expect(context.shipmentsSummary.total_margin).toBe(23.8);
      expect(context.shipmentsSummary.total_revenue).toBe(115.0);
    });

    it('includes wallet balance from user data', async () => {
      mockSupabaseClient.from = vi.fn((tableName: string) => {
        if (tableName === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { wallet_balance: '2500.75' },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const context = await getFiscalContext('user-123', 'user');

      expect(context.wallet.balance).toBe(2500.75);
    });

    it('returns only next 3 upcoming deadlines', async () => {
      mockSupabaseClient.from = vi.fn((tableName: string) => {
        if (tableName === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { wallet_balance: '100' },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const context = await getFiscalContext('user-123', 'user');

      expect(context.deadlines.length).toBeLessThanOrEqual(3);
      // All deadlines should be in the future
      const today = new Date().toISOString().split('T')[0];
      context.deadlines.forEach((deadline) => {
        expect(deadline.date >= today).toBe(true);
      });
    });

    it('handles wallet balance fetch error gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockSupabaseClient.from = vi.fn((tableName: string) => {
        if (tableName === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'User not found' },
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      });

      const context = await getFiscalContext('user-123', 'user');

      // Should default to 0 and continue execution
      expect(context.wallet.balance).toBe(0);
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });
});
