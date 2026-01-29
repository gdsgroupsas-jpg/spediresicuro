/**
 * Unit Tests: Google Places Adapter
 *
 * Test coverage per:
 * - MockPlacesAdapter: autocomplete e details
 * - Factory: createPlacesAdapter
 * - Session token handling
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockPlacesAdapter } from '@/lib/adapters/google-places/mock';
import { createPlacesAdapter } from '@/lib/adapters/google-places';

// ==================== MOCK ADAPTER ====================

describe('MockPlacesAdapter', () => {
  let adapter: MockPlacesAdapter;

  beforeEach(() => {
    adapter = new MockPlacesAdapter();
  });

  describe('autocomplete', () => {
    it('restituisce risultati per query corrispondente', async () => {
      const results = await adapter.autocomplete('Via Roma', {
        sessionToken: 'test-token',
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].placeId).toBeDefined();
      expect(results[0].description).toContain('Roma');
    });

    it('restituisce array vuoto per query troppo corta', async () => {
      const results = await adapter.autocomplete('Vi', {
        sessionToken: 'test-token',
      });
      expect(results).toEqual([]);
    });

    it('restituisce array vuoto per query senza match', async () => {
      const results = await adapter.autocomplete('Zzz Indirizzo Inesistente', {
        sessionToken: 'test-token',
      });
      expect(results).toEqual([]);
    });

    it('cerca per città', async () => {
      const results = await adapter.autocomplete('Milano', {
        sessionToken: 'test-token',
      });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].secondaryText).toContain('Milano');
    });
  });

  describe('getPlaceDetails', () => {
    it('restituisce dettagli per placeId valido', async () => {
      const details = await adapter.getPlaceDetails('mock-place-1', 'test-token');
      expect(details).not.toBeNull();
      expect(details!.city).toBe('Milano');
      expect(details!.province).toBe('MI');
      expect(details!.postalCode).toBe('20121');
      expect(details!.lat).toBeGreaterThan(0);
      expect(details!.lng).toBeGreaterThan(0);
    });

    it('restituisce null per placeId non esistente', async () => {
      const details = await adapter.getPlaceDetails('non-esiste', 'test-token');
      expect(details).toBeNull();
    });
  });

  describe('isAvailable', () => {
    it('è sempre disponibile', async () => {
      expect(await adapter.isAvailable()).toBe(true);
    });
  });
});

// ==================== FACTORY ====================

describe('createPlacesAdapter', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it('crea MockPlacesAdapter quando type=mock', () => {
    const adapter = createPlacesAdapter('mock');
    expect(adapter).toBeInstanceOf(MockPlacesAdapter);
  });

  it('crea MockPlacesAdapter in auto mode senza API key', () => {
    vi.stubEnv('GOOGLE_PLACES_API_KEY', '');
    vi.stubEnv('GOOGLE_MAPS_API_KEY', '');
    const adapter = createPlacesAdapter('auto');
    expect(adapter).toBeInstanceOf(MockPlacesAdapter);
  });
});
