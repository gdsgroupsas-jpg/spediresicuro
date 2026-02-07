/**
 * Test: Matrix Builder per preventivi commerciali
 *
 * Verifica costruzione matrice prezzi: margine, zone, peso volumetrico,
 * VAT, fallback e performance.
 *
 * Usa mock di supabaseAdmin per isolare la logica di calcolo.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock supabaseAdmin prima dell'import
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: (...args: any[]) => {
      mockFrom(...args);
      return {
        select: (...sArgs: any[]) => {
          mockSelect(...sArgs);
          return {
            eq: (...eArgs: any[]) => {
              mockEq(...eArgs);
              return {
                order: (...oArgs: any[]) => {
                  mockOrder(...oArgs);
                  return {
                    data: mockEntries,
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  },
}));

import { buildPriceMatrix } from '@/lib/commercial-quotes/matrix-builder';

// Entries mock: 3 zone x 2 fasce peso
let mockEntries: any[] = [];

const createEntries = (overrides?: Partial<any>[]) => {
  const defaults = [
    // IT-ITALIA, 0-5 kg, prezzo base 5.00
    {
      weight_from: 0,
      weight_to: 5,
      zone_code: 'IT-ITALIA',
      base_price: 5.0,
      service_type: 'standard',
      island_surcharge: 0,
      fuel_surcharge_percent: 0,
    },
    // IT-ITALIA, 5-10 kg, prezzo base 8.00
    {
      weight_from: 5,
      weight_to: 10,
      zone_code: 'IT-ITALIA',
      base_price: 8.0,
      service_type: 'standard',
      island_surcharge: 0,
      fuel_surcharge_percent: 0,
    },
    // IT-SICILIA, 0-5 kg, prezzo base 7.00
    {
      weight_from: 0,
      weight_to: 5,
      zone_code: 'IT-SICILIA',
      base_price: 7.0,
      service_type: 'standard',
      island_surcharge: 0,
      fuel_surcharge_percent: 0,
    },
    // IT-SICILIA, 5-10 kg, prezzo base 10.00
    {
      weight_from: 5,
      weight_to: 10,
      zone_code: 'IT-SICILIA',
      base_price: 10.0,
      service_type: 'standard',
      island_surcharge: 0,
      fuel_surcharge_percent: 0,
    },
    // IT-SARDEGNA, 0-5 kg, prezzo base 7.50
    {
      weight_from: 0,
      weight_to: 5,
      zone_code: 'IT-SARDEGNA',
      base_price: 7.5,
      service_type: 'standard',
      island_surcharge: 0,
      fuel_surcharge_percent: 0,
    },
    // IT-SARDEGNA, 5-10 kg, prezzo base 11.00
    {
      weight_from: 5,
      weight_to: 10,
      zone_code: 'IT-SARDEGNA',
      base_price: 11.0,
      service_type: 'standard',
      island_surcharge: 0,
      fuel_surcharge_percent: 0,
    },
  ];
  return overrides ? defaults.map((d, i) => ({ ...d, ...(overrides[i] || {}) })) : defaults;
};

beforeEach(() => {
  vi.clearAllMocks();
  mockEntries = createEntries();
});

describe('buildPriceMatrix', () => {
  const defaultParams = {
    priceListId: 'test-pl-id',
    marginPercent: 20,
    workspaceId: 'test-ws-id',
    carrierDisplayName: 'GLS',
    vatMode: 'excluded' as const,
    vatRate: 22,
  };

  it('dovrebbe costruire matrice con zone e fasce peso corrette', async () => {
    const matrix = await buildPriceMatrix(defaultParams);

    // 3 zone nell'ordine standard
    expect(matrix.zones).toEqual(['Italia', 'Sicilia', 'Sardegna']);

    // 2 fasce peso
    expect(matrix.weight_ranges).toHaveLength(2);
    expect(matrix.weight_ranges[0].from).toBe(0);
    expect(matrix.weight_ranges[0].to).toBe(5);
    expect(matrix.weight_ranges[1].from).toBe(5);
    expect(matrix.weight_ranges[1].to).toBe(10);
  });

  it('dovrebbe applicare margine del 20% ai prezzi', async () => {
    const matrix = await buildPriceMatrix(defaultParams);

    // IT-ITALIA 0-5kg: 5.00 * 1.20 = 6.00
    expect(matrix.prices[0][0]).toBe(6.0);

    // IT-ITALIA 5-10kg: 8.00 * 1.20 = 9.60
    expect(matrix.prices[1][0]).toBe(9.6);

    // IT-SICILIA 0-5kg: 7.00 * 1.20 = 8.40
    expect(matrix.prices[0][1]).toBe(8.4);

    // IT-SARDEGNA 5-10kg: 11.00 * 1.20 = 13.20
    expect(matrix.prices[1][2]).toBe(13.2);
  });

  it('dovrebbe applicare margine 0% (nessun ricarico)', async () => {
    const matrix = await buildPriceMatrix({ ...defaultParams, marginPercent: 0 });

    // Prezzi identici alla base
    expect(matrix.prices[0][0]).toBe(5.0);
    expect(matrix.prices[1][0]).toBe(8.0);
  });

  it('dovrebbe applicare margine alto (50%)', async () => {
    const matrix = await buildPriceMatrix({ ...defaultParams, marginPercent: 50 });

    // IT-ITALIA 0-5kg: 5.00 * 1.50 = 7.50
    expect(matrix.prices[0][0]).toBe(7.5);
  });

  it('dovrebbe arrotondare a 2 decimali', async () => {
    // Margine 33% su 5.00 = 6.65
    const matrix = await buildPriceMatrix({ ...defaultParams, marginPercent: 33 });
    expect(matrix.prices[0][0]).toBe(6.65);
  });

  it('dovrebbe ordinare zone secondo ordine standard (Italia, Sicilia, Calabria, Sardegna, Livigno)', async () => {
    const matrix = await buildPriceMatrix(defaultParams);

    // Verifica ordine: Italia prima, poi isole
    const zoneOrder = matrix.zones;
    const italiaIdx = zoneOrder.indexOf('Italia');
    const siciliaIdx = zoneOrder.indexOf('Sicilia');
    const sardegnaIdx = zoneOrder.indexOf('Sardegna');

    expect(italiaIdx).toBeLessThan(siciliaIdx);
    expect(siciliaIdx).toBeLessThan(sardegnaIdx);
  });

  it('dovrebbe includere carrier_display_name nello snapshot', async () => {
    const matrix = await buildPriceMatrix(defaultParams);
    expect(matrix.carrier_display_name).toBe('GLS');
  });

  it('dovrebbe includere vat_mode e vat_rate nello snapshot', async () => {
    const matrix = await buildPriceMatrix(defaultParams);
    expect(matrix.vat_mode).toBe('excluded');
    expect(matrix.vat_rate).toBe(22);
  });

  it('dovrebbe includere generated_at come ISO string', async () => {
    const matrix = await buildPriceMatrix(defaultParams);
    expect(matrix.generated_at).toBeDefined();
    // Verifica formato ISO
    expect(new Date(matrix.generated_at).toISOString()).toBe(matrix.generated_at);
  });

  it('dovrebbe avere matrice prices con dimensioni corrette (righe x colonne)', async () => {
    const matrix = await buildPriceMatrix(defaultParams);

    // 2 righe (fasce peso) x 3 colonne (zone)
    expect(matrix.prices).toHaveLength(2);
    expect(matrix.prices[0]).toHaveLength(3);
    expect(matrix.prices[1]).toHaveLength(3);
  });

  it('dovrebbe gestire island_surcharge', async () => {
    mockEntries = [
      {
        weight_from: 0,
        weight_to: 5,
        zone_code: 'IT-ITALIA',
        base_price: 5.0,
        service_type: 'standard',
        island_surcharge: 0,
        fuel_surcharge_percent: 0,
      },
      {
        weight_from: 0,
        weight_to: 5,
        zone_code: 'IT-SICILIA',
        base_price: 5.0,
        service_type: 'standard',
        island_surcharge: 2.0,
        fuel_surcharge_percent: 0,
      },
    ];

    const matrix = await buildPriceMatrix(defaultParams);

    // IT-ITALIA: 5.00 * 1.20 = 6.00
    expect(matrix.prices[0][0]).toBe(6.0);

    // IT-SICILIA: (5.00 + 2.00) * 1.20 = 8.40
    expect(matrix.prices[0][1]).toBe(8.4);
  });

  it('dovrebbe lanciare errore per listino senza voci', async () => {
    mockEntries = [];

    await expect(buildPriceMatrix(defaultParams)).rejects.toThrow('Listino senza voci di prezzo');
  });

  it('dovrebbe filtrare per service_type standard', async () => {
    mockEntries = [
      {
        weight_from: 0,
        weight_to: 5,
        zone_code: 'IT-ITALIA',
        base_price: 5.0,
        service_type: 'standard',
        island_surcharge: 0,
        fuel_surcharge_percent: 0,
      },
      {
        weight_from: 0,
        weight_to: 5,
        zone_code: 'IT-ITALIA',
        base_price: 15.0,
        service_type: 'express',
        island_surcharge: 0,
        fuel_surcharge_percent: 0,
      },
    ];

    const matrix = await buildPriceMatrix(defaultParams);

    // Solo standard: 5.00 * 1.20 = 6.00 (non 15.00 express)
    expect(matrix.prices[0][0]).toBe(6.0);
  });

  it('dovrebbe generare label fasce peso nel formato "X - Y kg"', async () => {
    const matrix = await buildPriceMatrix(defaultParams);
    expect(matrix.weight_ranges[0].label).toBe('0 - 5 kg');
    expect(matrix.weight_ranges[1].label).toBe('5 - 10 kg');
  });

  // --- Nuovi campi Fase A2 ---

  it('dovrebbe includere delivery_mode nello snapshot (default carrier_pickup)', async () => {
    const matrix = await buildPriceMatrix(defaultParams);
    expect(matrix.delivery_mode).toBe('carrier_pickup');
  });

  it('dovrebbe includere delivery_mode custom nello snapshot', async () => {
    const matrix = await buildPriceMatrix({ ...defaultParams, deliveryMode: 'own_fleet' });
    expect(matrix.delivery_mode).toBe('own_fleet');
  });

  it('dovrebbe includere pickup_fee nello snapshot (default null)', async () => {
    const matrix = await buildPriceMatrix(defaultParams);
    expect(matrix.pickup_fee).toBeNull();
  });

  it('dovrebbe includere pickup_fee custom nello snapshot', async () => {
    const matrix = await buildPriceMatrix({ ...defaultParams, pickupFee: 3.5 });
    expect(matrix.pickup_fee).toBe(3.5);
  });

  it('dovrebbe includere goods_needs_processing nello snapshot (default false)', async () => {
    const matrix = await buildPriceMatrix(defaultParams);
    expect(matrix.goods_needs_processing).toBe(false);
  });

  it('dovrebbe includere goods_needs_processing=true nello snapshot', async () => {
    const matrix = await buildPriceMatrix({ ...defaultParams, goodsNeedsProcessing: true });
    expect(matrix.goods_needs_processing).toBe(true);
  });

  it('dovrebbe includere processing_fee nello snapshot (default null)', async () => {
    const matrix = await buildPriceMatrix(defaultParams);
    expect(matrix.processing_fee).toBeNull();
  });

  it('dovrebbe includere processing_fee custom nello snapshot', async () => {
    const matrix = await buildPriceMatrix({
      ...defaultParams,
      goodsNeedsProcessing: true,
      processingFee: 1.5,
    });
    expect(matrix.processing_fee).toBe(1.5);
  });
});
