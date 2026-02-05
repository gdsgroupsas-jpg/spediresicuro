/**
 * Test VAT Handler - Milestone 1
 *
 * Test parametrici per le funzioni di normalizzazione VAT.
 * Copertura completa di tutti i casi edge.
 */

import { describe, expect, it } from 'vitest';
import {
  isManuallyModified,
  normalizeCustomAndSupplierPrices,
  normalizePricesToExclVAT,
} from '@/lib/pricing/vat-handler';

describe('VAT Handler', () => {
  describe('normalizePricesToExclVAT', () => {
    // Caso base: IVA esclusa (passthrough)
    it('passthrough quando vatMode = excluded', () => {
      const result = normalizePricesToExclVAT(100, 10, 'excluded', 22);

      expect(result.basePriceExclVAT).toBe(100);
      expect(result.surchargesExclVAT).toBe(10);
      expect(result.totalCostExclVAT).toBe(110);
    });

    // Caso base: IVA inclusa (normalizzazione)
    it('normalizza quando vatMode = included', () => {
      const result = normalizePricesToExclVAT(122, 12.2, 'included', 22);

      expect(result.basePriceExclVAT).toBeCloseTo(100, 2);
      expect(result.surchargesExclVAT).toBeCloseTo(10, 2);
      expect(result.totalCostExclVAT).toBeCloseTo(110, 2);
    });

    // Retrocompatibilita: null = excluded
    it('tratta null come excluded (retrocompatibilita)', () => {
      const result = normalizePricesToExclVAT(100, 10, null, 22);

      expect(result.basePriceExclVAT).toBe(100);
      expect(result.surchargesExclVAT).toBe(10);
      expect(result.totalCostExclVAT).toBe(110);
    });

    // Edge case: surcharges = 0
    it('gestisce surcharges = 0', () => {
      const result = normalizePricesToExclVAT(122, 0, 'included', 22);

      expect(result.basePriceExclVAT).toBeCloseTo(100, 2);
      expect(result.surchargesExclVAT).toBe(0);
      expect(result.totalCostExclVAT).toBeCloseTo(100, 2);
    });

    // Edge case: basePrice = 0
    it('gestisce basePrice = 0', () => {
      const result = normalizePricesToExclVAT(0, 12.2, 'included', 22);

      expect(result.basePriceExclVAT).toBe(0);
      expect(result.surchargesExclVAT).toBeCloseTo(10, 2);
      expect(result.totalCostExclVAT).toBeCloseTo(10, 2);
    });

    // Aliquota IVA diversa (4%)
    it('usa aliquota IVA custom (4%)', () => {
      const result = normalizePricesToExclVAT(104, 10.4, 'included', 4);

      expect(result.basePriceExclVAT).toBeCloseTo(100, 2);
      expect(result.surchargesExclVAT).toBeCloseTo(10, 2);
      expect(result.totalCostExclVAT).toBeCloseTo(110, 2);
    });

    // Aliquota IVA diversa (10%)
    it('usa aliquota IVA custom (10%)', () => {
      const result = normalizePricesToExclVAT(110, 11, 'included', 10);

      expect(result.basePriceExclVAT).toBeCloseTo(100, 2);
      expect(result.surchargesExclVAT).toBeCloseTo(10, 2);
      expect(result.totalCostExclVAT).toBeCloseTo(110, 2);
    });

    // Default vatRate = 22
    it('usa default vatRate 22 se non specificato', () => {
      const result = normalizePricesToExclVAT(122, 0, 'included');

      expect(result.basePriceExclVAT).toBeCloseTo(100, 2);
    });
  });

  describe('normalizeCustomAndSupplierPrices', () => {
    // Caso: stesso vat_mode (entrambi included)
    it('normalizza quando entrambi included', () => {
      const result = normalizeCustomAndSupplierPrices(
        { basePrice: 122, surcharges: 12.2 },
        'included',
        22,
        122,
        12.2,
        'included',
        22
      );

      expect(result.basePriceExclVAT).toBeCloseTo(100, 2);
      expect(result.totalCostExclVAT).toBeCloseTo(110, 2);
      expect(result.supplierBasePriceExclVAT).toBeCloseTo(100, 2);
      expect(result.supplierTotalCostExclVAT).toBeCloseTo(110, 2);
    });

    // Caso: vat_mode diversi (custom included, master excluded)
    it('normalizza con vat_mode diversi (custom included, master excluded)', () => {
      const result = normalizeCustomAndSupplierPrices(
        { basePrice: 122, surcharges: 0 },
        'included',
        22,
        100,
        0,
        'excluded',
        22
      );

      expect(result.basePriceExclVAT).toBeCloseTo(100, 2);
      expect(result.totalCostExclVAT).toBeCloseTo(100, 2);
      expect(result.supplierBasePriceExclVAT).toBe(100);
      expect(result.supplierTotalCostExclVAT).toBe(100);
    });

    // Caso: vat_mode diversi (custom excluded, master included)
    it('normalizza con vat_mode diversi (custom excluded, master included)', () => {
      const result = normalizeCustomAndSupplierPrices(
        { basePrice: 100, surcharges: 0 },
        'excluded',
        22,
        122,
        0,
        'included',
        22
      );

      expect(result.basePriceExclVAT).toBe(100);
      expect(result.totalCostExclVAT).toBe(100);
      expect(result.supplierBasePriceExclVAT).toBeCloseTo(100, 2);
      expect(result.supplierTotalCostExclVAT).toBeCloseTo(100, 2);
    });

    // Caso: aliquote diverse tra custom e master
    it('gestisce aliquote IVA diverse', () => {
      const result = normalizeCustomAndSupplierPrices(
        { basePrice: 122, surcharges: 0 },
        'included',
        22,
        110,
        0,
        'included',
        10
      );

      expect(result.basePriceExclVAT).toBeCloseTo(100, 2);
      expect(result.supplierBasePriceExclVAT).toBeCloseTo(100, 2);
    });

    // Caso: supplier con surcharges
    it('normalizza supplier con surcharges', () => {
      const result = normalizeCustomAndSupplierPrices(
        { basePrice: 134.2, surcharges: 12.2 }, // 110 + 10 = 120 base, +22% = 146.4
        'included',
        22,
        122,
        12.2, // 100 + 10 = 110 base, con IVA = 134.2
        'included',
        22
      );

      expect(result.totalCostExclVAT).toBeCloseTo(120, 2);
      expect(result.supplierTotalCostExclVAT).toBeCloseTo(110, 2);
    });
  });

  describe('isManuallyModified', () => {
    // Caso: prezzi identici
    it('ritorna false quando prezzi identici', () => {
      expect(isManuallyModified(100, 100)).toBe(false);
    });

    // Caso: prezzi diversi
    it('ritorna true quando prezzi diversi', () => {
      expect(isManuallyModified(110, 100)).toBe(true);
    });

    // Caso: differenza sotto tolleranza
    it('ritorna false quando differenza sotto tolleranza', () => {
      expect(isManuallyModified(100.005, 100)).toBe(false);
    });

    // Caso: differenza sopra tolleranza
    it('ritorna true quando differenza sopra tolleranza', () => {
      expect(isManuallyModified(100.02, 100)).toBe(true);
    });

    // Caso: supplier = 0 (no master list)
    it('ritorna false quando supplierTotal = 0', () => {
      expect(isManuallyModified(100, 0)).toBe(false);
    });

    // Caso: tolleranza custom
    it('usa tolleranza custom', () => {
      expect(isManuallyModified(100.5, 100, 1)).toBe(false);
      expect(isManuallyModified(101.5, 100, 1)).toBe(true);
    });

    // Caso: prezzo custom minore del supplier (sconto)
    it('rileva modifica anche con prezzo custom minore', () => {
      expect(isManuallyModified(90, 100)).toBe(true);
    });
  });

  // Test di integrazione: scenario reale
  describe('Scenario reale: listino personalizzato con master', () => {
    it('calcola correttamente margine implicito quando prezzi modificati', () => {
      // Scenario: master list IVA esclusa 100, custom list IVA inclusa 134.2 (110 + 22%)
      const normalized = normalizeCustomAndSupplierPrices(
        { basePrice: 134.2, surcharges: 0 },
        'included',
        22,
        100,
        0,
        'excluded',
        22
      );

      expect(normalized.totalCostExclVAT).toBeCloseTo(110, 2);
      expect(normalized.supplierTotalCostExclVAT).toBe(100);

      const modified = isManuallyModified(
        normalized.totalCostExclVAT,
        normalized.supplierTotalCostExclVAT
      );
      expect(modified).toBe(true);

      // Margine implicito = 110 - 100 = 10 (10% su base fornitore)
      const implicitMargin = normalized.totalCostExclVAT - normalized.supplierTotalCostExclVAT;
      expect(implicitMargin).toBeCloseTo(10, 2);
    });

    it('non applica margine quando prezzi identici', () => {
      // Scenario: entrambi IVA inclusa 122, stesso prezzo
      const normalized = normalizeCustomAndSupplierPrices(
        { basePrice: 122, surcharges: 0 },
        'included',
        22,
        122,
        0,
        'included',
        22
      );

      expect(normalized.totalCostExclVAT).toBeCloseTo(100, 2);
      expect(normalized.supplierTotalCostExclVAT).toBeCloseTo(100, 2);

      const modified = isManuallyModified(
        normalized.totalCostExclVAT,
        normalized.supplierTotalCostExclVAT
      );
      expect(modified).toBe(false);
    });
  });
});
