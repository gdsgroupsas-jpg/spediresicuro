/**
 * Test Unit: WMS API (Products, Warehouses, Inventory, Purchase Orders)
 *
 * Verifica:
 * - Auth obbligatoria (401) per ogni route
 * - UUID validation (400)
 * - Membership + permessi warehouse:view / warehouse:manage (403)
 * - Rate limiting (429)
 * - Validazione campi obbligatori (400)
 * - CRUD prodotti: create, list, update, delete
 * - Inventory: stock update con validazione
 * - Purchase orders: create, list, status update
 * - Suppliers: list, create
 * - Service layer: calculateNetCost, calculateMarginPercent
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─── MOCK SETUP ───

const mockFrom = vi.fn();
const mockGetSafeAuth = vi.fn();
const mockIsSuperAdmin = vi.fn();

vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

vi.mock('@/lib/safe-auth', () => ({
  getSafeAuth: () => mockGetSafeAuth(),
  isSuperAdmin: (ctx: unknown) => mockIsSuperAdmin(ctx),
}));

vi.mock('@/lib/workspace-constants', () => ({
  isValidUUID: (v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v),
}));

// Mock rate limiting — default: permetti tutto
const mockRateLimit = vi.fn().mockResolvedValue({
  allowed: true,
  remaining: 99,
  resetAt: Date.now() + 60000,
  source: 'memory' as const,
});

vi.mock('@/lib/security/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

// ─── FIXTURES ───

const WORKSPACE_ID = '11111111-1111-1111-1111-111111111111';
const PRODUCT_ID = '22222222-2222-2222-2222-222222222222';
const WAREHOUSE_ID = '33333333-3333-3333-3333-333333333333';
const USER_ID = '44444444-4444-4444-4444-444444444444';
const SUPPLIER_ID = '55555555-5555-5555-5555-555555555555';
const ORDER_ID = '66666666-6666-6666-6666-666666666666';

function createRequest(url: string, init?: RequestInit) {
  return new Request(url, init);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSafeAuth.mockResolvedValue({ target: { id: USER_ID } });
  mockIsSuperAdmin.mockReturnValue(false);
});

// ─── Helper: mock membership con ruolo e permessi ───

function mockMembership(role: string, permissions: string[] = []) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'workspace_members') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { role, permissions, status: 'active' },
                  error: null,
                }),
            }),
          }),
        }),
      };
    }
    // Default per altre tabelle: products, warehouses, etc.
    return mockTable(table);
  });
}

function mockNoMembership() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'workspace_members') {
      // Chainable mock che gestisce sia la query membership diretta (.single())
      // sia la query fallback parent/child (.in() → array vuoto)
      const chainable: Record<string, any> = {};
      const methods = ['select', 'eq', 'in', 'not', 'order', 'range'];
      for (const m of methods) {
        chainable[m] = vi.fn().mockReturnValue(chainable);
      }
      // .single() → no membership trovata
      chainable.single = vi.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });
      // Quando la catena finisce senza .single() (es. parent/child query) → array vuoto
      chainable.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));
      return chainable;
    }
    if (table === 'workspaces') {
      // Mock per la query child workspace (verifyWmsAccess fallback)
      return mockTable(table);
    }
    return mockTable(table);
  });
}

function mockTable(table: string) {
  const chainable: Record<string, any> = {};
  const methods = [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'gt',
    'lte',
    'or',
    'order',
    'range',
    'single',
    'in',
    'not',
  ];
  for (const m of methods) {
    chainable[m] = vi.fn().mockReturnValue(chainable);
  }
  chainable.single = vi.fn().mockResolvedValue({ data: null, error: null });
  return chainable;
}

// ═══════════════════════════════════════
// PRODUCTS API
// ═══════════════════════════════════════

describe('Products API - /api/workspaces/[id]/products', () => {
  describe('GET (list)', () => {
    it('ritorna 401 se non autenticato', async () => {
      mockGetSafeAuth.mockResolvedValue(null);

      const { GET } = await import('@/app/api/workspaces/[workspaceId]/products/route');

      const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/products`);
      const res = await GET(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(401);
    });

    it('ritorna 400 se workspaceId non valido', async () => {
      const { GET } = await import('@/app/api/workspaces/[workspaceId]/products/route');

      const req = createRequest('http://localhost/api/workspaces/invalid-id/products');
      const res = await GET(req, { params: Promise.resolve({ workspaceId: 'invalid-id' }) });

      expect(res.status).toBe(400);
    });

    it('ritorna 403 se non membro', async () => {
      mockNoMembership();

      const { GET } = await import('@/app/api/workspaces/[workspaceId]/products/route');

      const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/products`);
      const res = await GET(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(403);
    });

    it('ritorna 429 se rate limited', async () => {
      mockMembership('admin');
      mockRateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0 });

      const { GET } = await import('@/app/api/workspaces/[workspaceId]/products/route');

      const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/products`);
      const res = await GET(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(429);
    });
  });

  describe('POST (create)', () => {
    it('ritorna 401 se non autenticato', async () => {
      mockGetSafeAuth.mockResolvedValue(null);

      const { POST } = await import('@/app/api/workspaces/[workspaceId]/products/route');

      const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: 'TEST-001', name: 'Test' }),
      });
      const res = await POST(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(401);
    });

    it('ritorna 403 per viewer (no warehouse:manage)', async () => {
      mockMembership('viewer');

      const { POST } = await import('@/app/api/workspaces/[workspaceId]/products/route');

      const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: 'TEST-001', name: 'Test' }),
      });
      const res = await POST(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(403);
    });

    it('ritorna 400 se SKU mancante', async () => {
      mockMembership('admin');

      const { POST } = await import('@/app/api/workspaces/[workspaceId]/products/route');

      const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test senza SKU' }),
      });
      const res = await POST(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('SKU');
    });

    it('ritorna 400 se nome mancante', async () => {
      mockMembership('admin');

      const { POST } = await import('@/app/api/workspaces/[workspaceId]/products/route');

      const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: 'TEST-001' }),
      });
      const res = await POST(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('Nome');
    });

    it('ritorna 400 per tipo prodotto non valido', async () => {
      mockMembership('admin');

      const { POST } = await import('@/app/api/workspaces/[workspaceId]/products/route');

      const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: 'TEST-001', name: 'Test', type: 'invalid' }),
      });
      const res = await POST(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(400);
    });
  });
});

// ═══════════════════════════════════════
// PRODUCT DETAIL API
// ═══════════════════════════════════════

describe('Product Detail API - /api/workspaces/[id]/products/[productId]', () => {
  describe('GET (detail)', () => {
    it('ritorna 400 se productId non valido', async () => {
      mockMembership('admin');

      const { GET } = await import('@/app/api/workspaces/[workspaceId]/products/[productId]/route');

      const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/products/bad-id`);
      const res = await GET(req, {
        params: Promise.resolve({ workspaceId: WORKSPACE_ID, productId: 'bad-id' }),
      });

      expect(res.status).toBe(400);
    });

    it('ritorna 401 se non autenticato', async () => {
      mockGetSafeAuth.mockResolvedValue(null);

      const { GET } = await import('@/app/api/workspaces/[workspaceId]/products/[productId]/route');

      const req = createRequest(
        `http://localhost/api/workspaces/${WORKSPACE_ID}/products/${PRODUCT_ID}`
      );
      const res = await GET(req, {
        params: Promise.resolve({ workspaceId: WORKSPACE_ID, productId: PRODUCT_ID }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe('DELETE', () => {
    it('ritorna 403 per viewer (no warehouse:manage)', async () => {
      mockMembership('viewer');

      const { DELETE } =
        await import('@/app/api/workspaces/[workspaceId]/products/[productId]/route');

      const req = createRequest(
        `http://localhost/api/workspaces/${WORKSPACE_ID}/products/${PRODUCT_ID}`,
        { method: 'DELETE' }
      );
      const res = await DELETE(req, {
        params: Promise.resolve({ workspaceId: WORKSPACE_ID, productId: PRODUCT_ID }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH', () => {
    it('ritorna 400 se nessun campo da aggiornare', async () => {
      mockMembership('admin');

      const { PATCH } =
        await import('@/app/api/workspaces/[workspaceId]/products/[productId]/route');

      const req = createRequest(
        `http://localhost/api/workspaces/${WORKSPACE_ID}/products/${PRODUCT_ID}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        }
      );
      const res = await PATCH(req, {
        params: Promise.resolve({ workspaceId: WORKSPACE_ID, productId: PRODUCT_ID }),
      });

      expect(res.status).toBe(400);
    });
  });
});

// ═══════════════════════════════════════
// INVENTORY API
// ═══════════════════════════════════════

describe('Inventory API - /api/workspaces/[id]/inventory', () => {
  describe('POST (stock update)', () => {
    it('ritorna 401 se non autenticato', async () => {
      mockGetSafeAuth.mockResolvedValue(null);

      const { POST } = await import('@/app/api/workspaces/[workspaceId]/inventory/route');

      const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: PRODUCT_ID,
          warehouse_id: WAREHOUSE_ID,
          quantity: 10,
          type: 'inbound',
        }),
      });
      const res = await POST(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(401);
    });

    it('ritorna 400 se product_id mancante', async () => {
      mockMembership('admin');

      const { POST } = await import('@/app/api/workspaces/[workspaceId]/inventory/route');

      const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouse_id: WAREHOUSE_ID, quantity: 10, type: 'inbound' }),
      });
      const res = await POST(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(400);
    });

    it('ritorna 400 se quantity = 0', async () => {
      mockMembership('admin');

      const { POST } = await import('@/app/api/workspaces/[workspaceId]/inventory/route');

      const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: PRODUCT_ID,
          warehouse_id: WAREHOUSE_ID,
          quantity: 0,
          type: 'inbound',
        }),
      });
      const res = await POST(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(400);
    });

    it('ritorna 400 se type non valido', async () => {
      mockMembership('admin');

      const { POST } = await import('@/app/api/workspaces/[workspaceId]/inventory/route');

      const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: PRODUCT_ID,
          warehouse_id: WAREHOUSE_ID,
          quantity: 10,
          type: 'invalid',
        }),
      });
      const res = await POST(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(400);
    });
  });
});

// ═══════════════════════════════════════
// PURCHASE ORDERS API
// ═══════════════════════════════════════

describe('Purchase Orders API - /api/workspaces/[id]/purchase-orders', () => {
  describe('POST (create)', () => {
    it('ritorna 401 se non autenticato', async () => {
      mockGetSafeAuth.mockResolvedValue(null);

      const { POST } = await import('@/app/api/workspaces/[workspaceId]/purchase-orders/route');

      const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: SUPPLIER_ID,
          order_number: 'PO-001',
        }),
      });
      const res = await POST(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(401);
    });

    it('ritorna 400 se supplier_id mancante', async () => {
      mockMembership('admin');

      const { POST } = await import('@/app/api/workspaces/[workspaceId]/purchase-orders/route');

      const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_number: 'PO-001' }),
      });
      const res = await POST(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(400);
    });

    it('ritorna 400 se order_number mancante', async () => {
      mockMembership('admin');

      const { POST } = await import('@/app/api/workspaces/[workspaceId]/purchase-orders/route');

      const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/purchase-orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ supplier_id: SUPPLIER_ID }),
      });
      const res = await POST(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(400);
    });
  });

  describe('PATCH (status update)', () => {
    it('ritorna 400 per stato non valido', async () => {
      mockMembership('admin');

      const { PATCH } =
        await import('@/app/api/workspaces/[workspaceId]/purchase-orders/[orderId]/route');

      const req = createRequest(
        `http://localhost/api/workspaces/${WORKSPACE_ID}/purchase-orders/${ORDER_ID}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'nonexistent' }),
        }
      );
      const res = await PATCH(req, {
        params: Promise.resolve({ workspaceId: WORKSPACE_ID, orderId: ORDER_ID }),
      });

      expect(res.status).toBe(400);
    });

    it('ritorna 401 se non autenticato', async () => {
      mockGetSafeAuth.mockResolvedValue(null);

      const { PATCH } =
        await import('@/app/api/workspaces/[workspaceId]/purchase-orders/[orderId]/route');

      const req = createRequest(
        `http://localhost/api/workspaces/${WORKSPACE_ID}/purchase-orders/${ORDER_ID}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'confirmed' }),
        }
      );
      const res = await PATCH(req, {
        params: Promise.resolve({ workspaceId: WORKSPACE_ID, orderId: ORDER_ID }),
      });

      expect(res.status).toBe(401);
    });
  });
});

// ═══════════════════════════════════════
// SUPPLIERS API
// ═══════════════════════════════════════

describe('Suppliers API - /api/workspaces/[id]/suppliers', () => {
  describe('POST (create)', () => {
    it('ritorna 400 se nome mancante', async () => {
      mockMembership('admin');

      const { POST } = await import('@/app/api/workspaces/[workspaceId]/suppliers/route');

      const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const res = await POST(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(400);
    });

    it('ritorna 401 se non autenticato', async () => {
      mockGetSafeAuth.mockResolvedValue(null);

      const { POST } = await import('@/app/api/workspaces/[workspaceId]/suppliers/route');

      const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/suppliers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Supplier' }),
      });
      const res = await POST(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(401);
    });
  });
});

// ═══════════════════════════════════════
// SERVICE LAYER: calculateNetCost, calculateMarginPercent
// ═══════════════════════════════════════

describe('WMS Service Layer Utilities', () => {
  describe('calculateNetCost', () => {
    it('applica sconti cascata correttamente', async () => {
      const { calculateNetCost } = await import('@/lib/db/products');

      // Listino 100, sconti 50%, 10%
      // 100 * 0.5 = 50 → 50 * 0.9 = 45
      const result = calculateNetCost(100, [50, 10]);
      expect(result).toBeCloseTo(45);
    });

    it('aggiunge RAEE e eco-contributo', async () => {
      const { calculateNetCost } = await import('@/lib/db/products');

      // Listino 100, sconto 20% = 80, RAEE 5, eco 2 = 87
      const result = calculateNetCost(100, [20], 5, 2);
      expect(result).toBeCloseTo(87);
    });

    it('gestisce lista sconti vuota', async () => {
      const { calculateNetCost } = await import('@/lib/db/products');

      const result = calculateNetCost(100, []);
      expect(result).toBe(100);
    });

    it('ignora sconti <= 0', async () => {
      const { calculateNetCost } = await import('@/lib/db/products');

      const result = calculateNetCost(100, [0, -5, 10]);
      expect(result).toBeCloseTo(90);
    });

    it('gestisce 5 sconti cascata', async () => {
      const { calculateNetCost } = await import('@/lib/db/products');

      // 100 * 0.90 * 0.95 * 0.98 * 0.99 * 0.97 = 80.4635...
      const result = calculateNetCost(100, [10, 5, 2, 1, 3]);
      expect(result).toBeCloseTo(80.46, 1);
    });
  });

  describe('calculateMarginPercent', () => {
    it('calcola margine correttamente', async () => {
      const { calculateMarginPercent } = await import('@/lib/db/products');

      // Costo 45, vendita 90 → (90-45)/45 * 100 = 100%
      expect(calculateMarginPercent(45, 90)).toBeCloseTo(100);
    });

    it('ritorna 0 per costo <= 0', async () => {
      const { calculateMarginPercent } = await import('@/lib/db/products');

      expect(calculateMarginPercent(0, 90)).toBe(0);
      expect(calculateMarginPercent(-10, 90)).toBe(0);
    });

    it('gestisce margine negativo', async () => {
      const { calculateMarginPercent } = await import('@/lib/db/products');

      // Costo 100, vendita 80 → (80-100)/100 * 100 = -20%
      expect(calculateMarginPercent(100, 80)).toBeCloseTo(-20);
    });
  });
});

// ═══════════════════════════════════════
// NAVIGATION: WMS section visibilita'
// ═══════════════════════════════════════

describe('Navigation: WMS section', () => {
  it('WMS visibile per reseller', async () => {
    const { getNavigationForUser } = await import('@/lib/config/navigationConfig');

    const nav = getNavigationForUser('user', { isReseller: true });
    const wmsSection = nav.sections.find((s) => s.id === 'wms');

    expect(wmsSection).toBeDefined();
    expect(wmsSection!.items.length).toBeGreaterThanOrEqual(4);
  });

  it('WMS visibile per superadmin', async () => {
    const { getNavigationForUser } = await import('@/lib/config/navigationConfig');

    const nav = getNavigationForUser('superadmin', {});
    const wmsSection = nav.sections.find((s) => s.id === 'wms');

    expect(wmsSection).toBeDefined();
  });

  it('WMS visibile per admin', async () => {
    const { getNavigationForUser } = await import('@/lib/config/navigationConfig');

    const nav = getNavigationForUser('admin', {});
    const wmsSection = nav.sections.find((s) => s.id === 'wms');

    expect(wmsSection).toBeDefined();
  });

  it('WMS NON visibile per utente standard', async () => {
    const { getNavigationForUser } = await import('@/lib/config/navigationConfig');

    const nav = getNavigationForUser('user', { isReseller: false });
    const wmsSection = nav.sections.find((s) => s.id === 'wms');

    expect(wmsSection).toBeUndefined();
  });

  it('WMS contiene voci corrette', async () => {
    const { getNavigationForUser } = await import('@/lib/config/navigationConfig');

    const nav = getNavigationForUser('user', { isReseller: true });
    const wmsSection = nav.sections.find((s) => s.id === 'wms');

    const itemIds = wmsSection!.items.map((i) => i.id);
    expect(itemIds).toContain('wms-dashboard');
    expect(itemIds).toContain('wms-prodotti');
    expect(itemIds).toContain('wms-magazzini');
    expect(itemIds).toContain('wms-ordini');
  });
});
