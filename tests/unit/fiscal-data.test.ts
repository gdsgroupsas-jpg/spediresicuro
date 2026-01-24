import {
  getFiscalContext,
  getFiscalDeadlines,
  getPendingCOD,
  getShipmentsByPeriod,
} from '@/lib/agent/fiscal-data';
import * as supabaseServer from '@/lib/supabase-server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

    vi.mocked(supabaseServer.createServerActionClient).mockReturnValue(mockSupabaseClient);
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
      // Mock che supporta chaining multiplo: .eq("deleted", false).eq("user_id", userId)
      // E anche query su platform_provider_costs con .in()
      mockSupabaseClient.from = vi.fn((tableName: string) => {
        if (tableName === 'platform_provider_costs') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        // Per shipments
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
        };
        let eqCallCount = 0;
        builder.eq = vi.fn(function (column: string, value: any) {
          eqCallCount++;
          if (eqCallCount === 2) {
            return Promise.resolve({
              data: mockShipments,
              error: null,
            });
          }
          return this;
        });
        return builder;
      });

      const result = await getShipmentsByPeriod('user-123', 'user', '2026-01-01', '2026-01-31');

      expect(result.length).toBeGreaterThan(0);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('shipments');
    });

    it('filters by user_id for standard user', async () => {
      let eqCalls: Array<[string, any]> = [];

      mockSupabaseClient.from = vi.fn((tableName: string) => {
        if (tableName === 'platform_provider_costs') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        // Per shipments
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
        };
        let eqCallCount = 0;
        builder.eq = vi.fn(function (column: string, value: any) {
          eqCalls.push([column, value]);
          eqCallCount++;
          if (eqCallCount === 2) {
            return Promise.resolve({
              data: mockShipments,
              error: null,
            });
          }
          return this;
        });
        return builder;
      });

      await getShipmentsByPeriod('user-123', 'user', '2026-01-01', '2026-01-31');

      // Verifica che .eq() sia stato chiamato con user_id
      const userEqCall = eqCalls.find(([col]) => col === 'user_id');
      expect(userEqCall).toBeDefined();
      expect(userEqCall?.[1]).toBe('user-123');
    });

    it('includes sub-users for reseller role', async () => {
      // Mock sub-users query
      const subUsersQuery = {
        data: [{ id: 'sub-user-1' }, { id: 'sub-user-2' }],
        error: null,
      };

      let shipmentsInCallArgs: any = null;

      mockSupabaseClient.from = vi.fn((tableName: string) => {
        if (tableName === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue(subUsersQuery),
          };
        }
        if (tableName === 'platform_provider_costs') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        // Per shipments: supporta chaining .eq("deleted", false).in("user_id", ...)
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          in: vi.fn(function (column: string, values: any[]) {
            shipmentsInCallArgs = [column, values];
            return Promise.resolve({
              data: mockShipments,
              error: null,
            });
          }),
        };
        return builder;
      });

      await getShipmentsByPeriod('reseller-123', 'reseller', '2026-01-01', '2026-01-31');

      expect(shipmentsInCallArgs).toBeDefined();
      expect(shipmentsInCallArgs[0]).toBe('user_id');
      expect(shipmentsInCallArgs[1]).toEqual(['reseller-123', 'sub-user-1', 'sub-user-2']);
    });

    it('throws error on database failure', async () => {
      mockSupabaseClient.from = vi.fn((tableName: string) => {
        if (tableName === 'platform_provider_costs') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        // Per shipments: ritorna errore
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
        };
        let eqCallCount = 0;
        builder.eq = vi.fn(function (column: string, value: any) {
          eqCallCount++;
          if (eqCallCount === 2) {
            return Promise.resolve({
              data: null,
              error: { message: 'Database error' },
            });
          }
          return this;
        });
        return builder;
      });

      await expect(
        getShipmentsByPeriod('user-123', 'user', '2026-01-01', '2026-01-31')
      ).rejects.toThrow('Errore recupero spedizioni: Database error');
    });
  });

  describe('getPendingCOD', () => {
    // ⚠️ Il codice usa cash_on_delivery_amount, non cash_on_delivery
    const mockCODShipments = [
      {
        id: '1',
        created_at: '2026-01-10',
        cash_on_delivery_amount: 50.0,
        cod_status: 'pending',
        user_id: 'user-123',
      },
      {
        id: '2',
        created_at: '2026-01-12',
        cash_on_delivery_amount: 75.5,
        cod_status: 'collected',
        user_id: 'user-123',
      },
    ];

    // Risultato mappato atteso (dopo il mapping nel codice)
    const expectedMappedCODShipments = [
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
      // getPendingCOD fa: .select().eq("cash_on_delivery", true).neq().eq("deleted", false).eq("user_id", userId)
      // Quindi TRE chiamate a .eq(): cash_on_delivery, deleted, user_id
      const createQueryBuilder = () => {
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
        };
        let eqCallCount = 0;
        builder.eq = vi.fn(function (column: string, value: any) {
          eqCallCount++;
          // Terza chiamata a .eq() (user_id) restituisce Promise
          if (eqCallCount === 3) {
            return Promise.resolve({
              data: mockCODShipments,
              error: null,
            });
          }
          // Prime due chiamate restituiscono this per il chaining
          return this;
        });
        return builder;
      };
      mockSupabaseClient.from = vi.fn().mockReturnValue(createQueryBuilder());

      const result = await getPendingCOD('user-123', 'user');

      expect(result).toEqual(expectedMappedCODShipments);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('shipments');
    });

    it('filters by cash_on_delivery = true', async () => {
      const eqMock = vi.fn().mockReturnThis();
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: eqMock,
        neq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: mockCODShipments, error: null }),
      };
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockBuilder);

      await getPendingCOD('user-123', 'user');

      expect(eqMock).toHaveBeenCalledWith('cash_on_delivery', true);
    });

    it('excludes paid COD shipments', async () => {
      const neqMock = vi.fn().mockReturnThis();
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: neqMock,
        is: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: mockCODShipments, error: null }),
      };
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockBuilder);

      await getPendingCOD('user-123', 'user');

      expect(neqMock).toHaveBeenCalledWith('cod_status', 'paid');
    });

    it('throws error on database failure', async () => {
      const mockBuilder = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        then: (resolve: any) => resolve({ data: null, error: { message: 'COD query failed' } }),
      };
      mockSupabaseClient.from = vi.fn().mockReturnValue(mockBuilder);

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
        if (tableName === 'platform_provider_costs') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: [], error: null }),
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
      // Mock shipments with fields needed by computeMargin:
      // final_price for revenue, base_price for margin calculation
      // Margins: (50-39.5)=10.5, (25-20)=5, (40-31.7)=8.3 => total 23.8
      const mockShipments = [
        { id: '1', final_price: 50.0, base_price: 39.5 },
        { id: '2', final_price: 25.0, base_price: 20.0 },
        { id: '3', final_price: 40.0, base_price: 31.7 },
      ];

      let shipmentsCallCount = 0;

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
        if (tableName === 'platform_provider_costs') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (tableName === 'shipments') {
          shipmentsCallCount++;
          const currentCall = shipmentsCallCount;

          // Create a builder that chains properly and returns Promise on final call
          const createBuilder = (finalData: any) => {
            const builder: any = {};
            builder.select = vi.fn(() => builder);
            builder.gte = vi.fn(() => builder);
            builder.lte = vi.fn(() => builder);
            builder.is = vi.fn(() => builder);
            builder.neq = vi.fn(() => builder);
            builder.in = vi.fn(() => builder);
            // Track eq calls - for user role, final eq is user_id
            let eqCallsInChain = 0;
            builder.eq = vi.fn(() => {
              eqCallsInChain++;
              // getShipmentsByPeriod for user: 2 eq calls (.eq(deleted).eq(user_id))
              // getPendingCOD for user: 4 eq calls (.eq(cash).eq(deleted).eq(user_id))
              // Return Promise when it seems like the final eq
              if (currentCall === 1 && eqCallsInChain >= 2) {
                return Promise.resolve({ data: finalData, error: null });
              }
              if (currentCall > 1 && eqCallsInChain >= 3) {
                return Promise.resolve({ data: finalData, error: null });
              }
              return builder;
            });
            // Also support direct await via then
            builder.then = (resolve: any) => resolve({ data: finalData, error: null });
            return builder;
          };

          if (currentCall === 1) {
            return createBuilder(mockShipments);
          }
          return createBuilder([]);
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnValue(Promise.resolve({ data: [], error: null })),
        };
      });

      const context = await getFiscalContext('user-123', 'user');

      expect(context.shipmentsSummary.count).toBe(3);
      // total_revenue = sum of final_price = 50+25+40 = 115
      expect(context.shipmentsSummary.total_revenue).toBe(115.0);
      // total_margin = sum of (final_price - base_price) = 10.5+5+8.3 = 23.8
      expect(context.shipmentsSummary.total_margin).toBeCloseTo(23.8, 1);
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
        if (tableName === 'platform_provider_costs') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: [], error: null }),
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
        if (tableName === 'platform_provider_costs') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: [], error: null }),
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
            single: vi.fn().mockReturnThis(),
            then: (resolve: any, reject: any) => reject(new Error('User not found')),
          };
        }
        if (tableName === 'platform_provider_costs') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          neq: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: [], error: null }),
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
