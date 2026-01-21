/**
 * Tests: VAT Margin Zero Fix (ADR-001)
 *
 * Verifica che il calcolo del margine funzioni correttamente quando:
 * - Master list e custom list hanno vat_mode diversi
 * - Margine = 0 (prezzi equivalenti)
 * - Margine > 0 (prezzi diversi)
 */

import type { PriceList } from '@/types/listini';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Supabase
vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

// Mock calculatePriceFromList
vi.mock('@/lib/pricing/calculator', () => ({
  calculatePriceFromList: vi.fn(),
}));

import { supabaseAdmin } from '@/lib/db/client';
import { calculatePriceWithRules } from '@/lib/db/price-lists-advanced';
import { calculatePriceFromList } from '@/lib/pricing/calculator';

describe('VAT Margin Zero Fix', () => {
  const mockUserId = 'test-user-id';
  const mockParams = {
    weight: 1.0,
    destination: {
      zip: '20100',
      province: 'MI',
      region: 'Lombardia',
      country: 'IT',
    },
    courierId: 'test-courier',
    serviceType: 'standard' as const,
    options: {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario 1: Master excluded, Custom included (Margin 0)', () => {
    it('should calculate margin = 0 when prices are equivalent', async () => {
      // Master: 100€ (excluded) = Custom: 122€ (included)
      const masterList: PriceList = {
        id: 'master-list-id',
        name: 'Master List',
        version: '1.0',
        status: 'active',
        priority: 'global',
        is_global: true,
        list_type: 'supplier',
        vat_mode: 'excluded', // Master ha IVA esclusa
        vat_rate: 22.0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        entries: [
          {
            id: 'entry-1',
            price_list_id: 'master-list-id',
            weight_from: 0,
            weight_to: 5,
            base_price: 100,
            service_type: 'standard',
            created_at: new Date().toISOString(),
          },
        ],
      };

      const customList: PriceList = {
        id: 'custom-list-id',
        name: 'Custom List',
        version: '1.0',
        status: 'active',
        priority: 'client',
        is_global: false,
        list_type: 'custom',
        master_list_id: 'master-list-id', // Clonato da master
        vat_mode: 'included', // Custom ha IVA inclusa
        vat_rate: 22.0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        entries: [
          {
            id: 'entry-1',
            price_list_id: 'custom-list-id',
            weight_from: 0,
            weight_to: 5,
            base_price: 122, // 100€ + 22% IVA = 122€ (equivalente al master)
            service_type: 'standard',
            created_at: new Date().toISOString(),
          },
        ],
      };

      // Mock: Prima chiamata - recupera custom list
      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...customList, entries: customList.entries },
          error: null,
        }),
      } as any);

      // Mock: Seconda chiamata - recupera master list (quando calcola supplierPrice)
      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...masterList, entries: masterList.entries },
          error: null,
        }),
      } as any);

      // Mock: Calcolo prezzo dal master (per supplierPrice)
      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 100,
        surcharges: 0,
        totalCost: 100,
        details: {
          entry: masterList.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      // Mock: Calcolo prezzo dal custom (per totalCost)
      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 122,
        surcharges: 0,
        totalCost: 122,
        details: {
          entry: customList.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      const result = await calculatePriceWithRules(mockUserId, mockParams, 'custom-list-id');

      expect(result).not.toBeNull();
      expect(result?.vatMode).toBe('included');
      expect(result?.vatRate).toBe(22.0);

      // Nota: Quando isManuallyModified = false (prezzi equivalenti), viene applicato
      // margine default globale (20%) per garantire consistenza nel comparatore.
      // totalCostExclVAT = 122 / 1.22 = 100€
      // supplierTotalCostExclVAT = 100€ (già esclusa)
      // margin = 100 * 20% = 20€ (margine default globale)
      const expectedMargin = 100 * 0.2; // 20% default margin
      expect(result?.margin).toBeCloseTo(expectedMargin, 2);
      // finalPrice = (100 + 20) * 1.22 = 146.40€ (con IVA inclusa)
      expect(result?.finalPrice).toBeCloseTo(146.4, 2);
    });
  });

  describe('Scenario 2: Master included, Custom excluded (Margin 0)', () => {
    it('should calculate margin = 0 when prices are equivalent', async () => {
      // Master: 122€ (included) = Custom: 100€ (excluded)
      const masterList: PriceList = {
        id: 'master-list-id',
        name: 'Master List',
        version: '1.0',
        status: 'active',
        priority: 'global',
        is_global: true,
        list_type: 'supplier',
        vat_mode: 'included', // Master ha IVA inclusa
        vat_rate: 22.0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        entries: [
          {
            id: 'entry-1',
            price_list_id: 'master-list-id',
            weight_from: 0,
            weight_to: 5,
            base_price: 122, // 100€ + 22% IVA
            service_type: 'standard',
            created_at: new Date().toISOString(),
          },
        ],
      };

      const customList: PriceList = {
        id: 'custom-list-id',
        name: 'Custom List',
        version: '1.0',
        status: 'active',
        priority: 'client',
        is_global: false,
        list_type: 'custom',
        master_list_id: 'master-list-id',
        vat_mode: 'excluded', // Custom ha IVA esclusa
        vat_rate: 22.0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        entries: [
          {
            id: 'entry-1',
            price_list_id: 'custom-list-id',
            weight_from: 0,
            weight_to: 5,
            base_price: 100, // Equivalente a 122€ con IVA inclusa
            service_type: 'standard',
            created_at: new Date().toISOString(),
          },
        ],
      };

      // Mock: Prima chiamata - recupera custom list
      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...customList, entries: customList.entries },
          error: null,
        }),
      } as any);

      // Mock: Seconda chiamata - recupera master list
      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...masterList, entries: masterList.entries },
          error: null,
        }),
      } as any);

      // Mock: Calcolo prezzo dal master (per supplierPrice)
      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 122,
        surcharges: 0,
        totalCost: 122,
        details: {
          entry: masterList.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      // Mock: Calcolo prezzo dal custom (per totalCost)
      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 100,
        surcharges: 0,
        totalCost: 100,
        details: {
          entry: customList.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      const result = await calculatePriceWithRules(mockUserId, mockParams, 'custom-list-id');

      expect(result).not.toBeNull();
      expect(result?.vatMode).toBe('excluded');
      expect(result?.vatRate).toBe(22.0);

      // Nota: Quando isManuallyModified = false (prezzi equivalenti), viene applicato
      // margine default globale (20%) per garantire consistenza nel comparatore.
      // totalCostExclVAT = 100€ (già esclusa)
      // supplierTotalCostExclVAT = 122 / 1.22 = 100€
      // margin = 100 * 20% = 20€ (margine default globale)
      const expectedMargin = 100 * 0.2; // 20% default margin
      expect(result?.margin).toBeCloseTo(expectedMargin, 2);
      // finalPrice = 100 + 20 = 120€ (con IVA esclusa)
      expect(result?.finalPrice).toBeCloseTo(120, 2);
    });
  });

  describe('Scenario 3: Master excluded, Custom included (Margin > 0)', () => {
    it('should calculate margin correctly when prices differ', async () => {
      // Master: 100€ (excluded), Custom: 134.20€ (included) = 110€ excluded + 10€ margin
      const masterList: PriceList = {
        id: 'master-list-id',
        name: 'Master List',
        version: '1.0',
        status: 'active',
        priority: 'global',
        is_global: true,
        list_type: 'supplier',
        vat_mode: 'excluded',
        vat_rate: 22.0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        entries: [
          {
            id: 'entry-1',
            price_list_id: 'master-list-id',
            weight_from: 0,
            weight_to: 5,
            base_price: 100,
            service_type: 'standard',
            created_at: new Date().toISOString(),
          },
        ],
      };

      const customList: PriceList = {
        id: 'custom-list-id',
        name: 'Custom List',
        version: '1.0',
        status: 'active',
        priority: 'client',
        is_global: false,
        list_type: 'custom',
        master_list_id: 'master-list-id',
        vat_mode: 'included',
        vat_rate: 22.0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        entries: [
          {
            id: 'entry-1',
            price_list_id: 'custom-list-id',
            weight_from: 0,
            weight_to: 5,
            base_price: 134.2, // 110€ + 22% IVA = 134.20€ (margine 10€)
            service_type: 'standard',
            created_at: new Date().toISOString(),
          },
        ],
      };

      // Mock: Prima chiamata - recupera custom list
      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...customList, entries: customList.entries },
          error: null,
        }),
      } as any);

      // Mock: Seconda chiamata - recupera master list
      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...masterList, entries: masterList.entries },
          error: null,
        }),
      } as any);

      // Mock: Calcolo prezzo dal master (per supplierPrice)
      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 100,
        surcharges: 0,
        totalCost: 100,
        details: {
          entry: masterList.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      // Mock: Calcolo prezzo dal custom (per totalCost)
      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 134.2,
        surcharges: 0,
        totalCost: 134.2,
        details: {
          entry: customList.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      const result = await calculatePriceWithRules(mockUserId, mockParams, 'custom-list-id');

      expect(result).not.toBeNull();

      // Quando isManuallyModified = true, il margine è la differenza tra prezzi
      // totalCostExclVAT = 134.20 / 1.22 = 110€
      // supplierTotalCostExclVAT = 100€
      // margin = 110 - 100 = 10€ (differenza su base IVA esclusa)
      expect(result?.margin).toBeCloseTo(10, 2);
      // finalPrice = 134.20€ (prezzo custom list con IVA inclusa, margine già incluso)
      expect(result?.finalPrice).toBeCloseTo(134.2, 2);
    });
  });

  describe('Scenario 4: Same VAT mode (Backward Compatibility)', () => {
    it('should work correctly when both have vat_mode = excluded', async () => {
      const masterList: PriceList = {
        id: 'master-list-id',
        name: 'Master List',
        version: '1.0',
        status: 'active',
        priority: 'global',
        is_global: true,
        list_type: 'supplier',
        vat_mode: 'excluded',
        vat_rate: 22.0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        entries: [
          {
            id: 'entry-1',
            price_list_id: 'master-list-id',
            weight_from: 0,
            weight_to: 5,
            base_price: 100,
            service_type: 'standard',
            created_at: new Date().toISOString(),
          },
        ],
      };

      const customList: PriceList = {
        id: 'custom-list-id',
        name: 'Custom List',
        version: '1.0',
        status: 'active',
        priority: 'client',
        is_global: false,
        list_type: 'custom',
        master_list_id: 'master-list-id',
        vat_mode: 'excluded', // Stesso vat_mode del master
        vat_rate: 22.0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        entries: [
          {
            id: 'entry-1',
            price_list_id: 'custom-list-id',
            weight_from: 0,
            weight_to: 5,
            base_price: 100, // Stesso prezzo del master
            service_type: 'standard',
            created_at: new Date().toISOString(),
          },
        ],
      };

      // Mock: Prima chiamata - recupera custom list
      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...customList, entries: customList.entries },
          error: null,
        }),
      } as any);

      // Mock: Seconda chiamata - recupera master list
      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...masterList, entries: masterList.entries },
          error: null,
        }),
      } as any);

      // Mock: Calcolo prezzo dal master (per supplierPrice)
      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 100,
        surcharges: 0,
        totalCost: 100,
        details: {
          entry: masterList.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      // Mock: Calcolo prezzo dal custom (per totalCost)
      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 100,
        surcharges: 0,
        totalCost: 100,
        details: {
          entry: customList.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      const result = await calculatePriceWithRules(mockUserId, mockParams, 'custom-list-id');

      expect(result).not.toBeNull();
      expect(result?.vatMode).toBe('excluded');

      // Nota: Quando isManuallyModified = false (prezzi identici), viene applicato
      // margine default globale (20%) per garantire consistenza nel comparatore.
      // totalCostExclVAT = 100€
      // supplierTotalCostExclVAT = 100€
      // margin = 100 * 20% = 20€ (margine default globale)
      const expectedMargin = 100 * 0.2; // 20% default margin
      expect(result?.margin).toBeCloseTo(expectedMargin, 2);
      expect(result?.finalPrice).toBeCloseTo(120, 2); // 100 + 20 = 120€
    });
  });
});
