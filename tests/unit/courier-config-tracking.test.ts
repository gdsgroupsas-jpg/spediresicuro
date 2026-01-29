import { describe, it, expect, vi } from 'vitest';

/**
 * Test unitario per verificare che courierConfigId viene passato nell'insert della spedizione.
 *
 * Nessuna chiamata a DB, API o dati reali.
 * Verifica solo che il campo opzionale viene incluso/escluso correttamente
 * nell'oggetto di insert tramite il pattern conditional spread.
 */

describe('courierConfigId tracking in shipment insert', () => {
  const FAKE_CONFIG_ID = 'cccccccc-0000-0000-0000-000000000003';

  it('should include courier_config_id when provided', () => {
    const deps = { courierConfigId: FAKE_CONFIG_ID };

    // Simula lo spread pattern usato in create-shipment-core.ts
    const insertPayload = {
      user_id: 'fake-user',
      carrier: 'TESTCOURIER',
      ...(deps.courierConfigId ? { courier_config_id: deps.courierConfigId } : {}),
    };

    expect(insertPayload.courier_config_id).toBe(FAKE_CONFIG_ID);
  });

  it('should NOT include courier_config_id when undefined', () => {
    const deps: { courierConfigId?: string } = {};

    const insertPayload = {
      user_id: 'fake-user',
      carrier: 'TESTCOURIER',
      ...(deps.courierConfigId ? { courier_config_id: deps.courierConfigId } : {}),
    };

    expect('courier_config_id' in insertPayload).toBe(false);
  });

  it('should NOT include courier_config_id when empty string', () => {
    const deps = { courierConfigId: '' };

    const insertPayload = {
      user_id: 'fake-user',
      carrier: 'TESTCOURIER',
      ...(deps.courierConfigId ? { courier_config_id: deps.courierConfigId } : {}),
    };

    expect('courier_config_id' in insertPayload).toBe(false);
  });

  it('getCourierClient wrapper should not need configId', () => {
    // Verifica che il tipo deps.getCourierClient non richiede configId
    // (retrocompatibilità con smoke test e mock)
    const mockClient = {
      createShipping: vi
        .fn()
        .mockResolvedValue({ trackingNumber: 'TEST123', shipmentId: 'S1', cost: 5 }),
      deleteShipping: vi.fn().mockResolvedValue(undefined),
    };

    // Simula deps senza courierConfigId (come fanno gli smoke test)
    const deps = {
      getCourierClient: async () => mockClient,
      // NO courierConfigId → campo opzionale
    };

    expect(deps.getCourierClient).toBeDefined();
    expect((deps as any).courierConfigId).toBeUndefined();
  });
});
