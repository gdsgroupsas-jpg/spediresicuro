/**
 * Tests: VAT Utilities (ADR-001)
 *
 * Test suite per funzioni di gestione semantica IVA.
 * Verifica backward compatibility e correttezza calcoli.
 */

import {
  calculatePriceWithVAT,
  calculateVATAmount,
  extractPriceExclVAT,
  getVATModeWithFallback,
  isValidVATMode,
  normalizePrice,
  type VATMode,
} from '@/lib/pricing/vat-utils';
import { describe, expect, it } from 'vitest';

describe('VAT Utils', () => {
  describe('normalizePrice', () => {
    it('normalizes price from excluded to included', () => {
      const result = normalizePrice(100, 'excluded', 'included', 22);
      expect(result).toBeCloseTo(122, 2);
    });

    it('normalizes price from included to excluded', () => {
      const result = normalizePrice(122, 'included', 'excluded', 22);
      expect(result).toBeCloseTo(100, 2);
    });

    it('returns same price if modes are equal', () => {
      expect(normalizePrice(100, 'excluded', 'excluded', 22)).toBe(100);
      expect(normalizePrice(122, 'included', 'included', 22)).toBe(122);
    });

    it('handles null as excluded (backward compatibility)', () => {
      const result1 = normalizePrice(100, null, 'included', 22);
      expect(result1).toBeCloseTo(122, 2);

      const result2 = normalizePrice(122, 'included', null, 22);
      expect(result2).toBeCloseTo(100, 2);

      const result3 = normalizePrice(100, null, null, 22);
      expect(result3).toBe(100);
    });

    it('handles different VAT rates', () => {
      const result = normalizePrice(100, 'excluded', 'included', 10);
      expect(result).toBeCloseTo(110, 2); // Usa toBeCloseTo per precisione floating point
    });

    it('handles zero VAT rate', () => {
      const result = normalizePrice(100, 'excluded', 'included', 0);
      expect(result).toBe(100);
    });

    it('handles edge cases with very small prices', () => {
      const result = normalizePrice(0.01, 'excluded', 'included', 22);
      expect(result).toBeCloseTo(0.0122, 4);
    });
  });

  describe('calculateVATAmount', () => {
    it('calculates VAT amount correctly', () => {
      expect(calculateVATAmount(100, 22)).toBe(22);
      expect(calculateVATAmount(100, 10)).toBe(10);
    });

    it('uses default VAT rate (22%) if not provided', () => {
      expect(calculateVATAmount(100)).toBe(22);
    });

    it('handles zero price', () => {
      expect(calculateVATAmount(0, 22)).toBe(0);
    });

    it('handles zero VAT rate', () => {
      expect(calculateVATAmount(100, 0)).toBe(0);
    });
  });

  describe('calculatePriceWithVAT', () => {
    it('calculates price with VAT correctly', () => {
      expect(calculatePriceWithVAT(100, 22)).toBe(122);
      expect(calculatePriceWithVAT(100, 10)).toBe(110);
    });

    it('uses default VAT rate (22%) if not provided', () => {
      expect(calculatePriceWithVAT(100)).toBe(122);
    });

    it('handles zero price', () => {
      expect(calculatePriceWithVAT(0, 22)).toBe(0);
    });
  });

  describe('extractPriceExclVAT', () => {
    it('extracts price excluding VAT correctly', () => {
      expect(extractPriceExclVAT(122, 22)).toBeCloseTo(100, 2);
      expect(extractPriceExclVAT(110, 10)).toBeCloseTo(100, 2);
    });

    it('uses default VAT rate (22%) if not provided', () => {
      expect(extractPriceExclVAT(122)).toBeCloseTo(100, 2);
    });

    it('handles zero price', () => {
      expect(extractPriceExclVAT(0, 22)).toBe(0);
    });

    it('round-trip: extract then calculate should match', () => {
      const original = 100;
      const withVAT = calculatePriceWithVAT(original, 22);
      const extracted = extractPriceExclVAT(withVAT, 22);
      expect(extracted).toBeCloseTo(original, 2);
    });
  });

  describe('isValidVATMode', () => {
    it('returns true for valid modes', () => {
      expect(isValidVATMode('included')).toBe(true);
      expect(isValidVATMode('excluded')).toBe(true);
    });

    it('returns false for null', () => {
      expect(isValidVATMode(null)).toBe(false);
    });

    it('works as type guard', () => {
      const mode1: VATMode = 'included';
      const mode2: VATMode = null;

      if (isValidVATMode(mode1)) {
        // TypeScript should know mode1 is 'included' | 'excluded' here
        expect(mode1).toBe('included');
      }

      if (!isValidVATMode(mode2)) {
        // mode2 is still null here
        expect(mode2).toBeNull();
      }
    });
  });

  describe('getVATModeWithFallback', () => {
    it('returns mode if valid', () => {
      expect(getVATModeWithFallback('included')).toBe('included');
      expect(getVATModeWithFallback('excluded')).toBe('excluded');
    });

    it("returns 'excluded' for null (backward compatibility)", () => {
      expect(getVATModeWithFallback(null)).toBe('excluded');
    });
  });

  describe('Integration: Real-world scenarios', () => {
    it('handles complete flow: included → excluded → included', () => {
      const priceIncl = 122;
      const priceExcl = normalizePrice(priceIncl, 'included', 'excluded', 22);
      expect(priceExcl).toBeCloseTo(100, 2);

      const priceInclAgain = normalizePrice(priceExcl, 'excluded', 'included', 22);
      expect(priceInclAgain).toBeCloseTo(122, 2);
    });

    it('calculates margin on VAT-excluded base (Invariant #1)', () => {
      // Scenario: Listino con IVA inclusa, margine 10%
      const basePriceIncl = 122; // 100 + 22% IVA
      const vatRate = 22;

      // Step 1: Converti a IVA esclusa
      const basePriceExcl = extractPriceExclVAT(basePriceIncl, vatRate);
      expect(basePriceExcl).toBeCloseTo(100, 2);

      // Step 2: Applica margine su base IVA esclusa
      const marginPercent = 10;
      const margin = basePriceExcl * (marginPercent / 100);
      expect(margin).toBeCloseTo(10, 2);

      // Step 3: Calcola prezzo finale IVA esclusa
      const finalPriceExcl = basePriceExcl + margin;
      expect(finalPriceExcl).toBeCloseTo(110, 2);

      // Step 4: Converti a IVA inclusa per vendita
      const finalPriceIncl = calculatePriceWithVAT(finalPriceExcl, vatRate);
      expect(finalPriceIncl).toBeCloseTo(134.2, 2);
    });
  });
});
