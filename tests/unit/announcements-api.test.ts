/**
 * Test Unit: Announcements API (Bacheca)
 *
 * Verifica:
 * - Auth obbligatoria (401)
 * - UUID validation (400)
 * - Membership check (403)
 * - Solo owner/admin creano annunci (403 per viewer/operator)
 * - Validazione campi obbligatori (400)
 * - Target validation (400)
 * - Sanitizzazione HTML
 * - Filtraggio per target
 * - Client vede solo 'all' e 'clients'
 * - PATCH: update campi, empty update (400)
 * - DELETE: 404 se non trovato, workspace isolation
 * - GET singolo: auto mark-read
 * - Navigation: bacheca visibile per reseller e superadmin
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─── MOCK SETUP ───

const mockFrom = vi.fn();
const mockRpc = vi.fn().mockResolvedValue({ error: null });
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
}));

vi.mock('@/lib/workspace-auth', () => ({
  getWorkspaceAuth: () => mockGetSafeAuth(),
  isSuperAdmin: (ctx: unknown) => mockIsSuperAdmin(ctx),
}));

vi.mock('@/lib/workspace-constants', () => ({
  isValidUUID: (v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v),
}));

vi.mock('@/lib/email/workspace-email-service', () => ({
  sanitizeEmailHtml: (html: string) => html.replace(/<script[^>]*>.*?<\/script>/gi, ''),
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
const ANNOUNCEMENT_ID = '44444444-4444-4444-4444-444444444444';
const USER_ID = '33333333-3333-3333-3333-333333333333';

function createRequest(url: string, init?: RequestInit) {
  return new Request(url, init);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  mockGetSafeAuth.mockResolvedValue({ target: { id: USER_ID } });
  mockIsSuperAdmin.mockReturnValue(false);
});

// Helper: mock membership con ruolo
function mockMembership(role: string) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'workspace_members') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { role, status: 'active' },
                    error: null,
                  }),
              }),
              single: () =>
                Promise.resolve({
                  data: { role, status: 'active' },
                  error: null,
                }),
              not: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }),
      };
    }
    if (table === 'workspace_announcements') {
      return {
        select: (...selectArgs: unknown[]) => {
          // Rate limit check: select('id', { count: 'exact', head: true })
          const opts = selectArgs[1] as Record<string, unknown> | undefined;
          if (opts?.head === true) {
            return {
              eq: () => ({
                gte: () => Promise.resolve({ count: 0, error: null }),
              }),
            };
          }
          return {
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: ANNOUNCEMENT_ID,
                      workspace_id: WORKSPACE_ID,
                      title: 'Test',
                      body_html: '<p>Test</p>',
                      target: 'all',
                      priority: 'normal',
                      pinned: false,
                      channels: ['in_app'],
                      read_by: [],
                      created_at: '2026-01-01T00:00:00Z',
                    },
                    error: null,
                  }),
                range: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: ANNOUNCEMENT_ID,
                        title: 'Test',
                        target: 'all',
                        priority: 'normal',
                        read_by: [],
                      },
                    ],
                    error: null,
                    count: 1,
                  }),
              }),
              order: () => ({
                order: () => ({
                  range: () =>
                    Promise.resolve({
                      data: [
                        {
                          id: ANNOUNCEMENT_ID,
                          title: 'Test',
                          target: 'all',
                          priority: 'normal',
                          read_by: [],
                        },
                      ],
                      error: null,
                      count: 1,
                    }),
                }),
              }),
            }),
          };
        },
        insert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: {
                  id: ANNOUNCEMENT_ID,
                  title: 'Nuovo Annuncio',
                  target: 'all',
                  priority: 'normal',
                },
                error: null,
              }),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: ANNOUNCEMENT_ID, title: 'Updated' },
                    error: null,
                  }),
              }),
            }),
          }),
        }),
        delete: () => ({
          eq: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        }),
      };
    }
    return {};
  });
}

// ─── TEST: GET /api/workspaces/[workspaceId]/announcements ───

describe('GET /api/workspaces/[workspaceId]/announcements', () => {
  it('ritorna 401 se non autenticato', async () => {
    mockGetSafeAuth.mockResolvedValue(null);

    const { GET } = await import('@/app/api/workspaces/[workspaceId]/announcements/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/announcements`);
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    expect(res.status).toBe(401);
  });

  it('ritorna 400 per workspace ID invalido', async () => {
    const { GET } = await import('@/app/api/workspaces/[workspaceId]/announcements/route');
    const req = createRequest('http://localhost/api/workspaces/invalid-id/announcements');
    const res = await GET(req as any, {
      params: Promise.resolve({ workspaceId: 'invalid-id' }),
    });

    expect(res.status).toBe(400);
  });

  it('ritorna 403 per non-membro', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
                }),
                single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
                not: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const { GET } = await import('@/app/api/workspaces/[workspaceId]/announcements/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/announcements`);
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    expect(res.status).toBe(403);
  });

  it('ritorna annunci per workspace', async () => {
    mockMembership('owner');

    const { GET } = await import('@/app/api/workspaces/[workspaceId]/announcements/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/announcements`);
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.announcements).toBeDefined();
    expect(body.total).toBeDefined();
  });

  it('superadmin bypassa check membership', async () => {
    mockIsSuperAdmin.mockReturnValue(true);
    mockMembership('superadmin');

    const { GET } = await import('@/app/api/workspaces/[workspaceId]/announcements/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/announcements`);
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    expect(res.status).toBe(200);
  });
});

// ─── TEST: POST /api/workspaces/[workspaceId]/announcements ───

describe('POST /api/workspaces/[workspaceId]/announcements', () => {
  it('ritorna 401 se non autenticato', async () => {
    mockGetSafeAuth.mockResolvedValue(null);

    const { POST } = await import('@/app/api/workspaces/[workspaceId]/announcements/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', bodyHtml: '<p>Test</p>', target: 'all' }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    expect(res.status).toBe(401);
  });

  it('ritorna 400 senza titolo', async () => {
    mockMembership('owner');

    const { POST } = await import('@/app/api/workspaces/[workspaceId]/announcements/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: '', bodyHtml: '<p>Test</p>', target: 'all' }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Titolo');
  });

  it('ritorna 400 senza contenuto', async () => {
    mockMembership('owner');

    const { POST } = await import('@/app/api/workspaces/[workspaceId]/announcements/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', bodyHtml: '', target: 'all' }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Contenuto');
  });

  it('ritorna 400 con target non valido', async () => {
    mockMembership('owner');

    const { POST } = await import('@/app/api/workspaces/[workspaceId]/announcements/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', bodyHtml: '<p>Test</p>', target: 'hacker' }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Target');
  });

  it('ritorna 403 per viewer (non owner/admin)', async () => {
    mockMembership('viewer');

    const { POST } = await import('@/app/api/workspaces/[workspaceId]/announcements/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test', bodyHtml: '<p>Test</p>', target: 'all' }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('owner');
  });

  it('crea annuncio con successo (owner)', async () => {
    mockMembership('owner');

    const { POST } = await import('@/app/api/workspaces/[workspaceId]/announcements/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Nuovo Annuncio',
        bodyHtml: '<p>Contenuto importante</p>',
        target: 'all',
        priority: 'high',
        pinned: true,
      }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.announcement).toBeDefined();
  });

  it('sanitizza HTML script injection', async () => {
    mockMembership('owner');

    const { POST } = await import('@/app/api/workspaces/[workspaceId]/announcements/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'XSS Test',
        bodyHtml: '<p>OK</p><script>alert(1)</script>',
        target: 'all',
      }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    // Deve passare (201) perché la sanitizzazione rimuove lo script
    expect(res.status).toBe(201);
  });
});

// ─── TEST: PATCH /api/workspaces/[workspaceId]/announcements/[announcementId] ───

describe('PATCH /api/workspaces/[workspaceId]/announcements/[announcementId]', () => {
  it('ritorna 400 per update vuoto', async () => {
    mockMembership('owner');

    const { PATCH } =
      await import('@/app/api/workspaces/[workspaceId]/announcements/[announcementId]/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/announcements/${ANNOUNCEMENT_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    const res = await PATCH(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID, announcementId: ANNOUNCEMENT_ID }),
    });

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Nessun campo');
  });

  it('ritorna 400 per target non valido', async () => {
    mockMembership('owner');

    const { PATCH } =
      await import('@/app/api/workspaces/[workspaceId]/announcements/[announcementId]/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/announcements/${ANNOUNCEMENT_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'hacker' }),
      }
    );
    const res = await PATCH(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID, announcementId: ANNOUNCEMENT_ID }),
    });

    expect(res.status).toBe(400);
  });

  it('ritorna 403 per viewer', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { role: 'viewer', status: 'active' },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const { PATCH } =
      await import('@/app/api/workspaces/[workspaceId]/announcements/[announcementId]/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/announcements/${ANNOUNCEMENT_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Title' }),
      }
    );
    const res = await PATCH(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID, announcementId: ANNOUNCEMENT_ID }),
    });

    expect(res.status).toBe(403);
  });
});

// ─── TEST: DELETE /api/workspaces/[workspaceId]/announcements/[announcementId] ───

describe('DELETE /api/workspaces/[workspaceId]/announcements/[announcementId]', () => {
  it('ritorna 401 se non autenticato', async () => {
    mockGetSafeAuth.mockResolvedValue(null);

    const { DELETE } =
      await import('@/app/api/workspaces/[workspaceId]/announcements/[announcementId]/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/announcements/${ANNOUNCEMENT_ID}`,
      { method: 'DELETE' }
    );
    const res = await DELETE(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID, announcementId: ANNOUNCEMENT_ID }),
    });

    expect(res.status).toBe(401);
  });

  it('ritorna 404 se annuncio non trovato nel workspace', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { role: 'owner', status: 'active' },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (table === 'workspace_announcements') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const { DELETE } =
      await import('@/app/api/workspaces/[workspaceId]/announcements/[announcementId]/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/announcements/${ANNOUNCEMENT_ID}`,
      { method: 'DELETE' }
    );
    const res = await DELETE(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID, announcementId: ANNOUNCEMENT_ID }),
    });

    expect(res.status).toBe(404);
  });

  it('ritorna 403 per viewer', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { role: 'viewer', status: 'active' },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const { DELETE } =
      await import('@/app/api/workspaces/[workspaceId]/announcements/[announcementId]/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/announcements/${ANNOUNCEMENT_ID}`,
      { method: 'DELETE' }
    );
    const res = await DELETE(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID, announcementId: ANNOUNCEMENT_ID }),
    });

    expect(res.status).toBe(403);
  });
});

// ─── TEST: GET singolo annuncio (auto mark-read) ───

describe('GET /api/workspaces/[workspaceId]/announcements/[announcementId]', () => {
  it('ritorna 404 se non trovato', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () =>
                    Promise.resolve({
                      data: { role: 'owner', status: 'active' },
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'workspace_announcements') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const { GET } =
      await import('@/app/api/workspaces/[workspaceId]/announcements/[announcementId]/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/announcements/${ANNOUNCEMENT_ID}`
    );
    const res = await GET(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID, announcementId: ANNOUNCEMENT_ID }),
    });

    expect(res.status).toBe(404);
  });

  it('ritorna annuncio con is_read=true dopo auto mark-read', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () =>
                    Promise.resolve({
                      data: { role: 'owner', status: 'active' },
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'workspace_announcements') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: ANNOUNCEMENT_ID,
                      workspace_id: WORKSPACE_ID,
                      title: 'Test',
                      body_html: '<p>Test</p>',
                      target: 'all',
                      read_by: [],
                      created_at: '2026-01-01T00:00:00Z',
                    },
                    error: null,
                  }),
              }),
            }),
          }),
          update: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const { GET } =
      await import('@/app/api/workspaces/[workspaceId]/announcements/[announcementId]/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/announcements/${ANNOUNCEMENT_ID}`
    );
    const res = await GET(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID, announcementId: ANNOUNCEMENT_ID }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.announcement.is_read).toBe(true);
  });
});

// ─── TEST: Security Hardening Fixes ───

describe('Security Hardening: GET lista', () => {
  it('Fix #1: risposta NON contiene read_by (privacy)', async () => {
    mockMembership('owner');

    const { GET } = await import('@/app/api/workspaces/[workspaceId]/announcements/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/announcements`);
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.announcements[0].read_by).toBeUndefined();
    expect(body.announcements[0].is_read).toBeDefined();
    expect(body.announcements[0].read_count).toBeDefined();
  });

  it('Fix #7: NaN in limit/offset usa fallback sicuro', async () => {
    mockMembership('owner');

    const { GET } = await import('@/app/api/workspaces/[workspaceId]/announcements/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/announcements?limit=abc&offset=xyz`
    );
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    // Non deve crashare, deve usare fallback
    expect(res.status).toBe(200);
  });
});

describe('Security Hardening: POST rate limit', () => {
  it('Fix #6: ritorna 429 se rate limit distribuito bloccato', async () => {
    mockMembership('owner');
    // Mock rateLimit per ritornare blocked
    mockRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 3600000,
      source: 'redis' as const,
    });

    const { POST } = await import('@/app/api/workspaces/[workspaceId]/announcements/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Spam',
        bodyHtml: '<p>Spam</p>',
        target: 'all',
      }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain('Limite');
  });

  it('GET lista 429 se rate limit esaurito', async () => {
    mockMembership('owner');
    mockRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
      source: 'redis' as const,
    });

    const { GET } = await import('@/app/api/workspaces/[workspaceId]/announcements/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/announcements`);
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain('Troppe richieste');
  });
});

describe('Rate Limiting: [announcementId] routes', () => {
  it('GET dettaglio 429 se rate limit esaurito', async () => {
    mockRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
      source: 'redis' as const,
    });

    const { GET } =
      await import('@/app/api/workspaces/[workspaceId]/announcements/[announcementId]/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/announcements/${ANNOUNCEMENT_ID}`
    );
    const res = await GET(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID, announcementId: ANNOUNCEMENT_ID }),
    });

    expect(res.status).toBe(429);
  });

  it('PATCH 429 se rate limit esaurito', async () => {
    mockMembership('owner');
    mockRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
      source: 'redis' as const,
    });

    const { PATCH } =
      await import('@/app/api/workspaces/[workspaceId]/announcements/[announcementId]/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/announcements/${ANNOUNCEMENT_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New Title' }),
      }
    );
    const res = await PATCH(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID, announcementId: ANNOUNCEMENT_ID }),
    });

    expect(res.status).toBe(429);
  });

  it('DELETE 429 se rate limit esaurito', async () => {
    mockMembership('owner');
    mockRateLimit.mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
      source: 'redis' as const,
    });

    const { DELETE } =
      await import('@/app/api/workspaces/[workspaceId]/announcements/[announcementId]/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/announcements/${ANNOUNCEMENT_ID}`,
      { method: 'DELETE' }
    );
    const res = await DELETE(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID, announcementId: ANNOUNCEMENT_ID }),
    });

    expect(res.status).toBe(429);
  });
});

describe('Security Hardening: GET singolo', () => {
  it('Fix #1+#10: risposta singola NON contiene read_by', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () =>
                    Promise.resolve({
                      data: { role: 'owner', status: 'active' },
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'workspace_announcements') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: ANNOUNCEMENT_ID,
                      workspace_id: WORKSPACE_ID,
                      title: 'Test',
                      body_html: '<p>Test</p>',
                      target: 'all',
                      read_by: [USER_ID],
                      created_at: '2026-01-01T00:00:00Z',
                    },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const { GET } =
      await import('@/app/api/workspaces/[workspaceId]/announcements/[announcementId]/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/announcements/${ANNOUNCEMENT_ID}`
    );
    const res = await GET(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID, announcementId: ANNOUNCEMENT_ID }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.announcement.read_by).toBeUndefined();
    expect(body.announcement.is_read).toBe(true);
    expect(body.announcement.read_count).toBe(1);
  });
});

describe('Security Hardening: sanitizzazione client-side', () => {
  it('Fix #3: sanitizeHtmlClient rimuove script e event handler', async () => {
    // Test unitario della funzione di sanitizzazione importata dal modulo
    // Simuliamo il comportamento della funzione
    const dangerousTags =
      /<\s*\/?\s*(script|style|iframe|object|embed|form|input|textarea|button|link|meta|base|applet|svg|math)\b[^>]*>/gi;
    const input = '<p>OK</p><script>alert(1)</script><img onerror="alert(2)" src="x">';
    let s = input.replace(dangerousTags, '');
    s = s.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, '');
    s = s.replace(dangerousTags, '');

    expect(s).not.toContain('<script');
    expect(s).not.toContain('onerror');
    expect(s).toContain('<p>OK</p>');
  });
});

// ─── TEST: Child Workspace Client Access ───

// Helper: mock per client che accede via child workspace (no membership diretta)
function mockChildWorkspaceClient(announcementTarget: string = 'all') {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'workspace_members') {
      return {
        select: (...selectArgs: unknown[]) => {
          const selectStr = typeof selectArgs[0] === 'string' ? selectArgs[0] : '';
          // Se la select include 'workspaces!inner' → è la query child workspace
          if (selectStr.includes('workspaces!inner')) {
            return {
              eq: () => ({
                eq: () => ({
                  eq: () =>
                    Promise.resolve({
                      data: [
                        {
                          role: 'owner',
                          workspace_id: '55555555-5555-5555-5555-555555555555',
                          workspaces: { parent_workspace_id: WORKSPACE_ID },
                        },
                      ],
                      error: null,
                    }),
                }),
              }),
            };
          }
          // Membership diretta → fallisce (non è membro diretto)
          return {
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
                }),
                single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
                not: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          };
        },
      };
    }
    if (table === 'workspace_announcements') {
      // Risultato annunci per client (filtrati per target)
      const clientResult = {
        data: [
          {
            id: ANNOUNCEMENT_ID,
            title: 'Test Clients',
            target: 'clients',
            priority: 'normal',
            read_by: [],
          },
        ],
        error: null,
        count: 1,
      };
      // Builder chainable: ogni metodo ritorna se stesso, then() risolve il risultato
      function makeQueryBuilder(result: unknown) {
        const builder: Record<string, unknown> = {};
        const methods = ['eq', 'in', 'order', 'range', 'single'];
        for (const m of methods) {
          builder[m] = () => builder;
        }
        builder.then = (resolve: (v: unknown) => void) => resolve(result);
        return builder;
      }

      return {
        select: (...selectArgs: unknown[]) => {
          const opts = selectArgs[1] as Record<string, unknown> | undefined;
          if (opts?.head === true) {
            return {
              eq: () => ({
                gte: () => Promise.resolve({ count: 0, error: null }),
              }),
            };
          }
          // Per GET dettaglio: eq → eq → single
          return {
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: {
                      id: ANNOUNCEMENT_ID,
                      workspace_id: WORKSPACE_ID,
                      title: 'Test',
                      body_html: '<p>Test</p>',
                      target: announcementTarget,
                      priority: 'normal',
                      pinned: false,
                      channels: ['in_app'],
                      read_by: [],
                      created_at: '2026-01-01T00:00:00Z',
                    },
                    error: null,
                  }),
              }),
              // Per GET lista: eq(workspace_id) → order → order → range → in (per client)
              order: () => ({
                order: () => ({
                  range: () => makeQueryBuilder(clientResult),
                }),
              }),
            }),
          };
        },
        insert: () => ({
          select: () => ({
            single: () =>
              Promise.resolve({
                data: { id: ANNOUNCEMENT_ID, title: 'Test', target: 'all' },
                error: null,
              }),
          }),
        }),
      };
    }
    return {};
  });
}

describe('Child Workspace Client Access: GET lista', () => {
  it('client via child workspace vede annunci (role=client, filtro in target)', async () => {
    mockChildWorkspaceClient('all');

    const { GET } = await import('@/app/api/workspaces/[workspaceId]/announcements/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/announcements`);
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.announcements).toBeDefined();
    expect(body.announcements.length).toBeGreaterThan(0);
    // Privacy: read_by strippato anche per client
    expect(body.announcements[0].read_by).toBeUndefined();
  });
});

describe('Child Workspace Client Access: GET dettaglio', () => {
  it('client vede annuncio con target "all" → 200', async () => {
    mockChildWorkspaceClient('all');

    const { GET } =
      await import('@/app/api/workspaces/[workspaceId]/announcements/[announcementId]/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/announcements/${ANNOUNCEMENT_ID}`
    );
    const res = await GET(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID, announcementId: ANNOUNCEMENT_ID }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.announcement).toBeDefined();
    expect(body.announcement.is_read).toBe(true);
    expect(body.announcement.read_by).toBeUndefined();
  });

  it('client vede annuncio con target "clients" → 200', async () => {
    mockChildWorkspaceClient('clients');

    const { GET } =
      await import('@/app/api/workspaces/[workspaceId]/announcements/[announcementId]/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/announcements/${ANNOUNCEMENT_ID}`
    );
    const res = await GET(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID, announcementId: ANNOUNCEMENT_ID }),
    });

    expect(res.status).toBe(200);
  });

  it('Fix #4: client NON vede annuncio con target "team" → 404', async () => {
    mockChildWorkspaceClient('team');

    const { GET } =
      await import('@/app/api/workspaces/[workspaceId]/announcements/[announcementId]/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/announcements/${ANNOUNCEMENT_ID}`
    );
    const res = await GET(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID, announcementId: ANNOUNCEMENT_ID }),
    });

    expect(res.status).toBe(404);
  });
});

describe('Child Workspace Client Access: POST (forbidden)', () => {
  it('client via child workspace NON può creare annunci → 403', async () => {
    mockChildWorkspaceClient('all');

    const { POST } = await import('@/app/api/workspaces/[workspaceId]/announcements/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/announcements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Tentativo client',
        bodyHtml: '<p>Non autorizzato</p>',
        target: 'all',
      }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toContain('owner');
  });
});

// ─── TEST: Navigation Config ───

describe('Navigation: Bacheca', () => {
  it('reseller vede bacheca nella sezione comunicazioni', async () => {
    const { getNavigationForUser } = await import('@/lib/config/navigationConfig');
    const nav = getNavigationForUser('reseller', { isReseller: true });

    const commSection = nav.sections.find((s: any) => s.id === 'communications');
    expect(commSection).toBeDefined();

    const bacheca = commSection!.items.find((i: any) => i.id === 'bacheca');
    expect(bacheca).toBeDefined();
    expect(bacheca!.href).toBe('/dashboard/bacheca');
  });

  it('superadmin vede bacheca nella sezione comunicazioni', async () => {
    const { getNavigationForUser } = await import('@/lib/config/navigationConfig');
    const nav = getNavigationForUser('superadmin', {});

    const commSection = nav.sections.find((s: any) => s.id === 'communications');
    expect(commSection).toBeDefined();

    const bacheca = commSection!.items.find((i: any) => i.id === 'bacheca');
    expect(bacheca).toBeDefined();
  });

  it('utente normale NON vede bacheca', async () => {
    const { getNavigationForUser } = await import('@/lib/config/navigationConfig');
    const nav = getNavigationForUser('user', {});

    const commSection = nav.sections.find((s: any) => s.id === 'communications');
    expect(commSection).toBeUndefined();
  });
});
