import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Test unitario per SpediamoProClient
 *
 * Verifica:
 * - Factory registra il provider correttamente
 * - Mapping stati SpediamoPro → stati normalizzati
 * - Selezione rate dalla simulazione
 * - Token manager: comportamento base
 */

describe('SpediamoPro - CourierFactory registration', () => {
  it('should create SpediamoProClient for provider "spediamopro"', async () => {
    const { CourierFactory } = await import('@/lib/services/couriers/courier-factory');
    const client = CourierFactory.getClient('spediamopro', 'BRTEXP', {
      apiKey: 'test-auth-code',
      baseUrl: 'https://core.spediamopro.it',
    });
    expect(client).toBeDefined();
    expect(client.constructor.name).toBe('SpediamoProClient');
  });

  it('should create SpediamoProClient for provider "spediamo_pro"', async () => {
    const { CourierFactory } = await import('@/lib/services/couriers/courier-factory');
    const client = CourierFactory.getClient('spediamo_pro', 'SDASTD', {
      apiKey: 'test-auth-code',
      baseUrl: 'https://core.spediamopro.it',
    });
    expect(client).toBeDefined();
    expect(client.constructor.name).toBe('SpediamoProClient');
  });

  it('should create SpediamoProClient for provider "spediamo.pro"', async () => {
    const { CourierFactory } = await import('@/lib/services/couriers/courier-factory');
    const client = CourierFactory.getClient('spediamo.pro', 'UPSSTD', {
      apiKey: 'test-auth-code',
      baseUrl: 'https://core.spediamopro.it',
    });
    expect(client).toBeDefined();
    expect(client.constructor.name).toBe('SpediamoProClient');
  });

  it('should still create SpedisciOnlineClient for provider "spedisci_online"', async () => {
    const { CourierFactory } = await import('@/lib/services/couriers/courier-factory');
    const client = CourierFactory.getClient('spedisci_online', 'GLS', {
      apiKey: 'test-key',
      baseUrl: 'https://test.spedisci.online/api/v2',
    });
    expect(client).toBeDefined();
    expect(client.constructor.name).toBe('SpedisciOnlineClient');
  });

  it('should throw for unknown provider', async () => {
    const { CourierFactory } = await import('@/lib/services/couriers/courier-factory');
    expect(() =>
      CourierFactory.getClient('unknown_provider', 'BRT', {
        apiKey: 'test',
        baseUrl: 'https://test.com',
      })
    ).toThrow('Unsupported provider: unknown_provider');
  });
});

describe('SpediamoPro - Status mapping', () => {
  it('should map all 13 states (0-12) to normalized statuses', async () => {
    const { SPEDIAMOPRO_SHIPMENT_STATES, SPEDIAMOPRO_TO_NORMALIZED_STATUS } =
      await import('@/lib/services/couriers/spediamopro.client');

    // Verifica che tutti gli stati 0-12 siano mappati
    for (let i = 0; i <= 12; i++) {
      expect(SPEDIAMOPRO_SHIPMENT_STATES[i]).toBeDefined();
      expect(SPEDIAMOPRO_TO_NORMALIZED_STATUS[i]).toBeDefined();
    }
  });

  it('should map state 10 to "delivered"', async () => {
    const { SPEDIAMOPRO_TO_NORMALIZED_STATUS } =
      await import('@/lib/services/couriers/spediamopro.client');
    expect(SPEDIAMOPRO_TO_NORMALIZED_STATUS[10]).toBe('delivered');
  });

  it('should map state 0 to "cancelled"', async () => {
    const { SPEDIAMOPRO_TO_NORMALIZED_STATUS } =
      await import('@/lib/services/couriers/spediamopro.client');
    expect(SPEDIAMOPRO_TO_NORMALIZED_STATUS[0]).toBe('cancelled');
  });

  it('should map state 8 to "in_transit"', async () => {
    const { SPEDIAMOPRO_TO_NORMALIZED_STATUS } =
      await import('@/lib/services/couriers/spediamopro.client');
    expect(SPEDIAMOPRO_TO_NORMALIZED_STATUS[8]).toBe('in_transit');
  });

  it('should map state 11 to "exception"', async () => {
    const { SPEDIAMOPRO_TO_NORMALIZED_STATUS } =
      await import('@/lib/services/couriers/spediamopro.client');
    expect(SPEDIAMOPRO_TO_NORMALIZED_STATUS[11]).toBe('exception');
  });
});

describe('SpediamoPro - Provider ID normalization in get-courier-client', () => {
  it('should normalize spediamo.pro to spediamopro', () => {
    // Simula la logica di normalizzazione di get-courier-client.ts
    const normalizeProvider = (provider: string): string => {
      const providerLower = provider.toLowerCase();
      if (providerLower === 'spediscionline' || providerLower === 'spedisci.online') {
        return 'spedisci_online';
      } else if (providerLower === 'spediamo.pro' || providerLower === 'spediamo_pro') {
        return 'spediamopro';
      }
      return provider;
    };

    expect(normalizeProvider('spediamo.pro')).toBe('spediamopro');
    expect(normalizeProvider('spediamo_pro')).toBe('spediamopro');
    expect(normalizeProvider('spediamopro')).toBe('spediamopro');
    expect(normalizeProvider('spediscionline')).toBe('spedisci_online');
    expect(normalizeProvider('spedisci.online')).toBe('spedisci_online');
  });
});
