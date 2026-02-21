/**
 * Test: Delivery Mode (Fase A - Preventivatore Intelligente)
 *
 * Verifica la logica di delivery mode nel preventivatore commerciale:
 * - Clausole dinamiche per carrier_pickup / own_fleet / client_dropoff
 * - Pickup fee nel testo clausola
 * - Matrix builder con delivery_mode e pickup_fee nello snapshot
 * - Tipi DeliveryMode e DELIVERY_MODES
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getDefaultClauses, mergeWithCustomClauses } from '@/lib/commercial-quotes/clauses';
import type { DeliveryMode, QuoteClause } from '@/types/commercial-quotes';
import { DELIVERY_MODES } from '@/types/commercial-quotes';

// ============================================
// DELIVERY MODES TYPES
// ============================================

describe('DeliveryMode types', () => {
  it('dovrebbe avere 3 modalita di consegna definite', () => {
    expect(DELIVERY_MODES).toHaveLength(3);
  });

  it('dovrebbe avere carrier_pickup, own_fleet, client_dropoff', () => {
    const values = DELIVERY_MODES.map((m) => m.value);
    expect(values).toContain('carrier_pickup');
    expect(values).toContain('own_fleet');
    expect(values).toContain('client_dropoff');
  });

  it('ogni modalita deve avere label e description', () => {
    for (const mode of DELIVERY_MODES) {
      expect(mode.label).toBeTruthy();
      expect(mode.description).toBeTruthy();
      expect(mode.label.length).toBeGreaterThan(0);
      expect(mode.description.length).toBeGreaterThan(0);
    }
  });
});

// ============================================
// CLAUSOLE CON DELIVERY MODE
// ============================================

describe('getDefaultClauses con deliveryMode', () => {
  it('default (carrier_pickup) - clausola ritiro gratuito corriere', () => {
    const clauses = getDefaultClauses('excluded', 22);
    const ritiro = clauses.find((c) => c.title === 'Ritiro');
    expect(ritiro).toBeDefined();
    expect(ritiro!.text).toContain('corriere');
    expect(ritiro!.text).toContain('gratuito');
    expect(ritiro!.type).toBe('standard');
  });

  it('carrier_pickup esplicito - clausola ritiro corriere', () => {
    const clauses = getDefaultClauses('excluded', 22, { deliveryMode: 'carrier_pickup' });
    const ritiro = clauses.find((c) => c.title === 'Ritiro');
    expect(ritiro).toBeDefined();
    expect(ritiro!.text).toContain('corriere');
  });

  it('carrier_pickup con pickup_fee - mostra supplemento', () => {
    const clauses = getDefaultClauses('excluded', 22, {
      deliveryMode: 'carrier_pickup',
      pickupFee: 3.5,
    });
    const ritiro = clauses.find((c) => c.title === 'Ritiro');
    expect(ritiro).toBeDefined();
    expect(ritiro!.text).toContain('3.50');
    expect(ritiro!.text).toContain('supplemento');
    expect(ritiro!.text).not.toContain('gratuito');
  });

  it('own_fleet - clausola ritiro con nostra flotta', () => {
    const clauses = getDefaultClauses('excluded', 22, { deliveryMode: 'own_fleet' });
    const ritiro = clauses.find((c) => c.title === 'Ritiro');
    expect(ritiro).toBeDefined();
    expect(ritiro!.text).toContain('nostra flotta');
    expect(ritiro!.text).toContain('gratuito');
  });

  it('own_fleet con pickup_fee - mostra supplemento flotta', () => {
    const clauses = getDefaultClauses('excluded', 22, {
      deliveryMode: 'own_fleet',
      pickupFee: 5.0,
    });
    const ritiro = clauses.find((c) => c.title === 'Ritiro');
    expect(ritiro).toBeDefined();
    expect(ritiro!.text).toContain('nostra flotta');
    expect(ritiro!.text).toContain('5.00');
    expect(ritiro!.text).toContain('supplemento');
  });

  it('client_dropoff - clausola consegna al punto (no ritiro)', () => {
    const clauses = getDefaultClauses('excluded', 22, { deliveryMode: 'client_dropoff' });
    // Con client_dropoff il titolo diventa "Consegna"
    const consegna = clauses.find((c) => c.title === 'Consegna');
    expect(consegna).toBeDefined();
    expect(consegna!.text).toContain('nostro punto');
    expect(consegna!.text).toContain('magazzino');
  });

  it('client_dropoff - non ha clausola Ritiro', () => {
    const clauses = getDefaultClauses('excluded', 22, { deliveryMode: 'client_dropoff' });
    const ritiro = clauses.find((c) => c.title === 'Ritiro');
    expect(ritiro).toBeUndefined();
  });

  it('pickup_fee null = gratuito', () => {
    const clauses = getDefaultClauses('excluded', 22, {
      deliveryMode: 'carrier_pickup',
      pickupFee: null,
    });
    const ritiro = clauses.find((c) => c.title === 'Ritiro');
    expect(ritiro!.text).toContain('gratuito');
  });

  it('pickup_fee 0 = gratuito', () => {
    const clauses = getDefaultClauses('excluded', 22, {
      deliveryMode: 'carrier_pickup',
      pickupFee: 0,
    });
    const ritiro = clauses.find((c) => c.title === 'Ritiro');
    expect(ritiro!.text).toContain('gratuito');
  });

  it('mantiene 8 clausole totali indipendentemente dal delivery mode', () => {
    const modes: DeliveryMode[] = ['carrier_pickup', 'own_fleet', 'client_dropoff'];
    for (const mode of modes) {
      const clauses = getDefaultClauses('excluded', 22, { deliveryMode: mode });
      expect(clauses).toHaveLength(8);
    }
  });

  it('clausole IVA e altre non cambiano con delivery mode', () => {
    const carrierClauses = getDefaultClauses('excluded', 22, { deliveryMode: 'carrier_pickup' });
    const fleetClauses = getDefaultClauses('excluded', 22, { deliveryMode: 'own_fleet' });

    // IVA identica
    const carrierIva = carrierClauses.find((c) => c.title === 'IVA');
    const fleetIva = fleetClauses.find((c) => c.title === 'IVA');
    expect(carrierIva!.text).toBe(fleetIva!.text);

    // Tracking identico
    const carrierTracking = carrierClauses.find((c) => c.title === 'Tracking');
    const fleetTracking = fleetClauses.find((c) => c.title === 'Tracking');
    expect(carrierTracking!.text).toBe(fleetTracking!.text);
  });
});

// ============================================
// MERGE CLAUSOLE CON DELIVERY MODE
// ============================================

describe('mergeWithCustomClauses con delivery mode', () => {
  it('dovrebbe preservare clausole custom dopo cambio delivery mode', () => {
    const defaults = getDefaultClauses('excluded', 22, { deliveryMode: 'own_fleet' });
    const custom: QuoteClause[] = [
      { title: 'Pagamento', text: 'Pagamento a 30 giorni', type: 'custom' },
    ];

    const merged = mergeWithCustomClauses(defaults, custom);
    expect(merged).toHaveLength(defaults.length + 1);

    // Verifica che la clausola flotta sia presente
    const ritiro = merged.find((c) => c.title === 'Ritiro');
    expect(ritiro!.text).toContain('nostra flotta');

    // Verifica che la custom sia alla fine
    expect(merged[merged.length - 1].title).toBe('Pagamento');
  });
});

// ============================================
// MATRIX BUILDER CON DELIVERY MODE
// ============================================

// Mock supabaseAdmin
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockFrom = vi.fn();

let mockEntries: any[] = [];

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
                  return { data: mockEntries, error: null };
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

beforeEach(() => {
  vi.clearAllMocks();
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
  ];
});

describe('buildPriceMatrix con delivery mode', () => {
  const baseParams = {
    priceListId: 'test-pl-id',
    marginPercent: 20,
    workspaceId: 'test-ws-id',
    carrierDisplayName: 'GLS',
  };

  it('dovrebbe includere delivery_mode default (carrier_pickup) nello snapshot', async () => {
    const matrix = await buildPriceMatrix(baseParams);
    expect(matrix.delivery_mode).toBe('carrier_pickup');
  });

  it('dovrebbe includere delivery_mode own_fleet nello snapshot', async () => {
    const matrix = await buildPriceMatrix({ ...baseParams, deliveryMode: 'own_fleet' });
    expect(matrix.delivery_mode).toBe('own_fleet');
  });

  it('dovrebbe includere delivery_mode client_dropoff nello snapshot', async () => {
    const matrix = await buildPriceMatrix({ ...baseParams, deliveryMode: 'client_dropoff' });
    expect(matrix.delivery_mode).toBe('client_dropoff');
  });

  it('dovrebbe includere pickup_fee nello snapshot', async () => {
    const matrix = await buildPriceMatrix({ ...baseParams, pickupFee: 3.5 });
    expect(matrix.pickup_fee).toBe(3.5);
  });

  it('dovrebbe avere pickup_fee null di default', async () => {
    const matrix = await buildPriceMatrix(baseParams);
    expect(matrix.pickup_fee).toBeNull();
  });

  it('pickup_fee non altera la matrice prezzi', async () => {
    const matrixSenza = await buildPriceMatrix(baseParams);
    const matrixCon = await buildPriceMatrix({ ...baseParams, pickupFee: 10.0 });

    // Stessi prezzi nella matrice (pickup fee e' separato)
    expect(matrixCon.prices).toEqual(matrixSenza.prices);
  });

  it('delivery_mode non altera la matrice prezzi', async () => {
    const matrixCarrier = await buildPriceMatrix({
      ...baseParams,
      deliveryMode: 'carrier_pickup',
    });
    const matrixFleet = await buildPriceMatrix({ ...baseParams, deliveryMode: 'own_fleet' });
    const matrixDropoff = await buildPriceMatrix({
      ...baseParams,
      deliveryMode: 'client_dropoff',
    });

    // Stessi prezzi indipendentemente dal delivery mode
    expect(matrixCarrier.prices).toEqual(matrixFleet.prices);
    expect(matrixFleet.prices).toEqual(matrixDropoff.prices);
  });
});
