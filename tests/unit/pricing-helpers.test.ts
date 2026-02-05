/**
 * Test Pricing Helpers - Milestone 2
 *
 * Test per le funzioni helper estratte da calculateWithDefaultMargin.
 */

import { describe, expect, it, vi } from 'vitest';
import {
  calculateMatrixPrice,
  determineSupplierPrice,
  recoverMasterListPrice,
  type PricingParams,
} from '@/lib/pricing/pricing-helpers';
import type { PriceList } from '@/types/listini';

// Mock calculatePriceFromList
vi.mock('@/lib/pricing/calculator', () => ({
  calculatePriceFromList: vi.fn((priceList, weight, zip, serviceType) => {
    // Simula risposta basata su entries
    if (!priceList.entries || priceList.entries.length === 0) {
      return null;
    }
    // Trova entry che matcha il peso
    const entry = priceList.entries.find(
      (e: any) => weight >= (e.weight_from || 0) && weight <= (e.weight_to || 999)
    );
    if (!entry) return null;
    return {
      basePrice: entry.base_price || 10,
      surcharges: entry.surcharges || 0,
    };
  }),
}));

describe('Pricing Helpers', () => {
  const defaultParams: PricingParams = {
    weight: 5,
    destination: {
      zip: '20100',
      province: 'MI',
      region: 'Lombardia',
      country: 'IT',
    },
    serviceType: 'standard',
  };

  describe('recoverMasterListPrice', () => {
    it('ritorna default quando master list non trovato', async () => {
      const getCachedMasterList = vi.fn().mockResolvedValue(null);

      const result = await recoverMasterListPrice('master-123', defaultParams, getCachedMasterList);

      expect(result.found).toBe(false);
      expect(result.supplierBasePrice).toBe(0);
      expect(result.masterVATMode).toBe('excluded');
    });

    it('ritorna default quando master list senza entries', async () => {
      const getCachedMasterList = vi.fn().mockResolvedValue({
        id: 'master-123',
        name: 'Master Test',
        entries: [],
        vat_mode: 'excluded',
        vat_rate: 22,
      });

      const result = await recoverMasterListPrice('master-123', defaultParams, getCachedMasterList);

      expect(result.found).toBe(false);
      expect(result.supplierBasePrice).toBe(0);
    });

    it('recupera prezzo da master list con entries', async () => {
      const getCachedMasterList = vi.fn().mockResolvedValue({
        id: 'master-123',
        name: 'Master Test',
        entries: [{ weight_from: 0, weight_to: 10, base_price: 15, surcharges: 2 }],
        vat_mode: 'excluded',
        vat_rate: 22,
      });

      const result = await recoverMasterListPrice('master-123', defaultParams, getCachedMasterList);

      expect(result.found).toBe(true);
      expect(result.supplierBasePrice).toBe(15);
      expect(result.supplierSurcharges).toBe(2);
      expect(result.supplierTotalCostOriginal).toBe(17);
      expect(result.masterVATMode).toBe('excluded');
      expect(result.masterVATRate).toBe(22);
    });

    it('gestisce master list con IVA inclusa', async () => {
      const getCachedMasterList = vi.fn().mockResolvedValue({
        id: 'master-123',
        name: 'Master IVA Inclusa',
        entries: [{ weight_from: 0, weight_to: 10, base_price: 12.2, surcharges: 0 }],
        vat_mode: 'included',
        vat_rate: 22,
      });

      const result = await recoverMasterListPrice('master-123', defaultParams, getCachedMasterList);

      expect(result.found).toBe(true);
      expect(result.masterVATMode).toBe('included');
      expect(result.supplierTotalCostOriginal).toBe(12.2);
    });

    it('gestisce errori gracefully', async () => {
      const getCachedMasterList = vi.fn().mockRejectedValue(new Error('DB error'));

      const result = await recoverMasterListPrice('master-123', defaultParams, getCachedMasterList);

      expect(result.found).toBe(false);
      expect(result.supplierBasePrice).toBe(0);
    });
  });

  describe('calculateMatrixPrice', () => {
    it('ritorna default quando listino senza entries', () => {
      const priceList = {
        id: 'list-1',
        name: 'Test',
        entries: [],
      } as unknown as PriceList;

      const result = calculateMatrixPrice(priceList, defaultParams);

      expect(result.found).toBe(false);
      expect(result.basePrice).toBe(10); // Default fallback
    });

    it('calcola prezzo da matrice con entries', () => {
      const priceList = {
        id: 'list-1',
        name: 'Test',
        entries: [{ weight_from: 0, weight_to: 10, base_price: 8, surcharges: 1.5 }],
      } as unknown as PriceList;

      const result = calculateMatrixPrice(priceList, defaultParams);

      expect(result.found).toBe(true);
      expect(result.basePrice).toBe(8);
      expect(result.surcharges).toBe(1.5);
      expect(result.totalCostOriginal).toBe(9.5);
    });

    it('ritorna default quando nessuna entry matcha', () => {
      const priceList = {
        id: 'list-1',
        name: 'Test',
        entries: [
          { weight_from: 20, weight_to: 30, base_price: 25, surcharges: 0 }, // Non matcha peso 5
        ],
      } as unknown as PriceList;

      const result = calculateMatrixPrice(priceList, defaultParams);

      expect(result.found).toBe(false);
      expect(result.basePrice).toBe(10); // Default
    });
  });

  describe('determineSupplierPrice', () => {
    it('usa supplierTotalCost quando disponibile', () => {
      const result = determineSupplierPrice(15, 20, 'custom', 'Test List');

      expect(result).toBe(15);
    });

    it('usa totalCost per listini supplier', () => {
      const result = determineSupplierPrice(0, 18, 'supplier', 'Supplier List');

      expect(result).toBe(18);
    });

    it('ritorna undefined per listini custom senza master', () => {
      const result = determineSupplierPrice(0, 20, 'custom', 'Custom No Master');

      expect(result).toBeUndefined();
    });

    it('priorita supplierTotalCost anche per listini supplier', () => {
      // Se c'è supplierTotalCost, usa quello anche per listini supplier
      const result = determineSupplierPrice(12, 18, 'supplier', 'Supplier List');

      expect(result).toBe(12);
    });
  });
});
