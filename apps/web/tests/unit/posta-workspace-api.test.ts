/**
 * Test Unit: Posta Workspace API Routes
 *
 * Verifica:
 * - GET /api/workspaces/[workspaceId]/emails — lista email workspace-scoped
 * - POST /api/workspaces/[workspaceId]/emails — invio email / bozza
 * - GET /api/workspaces/[workspaceId]/emails/[emailId] — dettaglio email
 * - PATCH /api/workspaces/[workspaceId]/emails/[emailId] — aggiornamento
 * - DELETE /api/workspaces/[workspaceId]/emails/[emailId] — trash / hard delete
 * - GET /api/workspaces/[workspaceId]/email-addresses — lista indirizzi
 * - Auth e workspace isolation in tutti gli endpoint
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─── MOCK SETUP ───

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

const mockGetSafeAuth = vi.fn();
const mockIsSuperAdmin = vi.fn();

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

vi.mock('@/types/workspace', () => ({
  memberHasPermission: vi.fn().mockReturnValue(true),
}));

vi.mock('@/lib/email/workspace-email-service', () => ({
  sendWorkspaceEmail: vi
    .fn()
    .mockResolvedValue({ success: true, emailId: 'email-1', resendId: 'resend-1' }),
  getWorkspaceEmailAddresses: vi.fn().mockResolvedValue([]),
}));

// ─── FIXTURES ───

const WORKSPACE_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_WORKSPACE = '22222222-2222-2222-2222-222222222222';
const USER_ID = '33333333-3333-3333-3333-333333333333';
const EMAIL_ID = '44444444-4444-4444-4444-444444444444';

const validAuth = {
  target: { id: USER_ID },
  actor: { account_type: 'reseller' },
};

function createRequest(url: string, opts?: RequestInit) {
  return new Request(url, opts);
}

function mockMembershipActive() {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'workspace_members') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { role: 'owner', permissions: [], status: 'active' },
                    error: null,
                  }),
              }),
              single: () =>
                Promise.resolve({
                  data: { role: 'owner', permissions: [], status: 'active' },
                  error: null,
                }),
            }),
          }),
        }),
      };
    }
    if (table === 'emails') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                range: () => Promise.resolve({ data: [], error: null, count: 0 }),
              }),
              single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
            }),
          }),
        }),
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: EMAIL_ID, read: true, starred: false, folder: 'inbox' },
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
    if (table === 'workspace_email_addresses') {
      return {
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [], error: null }),
          }),
        }),
      };
    }
    return {};
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSafeAuth.mockResolvedValue(validAuth);
  mockIsSuperAdmin.mockReturnValue(false);
});

// ─── TESTS: emails list ───

describe('GET /api/workspaces/[workspaceId]/emails', () => {
  it('ritorna 401 se non autenticato', async () => {
    mockGetSafeAuth.mockResolvedValue(null);

    const { GET } = await import('@/app/api/workspaces/[workspaceId]/emails/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/emails?folder=inbox`
    );
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toContain('Unauthorized');
  });

  it('ritorna 400 per workspace ID invalido', async () => {
    const { GET } = await import('@/app/api/workspaces/[workspaceId]/emails/route');
    const req = createRequest('http://localhost/api/workspaces/invalid-uuid/emails?folder=inbox');
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: 'invalid-uuid' }) });

    expect(res.status).toBe(400);
  });

  it('ritorna 403 se non membro del workspace', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
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

    const { GET } = await import('@/app/api/workspaces/[workspaceId]/emails/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/emails?folder=inbox`
    );
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    expect(res.status).toBe(403);
  });

  it('ritorna email filtrate per workspace', async () => {
    const testEmails = [
      { id: '1', subject: 'Test email', folder: 'inbox', read: false, workspace_id: WORKSPACE_ID },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { role: 'owner', permissions: [], status: 'active' },
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (table === 'emails') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  range: () => Promise.resolve({ data: testEmails, error: null, count: 1 }),
                }),
                or: () => ({
                  order: () => ({
                    range: () => Promise.resolve({ data: testEmails, error: null, count: 1 }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const { GET } = await import('@/app/api/workspaces/[workspaceId]/emails/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/emails?folder=inbox`
    );
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.emails).toHaveLength(1);
    expect(body.emails[0].subject).toBe('Test email');
  });

  it('superadmin bypassa check membership', async () => {
    mockIsSuperAdmin.mockReturnValue(true);
    mockMembershipActive();

    const { GET } = await import('@/app/api/workspaces/[workspaceId]/emails/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/emails?folder=inbox`
    );
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    expect(res.status).toBe(200);
  });
});

// ─── TESTS: send email ───

describe('POST /api/workspaces/[workspaceId]/emails', () => {
  it('ritorna 401 se non autenticato', async () => {
    mockGetSafeAuth.mockResolvedValue(null);

    const { POST } = await import('@/app/api/workspaces/[workspaceId]/emails/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAddressId: 'addr-1',
        to: ['test@test.it'],
        subject: 'Test',
        bodyHtml: '<p>Test</p>',
      }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    expect(res.status).toBe(401);
  });

  it('ritorna 400 senza fromAddressId', async () => {
    mockMembershipActive();

    const { POST } = await import('@/app/api/workspaces/[workspaceId]/emails/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: ['test@test.it'], subject: 'Test', bodyHtml: '<p>Test</p>' }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain('fromAddressId');
  });

  it('invio riuscito ritorna success + emailId', async () => {
    mockMembershipActive();

    const { POST } = await import('@/app/api/workspaces/[workspaceId]/emails/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAddressId: 'addr-1',
        to: ['test@test.it'],
        subject: 'Test',
        bodyHtml: '<p>Test</p>',
      }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.emailId).toBe('email-1');
  });

  it('ritorna 400 se to o subject mancanti (non draft)', async () => {
    mockMembershipActive();

    const { POST } = await import('@/app/api/workspaces/[workspaceId]/emails/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/emails`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromAddressId: 'addr-1',
        to: [],
        subject: '',
        bodyHtml: '<p>Test</p>',
      }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    expect(res.status).toBe(400);
  });
});

// ─── TESTS: single email ───

describe('GET /api/workspaces/[workspaceId]/emails/[emailId]', () => {
  it('ritorna 404 se email non appartiene al workspace', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: { status: 'active' }, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'emails') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
              }),
            }),
          }),
          update: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      return {};
    });

    const { GET } = await import('@/app/api/workspaces/[workspaceId]/emails/[emailId]/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/emails/${EMAIL_ID}`);
    const res = await GET(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID, emailId: EMAIL_ID }),
    });

    expect(res.status).toBe(404);
  });
});

// ─── TESTS: PATCH email ───

describe('PATCH /api/workspaces/[workspaceId]/emails/[emailId]', () => {
  it('ritorna 400 senza campi da aggiornare', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: { status: 'active' }, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const { PATCH } = await import('@/app/api/workspaces/[workspaceId]/emails/[emailId]/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/emails/${EMAIL_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }
    );
    const res = await PATCH(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID, emailId: EMAIL_ID }),
    });

    expect(res.status).toBe(400);
  });

  it('non accetta folder non validi', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: { status: 'active' }, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const { PATCH } = await import('@/app/api/workspaces/[workspaceId]/emails/[emailId]/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/emails/${EMAIL_ID}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder: 'malicious_folder' }),
      }
    );
    const res = await PATCH(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID, emailId: EMAIL_ID }),
    });

    // folder non valido → nessun campo da aggiornare → 400
    expect(res.status).toBe(400);
  });
});

// ─── TESTS: DELETE email ───

describe('DELETE /api/workspaces/[workspaceId]/emails/[emailId]', () => {
  it('ritorna 404 se email non trovata nel workspace', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: { status: 'active' }, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'emails') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const { DELETE } = await import('@/app/api/workspaces/[workspaceId]/emails/[emailId]/route');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/emails/${EMAIL_ID}`,
      { method: 'DELETE' }
    );
    const res = await DELETE(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID, emailId: EMAIL_ID }),
    });

    expect(res.status).toBe(404);
  });
});

// ─── TESTS: email-addresses ───

describe('GET /api/workspaces/[workspaceId]/email-addresses', () => {
  it('ritorna 401 se non autenticato', async () => {
    mockGetSafeAuth.mockResolvedValue(null);

    const { GET } = await import('@/app/api/workspaces/[workspaceId]/email-addresses/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/email-addresses`);
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    expect(res.status).toBe(401);
  });

  it('ritorna 403 se non membro', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const { GET } = await import('@/app/api/workspaces/[workspaceId]/email-addresses/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/email-addresses`);
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    expect(res.status).toBe(403);
  });

  it('ritorna indirizzi per workspace', async () => {
    const addresses = [
      {
        id: 'addr-1',
        email_address: 'info@test.it',
        display_name: 'Test',
        is_primary: true,
        is_verified: true,
      },
    ];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_members') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: { status: 'active' }, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'workspace_email_addresses') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: addresses, error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const { GET } = await import('@/app/api/workspaces/[workspaceId]/email-addresses/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/email-addresses`);
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.addresses).toHaveLength(1);
    expect(body.addresses[0].email_address).toBe('info@test.it');
  });

  it('superadmin bypassa membership check', async () => {
    mockIsSuperAdmin.mockReturnValue(true);
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_email_addresses') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        };
      }
      return {};
    });

    const { GET } = await import('@/app/api/workspaces/[workspaceId]/email-addresses/route');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/email-addresses`);
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });

    expect(res.status).toBe(200);
  });
});

// ─── TESTS: Navigation ───

describe('Navigation: Posta per reseller', () => {
  it('reseller vede Posta nella sidebar con href workspace', async () => {
    const { getNavigationForUser } = await import('@/lib/config/navigationConfig');
    const nav = getNavigationForUser('reseller', { isReseller: true });
    const commSection = nav.sections.find((s) => s.id === 'communications');

    expect(commSection).toBeDefined();
    const postaItem = commSection!.items.find((i) => i.id === 'mail-workspace');
    expect(postaItem).toBeDefined();
    expect(postaItem!.href).toBe('/dashboard/posta-workspace');
  });

  it('superadmin vede Posta con href superadmin', async () => {
    const { getNavigationForUser } = await import('@/lib/config/navigationConfig');
    const nav = getNavigationForUser('superadmin', {});
    const commSection = nav.sections.find((s) => s.id === 'communications');

    expect(commSection).toBeDefined();
    const postaItem = commSection!.items.find((i) => i.id === 'mail');
    expect(postaItem).toBeDefined();
    expect(postaItem!.href).toBe('/dashboard/posta');
  });

  it('utente normale non vede sezione comunicazioni', async () => {
    const { getNavigationForUser } = await import('@/lib/config/navigationConfig');
    const nav = getNavigationForUser('user', {});
    const commSection = nav.sections.find((s) => s.id === 'communications');

    expect(commSection).toBeUndefined();
  });
});
