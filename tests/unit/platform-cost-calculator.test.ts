/**
 * Unit Tests: platform-cost-calculator.ts
 * 
 * Test della logica di calcolo api_source e provider_cost.
 * Coverage:
 * - determineApiSource: master_list_id, is_global, assegnazioni, BYOC, default
 * - calculateProviderCost: fallback chain (master_list → historical → estimate)
 * - calculateMargin: utility function
 * 
 * @since Sprint 1 - Financial Tracking
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  determineApiSource,
  calculateProviderCost,
  calculateMargin,
  type DetermineApiSourceParams,
  type CalculateProviderCostParams,
} from '@/lib/pricing/platform-cost-calculator';

// ==================== MOCK SUPABASE ====================

interface MockQueryResult {
  data: any;
  error: any;
}

const createMockSupabase = (config: {
  priceListResult?: MockQueryResult;
  assignmentsResult?: MockQueryResult;
  userResult?: MockQueryResult;
  creatorResult?: MockQueryResult;
  masterListsResult?: MockQueryResult;
  entriesResult?: MockQueryResult;
  historicalCostsResult?: MockQueryResult;
  priceListRulesResult?: MockQueryResult;
} = {}) => {
  // Chain per query complesse
  const createChain = (result: MockQueryResult) => {
    const chain: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue(result),
    };
    // Per query che non usano .single()
    chain.then = (resolve: any) => resolve(result);
    return chain;
  };

  const fromMock = vi.fn().mockImplementation((table: string) => {
    switch (table) {
      case 'price_lists':
        return createChain(config.priceListResult || { data: null, error: null });
      case 'price_list_assignments':
        return createChain(config.assignmentsResult || { data: [], error: null });
      case 'users':
        return createChain(config.userResult || { data: null, error: null });
      case 'platform_provider_costs':
        return createChain(config.historicalCostsResult || { data: [], error: null });
      case 'price_list_entries':
        return createChain(config.entriesResult || { data: [], error: null });
      default:
        return createChain({ data: null, error: null });
    }
  });

  return { from: fromMock } as any;
};

// ==================== TESTS: determineApiSource ====================

describe('platform-cost-calculator', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('determineApiSource', () => {
    it('should return "platform" when price list has master_list_id', async () => {
      const mockSupabase = createMockSupabase({
        priceListResult: {
          data: {
            id: 'pl-123',
            master_list_id: 'master-456',
            is_global: false,
            list_type: 'reseller',
            created_by: 'superadmin-789',
            assigned_to_user_id: 'user-001',
          },
          error: null,
        },
      });

      const result = await determineApiSource(mockSupabase, {
        userId: 'user-001',
        priceListId: 'pl-123',
        courierCode: 'BRT',
      });

      expect(result.apiSource).toBe('platform');
      expect(result.masterPriceListId).toBe('master-456');
      expect(result.priceListId).toBe('pl-123');
      expect(result.reason).toContain('derivato da master');
    });

    it('should return "platform" when price list is global', async () => {
      const mockSupabase = createMockSupabase({
        priceListResult: {
          data: {
            id: 'pl-global',
            master_list_id: null,
            is_global: true,
            list_type: 'global',
            created_by: 'superadmin-789',
            assigned_to_user_id: null,
          },
          error: null,
        },
      });

      const result = await determineApiSource(mockSupabase, {
        userId: 'user-001',
        priceListId: 'pl-global',
      });

      expect(result.apiSource).toBe('platform');
      expect(result.reason).toContain('globale SpedireSicuro');
    });

    it('should return "platform" when assigned by superadmin', async () => {
      const mockSupabase = createMockSupabase({
        priceListResult: {
          data: {
            id: 'pl-assigned',
            master_list_id: null,
            is_global: false,
            list_type: 'reseller',
            created_by: 'superadmin-789',
            assigned_to_user_id: 'user-001',
          },
          error: null,
        },
      });

      // Override per query creator
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        if (table === 'price_lists') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: {
                id: 'pl-assigned',
                master_list_id: null,
                is_global: false,
                list_type: 'reseller',
                created_by: 'superadmin-789',
                assigned_to_user_id: 'user-001',
              },
              error: null,
            }),
          };
        }
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({
              data: { account_type: 'superadmin' },
              error: null,
            }),
          };
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      });

      const result = await determineApiSource(mockSupabase, {
        userId: 'user-001',
        priceListId: 'pl-assigned',
      });

      expect(result.apiSource).toBe('platform');
      expect(result.reason).toContain('assegnato da SuperAdmin');
    });

    it('should return "byoc_own" for BYOC users without platform list', async () => {
      const mockSupabase = createMockSupabase({
        priceListResult: { data: null, error: null },
        assignmentsResult: { data: [], error: null },
        userResult: {
          data: { account_type: 'byoc', is_reseller: false },
          error: null,
        },
      });

      // Setup complesso per chain calls
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn(),
        };

        if (table === 'price_lists') {
          chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
        } else if (table === 'price_list_assignments') {
          chain.single = vi.fn().mockResolvedValue({ data: [], error: null });
          // Per query che ritornano array
          chain.then = (resolve: any) => resolve({ data: [], error: null });
        } else if (table === 'users') {
          chain.single = vi.fn().mockResolvedValue({
            data: { account_type: 'byoc', is_reseller: false },
            error: null,
          });
        }
        return chain;
      });

      const result = await determineApiSource(mockSupabase, {
        userId: 'byoc-user',
      });

      expect(result.apiSource).toBe('byoc_own');
      expect(result.reason).toContain('BYOC');
    });

    it('should return "reseller_own" as default fallback', async () => {
      const mockSupabase = createMockSupabase({
        priceListResult: { data: null, error: null },
        assignmentsResult: { data: [], error: null },
        userResult: {
          data: { account_type: 'user', is_reseller: true },
          error: null,
        },
      });

      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn(),
        };

        if (table === 'users') {
          chain.single = vi.fn().mockResolvedValue({
            data: { account_type: 'user', is_reseller: true },
            error: null,
          });
        } else {
          chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
          chain.then = (resolve: any) => resolve({ data: [], error: null });
        }
        return chain;
      });

      const result = await determineApiSource(mockSupabase, {
        userId: 'reseller-user',
      });

      expect(result.apiSource).toBe('reseller_own');
      expect(result.reason).toContain('contratto proprio');
    });

    it('should handle missing priceListId by checking assignments', async () => {
      const mockSupabase = createMockSupabase();
      
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          single: vi.fn(),
        };

        if (table === 'price_list_assignments') {
          chain.then = (resolve: any) => resolve({
            data: [{
              price_list_id: 'assigned-pl',
              price_lists: {
                id: 'assigned-pl',
                master_list_id: 'master-123',
                is_global: false,
              },
            }],
            error: null,
          });
        } else {
          chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
        }
        return chain;
      });

      const result = await determineApiSource(mockSupabase, {
        userId: 'user-with-assignment',
        // No priceListId provided
      });

      expect(result.apiSource).toBe('platform');
      expect(result.reason).toContain('listino piattaforma assegnato');
    });
  });

  describe('calculateProviderCost', () => {
    it('should return cost from master list when available', async () => {
      const mockSupabase = createMockSupabase();
      
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn(),
        };

        if (table === 'price_list_entries') {
          chain.then = (resolve: any) => resolve({
            data: [{ base_price: 7.50, fuel_surcharge_percent: 10 }],
            error: null,
          });
        } else {
          chain.then = (resolve: any) => resolve({ data: [], error: null });
          chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
        }
        return chain;
      });

      const result = await calculateProviderCost(mockSupabase, {
        courierCode: 'BRT',
        weight: 5,
        destination: { zip: '20100', province: 'MI', country: 'IT' },
        masterPriceListId: 'master-123',
      });

      expect(result.source).toBe('master_list');
      expect(result.confidence).toBe('high');
      expect(result.cost).toBe(8.25); // 7.50 + 10% fuel
    });

    it('should fallback to historical average when master list not found', async () => {
      const mockSupabase = createMockSupabase();
      
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn(),
        };

        if (table === 'platform_provider_costs') {
          // Simula 15 record storici
          const historicalData = Array(15).fill({ provider_cost: 10 });
          chain.then = (resolve: any) => resolve({ data: historicalData, error: null });
        } else if (table === 'price_lists') {
          chain.then = (resolve: any) => resolve({ data: [], error: null });
        } else {
          chain.then = (resolve: any) => resolve({ data: [], error: null });
          chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
        }
        return chain;
      });

      const result = await calculateProviderCost(mockSupabase, {
        courierCode: 'GLS',
        weight: 3,
        destination: { zip: '00100', province: 'RM' },
      });

      expect(result.source).toBe('historical_avg');
      expect(result.confidence).toBe('medium');
      expect(result.cost).toBe(10);
      expect(result.details).toContain('Media di 15 spedizioni');
    });

    it('should fallback to estimate when no historical data', async () => {
      const mockSupabase = createMockSupabase();
      
      mockSupabase.from = vi.fn().mockImplementation(() => {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
        chain.then = (resolve: any) => resolve({ data: [], error: null });
        return chain;
      });

      const result = await calculateProviderCost(mockSupabase, {
        courierCode: 'NEW_COURIER',
        weight: 10,
        destination: { zip: '10100', province: 'TO' },
      });

      expect(result.source).toBe('estimate');
      expect(result.confidence).toBe('low');
      // Formula: €5 base + €0.50/kg = 5 + (10 * 0.5) = 10
      expect(result.cost).toBe(10);
      expect(result.details).toContain('Stima basata su peso');
    });

    it('should not use historical if less than 10 records', async () => {
      const mockSupabase = createMockSupabase();
      
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn(),
        };

        if (table === 'platform_provider_costs') {
          // Solo 5 record (sotto la soglia di 10)
          const historicalData = Array(5).fill({ provider_cost: 10 });
          chain.then = (resolve: any) => resolve({ data: historicalData, error: null });
        } else {
          chain.then = (resolve: any) => resolve({ data: [], error: null });
          chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
        }
        return chain;
      });

      const result = await calculateProviderCost(mockSupabase, {
        courierCode: 'DHL',
        weight: 2,
        destination: { zip: '50100', province: 'FI' },
      });

      // Deve usare estimate, non historical (< 10 record)
      expect(result.source).toBe('estimate');
      expect(result.confidence).toBe('low');
    });

    it('should search master list by courier name if not provided directly', async () => {
      const mockSupabase = createMockSupabase();
      
      let searchedTable = '';
      mockSupabase.from = vi.fn().mockImplementation((table: string) => {
        searchedTable = table;
        const chain: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          ilike: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockReturnThis(),
          single: vi.fn(),
        };

        if (table === 'price_lists') {
          chain.then = (resolve: any) => resolve({
            data: [{ id: 'found-master', name: 'Listino BRT Standard' }],
            error: null,
          });
        } else if (table === 'price_list_entries') {
          chain.then = (resolve: any) => resolve({
            data: [{ base_price: 6.00, fuel_surcharge_percent: null }],
            error: null,
          });
        } else {
          chain.then = (resolve: any) => resolve({ data: [], error: null });
          chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
        }
        return chain;
      });

      const result = await calculateProviderCost(mockSupabase, {
        courierCode: 'BRT',
        weight: 1,
        destination: { zip: '30100', province: 'VE' },
        // No masterPriceListId - deve cercarlo
      });

      expect(result.source).toBe('master_list');
      expect(result.cost).toBe(6.00);
    });
  });

  describe('calculateMargin', () => {
    it('should calculate positive margin correctly', () => {
      const result = calculateMargin(15.00, 10.00);
      
      expect(result.margin).toBe(5.00);
      expect(result.marginPercent).toBe(50.00);
    });

    it('should calculate negative margin correctly', () => {
      const result = calculateMargin(8.00, 12.00);
      
      expect(result.margin).toBe(-4.00);
      expect(result.marginPercent).toBe(-33.33);
    });

    it('should handle zero provider cost', () => {
      const result = calculateMargin(10.00, 0);
      
      expect(result.margin).toBe(10.00);
      expect(result.marginPercent).toBe(100);
    });

    it('should handle zero billed amount', () => {
      const result = calculateMargin(0, 0);
      
      expect(result.margin).toBe(0);
      expect(result.marginPercent).toBe(0);
    });

    it('should round margin percent to 2 decimals', () => {
      const result = calculateMargin(13.00, 9.00);
      
      // (13-9)/9 * 100 = 44.444...
      expect(result.marginPercent).toBe(44.44);
    });
  });
});
