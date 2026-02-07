/**
 * Test: Clausole standard preventivi commerciali
 *
 * Verifica che le clausole default siano presenti e dinamiche
 * in base a vatMode e vatRate.
 */

import { describe, expect, it } from 'vitest';
import { getDefaultClauses, mergeWithCustomClauses } from '@/lib/commercial-quotes/clauses';
import type { QuoteClause } from '@/types/commercial-quotes';

describe('getDefaultClauses', () => {
  it('dovrebbe restituire 8 clausole standard (senza processing)', () => {
    const clauses = getDefaultClauses('excluded');
    expect(clauses).toHaveLength(8);
    expect(clauses.every((c) => c.type === 'standard')).toBe(true);
  });

  it("dovrebbe restituire 9 clausole quando goodsNeedsProcessing e' attivo", () => {
    const clauses = getDefaultClauses('excluded', 22, { goodsNeedsProcessing: true });
    expect(clauses).toHaveLength(9);
    expect(clauses.every((c) => c.type === 'standard')).toBe(true);
    const processingClause = clauses.find((c) => c.title === 'Lavorazione');
    expect(processingClause).toBeDefined();
  });

  it('dovrebbe avere titoli unici per ogni clausola', () => {
    const clauses = getDefaultClauses('excluded');
    const titles = clauses.map((c) => c.title);
    const uniqueTitles = new Set(titles);
    expect(uniqueTitles.size).toBe(titles.length);
  });

  it('dovrebbe generare testo IVA esclusa quando vatMode=excluded', () => {
    const clauses = getDefaultClauses('excluded', 22);
    const ivaClause = clauses.find((c) => c.title === 'IVA');
    expect(ivaClause).toBeDefined();
    expect(ivaClause!.text).toContain('IVA esclusa');
    expect(ivaClause!.text).toContain('22%');
  });

  it('dovrebbe generare testo IVA inclusa quando vatMode=included', () => {
    const clauses = getDefaultClauses('included', 22);
    const ivaClause = clauses.find((c) => c.title === 'IVA');
    expect(ivaClause).toBeDefined();
    expect(ivaClause!.text).toContain('IVA inclusa');
    expect(ivaClause!.text).toContain('22%');
  });

  it('dovrebbe supportare aliquota IVA custom', () => {
    const clauses = getDefaultClauses('excluded', 10);
    const ivaClause = clauses.find((c) => c.title === 'IVA');
    expect(ivaClause!.text).toContain('10%');
  });

  it('dovrebbe usare vatRate default 22 se non specificata', () => {
    const clauses = getDefaultClauses('excluded');
    const ivaClause = clauses.find((c) => c.title === 'IVA');
    expect(ivaClause!.text).toContain('22%');
  });

  it('dovrebbe includere clausola peso volumetrico con divisore default 5000', () => {
    const clauses = getDefaultClauses('excluded');
    const volClause = clauses.find((c) => c.title === 'Peso volumetrico');
    expect(volClause).toBeDefined();
    expect(volClause!.text).toContain('5000');
  });

  it('dovrebbe rispettare options custom', () => {
    const clauses = getDefaultClauses('excluded', 22, {
      codFee: 3.5,
      insuranceLimit: 200,
      volumetricDivisor: 6000,
      deliveryTimeDays: '24h',
      deliveryTimeIslands: '72h',
    });

    const codClause = clauses.find((c) => c.title === 'Contrassegno');
    expect(codClause!.text).toContain('3.50');

    const insuranceClause = clauses.find((c) => c.title === 'Assicurazione');
    expect(insuranceClause!.text).toContain('200');

    const volClause = clauses.find((c) => c.title === 'Peso volumetrico');
    expect(volClause!.text).toContain('6000');

    const deliveryClause = clauses.find((c) => c.title === 'Tempi di consegna');
    expect(deliveryClause!.text).toContain('24h');
    expect(deliveryClause!.text).toContain('72h');
  });

  it('dovrebbe includere le clausole necessarie: ritiro, tracking, supplementi', () => {
    const clauses = getDefaultClauses('excluded');
    const titles = clauses.map((c) => c.title);

    expect(titles).toContain('Ritiro');
    expect(titles).toContain('Tracking');
    expect(titles).toContain('Supplementi esclusi');
    expect(titles).toContain('Tempi di consegna');
  });

  // --- Test Delivery Mode ---

  it('dovrebbe generare clausola ritiro corriere per carrier_pickup', () => {
    const clauses = getDefaultClauses('excluded', 22, { deliveryMode: 'carrier_pickup' });
    const pickupClause = clauses.find((c) => c.title === 'Ritiro');
    expect(pickupClause).toBeDefined();
    expect(pickupClause!.text).toContain('corriere');
  });

  it('dovrebbe generare clausola ritiro propria flotta per own_fleet', () => {
    const clauses = getDefaultClauses('excluded', 22, { deliveryMode: 'own_fleet' });
    const pickupClause = clauses.find((c) => c.title === 'Ritiro');
    expect(pickupClause).toBeDefined();
    expect(pickupClause!.text).toContain('nostra flotta');
  });

  it('dovrebbe generare clausola consegna al punto per client_dropoff', () => {
    const clauses = getDefaultClauses('excluded', 22, { deliveryMode: 'client_dropoff' });
    const consClause = clauses.find((c) => c.title === 'Consegna');
    expect(consClause).toBeDefined();
    expect(consClause!.text).toContain('punto/magazzino');
  });

  it('dovrebbe includere supplemento ritiro se specificato (carrier_pickup)', () => {
    const clauses = getDefaultClauses('excluded', 22, {
      deliveryMode: 'carrier_pickup',
      pickupFee: 3.5,
    });
    const pickupClause = clauses.find((c) => c.title === 'Ritiro');
    expect(pickupClause!.text).toContain('3.50');
    expect(pickupClause!.text).toContain('supplemento');
  });

  it('dovrebbe indicare ritiro gratuito se pickupFee nullo (own_fleet)', () => {
    const clauses = getDefaultClauses('excluded', 22, {
      deliveryMode: 'own_fleet',
      pickupFee: null,
    });
    const pickupClause = clauses.find((c) => c.title === 'Ritiro');
    expect(pickupClause!.text).toContain('gratuito');
  });

  // --- Test Lavorazione Merce ---

  it('dovrebbe NON includere clausola lavorazione se goodsNeedsProcessing=false', () => {
    const clauses = getDefaultClauses('excluded', 22, { goodsNeedsProcessing: false });
    const processingClause = clauses.find((c) => c.title === 'Lavorazione');
    expect(processingClause).toBeUndefined();
  });

  it('dovrebbe includere clausola lavorazione con costo se specificato', () => {
    const clauses = getDefaultClauses('excluded', 22, {
      goodsNeedsProcessing: true,
      processingFee: 1.5,
    });
    const processingClause = clauses.find((c) => c.title === 'Lavorazione');
    expect(processingClause).toBeDefined();
    expect(processingClause!.text).toContain('1.50');
    expect(processingClause!.text).toContain('IVA');
  });

  it('dovrebbe indicare lavorazione inclusa se processingFee nullo', () => {
    const clauses = getDefaultClauses('excluded', 22, {
      goodsNeedsProcessing: true,
      processingFee: null,
    });
    const processingClause = clauses.find((c) => c.title === 'Lavorazione');
    expect(processingClause).toBeDefined();
    expect(processingClause!.text).toContain('inclusa');
  });
});

