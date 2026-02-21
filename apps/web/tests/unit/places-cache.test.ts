/**
 * Unit Tests: places-cache.ts
 *
 * Test coverage per cache Redis Google Places:
 * - Cache hit/miss autocomplete
 * - Cache hit/miss place details
 * - Graceful degradation se Redis non disponibile
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getCachedAutocomplete,
  setCachedAutocomplete,
  getCachedPlaceDetails,
  setCachedPlaceDetails,
} from '@/lib/address/places-cache';
import type { PlacesAutocompleteResult, PlaceDetails } from '@/lib/adapters/google-places/base';

// Mock Redis
const mockGet = vi.fn();
const mockSetex = vi.fn();

vi.mock('@/lib/db/redis', () => ({
  getRedis: vi.fn(() => ({
    get: mockGet,
    setex: mockSetex,
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

// ==================== AUTOCOMPLETE CACHE ====================

describe('autocomplete cache', () => {
  const mockResults: PlacesAutocompleteResult[] = [
    {
      placeId: 'place-1',
      description: 'Via Roma, 20, 20121 Milano MI',
      mainText: 'Via Roma, 20',
      secondaryText: 'Milano, MI',
    },
  ];

  it('restituisce null su cache miss', async () => {
    mockGet.mockResolvedValue(null);
    const result = await getCachedAutocomplete('Via Roma');
    expect(result).toBeNull();
  });

  it('restituisce risultati su cache hit', async () => {
    mockGet.mockResolvedValue(mockResults);
    const result = await getCachedAutocomplete('Via Roma');
    expect(result).toEqual(mockResults);
  });

  it('salva risultati in cache', async () => {
    mockSetex.mockResolvedValue('OK');
    await setCachedAutocomplete('Via Roma', mockResults);
    expect(mockSetex).toHaveBeenCalledOnce();
    expect(mockSetex).toHaveBeenCalledWith(
      expect.stringContaining('places:ac:'),
      86400, // 24h
      expect.any(String)
    );
  });

  it('graceful degradation su errore Redis', async () => {
    mockGet.mockRejectedValue(new Error('Redis down'));
    const result = await getCachedAutocomplete('Via Roma');
    expect(result).toBeNull();
  });
});

// ==================== DETAILS CACHE ====================

describe('details cache', () => {
  const mockDetails: PlaceDetails = {
    streetName: 'Via Roma',
    streetNumber: '20',
    city: 'Milano',
    province: 'MI',
    postalCode: '20121',
    country: 'IT',
    lat: 45.4654,
    lng: 9.1859,
    formattedAddress: 'Via Roma, 20, 20121 Milano MI',
  };

  it('restituisce null su cache miss', async () => {
    mockGet.mockResolvedValue(null);
    const result = await getCachedPlaceDetails('place-1');
    expect(result).toBeNull();
  });

  it('restituisce dettagli su cache hit', async () => {
    mockGet.mockResolvedValue(mockDetails);
    const result = await getCachedPlaceDetails('place-1');
    expect(result).toEqual(mockDetails);
  });

  it('salva dettagli in cache con TTL 7 giorni', async () => {
    mockSetex.mockResolvedValue('OK');
    await setCachedPlaceDetails('place-1', mockDetails);
    expect(mockSetex).toHaveBeenCalledWith(
      'places:det:place-1',
      604800, // 7 giorni
      expect.any(String)
    );
  });
});

// ==================== REDIS NON DISPONIBILE ====================

describe('Redis non disponibile', () => {
  it('getCachedAutocomplete restituisce null', async () => {
    const { getRedis } = await import('@/lib/db/redis');
    vi.mocked(getRedis).mockReturnValue(null);

    const result = await getCachedAutocomplete('test');
    expect(result).toBeNull();
  });

  it('setCachedAutocomplete non fallisce', async () => {
    const { getRedis } = await import('@/lib/db/redis');
    vi.mocked(getRedis).mockReturnValue(null);

    await expect(setCachedAutocomplete('test', [])).resolves.not.toThrow();
  });
});
