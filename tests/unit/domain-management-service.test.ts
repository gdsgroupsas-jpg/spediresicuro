/**
 * Test Unit: Domain Management Service
 *
 * Verifica:
 * - registerCustomDomain: registra, blocklist, duplicato, errore Resend
 * - verifyCustomDomain: verified, failed, non trovato
 * - removeCustomDomain: successo, invalida indirizzi
 * - addEmailAddressOnDomain: successo, dominio non verificato, email non match
 * - removeEmailAddress: successo, blocca ultimo primary
 * - validateDomainName: validi, invalidi, blocklist
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

const mockDomainsCreate = vi.fn();
const mockDomainsGet = vi.fn();
const mockDomainsVerify = vi.fn();
const mockDomainsRemove = vi.fn();

vi.mock('@/lib/email/resend', () => ({
  getResend: () => ({
    domains: {
      create: (...args: unknown[]) => mockDomainsCreate(...args),
      get: (...args: unknown[]) => mockDomainsGet(...args),
      verify: (...args: unknown[]) => mockDomainsVerify(...args),
      remove: (...args: unknown[]) => mockDomainsRemove(...args),
    },
  }),
}));

// ─── FIXTURES ───

const WORKSPACE_ID = '11111111-1111-1111-1111-111111111111';
const DOMAIN_ID = 'domain-uuid-1';
const RESEND_DOMAIN_ID = 'resend-dom-abc123';

// ─── HELPERS ───

function makeChainable(result: unknown) {
  const builder: Record<string, unknown> = {};
  const methods = [
    'eq',
    'in',
    'order',
    'select',
    'single',
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

function mockFromTable(tableName: string, result: unknown) {
  mockFrom.mockImplementation((table: string) => {
    if (table === tableName) return makeChainable(result);
    return makeChainable({ data: null, error: null });
  });
}

// ─── IMPORTS (after mocks) ───

import {
  validateDomainName,
  registerCustomDomain,
  getWorkspaceCustomDomain,
  verifyCustomDomain,
  removeCustomDomain,
  addEmailAddressOnDomain,
  removeEmailAddress,
} from '@/lib/email/domain-management-service';

// ─── TESTS ───

beforeEach(() => {
  vi.clearAllMocks();
});

describe('validateDomainName', () => {
  it('accetta dominio valido', () => {
    expect(validateDomainName('example.com')).toBeNull();
    expect(validateDomainName('logistica-milano.it')).toBeNull();
    expect(validateDomainName('sub.domain.example.co.uk')).toBeNull();
  });

  it('rifiuta dominio vuoto', () => {
    expect(validateDomainName('')).toBe('Dominio obbligatorio');
  });

  it('rifiuta formato invalido', () => {
    expect(validateDomainName('not a domain')).toBe('Formato dominio non valido');
    expect(validateDomainName('-invalid.com')).toBe('Formato dominio non valido');
    expect(validateDomainName('.com')).toBe('Formato dominio non valido');
  });

  it('rifiuta domini in blocklist', () => {
    expect(validateDomainName('gmail.com')).toBe('Questo dominio non è consentito');
    expect(validateDomainName('spediresicuro.it')).toBe('Questo dominio non è consentito');
    expect(validateDomainName('hotmail.com')).toBe('Questo dominio non è consentito');
    expect(validateDomainName('libero.it')).toBe('Questo dominio non è consentito');
  });

  it('normalizza in lowercase', () => {
    expect(validateDomainName('GMAIL.COM')).toBe('Questo dominio non è consentito');
    expect(validateDomainName('Example.Com')).toBeNull();
  });
});

describe('registerCustomDomain', () => {
  it('registra con successo', async () => {
    // Mock: due chiamate a from('workspace_custom_domains')
    // 1. select('id').eq().single() → null (nessun dominio esistente)
    // 2. insert({...}).select().single() → dominio creato
    let fromCallCount = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_custom_domains') {
        fromCallCount++;
        if (fromCallCount === 1) {
          // Check esistente → non trovato
          return makeChainable({ data: null, error: { code: 'PGRST116' } });
        }
        // Insert → successo
        return makeChainable({
          data: {
            id: DOMAIN_ID,
            workspace_id: WORKSPACE_ID,
            domain_name: 'example.com',
            resend_domain_id: RESEND_DOMAIN_ID,
            status: 'pending',
          },
          error: null,
        });
      }
      return makeChainable({ data: null, error: null });
    });

    mockDomainsCreate.mockResolvedValue({
      data: { id: RESEND_DOMAIN_ID, name: 'example.com', status: 'pending', records: [] },
      error: null,
    });

    const result = await registerCustomDomain(WORKSPACE_ID, 'example.com');
    expect(result.success).toBe(true);
    expect(result.domain?.domain_name).toBe('example.com');
    expect(mockDomainsCreate).toHaveBeenCalledWith({ name: 'example.com' });
  });

  it('rifiuta dominio in blocklist', async () => {
    const result = await registerCustomDomain(WORKSPACE_ID, 'gmail.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('non è consentito');
    expect(mockDomainsCreate).not.toHaveBeenCalled();
  });

  it('rifiuta dominio invalido', async () => {
    const result = await registerCustomDomain(WORKSPACE_ID, 'not-a-domain');
    expect(result.success).toBe(false);
    expect(result.error).toContain('non valido');
  });

  it('rifiuta se workspace ha gia dominio', async () => {
    mockFromTable('workspace_custom_domains', {
      data: { id: DOMAIN_ID },
      error: null,
    });

    const result = await registerCustomDomain(WORKSPACE_ID, 'example.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('ha già un dominio');
    expect(mockDomainsCreate).not.toHaveBeenCalled();
  });

  it('gestisce errore Resend', async () => {
    mockFromTable('workspace_custom_domains', {
      data: null,
      error: { code: 'PGRST116' },
    });

    mockDomainsCreate.mockResolvedValue({
      data: null,
      error: { message: 'Domain already exists' },
    });

    const result = await registerCustomDomain(WORKSPACE_ID, 'example.com');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Domain already exists');
  });
});

describe('getWorkspaceCustomDomain', () => {
  it('ritorna dominio se presente', async () => {
    mockFromTable('workspace_custom_domains', {
      data: { id: DOMAIN_ID, domain_name: 'example.com', status: 'verified' },
      error: null,
    });

    const domain = await getWorkspaceCustomDomain(WORKSPACE_ID);
    expect(domain).not.toBeNull();
    expect(domain?.domain_name).toBe('example.com');
  });

  it('ritorna null se non presente', async () => {
    mockFromTable('workspace_custom_domains', {
      data: null,
      error: { code: 'PGRST116' },
    });

    const domain = await getWorkspaceCustomDomain(WORKSPACE_ID);
    expect(domain).toBeNull();
  });
});

describe('verifyCustomDomain', () => {
  it('ritorna status verified', async () => {
    mockFromTable('workspace_custom_domains', {
      data: {
        id: DOMAIN_ID,
        domain_name: 'example.com',
        resend_domain_id: RESEND_DOMAIN_ID,
        status: 'pending',
        verified_at: null,
        dns_records: [],
      },
      error: null,
    });

    mockDomainsVerify.mockResolvedValue({});
    mockDomainsGet.mockResolvedValue({
      data: {
        id: RESEND_DOMAIN_ID,
        status: 'verified',
        records: [{ type: 'MX', name: 'mx', value: 'mx.resend.com' }],
      },
      error: null,
    });

    const result = await verifyCustomDomain(WORKSPACE_ID);
    expect(result.success).toBe(true);
    expect(result.status).toBe('verified');
  });

  it('ritorna status failed', async () => {
    mockFromTable('workspace_custom_domains', {
      data: {
        id: DOMAIN_ID,
        resend_domain_id: RESEND_DOMAIN_ID,
        status: 'pending',
        verified_at: null,
        dns_records: [],
      },
      error: null,
    });

    mockDomainsVerify.mockResolvedValue({});
    mockDomainsGet.mockResolvedValue({
      data: { id: RESEND_DOMAIN_ID, status: 'failed', records: [] },
      error: null,
    });

    const result = await verifyCustomDomain(WORKSPACE_ID);
    expect(result.success).toBe(true);
    expect(result.status).toBe('failed');
  });

  it('errore se nessun dominio configurato', async () => {
    mockFromTable('workspace_custom_domains', {
      data: null,
      error: { code: 'PGRST116' },
    });

    const result = await verifyCustomDomain(WORKSPACE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Nessun dominio');
  });

  it('errore se resend_domain_id mancante', async () => {
    mockFromTable('workspace_custom_domains', {
      data: { id: DOMAIN_ID, resend_domain_id: null, status: 'pending' },
      error: null,
    });

    const result = await verifyCustomDomain(WORKSPACE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain('non registrato su Resend');
  });
});

describe('removeCustomDomain', () => {
  it('rimuove con successo', async () => {
    let callIdx = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_custom_domains') {
        return {
          select: () => ({
            eq: () => ({
              single: () => {
                callIdx++;
                if (callIdx === 1) {
                  return Promise.resolve({
                    data: {
                      id: DOMAIN_ID,
                      resend_domain_id: RESEND_DOMAIN_ID,
                      domain_name: 'example.com',
                    },
                    error: null,
                  });
                }
                return Promise.resolve({ data: null, error: null });
              },
            }),
          }),
          delete: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      if (table === 'workspace_email_addresses') {
        return {
          update: () => ({
            eq: () => ({
              not: () => Promise.resolve({ error: null }),
            }),
          }),
        };
      }
      return makeChainable({ data: null, error: null });
    });

    mockDomainsRemove.mockResolvedValue({});

    const result = await removeCustomDomain(WORKSPACE_ID);
    expect(result.success).toBe(true);
    expect(mockDomainsRemove).toHaveBeenCalledWith(RESEND_DOMAIN_ID);
  });

  it('errore se nessun dominio', async () => {
    mockFromTable('workspace_custom_domains', {
      data: null,
      error: { code: 'PGRST116' },
    });

    const result = await removeCustomDomain(WORKSPACE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toContain('Nessun dominio');
  });
});

describe('addEmailAddressOnDomain', () => {
  it('aggiunge indirizzo con successo', async () => {
    let callIdx = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_custom_domains') {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: {
                    id: DOMAIN_ID,
                    domain_name: 'example.com',
                    status: 'verified',
                    resend_domain_id: RESEND_DOMAIN_ID,
                    verified_at: '2026-01-01T00:00:00Z',
                  },
                  error: null,
                }),
            }),
          }),
        };
      }
      if (table === 'workspace_email_addresses') {
        callIdx++;
        if (callIdx === 1) {
          // update is_primary = false (per isPrimary)
          return {
            update: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ error: null }),
              }),
            }),
          };
        }
        // insert
        return {
          insert: () => ({
            select: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: 'addr-new' },
                  error: null,
                }),
            }),
          }),
        };
      }
      return makeChainable({ data: null, error: null });
    });

    const result = await addEmailAddressOnDomain(
      WORKSPACE_ID,
      'info@example.com',
      'Info Example',
      true
    );
    expect(result.success).toBe(true);
    expect(result.addressId).toBe('addr-new');
  });

  it('rifiuta se dominio non verificato', async () => {
    mockFromTable('workspace_custom_domains', {
      data: { id: DOMAIN_ID, domain_name: 'example.com', status: 'pending' },
      error: null,
    });

    const result = await addEmailAddressOnDomain(WORKSPACE_ID, 'info@example.com', 'Info');
    expect(result.success).toBe(false);
    expect(result.error).toContain('non è ancora verificato');
  });

  it('rifiuta se email non corrisponde al dominio', async () => {
    mockFromTable('workspace_custom_domains', {
      data: { id: DOMAIN_ID, domain_name: 'example.com', status: 'verified' },
      error: null,
    });

    const result = await addEmailAddressOnDomain(WORKSPACE_ID, 'info@altro-dominio.it', 'Info');
    expect(result.success).toBe(false);
    expect(result.error).toContain('deve essere sul dominio');
  });

  it('errore se nessun dominio', async () => {
    mockFromTable('workspace_custom_domains', {
      data: null,
      error: { code: 'PGRST116' },
    });

    const result = await addEmailAddressOnDomain(WORKSPACE_ID, 'info@example.com', 'Info');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Nessun dominio');
  });
});

describe('removeEmailAddress', () => {
  it('rimuove con successo', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_email_addresses') {
        return {
          select: (..._args: unknown[]) => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: { id: 'addr-1', is_primary: false, workspace_id: WORKSPACE_ID },
                    error: null,
                  }),
              }),
            }),
          }),
          delete: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      return makeChainable({ data: null, error: null });
    });

    const result = await removeEmailAddress(WORKSPACE_ID, 'addr-1');
    expect(result.success).toBe(true);
  });

  it('blocca rimozione ultimo primary', async () => {
    let callIdx = 0;
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_email_addresses') {
        callIdx++;
        if (callIdx === 1) {
          // fetch address
          return {
            select: (..._args: unknown[]) => ({
              eq: () => ({
                eq: () => ({
                  single: () =>
                    Promise.resolve({
                      data: { id: 'addr-1', is_primary: true, workspace_id: WORKSPACE_ID },
                      error: null,
                    }),
                }),
              }),
            }),
          };
        }
        // count primary
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ count: 1, error: null }),
            }),
          }),
        };
      }
      return makeChainable({ data: null, error: null });
    });

    const result = await removeEmailAddress(WORKSPACE_ID, 'addr-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('ultimo indirizzo primario');
  });

  it('errore se indirizzo non trovato', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_email_addresses') {
        return {
          select: (..._args: unknown[]) => ({
            eq: () => ({
              eq: () => ({
                single: () =>
                  Promise.resolve({
                    data: null,
                    error: { code: 'PGRST116' },
                  }),
              }),
            }),
          }),
        };
      }
      return makeChainable({ data: null, error: null });
    });

    const result = await removeEmailAddress(WORKSPACE_ID, 'non-existent');
    expect(result.success).toBe(false);
    expect(result.error).toContain('non trovato');
  });
});
