/**
 * Unit Tests: Margin Calculator
 *
 * Verifica che computeMargin() rispetti il principio:
 * "Un margine esiste SOLO se esistono dati reali"
 */

import { describe, it, expect } from 'vitest';
import {
  computeMargin,
  formatMarginDisplay,
  aggregateMargins,
  type MarginResult,
} from '@/lib/financial';

describe('computeMargin', () => {
  describe('platform con costo fornitore (provider_cost)', () => {
    it('calcola margine correttamente da provider_cost', () => {
      const result = computeMargin({
        finalPrice: 15.0,
        providerCost: 10.0,
        basePrice: null,
        apiSource: 'platform',
      });

      expect(result.isCalculable).toBe(true);
      expect(result.margin).toBe(5.0);
      expect(result.marginPercent).toBe(50.0);
      expect(result.reason).toBe('CALCULATED_FROM_PROVIDER_COST');
      expect(result.costSource).toBe('provider_cost');
    });

    it('gestisce margine negativo (perdita)', () => {
      const result = computeMargin({
        finalPrice: 8.0,
        providerCost: 10.0,
        basePrice: null,
        apiSource: 'platform',
      });

      expect(result.isCalculable).toBe(true);
      expect(result.margin).toBe(-2.0);
      expect(result.marginPercent).toBe(-20.0);
    });

    it('gestisce margine zero', () => {
      const result = computeMargin({
        finalPrice: 10.0,
        providerCost: 10.0,
        basePrice: null,
        apiSource: 'platform',
      });

      expect(result.isCalculable).toBe(true);
      expect(result.margin).toBe(0);
      expect(result.marginPercent).toBe(0);
    });

    it('prioritizza provider_cost rispetto a base_price', () => {
      const result = computeMargin({
        finalPrice: 15.0,
        providerCost: 10.0, // Priorità
        basePrice: 8.0, // Ignorato
        apiSource: 'platform',
      });

      expect(result.margin).toBe(5.0); // 15 - 10, non 15 - 8
      expect(result.costSource).toBe('provider_cost');
    });

    it('arrotonda correttamente a 2 decimali', () => {
      const result = computeMargin({
        finalPrice: 15.33,
        providerCost: 10.17,
        basePrice: null,
        apiSource: 'platform',
      });

      expect(result.margin).toBe(5.16);
      // marginPercent = 5.16 / 10.17 * 100 = 50.7374...
      expect(result.marginPercent).toBe(50.74);
    });
  });

  describe('platform con base_price (fallback)', () => {
    it('usa base_price quando provider_cost manca', () => {
      const result = computeMargin({
        finalPrice: 12.0,
        providerCost: null,
        basePrice: 10.0,
        apiSource: 'platform',
      });

      expect(result.isCalculable).toBe(true);
      expect(result.margin).toBe(2.0);
      expect(result.marginPercent).toBe(20.0);
      expect(result.reason).toBe('CALCULATED_FROM_BASE_PRICE');
      expect(result.costSource).toBe('base_price');
    });

    it('usa base_price quando provider_cost è 0', () => {
      const result = computeMargin({
        finalPrice: 12.0,
        providerCost: 0,
        basePrice: 10.0,
        apiSource: 'platform',
      });

      expect(result.isCalculable).toBe(true);
      expect(result.costSource).toBe('base_price');
    });

    it('usa base_price quando provider_cost è undefined', () => {
      const result = computeMargin({
        finalPrice: 12.0,
        providerCost: undefined,
        basePrice: 10.0,
        apiSource: 'platform',
      });

      expect(result.isCalculable).toBe(true);
      expect(result.costSource).toBe('base_price');
    });
  });

  describe('platform senza dati di costo', () => {
    it('ritorna null con reason MISSING_COST_DATA', () => {
      const result = computeMargin({
        finalPrice: 15.0,
        providerCost: null,
        basePrice: null,
        apiSource: 'platform',
      });

      expect(result.isCalculable).toBe(false);
      expect(result.margin).toBeNull();
      expect(result.marginPercent).toBeNull();
      expect(result.reason).toBe('MISSING_COST_DATA');
      expect(result.costSource).toBeNull();
    });

    it('ritorna null quando entrambi i costi sono 0', () => {
      const result = computeMargin({
        finalPrice: 15.0,
        providerCost: 0,
        basePrice: 0,
        apiSource: 'platform',
      });

      expect(result.isCalculable).toBe(false);
      expect(result.reason).toBe('MISSING_COST_DATA');
    });

    it('ritorna null quando entrambi i costi sono undefined', () => {
      const result = computeMargin({
        finalPrice: 15.0,
        providerCost: undefined,
        basePrice: undefined,
        apiSource: 'platform',
      });

      expect(result.isCalculable).toBe(false);
      expect(result.reason).toBe('MISSING_COST_DATA');
    });
  });

  describe('BYOC (contratto proprio)', () => {
    it('ritorna null con reason NOT_APPLICABLE_FOR_MODEL', () => {
      const result = computeMargin({
        finalPrice: 15.0,
        providerCost: 10.0,
        basePrice: 10.0,
        apiSource: 'byoc_own',
      });

      expect(result.isCalculable).toBe(false);
      expect(result.margin).toBeNull();
      expect(result.marginPercent).toBeNull();
      expect(result.reason).toBe('NOT_APPLICABLE_FOR_MODEL');
    });

    it('ignora i dati di costo anche se presenti', () => {
      const result = computeMargin({
        finalPrice: 20.0,
        providerCost: 5.0, // Ignorato
        basePrice: 5.0, // Ignorato
        apiSource: 'byoc_own',
      });

      expect(result.isCalculable).toBe(false);
      expect(result.margin).toBeNull();
    });
  });

  describe('reseller_own (contratto proprio reseller)', () => {
    it('ritorna null con reason NOT_APPLICABLE_FOR_MODEL', () => {
      const result = computeMargin({
        finalPrice: 15.0,
        providerCost: 10.0,
        basePrice: null,
        apiSource: 'reseller_own',
      });

      expect(result.isCalculable).toBe(false);
      expect(result.reason).toBe('NOT_APPLICABLE_FOR_MODEL');
    });
  });

  describe('finalPrice mancante o invalido', () => {
    it('ritorna null quando finalPrice è 0', () => {
      const result = computeMargin({
        finalPrice: 0,
        providerCost: 10.0,
        basePrice: null,
        apiSource: 'platform',
      });

      expect(result.isCalculable).toBe(false);
      expect(result.reason).toBe('MISSING_FINAL_PRICE');
    });

    it('ritorna null quando finalPrice è null', () => {
      const result = computeMargin({
        finalPrice: null,
        providerCost: 10.0,
        basePrice: null,
        apiSource: 'platform',
      });

      expect(result.isCalculable).toBe(false);
      expect(result.reason).toBe('MISSING_FINAL_PRICE');
    });

    it('ritorna null quando finalPrice è undefined', () => {
      const result = computeMargin({
        finalPrice: undefined,
        providerCost: 10.0,
        basePrice: null,
        apiSource: 'platform',
      });

      expect(result.isCalculable).toBe(false);
      expect(result.reason).toBe('MISSING_FINAL_PRICE');
    });

    it('ritorna null quando finalPrice è negativo', () => {
      const result = computeMargin({
        finalPrice: -5.0,
        providerCost: 10.0,
        basePrice: null,
        apiSource: 'platform',
      });

      expect(result.isCalculable).toBe(false);
      expect(result.reason).toBe('MISSING_FINAL_PRICE');
    });
  });

  describe('apiSource null o mancante (default platform)', () => {
    it('tratta apiSource null come platform', () => {
      const result = computeMargin({
        finalPrice: 15.0,
        providerCost: 10.0,
        basePrice: null,
        apiSource: null,
      });

      expect(result.isCalculable).toBe(true);
      expect(result.margin).toBe(5.0);
    });

    it('tratta apiSource undefined come platform', () => {
      const result = computeMargin({
        finalPrice: 15.0,
        providerCost: 10.0,
        basePrice: null,
        apiSource: undefined,
      });

      expect(result.isCalculable).toBe(true);
      expect(result.margin).toBe(5.0);
    });
  });
});

