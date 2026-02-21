/**
 * Tests: VAT Semantics Comprehensive (ADR-001)
 *
 * Test suite enterprise-grade per semantica IVA completa.
 * Verifica calcolo prezzi, normalizzazione, margini e retrocompatibilità.
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

describe('VAT Semantics - Comprehensive Tests (ADR-001)', () => {
  describe('1. Normalizzazione Prezzi', () => {
    it('normalizza da excluded a included con IVA 22%', () => {
      const result = normalizePrice(100, 'excluded', 'included', 22);
      expect(result).toBeCloseTo(122, 2);
    });

    it('normalizza da included a excluded con IVA 22%', () => {
      const result = normalizePrice(122, 'included', 'excluded', 22);
      expect(result).toBeCloseTo(100, 2);
    });

    it('normalizza con IVA 10%', () => {
      const result = normalizePrice(100, 'excluded', 'included', 10);
      expect(result).toBeCloseTo(110, 2);
    });

    it('normalizza con IVA 4%', () => {
      const result = normalizePrice(100, 'excluded', 'included', 4);
      expect(result).toBeCloseTo(104, 2);
    });

    it('restituisce stesso prezzo se modalità identiche', () => {
      expect(normalizePrice(100, 'excluded', 'excluded', 22)).toBe(100);
      expect(normalizePrice(122, 'included', 'included', 22)).toBe(122);
    });

    it('gestisce null come excluded (backward compatibility)', () => {
      const result1 = normalizePrice(100, null, 'included', 22);
      expect(result1).toBeCloseTo(122, 2);

      const result2 = normalizePrice(122, 'included', null, 22);
      expect(result2).toBeCloseTo(100, 2);

      const result3 = normalizePrice(100, null, null, 22);
      expect(result3).toBe(100);
    });

    it('gestisce precisione floating point correttamente', () => {
      const result = normalizePrice(100.5, 'excluded', 'included', 22);
      expect(result).toBeCloseTo(122.61, 2);
    });
  });

  describe('2. Calcolo IVA', () => {
    it('calcola IVA su prezzo escluso (22%)', () => {
      const result = calculateVATAmount(100, 22);
      expect(result).toBeCloseTo(22, 2);
    });

    it('calcola IVA su prezzo escluso (10%)', () => {
      const result = calculateVATAmount(100, 10);
      expect(result).toBeCloseTo(10, 2);
    });

    it('calcola prezzo con IVA (22%)', () => {
      const result = calculatePriceWithVAT(100, 22);
      expect(result).toBeCloseTo(122, 2);
    });

    it('calcola prezzo con IVA (10%)', () => {
      const result = calculatePriceWithVAT(100, 10);
      expect(result).toBeCloseTo(110, 2);
    });

    it('estrae prezzo escluso da prezzo incluso (22%)', () => {
      const result = extractPriceExclVAT(122, 22);
      expect(result).toBeCloseTo(100, 2);
    });

    it('estrae prezzo escluso da prezzo incluso (10%)', () => {
      const result = extractPriceExclVAT(110, 10);
      expect(result).toBeCloseTo(100, 2);
    });
  });

  describe('3. Validazione VAT Mode', () => {
    it("valida vat_mode 'included'", () => {
      expect(isValidVATMode('included')).toBe(true);
    });

    it("valida vat_mode 'excluded'", () => {
      expect(isValidVATMode('excluded')).toBe(true);
    });

    it("valida vat_mode null (ma restituisce false perché isValidVATMode verifica solo 'included'/'excluded')", () => {
      // Nota: isValidVATMode restituisce false per null perché verifica solo 'included'/'excluded'
      // null è gestito da getVATModeWithFallback
      expect(isValidVATMode(null as any)).toBe(false);
    });

    it('invalida vat_mode undefined', () => {
      expect(isValidVATMode(undefined as any)).toBe(false);
    });

    it('invalida vat_mode stringa non valida', () => {
      expect(isValidVATMode('invalid' as any)).toBe(false);
    });
  });

  describe('4. Fallback VAT Mode', () => {
    it("restituisce 'excluded' per null (backward compatibility)", () => {
      expect(getVATModeWithFallback(null)).toBe('excluded');
    });

    it("restituisce 'excluded' per undefined (backward compatibility)", () => {
      expect(getVATModeWithFallback(undefined as any)).toBe('excluded');
    });

    it("restituisce 'included' se specificato", () => {
      expect(getVATModeWithFallback('included')).toBe('included');
    });

    it("restituisce 'excluded' se specificato", () => {
      expect(getVATModeWithFallback('excluded')).toBe('excluded');
    });
  });

  describe('5. Scenari Real-World', () => {
    it('scenario: Listino IVA esclusa, margine 20%, risultato IVA esclusa', () => {
      const basePrice = 100; // IVA esclusa
      const margin = 20; // 20%
      const finalPriceExclVAT = basePrice + (basePrice * margin) / 100; // 120€
      const vatAmount = calculateVATAmount(finalPriceExclVAT, 22); // 26.40€
      const finalPriceWithVAT = finalPriceExclVAT + vatAmount; // 146.40€

      expect(finalPriceExclVAT).toBe(120);
      expect(vatAmount).toBeCloseTo(26.4, 2);
      expect(finalPriceWithVAT).toBeCloseTo(146.4, 2);
    });

    it('scenario: Listino IVA inclusa, margine 20%, risultato IVA inclusa', () => {
      const basePriceInclVAT = 122; // IVA inclusa (100€ + 22€)
      const basePriceExclVAT = extractPriceExclVAT(basePriceInclVAT, 22); // 100€
      const margin = 20; // 20% su base IVA esclusa
      const marginAmount = (basePriceExclVAT * margin) / 100; // 20€
      const finalPriceExclVAT = basePriceExclVAT + marginAmount; // 120€
      const finalPriceWithVAT = calculatePriceWithVAT(finalPriceExclVAT, 22); // 146.40€

      expect(basePriceExclVAT).toBeCloseTo(100, 2);
      expect(marginAmount).toBe(20);
      expect(finalPriceExclVAT).toBe(120);
      expect(finalPriceWithVAT).toBeCloseTo(146.4, 2);
    });

    it('scenario: Confronto prezzi con vat_mode diversi', () => {
      const price1 = 100; // IVA esclusa
      const price2 = 122; // IVA inclusa

      // Normalizza entrambi a IVA esclusa per confronto
      const price1ExclVAT = price1; // Già esclusa
      const price2ExclVAT = extractPriceExclVAT(price2, 22); // 100€

      expect(price1ExclVAT).toBeCloseTo(price2ExclVAT, 2); // Prezzi equivalenti
    });

    it('scenario: Surcharges seguono vat_mode del listino', () => {
      // Listino IVA inclusa
      const basePriceInclVAT = 122; // 100€ + 22% IVA
      const surchargesInclVAT = 12.2; // 10€ + 22% IVA
      const totalInclVAT = basePriceInclVAT + surchargesInclVAT; // 134.20€

      // Normalizza a IVA esclusa per calcoli interni
      const basePriceExclVAT = extractPriceExclVAT(basePriceInclVAT, 22); // 100€
      const surchargesExclVAT = extractPriceExclVAT(surchargesInclVAT, 22); // 10€
      const totalExclVAT = basePriceExclVAT + surchargesExclVAT; // 110€

      expect(basePriceExclVAT).toBeCloseTo(100, 2);
      expect(surchargesExclVAT).toBeCloseTo(10, 2);
      expect(totalExclVAT).toBeCloseTo(110, 2);
    });
  });

  describe('6. Edge Cases', () => {
    it('gestisce prezzo zero', () => {
      expect(normalizePrice(0, 'excluded', 'included', 22)).toBe(0);
      expect(normalizePrice(0, 'included', 'excluded', 22)).toBe(0);
      expect(calculateVATAmount(0, 22)).toBe(0);
      expect(calculatePriceWithVAT(0, 22)).toBe(0);
    });

    it('gestisce IVA rate zero', () => {
      expect(normalizePrice(100, 'excluded', 'included', 0)).toBe(100);
      expect(calculateVATAmount(100, 0)).toBe(0);
      expect(calculatePriceWithVAT(100, 0)).toBe(100);
    });

    it('gestisce prezzi molto piccoli', () => {
      const result = normalizePrice(0.01, 'excluded', 'included', 22);
      // roundToTwoDecimals(0.0122) = 0.01 (arrotondamento finanziario a 2 decimali)
      expect(result).toBeCloseTo(0.01, 2);
    });

    it('gestisce prezzi molto grandi', () => {
      const result = normalizePrice(1000000, 'excluded', 'included', 22);
      expect(result).toBeCloseTo(1220000, 2);
    });
  });

  describe('7. Invarianti (ADR-001)', () => {
    it('Invariant #1: Margine sempre su base IVA esclusa', () => {
      // Base price IVA inclusa: 122€ (100€ + 22%)
      const basePriceInclVAT = 122;
      const basePriceExclVAT = extractPriceExclVAT(basePriceInclVAT, 22); // 100€
      const marginPercent = 20;
      const margin = (basePriceExclVAT * marginPercent) / 100; // 20€ su base esclusa
      const finalPriceExclVAT = basePriceExclVAT + margin; // 120€

      expect(margin).toBe(20); // Margine calcolato su base esclusa
      expect(finalPriceExclVAT).toBe(120);
    });

    it('Invariant #2: Normalizzazione bidirezionale', () => {
      const originalPrice = 100;
      const normalized = normalizePrice(originalPrice, 'excluded', 'included', 22);
      const backToOriginal = normalizePrice(normalized, 'included', 'excluded', 22);

      expect(backToOriginal).toBeCloseTo(originalPrice, 2);
    });

    it('Invariant #3: Confronto prezzi solo dopo normalizzazione', () => {
      const price1 = 100; // IVA esclusa
      const price2 = 122; // IVA inclusa

      // ❌ SBAGLIATO: confronto diretto
      expect(price1).not.toBe(price2);

      // ✅ CORRETTO: normalizza prima di confrontare
      const price1ExclVAT = price1;
      const price2ExclVAT = extractPriceExclVAT(price2, 22);
      expect(price1ExclVAT).toBeCloseTo(price2ExclVAT, 2);
    });
  });
});