describe('mergeWithCustomClauses', () => {
  it('dovrebbe unire clausole standard + custom', () => {
    const defaults = getDefaultClauses('excluded');
    const custom: QuoteClause[] = [
      { title: 'Pagamento', text: 'Pagamento a 30 giorni', type: 'custom' },
    ];

    const merged = mergeWithCustomClauses(defaults, custom);
    expect(merged).toHaveLength(defaults.length + 1);
    expect(merged[merged.length - 1].title).toBe('Pagamento');
    expect(merged[merged.length - 1].type).toBe('custom');
  });

  it('dovrebbe preservare ordine: standard prima, custom dopo', () => {
    const defaults = getDefaultClauses('excluded');
    const custom: QuoteClause[] = [
      { title: 'Custom 1', text: 'Testo 1', type: 'custom' },
      { title: 'Custom 2', text: 'Testo 2', type: 'custom' },
    ];

    const merged = mergeWithCustomClauses(defaults, custom);

    // Prime N clausole sono standard
    for (let i = 0; i < defaults.length; i++) {
      expect(merged[i].type).toBe('standard');
    }
    // Ultime sono custom
    expect(merged[defaults.length].type).toBe('custom');
    expect(merged[defaults.length + 1].type).toBe('custom');
  });

  it('dovrebbe restituire solo default se custom vuoto', () => {
    const defaults = getDefaultClauses('excluded');
    const merged = mergeWithCustomClauses(defaults, []);
    expect(merged).toHaveLength(defaults.length);
  });
});