describe('formatMarginDisplay', () => {
  it('formatta margine positivo', () => {
    const result = computeMargin({
      finalPrice: 15.0,
      providerCost: 10.0,
      basePrice: null,
      apiSource: 'platform',
    });

    const display = formatMarginDisplay(result);

    expect(display.value).toBe('€5.00 (50.0%)');
    expect(display.cssClass).toBe('positive');
    expect(display.tooltip).toBe('Calcolato da costo fornitore reale');
  });

  it('formatta margine negativo', () => {
    const result = computeMargin({
      finalPrice: 8.0,
      providerCost: 10.0,
      basePrice: null,
      apiSource: 'platform',
    });

    const display = formatMarginDisplay(result);

    expect(display.value).toBe('€-2.00 (-20.0%)');
    expect(display.cssClass).toBe('negative');
  });

  it('formatta margine zero', () => {
    const result = computeMargin({
      finalPrice: 10.0,
      providerCost: 10.0,
      basePrice: null,
      apiSource: 'platform',
    });

    const display = formatMarginDisplay(result);

    expect(display.value).toBe('€0.00 (0.0%)');
    expect(display.cssClass).toBe('neutral');
  });

  it('mostra N/A per margine non calcolabile', () => {
    const result = computeMargin({
      finalPrice: 15.0,
      providerCost: null,
      basePrice: null,
      apiSource: 'platform',
    });

    const display = formatMarginDisplay(result);

    expect(display.value).toBe('N/A');
    expect(display.cssClass).toBe('unavailable');
    expect(display.tooltip).toBe('Costo fornitore non disponibile');
  });

  it('mostra tooltip corretto per BYOC', () => {
    const result = computeMargin({
      finalPrice: 15.0,
      providerCost: 10.0,
      basePrice: null,
      apiSource: 'byoc_own',
    });

    const display = formatMarginDisplay(result);

    expect(display.value).toBe('N/A');
    expect(display.tooltip).toBe('Contratto proprio (BYOC/Reseller)');
  });

  it('mostra tooltip per base_price', () => {
    const result = computeMargin({
      finalPrice: 12.0,
      providerCost: null,
      basePrice: 10.0,
      apiSource: 'platform',
    });

    const display = formatMarginDisplay(result);

    expect(display.tooltip).toBe('Calcolato da prezzo base listino');
  });
});

