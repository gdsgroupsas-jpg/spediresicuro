/**
 * Test Unit: Custom Domain API Routes
 *
 * Verifica:
 * - GET /api/workspaces/[workspaceId]/custom-domain — lettura dominio
 * - POST /api/workspaces/[workspaceId]/custom-domain — registrazione
 * - DELETE /api/workspaces/[workspaceId]/custom-domain — rimozione
 * - POST /api/workspaces/[workspaceId]/custom-domain/verify — verifica DNS
 * - POST /api/workspaces/[workspaceId]/email-addresses — crea indirizzo
 * - DELETE /api/workspaces/[workspaceId]/email-addresses — rimuove indirizzo
 * - Auth, membership, owner check, UUID validation
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
  isSuperAdmin: (ctx: unknown) => mockIsSuperAdmin(ctx),
}));

vi.mock('@/lib/workspace-constants', () => ({
  isValidUUID: (v: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v),
}));

// Mock domain management service
const mockGetWorkspaceCustomDomain = vi.fn();
const mockRegisterCustomDomain = vi.fn();
const mockRemoveCustomDomainService = vi.fn();
const mockVerifyCustomDomainService = vi.fn();
const mockAddEmailAddressOnDomain = vi.fn();
const mockRemoveEmailAddress = vi.fn();

vi.mock('@/lib/email/domain-management-service', () => ({
  getWorkspaceCustomDomain: (...args: unknown[]) => mockGetWorkspaceCustomDomain(...args),
  registerCustomDomain: (...args: unknown[]) => mockRegisterCustomDomain(...args),
  removeCustomDomain: (...args: unknown[]) => mockRemoveCustomDomainService(...args),
  verifyCustomDomain: (...args: unknown[]) => mockVerifyCustomDomainService(...args),
  addEmailAddressOnDomain: (...args: unknown[]) => mockAddEmailAddressOnDomain(...args),
  removeEmailAddress: (...args: unknown[]) => mockRemoveEmailAddress(...args),
}));

// ─── FIXTURES ───

const WORKSPACE_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '33333333-3333-3333-3333-333333333333';
const ADDRESS_ID = '55555555-5555-5555-5555-555555555555';

const validAuth = {
  target: { id: USER_ID },
  role: 'authenticated',
};

// ─── HELPERS ───

function makeChainable(result: unknown) {
  const builder: Record<string, unknown> = {};
  const methods = [
    'eq',
    'select',
    'single',
    'order',
    'not',
    'neq',
    'gte',
    'insert',
    'update',
    'delete',
  ];
  for (const m of methods) {
    builder[m] = (..._args: unknown[]) => builder;
  }
  builder.then = (resolve: (v: unknown) => void) => resolve(result);
  return builder;
}

function mockActiveMembership(role = 'owner') {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'workspace_members') {
      return makeChainable({
        data: { role, status: 'active' },
        error: null,
      });
    }
    return makeChainable({ data: null, error: null });
  });
}

function mockNoMembership() {
  mockFrom.mockImplementation(() => makeChainable({ data: null, error: { code: 'PGRST116' } }));
}

function createRequest(url: string, options: RequestInit = {}) {
  return new Request(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
}

// ─── IMPORTS (after mocks) ───

import { GET, POST, DELETE } from '@/app/api/workspaces/[workspaceId]/custom-domain/route';
import { POST as VERIFY_POST } from '@/app/api/workspaces/[workspaceId]/custom-domain/verify/route';
import {
  GET as ADDR_GET,
  POST as ADDR_POST,
  DELETE as ADDR_DELETE,
} from '@/app/api/workspaces/[workspaceId]/email-addresses/route';

// ─── TESTS ───

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSafeAuth.mockResolvedValue(validAuth);
  mockIsSuperAdmin.mockReturnValue(false);
});

// ============================================
// GET /api/workspaces/[workspaceId]/custom-domain
// ============================================

describe('GET custom-domain', () => {
  it('401 senza autenticazione', async () => {
    mockGetSafeAuth.mockResolvedValue(null);
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/custom-domain`);
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });
    expect(res.status).toBe(401);
  });

  it('400 per UUID non valido', async () => {
    const req = createRequest('http://localhost/api/workspaces/not-a-uuid/custom-domain');
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: 'not-a-uuid' }) });
    expect(res.status).toBe(400);
  });

  it('403 per non-membro', async () => {
    mockNoMembership();
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/custom-domain`);
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });
    expect(res.status).toBe(403);
  });

  it('ritorna dominio', async () => {
    mockActiveMembership('viewer');
    mockGetWorkspaceCustomDomain.mockResolvedValue({
      id: 'dom-1',
      domain_name: 'example.com',
      status: 'verified',
    });
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/custom-domain`);
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.domain.domain_name).toBe('example.com');
  });

  it('ritorna null se nessun dominio', async () => {
    mockActiveMembership('viewer');
    mockGetWorkspaceCustomDomain.mockResolvedValue(null);
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/custom-domain`);
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.domain).toBeNull();
  });

  it('superadmin bypassa membership', async () => {
    mockIsSuperAdmin.mockReturnValue(true);
    mockGetWorkspaceCustomDomain.mockResolvedValue(null);
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/custom-domain`);
    const res = await GET(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });
    expect(res.status).toBe(200);
  });
});

// ============================================
// POST /api/workspaces/[workspaceId]/custom-domain
// ============================================

describe('POST custom-domain', () => {
  it('401 senza autenticazione', async () => {
    mockGetSafeAuth.mockResolvedValue(null);
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/custom-domain`, {
      method: 'POST',
      body: JSON.stringify({ domainName: 'example.com' }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });
    expect(res.status).toBe(401);
  });

  it('403 per non-owner', async () => {
    mockActiveMembership('admin');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/custom-domain`, {
      method: 'POST',
      body: JSON.stringify({ domainName: 'example.com' }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });
    expect(res.status).toBe(403);
  });

  it('400 senza domainName', async () => {
    mockActiveMembership('owner');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/custom-domain`, {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await POST(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });
    expect(res.status).toBe(400);
  });

  it('201 registra con successo', async () => {
    mockActiveMembership('owner');
    mockRegisterCustomDomain.mockResolvedValue({
      success: true,
      domain: { id: 'dom-1', domain_name: 'example.com', status: 'pending' },
    });
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/custom-domain`, {
      method: 'POST',
      body: JSON.stringify({ domainName: 'example.com' }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.domain.domain_name).toBe('example.com');
  });

  it('400 per dominio invalido', async () => {
    mockActiveMembership('owner');
    mockRegisterCustomDomain.mockResolvedValue({
      success: false,
      error: 'Formato dominio non valido',
    });
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/custom-domain`, {
      method: 'POST',
      body: JSON.stringify({ domainName: 'invalid' }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });
    expect(res.status).toBe(400);
  });

  it('400 per dominio troppo lungo', async () => {
    mockActiveMembership('owner');
    const longDomain = 'a'.repeat(250) + '.com';
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/custom-domain`, {
      method: 'POST',
      body: JSON.stringify({ domainName: longDomain }),
    });
    const res = await POST(req as any, { params: Promise.resolve({ workspaceId: WORKSPACE_ID }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('troppo lungo');
  });
});

// ============================================
// DELETE /api/workspaces/[workspaceId]/custom-domain
// ============================================

describe('DELETE custom-domain', () => {
  it('403 per non-owner', async () => {
    mockActiveMembership('viewer');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/custom-domain`, {
      method: 'DELETE',
    });
    const res = await DELETE(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID }),
    });
    expect(res.status).toBe(403);
  });

  it('200 rimuove con successo', async () => {
    mockActiveMembership('owner');
    mockRemoveCustomDomainService.mockResolvedValue({ success: true });
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/custom-domain`, {
      method: 'DELETE',
    });
    const res = await DELETE(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});

// ============================================
// POST /api/workspaces/[workspaceId]/custom-domain/verify
// ============================================

describe('POST custom-domain/verify', () => {
  it('401 senza autenticazione', async () => {
    mockGetSafeAuth.mockResolvedValue(null);
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/custom-domain/verify`,
      {
        method: 'POST',
      }
    );
    const res = await VERIFY_POST(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID }),
    });
    expect(res.status).toBe(401);
  });

  it('403 per non-owner', async () => {
    mockActiveMembership('operator');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/custom-domain/verify`,
      {
        method: 'POST',
      }
    );
    const res = await VERIFY_POST(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID }),
    });
    expect(res.status).toBe(403);
  });

  it('200 verifica con successo', async () => {
    mockActiveMembership('owner');
    mockVerifyCustomDomainService.mockResolvedValue({
      success: true,
      status: 'verified',
      dns_records: [{ type: 'MX', name: 'mx', value: 'mx.resend.com' }],
    });
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/custom-domain/verify`,
      {
        method: 'POST',
      }
    );
    const res = await VERIFY_POST(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('verified');
  });
});

// ============================================
// POST /api/workspaces/[workspaceId]/email-addresses
// ============================================

describe('POST email-addresses', () => {
  it('401 senza autenticazione', async () => {
    mockGetSafeAuth.mockResolvedValue(null);
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/email-addresses`, {
      method: 'POST',
      body: JSON.stringify({ emailAddress: 'info@example.com', displayName: 'Info' }),
    });
    const res = await ADDR_POST(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID }),
    });
    expect(res.status).toBe(401);
  });

  it('403 per non-owner', async () => {
    mockActiveMembership('viewer');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/email-addresses`, {
      method: 'POST',
      body: JSON.stringify({ emailAddress: 'info@example.com', displayName: 'Info' }),
    });
    const res = await ADDR_POST(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID }),
    });
    expect(res.status).toBe(403);
  });

  it('400 senza emailAddress', async () => {
    mockActiveMembership('owner');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/email-addresses`, {
      method: 'POST',
      body: JSON.stringify({ displayName: 'Info' }),
    });
    const res = await ADDR_POST(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID }),
    });
    expect(res.status).toBe(400);
  });

  it('400 senza displayName', async () => {
    mockActiveMembership('owner');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/email-addresses`, {
      method: 'POST',
      body: JSON.stringify({ emailAddress: 'info@example.com' }),
    });
    const res = await ADDR_POST(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID }),
    });
    expect(res.status).toBe(400);
  });

  it('400 per email troppo lunga', async () => {
    mockActiveMembership('owner');
    const longEmail = 'a'.repeat(250) + '@example.com';
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/email-addresses`, {
      method: 'POST',
      body: JSON.stringify({ emailAddress: longEmail, displayName: 'Info' }),
    });
    const res = await ADDR_POST(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('troppo lungo');
  });

  it('400 per displayName troppo lungo', async () => {
    mockActiveMembership('owner');
    const longName = 'A'.repeat(101);
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/email-addresses`, {
      method: 'POST',
      body: JSON.stringify({ emailAddress: 'info@example.com', displayName: longName }),
    });
    const res = await ADDR_POST(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID }),
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain('troppo lungo');
  });

  it('201 crea indirizzo con successo', async () => {
    mockActiveMembership('owner');
    mockAddEmailAddressOnDomain.mockResolvedValue({
      success: true,
      addressId: 'addr-new',
    });
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/email-addresses`, {
      method: 'POST',
      body: JSON.stringify({ emailAddress: 'info@example.com', displayName: 'Info Example' }),
    });
    const res = await ADDR_POST(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID }),
    });
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.addressId).toBe('addr-new');
  });
});

// ============================================
// DELETE /api/workspaces/[workspaceId]/email-addresses
// ============================================

describe('DELETE email-addresses', () => {
  it('400 senza addressId', async () => {
    mockActiveMembership('owner');
    const req = createRequest(`http://localhost/api/workspaces/${WORKSPACE_ID}/email-addresses`, {
      method: 'DELETE',
    });
    const res = await ADDR_DELETE(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID }),
    });
    expect(res.status).toBe(400);
  });

  it('400 per addressId non UUID', async () => {
    mockActiveMembership('owner');
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/email-addresses?addressId=not-uuid`,
      {
        method: 'DELETE',
      }
    );
    const res = await ADDR_DELETE(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID }),
    });
    expect(res.status).toBe(400);
  });

  it('200 rimuove con successo', async () => {
    mockActiveMembership('owner');
    mockRemoveEmailAddress.mockResolvedValue({ success: true });
    const req = createRequest(
      `http://localhost/api/workspaces/${WORKSPACE_ID}/email-addresses?addressId=${ADDRESS_ID}`,
      { method: 'DELETE' }
    );
    const res = await ADDR_DELETE(req as any, {
      params: Promise.resolve({ workspaceId: WORKSPACE_ID }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });
});

// ============================================
// Navigation
// ============================================

describe('Navigation', () => {
  it('reseller vede Dominio Email nel menu', async () => {
    const { getNavigationForUser } = await import('@/lib/config/navigationConfig');
    const nav = getNavigationForUser('user', { isReseller: true });
    const resellerSection = nav.sections.find((s) => s.id === 'reseller');
    expect(resellerSection).toBeDefined();
    const domainItem = resellerSection?.items.find((i) => i.id === 'email-domain');
    expect(domainItem).toBeDefined();
    expect(domainItem?.href).toBe('/dashboard/workspace/email-domain');
  });

  it('utente normale NON vede Dominio Email', async () => {
    const { getNavigationForUser } = await import('@/lib/config/navigationConfig');
    const nav = getNavigationForUser('user', { isReseller: false });
    const resellerSection = nav.sections.find((s) => s.id === 'reseller');
    expect(resellerSection).toBeUndefined();
  });
});
