/**
 * Integration Tests: Address Autocomplete API
 *
 * Test della route GET /api/address/autocomplete
 * Usa Mock Places adapter (nessuna API esterna).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { MockPlacesAdapter } from '@/lib/adapters/google-places/mock';

// Mock next-auth
vi.mock('next-auth', () => ({ default: vi.fn() }));

// Mock Redis (no Redis in test)
vi.mock('@/lib/db/redis', () => ({
  getRedis: vi.fn(() => null),
}));

// Mock places cache
vi.mock('@/lib/address/places-cache', () => ({
  getCachedAutocomplete: vi.fn(() => null),
  setCachedAutocomplete: vi.fn(),
}));

// Force mock adapter
vi.mock('@/lib/adapters/google-places', () => ({
  createPlacesAdapter: vi.fn(() => new MockPlacesAdapter()),
}));

describe('GET /api/address/autocomplete', () => {
  let GET: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/address/autocomplete/route');
    GET = mod.GET;
  });

  it('restituisce risultati per query valida', async () => {
    const url = 'http://localhost/api/address/autocomplete?q=Via+Roma&session=test-uuid';
    const req = new NextRequest(url);

    const res = await GET(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.results.length).toBeGreaterThan(0);
    expect(data.results[0].placeId).toBeDefined();
    expect(data.results[0].description).toContain('Roma');
  });

  it('restituisce errore 400 per query troppo corta', async () => {
    const url = 'http://localhost/api/address/autocomplete?q=Vi&session=test-uuid';
    const req = new NextRequest(url);

    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('restituisce errore 400 senza session token', async () => {
    const url = 'http://localhost/api/address/autocomplete?q=Via+Roma';
    const req = new NextRequest(url);

    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('restituisce array vuoto per query senza match', async () => {
    const url = 'http://localhost/api/address/autocomplete?q=Zzz+Inesistente&session=test-uuid';
    const req = new NextRequest(url);

    const res = await GET(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.results).toEqual([]);
  });
});
