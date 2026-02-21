/**
 * Integration Tests: Address Validation CAP API
 *
 * Test della route POST /api/address/validate-cap
 * Usa dataset postale italiano (nessuna API esterna).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock next-auth per evitare errori di import
vi.mock('next-auth', () => ({ default: vi.fn() }));

describe('POST /api/address/validate-cap', () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const mod = await import('@/app/api/address/validate-cap/route');
    POST = mod.POST;
  });

  it('valida correttamente CAP/città/provincia coerenti', async () => {
    const req = new NextRequest('http://localhost/api/address/validate-cap', {
      method: 'POST',
      body: JSON.stringify({ cap: '20100', city: 'Milano', province: 'MI' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.valid).toBe(true);
  });

  it('rileva provincia errata per città nota', async () => {
    const req = new NextRequest('http://localhost/api/address/validate-cap', {
      method: 'POST',
      body: JSON.stringify({ cap: '20100', city: 'Milano', province: 'RM' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.valid).toBe(false);
    expect(data.suggestion?.correctProvince).toBe('MI');
  });

  it('lookup parziale solo città', async () => {
    const req = new NextRequest('http://localhost/api/address/validate-cap', {
      method: 'POST',
      body: JSON.stringify({ city: 'Roma' }),
    });

    const res = await POST(req);
    const data = await res.json();

    expect(data.success).toBe(true);
    expect(data.suggestion?.correctProvince).toBe('RM');
  });

  it('restituisce errore 400 senza campi', async () => {
    const req = new NextRequest('http://localhost/api/address/validate-cap', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
