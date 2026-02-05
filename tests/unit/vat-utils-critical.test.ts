/**
 * Test VAT Utils - Critical Fixes
 *
 * Test per validazione input e prevenzione division by zero.
 * Verifica fix CRITICAL per calcoli finanziari sicuri.
 */

import { describe, expect, it } from 'vitest';
import {
  normalizePrice,
  calculateVATAmount,
  calculatePriceWithVAT,
  extractPriceExclVAT,
} from '@/lib/pricing/vat-utils';

describe('VAT Utils - Critical Input Validation', () => {
  describe('normalizePrice', () => {
    // Happy path
    it('converte correttamente IVA esclusa → inclusa', () => {
      expect(normalizePrice(100, 'excluded', 'included', 22)).toBe(122);
    });

    it('converte correttamente IVA inclusa → esclusa', () => {
      expect(normalizePrice(122, 'included', 'excluded', 22)).toBe(100);
    });

    it('ritorna stesso prezzo se modalità uguale', () => {
      expect(normalizePrice(100, 'excluded', 'excluded', 22)).toBe(100);
    });

    // CRITICAL: Division by zero
    it('lancia errore per vatRate = -100 (divisione per zero)', () => {
      expect(() => normalizePrice(100, 'included', 'excluded', -100)).toThrow('INVALID_VAT_RATE');
    });

    it('lancia errore per vatRate negativo', () => {
      expect(() => normalizePrice(100, 'excluded', 'included', -1)).toThrow('INVALID_VAT_RATE');
    });

    it('lancia errore per vatRate > 100', () => {
      expect(() => normalizePrice(100, 'excluded', 'included', 101)).toThrow('INVALID_VAT_RATE');
    });

    // CRITICAL: NaN/Infinity
    it('lancia errore per price = NaN', () => {
      expect(() => normalizePrice(NaN, 'excluded', 'included', 22)).toThrow('INVALID_PRICE');
    });

    it('lancia errore per price = Infinity', () => {
      expect(() => normalizePrice(Infinity, 'excluded', 'included', 22)).toThrow('INVALID_PRICE');
    });

    it('lancia errore per price negativo', () => {
      expect(() => normalizePrice(-100, 'excluded', 'included', 22)).toThrow('INVALID_PRICE');
    });

    it('lancia errore per vatRate = NaN', () => {
      expect(() => normalizePrice(100, 'excluded', 'included', NaN)).toThrow('INVALID_VAT_RATE');
    });

    // Edge cases validi
    it('accetta vatRate = 0 (tax free)', () => {
      expect(normalizePrice(100, 'excluded', 'included', 0)).toBe(100);
    });

    it('accetta vatRate = 100', () => {
      expect(normalizePrice(100, 'excluded', 'included', 100)).toBe(200);
    });

    it('accetta price = 0', () => {
      expect(normalizePrice(0, 'excluded', 'included', 22)).toBe(0);
    });

    // CRITICAL: Floating point precision
    it('arrotonda a 2 decimali per evitare errori floating point', () => {
      // 99.99 / 1.22 = 81.95081967... deve diventare 81.95
      const result = normalizePrice(99.99, 'included', 'excluded', 22);
      expect(result).toBe(81.96); // Arrotondato correttamente
    });

    it('arrotonda correttamente IVA inclusa', () => {
      // 81.95 * 1.22 = 99.979 deve diventare 99.98
      const result = normalizePrice(81.95, 'excluded', 'included', 22);
      expect(result).toBe(99.98);
    });
  });

  describe('calculateVATAmount', () => {
    it('calcola IVA correttamente', () => {
      expect(calculateVATAmount(100, 22)).toBe(22);
    });

    it('lancia errore per prezzo negativo', () => {
      expect(() => calculateVATAmount(-100, 22)).toThrow('INVALID_PRICEEXCLVAT');
    });

    it('lancia errore per prezzo NaN', () => {
      expect(() => calculateVATAmount(NaN, 22)).toThrow('INVALID_PRICEEXCLVAT');
    });

    it('lancia errore per vatRate invalido', () => {
      expect(() => calculateVATAmount(100, -22)).toThrow('INVALID_VAT_RATE');
    });

    it('arrotonda correttamente', () => {
      // 99.99 * 0.22 = 21.9978 deve diventare 22.00
      expect(calculateVATAmount(99.99, 22)).toBe(22);
    });
  });

  describe('calculatePriceWithVAT', () => {
    it('calcola prezzo con IVA correttamente', () => {
      expect(calculatePriceWithVAT(100, 22)).toBe(122);
    });

    it('propaga errore di validazione', () => {
      expect(() => calculatePriceWithVAT(-100, 22)).toThrow('INVALID_PRICEEXCLVAT');
    });
  });

  describe('extractPriceExclVAT', () => {
    it('estrae prezzo senza IVA correttamente', () => {
      expect(extractPriceExclVAT(122, 22)).toBe(100);
    });

    it('lancia errore per prezzo negativo', () => {
      expect(() => extractPriceExclVAT(-122, 22)).toThrow('INVALID_PRICEINCLVAT');
    });

    it('lancia errore per vatRate che causerebbe divisione per zero', () => {
      expect(() => extractPriceExclVAT(100, -100)).toThrow('INVALID_VAT_RATE');
    });

    it('arrotonda correttamente', () => {
      // 99.99 / 1.22 = 81.95081967... deve diventare 81.96
      expect(extractPriceExclVAT(99.99, 22)).toBe(81.96);
    });
  });
});

describe('VAT Utils - Financial Precision', () => {
  it('calcoli roundtrip sono consistenti', () => {
    const original = 99.99;

    // excluded -> included -> excluded deve tornare ~originale
    const withVAT = normalizePrice(original, 'excluded', 'included', 22);
    const backToExcluded = normalizePrice(withVAT, 'included', 'excluded', 22);

    // Con arrotondamento a 2 decimali, deve essere molto vicino
    expect(Math.abs(backToExcluded - original)).toBeLessThan(0.02);
  });

  it('VAT amount + price excluded = price included', () => {
    const priceExcl = 100;
    const vatAmount = calculateVATAmount(priceExcl, 22);
    const priceIncl = calculatePriceWithVAT(priceExcl, 22);

    expect(priceExcl + vatAmount).toBe(priceIncl);
  });

  it('extractPriceExclVAT inverte calculatePriceWithVAT', () => {
    const priceExcl = 81.97;
    const priceIncl = calculatePriceWithVAT(priceExcl, 22);
    const extracted = extractPriceExclVAT(priceIncl, 22);

    // Dovrebbero essere uguali grazie all'arrotondamento consistente
    expect(Math.abs(extracted - priceExcl)).toBeLessThan(0.02);
  });
});
