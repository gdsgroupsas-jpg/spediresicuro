/**
 * Test: WMS Audit Fixes Verification
 *
 * Verifica specifica dei fix introdotti dall'audit:
 * 1. Cross-tenant reject su UUID opzionali (400 vs 500)
 * 2. Atomicita stock+movimento (errore RPC mappato correttamente)
 * 3. Fallback parent->child in verifyWmsAccess
 * 4. Paginazione stabile con tiebreaker id
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─── MOCK SETUP ───

const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockGetSafeAuth = vi.fn();
const mockIsSuperAdmin = vi.fn();

vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
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

function mockTable() {
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
    return mockTable();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSafeAuth.mockResolvedValue({ target: { id: USER_ID } });
  mockIsSuperAdmin.mockReturnValue(false);
});

// ═══════════════════════════════════════
// 1. UUID OPZIONALI: 400 vs 500
// ═══════════════════════════════════════

describe('Audit Fix: UUID opzionali validati (400 vs 500)', () => {
  describe('POST inventory — reference_id malformato', () => {
    it("ritorna 400 se reference_id non e' UUID valido", async () => {
      mockMembership('admin');

      const { POST } = await import('@/app/api/workspaces/[workspaceId]/inventory/route');

      const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/inventory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: PRODUCT_ID,
          warehouse_id: WAREHOUSE_ID,
          quantity: 10,
          type: 'inbound',
          reference_id: 'non-un-uuid',
        }),
      });
      const res = await POST(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('reference_id');
    });
  });

  describe('POST purchase-order item — warehouse_id malformato', () => {
    it("ritorna 400 se warehouse_id non e' UUID valido", async () => {
      mockMembership('admin');

      const { POST } =
        await import('@/app/api/workspaces/[workspaceId]/purchase-orders/[orderId]/route');

      const req = createRequest(
        `http://localhost/api/workspaces/${WORKSPACE_ID}/purchase-orders/${ORDER_ID}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: PRODUCT_ID,
            quantity_ordered: 5,
            list_price: 100,
            warehouse_id: 'non-un-uuid',
          }),
        }
      );
      const res = await POST(req, {
        params: Promise.resolve({ workspaceId: WORKSPACE_ID, orderId: ORDER_ID }),
      });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('warehouse_id');
    });
  });

  describe('GET inventory — warehouse_id malformato in query param', () => {
    it("ritorna 400 se warehouse_id query param non e' UUID", async () => {
      mockMembership('admin');

      const { GET } = await import('@/app/api/workspaces/[workspaceId]/inventory/route');

      const req = createRequest(
        `http://localhost/api/workspaces/${WORKSPACE_ID}/inventory?warehouse_id=bad-uuid`
      );
      const res = await GET(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('warehouse_id');
    });
  });

  describe('GET inventory — product_id malformato in query param', () => {
    it("ritorna 400 se product_id query param non e' UUID", async () => {
      mockMembership('admin');

      const { GET } = await import('@/app/api/workspaces/[workspaceId]/inventory/route');

      const req = createRequest(
        `http://localhost/api/workspaces/${WORKSPACE_ID}/inventory?product_id=bad-uuid`
      );
      const res = await GET(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('product_id');
    });
  });

  describe('GET purchase-orders — supplier_id malformato in query param', () => {
    it("ritorna 400 se supplier_id query param non e' UUID", async () => {
      mockMembership('admin');

      const { GET } = await import('@/app/api/workspaces/[workspaceId]/purchase-orders/route');

      const req = createRequest(
        `http://localhost/api/workspaces/${WORKSPACE_ID}/purchase-orders?supplier_id=bad-uuid`
      );
      const res = await GET(req, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain('supplier_id');
    });
  });
});

// ═══════════════════════════════════════
// 2. ATOMICITA STOCK + MOVIMENTO
// ═══════════════════════════════════════

describe('Audit Fix: Atomicita stock+movimento via RPC', () => {
  it('updateStock usa RPC wms_update_stock_with_movement', async () => {
    mockRpc.mockResolvedValueOnce({ data: 10, error: null });

    const { updateStock } = await import('@/lib/db/warehouses');

    await updateStock(
      WORKSPACE_ID,
      {
        product_id: PRODUCT_ID,
        warehouse_id: WAREHOUSE_ID,
        quantity: 10,
        type: 'inbound',
      },
      USER_ID
    );

    expect(mockRpc).toHaveBeenCalledWith('wms_update_stock_with_movement', {
      p_workspace_id: WORKSPACE_ID,
      p_product_id: PRODUCT_ID,
      p_warehouse_id: WAREHOUSE_ID,
      p_delta: 10,
      p_movement_type: 'inbound',
      p_created_by: USER_ID,
      p_notes: null,
      p_reference_type: null,
      p_reference_id: null,
    });
  });

  it('lancia errore per stock insufficiente (newQty === -1)', async () => {
    mockRpc.mockResolvedValueOnce({ data: -1, error: null });

    const { updateStock } = await import('@/lib/db/warehouses');

    await expect(
      updateStock(
        WORKSPACE_ID,
        {
          product_id: PRODUCT_ID,
          warehouse_id: WAREHOUSE_ID,
          quantity: -999,
          type: 'outbound',
        },
        USER_ID
      )
    ).rejects.toThrow('Stock insufficiente');
  });

  it('lancia errore per cross-workspace violation', async () => {
    mockRpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'product_id non appartiene al workspace' },
    });

    const { updateStock } = await import('@/lib/db/warehouses');

    await expect(
      updateStock(
        WORKSPACE_ID,
        {
          product_id: PRODUCT_ID,
          warehouse_id: WAREHOUSE_ID,
          quantity: 5,
          type: 'inbound',
        },
        USER_ID
      )
    ).rejects.toThrow('non appartiene al workspace');
  });
});

// ═══════════════════════════════════════
// 3. FALLBACK PARENT → CHILD
// ═══════════════════════════════════════

describe('Audit Fix: verifyWmsAccess parent→child fallback', () => {
  it("permette warehouse:view se utente e' owner di workspace parent", async () => {
    const PARENT_WS = '77777777-7777-7777-7777-777777777777';
    const CHILD_WS = '88888888-8888-8888-8888-888888888888';

    let callCount = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        callCount++;
        if (callCount === 1) {
          // Prima chiamata: membership diretta → non trovata
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () =>
                    Promise.resolve({
                      data: null,
                      error: { code: 'PGRST116', message: 'not found' },
                    }),
                }),
              }),
            }),
          };
        }
        // Seconda chiamata: parent workspace membership
        const chainable: Record<string, any> = {};
        chainable.select = vi.fn().mockReturnValue(chainable);
        chainable.eq = vi.fn().mockReturnValue(chainable);
        chainable.in = vi.fn().mockReturnValue(chainable);
        chainable.then = vi.fn((resolve: any) =>
          resolve({
            data: [{ role: 'owner', status: 'active', workspaces: { id: PARENT_WS } }],
            error: null,
          })
        );
        return chainable;
      }
      if (table === 'workspaces') {
        // Child workspace trovato
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: CHILD_WS },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      return mockTable();
    });

    const { verifyWmsAccess } = await import('@/lib/wms/verify-access');

    const result = await verifyWmsAccess(USER_ID, CHILD_WS, 'warehouse:view', false);

    expect(result.allowed).toBe(true);
  });

  it('nega warehouse:manage per parent (solo view permesso)', async () => {
    let callCount = 0;

    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        callCount++;
        if (callCount === 1) {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () =>
                    Promise.resolve({
                      data: null,
                      error: { code: 'PGRST116', message: 'not found' },
                    }),
                }),
              }),
            }),
          };
        }
        // Il fallback non viene nemmeno chiamato per warehouse:manage
        return mockTable();
      }
      return mockTable();
    });

    const { verifyWmsAccess } = await import('@/lib/wms/verify-access');

    const result = await verifyWmsAccess(USER_ID, WORKSPACE_ID, 'warehouse:manage', false);

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Non sei membro');
  });

  it("nega accesso se utente non e' membro di nessun workspace parent", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        const chainable: Record<string, any> = {};
        const methods = ['select', 'eq', 'in', 'not', 'order', 'range'];
        for (const m of methods) {
          chainable[m] = vi.fn().mockReturnValue(chainable);
        }
        chainable.single = vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'not found' },
        });
        chainable.then = vi.fn((resolve: any) => resolve({ data: [], error: null }));
        return chainable;
      }
      return mockTable();
    });

    const { verifyWmsAccess } = await import('@/lib/wms/verify-access');

    const result = await verifyWmsAccess(USER_ID, WORKSPACE_ID, 'warehouse:view', false);

    expect(result.allowed).toBe(false);
  });
});

// ═══════════════════════════════════════
// 4. SERVICE LAYER: calculateNetCost con paginazione stabile
// ═══════════════════════════════════════

describe('Audit Fix: Paginazione stabile (tiebreaker id)', () => {
  it('listInventory chiama order due volte (quantity_available + id)', async () => {
    const orderMock = vi.fn();
    const rangeMock = vi.fn();

    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { role: 'admin', permissions: [], status: 'active' },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      // inventory table
      const chainable: Record<string, any> = {};
      chainable.select = vi.fn().mockReturnValue(chainable);
      chainable.eq = vi.fn().mockReturnValue(chainable);
      chainable.order = orderMock.mockReturnValue(chainable);
      chainable.range = rangeMock.mockResolvedValue({ data: [], error: null, count: 0 });
      return chainable;
    });

    const { listInventory } = await import('@/lib/db/warehouses');

    await listInventory(WORKSPACE_ID);

    // Deve chiamare .order() due volte: quantity_available + id (tiebreaker)
    expect(orderMock).toHaveBeenCalledTimes(2);
    expect(orderMock).toHaveBeenCalledWith('quantity_available', { ascending: true });
    expect(orderMock).toHaveBeenCalledWith('id', { ascending: true });
  });
});
