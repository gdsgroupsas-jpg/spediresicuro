/**
 * Contract Tests: Pricing Engine
 *
 * Test deterministici per calculateOptimalPrice senza dipendenze esterne (DB, rete, LLM).
 * Mock solo delle dipendenze esterne (supabase, calculatePrice) per testare la logica reale.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateOptimalPrice, PricingRequest, PricingResult } from '@/lib/ai/pricing-engine';

// Mock delle dipendenze esterne
vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/db/price-lists', () => ({
  calculatePrice: vi.fn(),
}));

// Import dopo i mock
import { supabaseAdmin } from '@/lib/db/client';
import { calculatePrice } from '@/lib/db/price-lists';

describe('Pricing Engine - Contract Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock: corrieri attivi
    vi.mocked(supabaseAdmin.from).mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({
        data: [
          { id: 'courier-1', name: 'BRT', code: 'BRT' },
          { id: 'courier-2', name: 'DHL', code: 'DHL' },
          { id: 'courier-3', name: 'GLS', code: 'GLS' },
        ],
        error: null,
      }),
    } as any);
  });

  describe('Valid Requests - Complete Data', () => {
    it('should calculate price for integer weight (2kg) with valid CAP and province', async () => {
      // Mock calculatePrice per restituire prezzi deterministici
      vi.mocked(calculatePrice)
        .mockResolvedValueOnce({
          basePrice: 10.0,
          surcharges: 0,
          totalCost: 10.0,
          details: {
            estimatedDeliveryDays: { min: 3, max: 5 },
          },
        })
        .mockResolvedValueOnce({
          basePrice: 12.0,
          surcharges: 0,
          totalCost: 12.0,
          details: {
            estimatedDeliveryDays: { min: 2, max: 4 },
          },
        })
        .mockResolvedValueOnce({
          basePrice: 9.5,
          surcharges: 0,
          totalCost: 9.5,
          details: {
            estimatedDeliveryDays: { min: 4, max: 6 },
          },
        });

      const request: PricingRequest = {
        weight: 2,
        destinationZip: '00100',
        destinationProvince: 'RM',
      };

      const results = await calculateOptimalPrice(request);

      // Verifica: nessun NaN
      results.forEach((result) => {
        expect(Number.isNaN(result.basePrice)).toBe(false);
        expect(Number.isNaN(result.surcharges)).toBe(false);
        expect(Number.isNaN(result.totalCost)).toBe(false);
        expect(Number.isNaN(result.finalPrice)).toBe(false);
        expect(Number.isNaN(result.margin)).toBe(false);
      });

      // Verifica: finalPrice > 0 quando dati completi
      expect(results.length).toBeGreaterThan(0);
      results.forEach((result) => {
        expect(result.finalPrice).toBeGreaterThan(0);
      });

      // Verifica: schema opzioni coerente
      results.forEach((result) => {
        expect(result).toHaveProperty('courier');
        expect(result).toHaveProperty('serviceType');
        expect(result).toHaveProperty('finalPrice');
        expect(result).toHaveProperty('estimatedDeliveryDays');
        expect(result.estimatedDeliveryDays).toHaveProperty('min');
        expect(result.estimatedDeliveryDays).toHaveProperty('max');
        expect(typeof result.courier).toBe('string');
        expect(typeof result.serviceType).toBe('string');
        expect(typeof result.finalPrice).toBe('number');
        expect(typeof result.estimatedDeliveryDays.min).toBe('number');
        expect(typeof result.estimatedDeliveryDays.max).toBe('number');
      });

      // Verifica: risultati ordinati per prezzo (crescente)
      for (let i = 1; i < results.length; i++) {
        expect(results[i].finalPrice).toBeGreaterThanOrEqual(results[i - 1].finalPrice);
      }
    });

    it('should calculate price for decimal weight (1.5 kg) with valid CAP and province', async () => {
      vi.mocked(calculatePrice).mockResolvedValueOnce({
        basePrice: 8.5,
        surcharges: 0,
        totalCost: 8.5,
        details: {
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      });

      const request: PricingRequest = {
        weight: 1.5,
        destinationZip: '20100',
        destinationProvince: 'MI',
      };

      const results = await calculateOptimalPrice(request);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].finalPrice).toBeGreaterThan(0);
      expect(Number.isNaN(results[0].finalPrice)).toBe(false);
    });

    it('should calculate price for minimum weight (0.1 kg)', async () => {
      vi.mocked(calculatePrice).mockResolvedValueOnce({
        basePrice: 5.0,
        surcharges: 0,
        totalCost: 5.0,
        details: {
          estimatedDeliveryDays: { min: 2, max: 4 },
        },
      });

      const request: PricingRequest = {
        weight: 0.1,
        destinationZip: '50100',
        destinationProvince: 'FI',
      };

      const results = await calculateOptimalPrice(request);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].finalPrice).toBeGreaterThan(0);
      expect(Number.isNaN(results[0].finalPrice)).toBe(false);
    });

    it('should calculate price for maximum reasonable weight (30 kg)', async () => {
      vi.mocked(calculatePrice).mockResolvedValueOnce({
        basePrice: 25.0,
        surcharges: 0,
        totalCost: 25.0,
        details: {
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      });

      const request: PricingRequest = {
        weight: 30,
        destinationZip: '80100',
        destinationProvince: 'NA',
      };

      const results = await calculateOptimalPrice(request);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].finalPrice).toBeGreaterThan(0);
      expect(Number.isNaN(results[0].finalPrice)).toBe(false);
    });

    it('should apply margin correctly (20% default)', async () => {
      const baseCost = 10.0;
      // DEFAULT_MARGIN_PERCENT is 20% when no listino is configured
      const expectedMargin = (baseCost * 20) / 100;
      const expectedFinalPrice = baseCost + expectedMargin;

      vi.mocked(calculatePrice).mockResolvedValueOnce({
        basePrice: baseCost,
        surcharges: 0,
        totalCost: baseCost,
        details: {
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      });

      const request: PricingRequest = {
        weight: 2,
        destinationZip: '00100',
        destinationProvince: 'RM',
      };

      const results = await calculateOptimalPrice(request);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].margin).toBeCloseTo(expectedMargin, 2);
      expect(results[0].finalPrice).toBeCloseTo(expectedFinalPrice, 2);
    });

    it('should handle serviceType express', async () => {
      vi.mocked(calculatePrice).mockResolvedValueOnce({
        basePrice: 15.0,
        surcharges: 0,
        totalCost: 15.0,
        details: {
          estimatedDeliveryDays: { min: 1, max: 2 },
        },
      });

      const request: PricingRequest = {
        weight: 2,
        destinationZip: '00100',
        destinationProvince: 'RM',
        serviceType: 'express',
      };

      const results = await calculateOptimalPrice(request);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].serviceType).toBe('express');
      expect(results[0].finalPrice).toBeGreaterThan(0);
    });

    it('should handle serviceType economy', async () => {
      vi.mocked(calculatePrice).mockResolvedValueOnce({
        basePrice: 7.0,
        surcharges: 0,
        totalCost: 7.0,
        details: {
          estimatedDeliveryDays: { min: 5, max: 7 },
        },
      });

      const request: PricingRequest = {
        weight: 2,
        destinationZip: '00100',
        destinationProvince: 'RM',
        serviceType: 'economy',
      };

      const results = await calculateOptimalPrice(request);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].serviceType).toBe('economy');
      expect(results[0].finalPrice).toBeGreaterThan(0);
    });

    it('should handle cashOnDelivery option', async () => {
      vi.mocked(calculatePrice).mockResolvedValueOnce({
        basePrice: 10.0,
        surcharges: 2.5, // Supplemento contrassegno
        totalCost: 12.5,
        details: {
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      });

      const request: PricingRequest = {
        weight: 2,
        destinationZip: '00100',
        destinationProvince: 'RM',
        cashOnDelivery: 100,
      };

      const results = await calculateOptimalPrice(request);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].surcharges).toBeGreaterThan(0);
      expect(results[0].totalCost).toBeGreaterThan(results[0].basePrice);
    });

    it('should handle insurance option', async () => {
      vi.mocked(calculatePrice).mockResolvedValueOnce({
        basePrice: 10.0,
        surcharges: 1.0, // Supplemento assicurazione
        totalCost: 11.0,
        details: {
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      });

      const request: PricingRequest = {
        weight: 2,
        destinationZip: '00100',
        destinationProvince: 'RM',
        declaredValue: 500,
        insurance: true,
      };

      const results = await calculateOptimalPrice(request);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].surcharges).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases - Missing Data', () => {
    it('should return empty array when no couriers available', async () => {
      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      } as any);

      const request: PricingRequest = {
        weight: 2,
        destinationZip: '00100',
        destinationProvince: 'RM',
      };

      const results = await calculateOptimalPrice(request);

      expect(results).toEqual([]);
    });

    it('should return empty array when calculatePrice returns null (no matching price list)', async () => {
      vi.mocked(calculatePrice).mockResolvedValue(null);

      const request: PricingRequest = {
        weight: 2,
        destinationZip: '00100',
        destinationProvince: 'RM',
      };

      const results = await calculateOptimalPrice(request);

      expect(results).toEqual([]);
    });

    it('should handle error from couriers query gracefully', async () => {
      vi.mocked(supabaseAdmin.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      } as any);

      const request: PricingRequest = {
        weight: 2,
        destinationZip: '00100',
        destinationProvince: 'RM',
      };

      const results = await calculateOptimalPrice(request);

      expect(results).toEqual([]);
    });

    it('should continue with other couriers if one fails', async () => {
      vi.mocked(calculatePrice)
        .mockRejectedValueOnce(new Error('Courier 1 error'))
        .mockResolvedValueOnce({
          basePrice: 12.0,
          surcharges: 0,
          totalCost: 12.0,
          details: {
            estimatedDeliveryDays: { min: 3, max: 5 },
          },
        })
        .mockResolvedValueOnce({
          basePrice: 9.5,
          surcharges: 0,
          totalCost: 9.5,
          details: {
            estimatedDeliveryDays: { min: 4, max: 6 },
          },
        });

      const request: PricingRequest = {
        weight: 2,
        destinationZip: '00100',
        destinationProvince: 'RM',
      };

      const results = await calculateOptimalPrice(request);

      // Dovrebbe avere risultati per gli altri 2 corrieri
      expect(results.length).toBe(2);
      results.forEach((result) => {
        expect(result.finalPrice).toBeGreaterThan(0);
        expect(Number.isNaN(result.finalPrice)).toBe(false);
      });
    });
  });

  describe('Result Schema Validation', () => {
    it('should return results with correct schema structure', async () => {
      vi.mocked(calculatePrice).mockResolvedValueOnce({
        basePrice: 10.0,
        surcharges: 1.5,
        totalCost: 11.5,
        details: {
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      });

      const request: PricingRequest = {
        weight: 2,
        destinationZip: '00100',
        destinationProvince: 'RM',
      };

      const results = await calculateOptimalPrice(request);

      expect(results.length).toBeGreaterThan(0);
      const result = results[0];

      // Verifica tutti i campi obbligatori
      expect(result).toHaveProperty('courier');
      expect(result).toHaveProperty('serviceType');
      expect(result).toHaveProperty('basePrice');
      expect(result).toHaveProperty('surcharges');
      expect(result).toHaveProperty('totalCost');
      expect(result).toHaveProperty('finalPrice');
      expect(result).toHaveProperty('margin');
      expect(result).toHaveProperty('estimatedDeliveryDays');
      expect(result).toHaveProperty('recommendation');

      // Verifica tipi
      expect(typeof result.courier).toBe('string');
      expect(typeof result.serviceType).toBe('string');
      expect(typeof result.basePrice).toBe('number');
      expect(typeof result.surcharges).toBe('number');
      expect(typeof result.totalCost).toBe('number');
      expect(typeof result.finalPrice).toBe('number');
      expect(typeof result.margin).toBe('number');
      expect(typeof result.estimatedDeliveryDays).toBe('object');
      expect(typeof result.recommendation).toBe('string');

      // Verifica estimatedDeliveryDays
      expect(result.estimatedDeliveryDays).toHaveProperty('min');
      expect(result.estimatedDeliveryDays).toHaveProperty('max');
      expect(typeof result.estimatedDeliveryDays.min).toBe('number');
      expect(typeof result.estimatedDeliveryDays.max).toBe('number');
      expect(result.estimatedDeliveryDays.min).toBeGreaterThanOrEqual(0);
      expect(result.estimatedDeliveryDays.max).toBeGreaterThanOrEqual(
        result.estimatedDeliveryDays.min
      );

      // Verifica recommendation enum
      expect(['best_price', 'best_speed', 'best_reliability']).toContain(result.recommendation);
    });

    it('should assign best_price recommendation to first result (sorted by price)', async () => {
      vi.mocked(calculatePrice)
        .mockResolvedValueOnce({
          basePrice: 12.0,
          surcharges: 0,
          totalCost: 12.0,
          details: {
            estimatedDeliveryDays: { min: 3, max: 5 },
          },
        })
        .mockResolvedValueOnce({
          basePrice: 10.0,
          surcharges: 0,
          totalCost: 10.0,
          details: {
            estimatedDeliveryDays: { min: 3, max: 5 },
          },
        })
        .mockResolvedValueOnce({
          basePrice: 9.5,
          surcharges: 0,
          totalCost: 9.5,
          details: {
            estimatedDeliveryDays: { min: 4, max: 6 },
          },
        });

      const request: PricingRequest = {
        weight: 2,
        destinationZip: '00100',
        destinationProvince: 'RM',
      };

      const results = await calculateOptimalPrice(request);

      expect(results.length).toBeGreaterThan(0);
      // Il primo risultato (più economico) dovrebbe avere best_price
      expect(results[0].recommendation).toBe('best_price');
    });
  });

  describe('Price Calculation Logic', () => {
    it('should round finalPrice to 2 decimal places', async () => {
      vi.mocked(calculatePrice).mockResolvedValueOnce({
        basePrice: 10.0,
        surcharges: 0,
        totalCost: 10.0,
        details: {
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      });

      const request: PricingRequest = {
        weight: 2,
        destinationZip: '00100',
        destinationProvince: 'RM',
      };

      const results = await calculateOptimalPrice(request);

      expect(results.length).toBeGreaterThan(0);
      const finalPrice = results[0].finalPrice;
      const decimalPlaces = (finalPrice.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    it('should round margin to 2 decimal places', async () => {
      vi.mocked(calculatePrice).mockResolvedValueOnce({
        basePrice: 10.0,
        surcharges: 0,
        totalCost: 10.0,
        details: {
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      });

      const request: PricingRequest = {
        weight: 2,
        destinationZip: '00100',
        destinationProvince: 'RM',
      };

      const results = await calculateOptimalPrice(request);

      expect(results.length).toBeGreaterThan(0);
      const margin = results[0].margin;
      const decimalPlaces = (margin.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(2);
    });

    it('should calculate finalPrice = totalCost + margin', async () => {
      const totalCost = 10.0;
      // DEFAULT_MARGIN_PERCENT is 20% when no listino is configured
      const expectedMargin = (totalCost * 20) / 100;
      const expectedFinalPrice = totalCost + expectedMargin;

      vi.mocked(calculatePrice).mockResolvedValueOnce({
        basePrice: 10.0,
        surcharges: 0,
        totalCost,
        details: {
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      });

      const request: PricingRequest = {
        weight: 2,
        destinationZip: '00100',
        destinationProvince: 'RM',
      };

      const results = await calculateOptimalPrice(request);

      expect(results.length).toBeGreaterThan(0);
      const result = results[0];
      expect(result.totalCost).toBe(totalCost);
      expect(result.finalPrice).toBeCloseTo(expectedFinalPrice, 2);
      expect(result.margin).toBeCloseTo(expectedMargin, 2);
    });
  });
});