describe('aggregateMargins', () => {
  it('aggrega margini calcolabili', () => {
    const results: MarginResult[] = [
      computeMargin({ finalPrice: 15, providerCost: 10, basePrice: null, apiSource: 'platform' }),
      computeMargin({ finalPrice: 20, providerCost: 15, basePrice: null, apiSource: 'platform' }),
      computeMargin({ finalPrice: 12, providerCost: 10, basePrice: null, apiSource: 'platform' }),
    ];

    const aggregate = aggregateMargins(results);

    expect(aggregate.totalMargin).toBe(12.0); // 5 + 5 + 2
    expect(aggregate.calculableCount).toBe(3);
    expect(aggregate.excludedCount).toBe(0);
  });

  it('esclude margini non calcolabili dal totale', () => {
    const results: MarginResult[] = [
      computeMargin({ finalPrice: 15, providerCost: 10, basePrice: null, apiSource: 'platform' }), // +5
      computeMargin({ finalPrice: 15, providerCost: null, basePrice: null, apiSource: 'platform' }), // escluso
      computeMargin({ finalPrice: 20, providerCost: 15, basePrice: null, apiSource: 'byoc_own' }), // escluso
    ];

    const aggregate = aggregateMargins(results);

    expect(aggregate.totalMargin).toBe(5.0);
    expect(aggregate.calculableCount).toBe(1);
    expect(aggregate.excludedCount).toBe(2);
  });

  it('traccia reasons per esclusioni', () => {
    const results: MarginResult[] = [
      computeMargin({ finalPrice: 15, providerCost: null, basePrice: null, apiSource: 'platform' }),
      computeMargin({ finalPrice: 15, providerCost: null, basePrice: null, apiSource: 'platform' }),
      computeMargin({ finalPrice: 20, providerCost: 15, basePrice: null, apiSource: 'byoc_own' }),
    ];

    const aggregate = aggregateMargins(results);

    expect(aggregate.excludedReasons['MISSING_COST_DATA']).toBe(2);
    expect(aggregate.excludedReasons['NOT_APPLICABLE_FOR_MODEL']).toBe(1);
  });

  it('gestisce array vuoto', () => {
    const aggregate = aggregateMargins([]);

    expect(aggregate.totalMargin).toBe(0);
    expect(aggregate.calculableCount).toBe(0);
    expect(aggregate.excludedCount).toBe(0);
  });
});
