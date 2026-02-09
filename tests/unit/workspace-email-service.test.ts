/**
 * Test: Workspace Email Service
 *
 * Verifica:
 * - Validazione ownership indirizzo mittente
 * - Rate limiting per workspace
 * - Sanitizzazione HTML body (XSS, script, event handler)
 * - Invio email workspace-scoped (draft vs invio reale)
 * - Errore se indirizzo non appartiene al workspace
 * - Errore se rate limit superato
 * - Aggiornamento message_id dopo invio Resend
 * - Fallback status 'failed' se Resend fallisce
 * - Lookup workspace da indirizzo email
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ─── MOCK SETUP ───

// Mock Resend SDK (usato da sendEmail in resend.ts)
const mockResendSend = vi.fn().mockResolvedValue({ data: { id: 'resend-123' }, error: null });

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: { send: mockResendSend },
  })),
}));

vi.stubEnv('RESEND_API_KEY', 'test-key');

// Mock supabaseAdmin
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

// Mock rate limiting distribuito — default: permetti tutto
const mockRateLimit = vi.fn().mockResolvedValue({
  allowed: true,
  remaining: 99,
  resetAt: Date.now() + 60000,
  source: 'memory' as const,
});

vi.mock('@/lib/security/rate-limit', () => ({
  rateLimit: (...args: unknown[]) => mockRateLimit(...args),
}));

// ─── IMPORT AFTER MOCKS ───

import {
  sendWorkspaceEmail,
  validateSenderAddress,
  getWorkspaceEmailAddresses,
  lookupWorkspaceByEmail,
} from '@/lib/email/workspace-email-service';

// ─── FIXTURES ───

const WORKSPACE_ID = 'ws-001';
const FROM_ADDRESS_ID = 'addr-001';

const mockAddress = {
  id: FROM_ADDRESS_ID,
  workspace_id: WORKSPACE_ID,
  email_address: 'info@logisticamilano.it',
  display_name: 'Logistica Milano',
  is_primary: true,
  is_verified: true,
  resend_domain_id: 'domain-123',
  domain_verified_at: '2026-01-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const defaultParams = {
  workspaceId: WORKSPACE_ID,
  fromAddressId: FROM_ADDRESS_ID,
  to: ['cliente@example.it'],
  subject: 'Conferma spedizione',
  bodyHtml: '<p>La tua spedizione è confermata.</p>',
};

// ─── HELPERS ───

/**
 * Configura mock per un flusso di invio completo (validazione + rate limit + RPC + Resend)
 */
function setupSuccessfulSendMocks() {
  // validateSenderAddress → .from('workspace_email_addresses').select().eq().eq().single()
  // checkRateLimit → .from('outreach_channel_config').select().eq().eq().single()
  //                 → .from('emails').select(count).eq().eq().neq().gte()
  // update message_id → .from('emails').update().eq()

  mockFrom.mockImplementation((table: string) => {
    if (table === 'workspace_email_addresses') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: mockAddress, error: null }),
            }),
          }),
          order: () => Promise.resolve({ data: [mockAddress], error: null }),
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
                gte: () => Promise.resolve({ count: 5, error: null }),
              }),
            }),
          }),
        }),
        update: () => ({
          eq: () => Promise.resolve({ error: null }),
        }),
      };
    }
    return {
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    };
  });

  // RPC send_workspace_email → restituisce UUID
  mockRpc.mockResolvedValue({ data: 'email-uuid-001', error: null });
}

// ─── TESTS ───

beforeEach(() => {
  vi.clearAllMocks();
  mockResendSend.mockResolvedValue({ data: { id: 'resend-123' }, error: null });
});

describe('validateSenderAddress', () => {
  it('dovrebbe validare indirizzo appartenente al workspace', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: mockAddress, error: null }),
          }),
        }),
      }),
    });

    const result = await validateSenderAddress(WORKSPACE_ID, FROM_ADDRESS_ID);

    expect(result.valid).toBe(true);
    expect(result.address).toBeDefined();
    expect(result.address!.email_address).toBe('info@logisticamilano.it');
  });

  it('dovrebbe rifiutare indirizzo non trovato', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
          }),
        }),
      }),
    });

    const result = await validateSenderAddress(WORKSPACE_ID, 'addr-fake');

    expect(result.valid).toBe(false);
    expect(result.error).toContain('non trovato');
  });

  it('dovrebbe rifiutare indirizzo non verificato', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () =>
              Promise.resolve({ data: { ...mockAddress, is_verified: false }, error: null }),
          }),
        }),
      }),
    });

    const result = await validateSenderAddress(WORKSPACE_ID, FROM_ADDRESS_ID);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('non verificato');
  });
});

describe('sendWorkspaceEmail', () => {
  describe('invio reale', () => {
    it('dovrebbe inviare email con successo', async () => {
      setupSuccessfulSendMocks();

      const result = await sendWorkspaceEmail(defaultParams);

      expect(result.success).toBe(true);
      expect(result.emailId).toBe('email-uuid-001');
      expect(result.resendId).toBe('resend-123');
    });

    it('dovrebbe chiamare RPC con parametri corretti', async () => {
      setupSuccessfulSendMocks();

      await sendWorkspaceEmail(defaultParams);

      expect(mockRpc).toHaveBeenCalledWith('send_workspace_email', {
        p_workspace_id: WORKSPACE_ID,
        p_from_address_id: FROM_ADDRESS_ID,
        p_to_addresses: ['cliente@example.it'],
        p_cc: [],
        p_subject: 'Conferma spedizione',
        p_body_html: '<p>La tua spedizione è confermata.</p>',
        p_body_text: null,
        p_reply_to_email_id: null,
        p_is_draft: false,
      });
    });

    it('dovrebbe passare from del workspace a Resend (FIX #9)', async () => {
      setupSuccessfulSendMocks();

      await sendWorkspaceEmail(defaultParams);

      // Verifica che Resend riceva from con indirizzo workspace
      const resendCall = mockResendSend.mock.calls[0][0];
      expect(resendCall.from).toContain('Logistica Milano');
      expect(resendCall.from).toContain('info@logisticamilano.it');
    });

    it('dovrebbe aggiornare message_id Resend dopo invio', async () => {
      setupSuccessfulSendMocks();

      await sendWorkspaceEmail(defaultParams);

      // Verifica che update sia stato chiamato per aggiornare message_id
      expect(mockFrom).toHaveBeenCalledWith('emails');
    });

    it('dovrebbe fallire se indirizzo non appartiene al workspace', async () => {
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
        ...defaultParams,
        fromAddressId: 'addr-wrong-workspace',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('non trovato');
      // NON deve chiamare RPC né Resend
      expect(mockRpc).not.toHaveBeenCalled();
      expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('dovrebbe segnare come failed se Resend fallisce', async () => {
      setupSuccessfulSendMocks();
      mockResendSend.mockResolvedValueOnce({ data: null, error: { message: 'Rate limited' } });

      const result = await sendWorkspaceEmail(defaultParams);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Rate limited');
      expect(result.emailId).toBe('email-uuid-001'); // Record DB creato comunque
    });

    it('dovrebbe gestire errore RPC SENDER_NOT_OWNED', async () => {
      // Validazione OK ma RPC fallisce
      mockFrom.mockImplementation((table: string) => {
        if (table === 'workspace_email_addresses') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: mockAddress, error: null }),
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
                    gte: () => Promise.resolve({ count: 5, error: null }),
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      mockRpc.mockResolvedValueOnce({
        data: null,
        error: { message: "SENDER_NOT_OWNED: L'indirizzo mittente non appartiene" },
      });

      const result = await sendWorkspaceEmail(defaultParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('non appartiene');
    });
  });

  describe('bozze', () => {
    it('dovrebbe salvare bozza senza inviare via Resend', async () => {
      setupSuccessfulSendMocks();

      const result = await sendWorkspaceEmail({
        ...defaultParams,
        isDraft: true,
      });

      expect(result.success).toBe(true);
      expect(result.emailId).toBe('email-uuid-001');
      expect(result.resendId).toBeUndefined();
      // Resend NON deve essere chiamato per bozze
      expect(mockResendSend).not.toHaveBeenCalled();
    });

    it('dovrebbe passare is_draft=true alla RPC', async () => {
      setupSuccessfulSendMocks();

      await sendWorkspaceEmail({
        ...defaultParams,
        isDraft: true,
      });

      expect(mockRpc).toHaveBeenCalledWith(
        'send_workspace_email',
        expect.objectContaining({ p_is_draft: true })
      );
    });

    it('dovrebbe saltare rate limit per bozze', async () => {
      // Setup: indirizzo valido ma rate limit esaurito
      mockFrom.mockImplementation((table: string) => {
        if (table === 'workspace_email_addresses') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: mockAddress, error: null }),
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
                  single: () => Promise.resolve({ data: { daily_limit: 5 }, error: null }),
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
                    gte: () => Promise.resolve({ count: 5, error: null }), // Limite raggiunto!
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      mockRpc.mockResolvedValue({ data: 'draft-uuid', error: null });

      const result = await sendWorkspaceEmail({
        ...defaultParams,
        isDraft: true,
      });

      // Bozza OK anche con rate limit esaurito
      expect(result.success).toBe(true);
    });
  });

  describe('rate limiting', () => {
    it('dovrebbe bloccare se rate limit superato', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'workspace_email_addresses') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: mockAddress, error: null }),
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
                  single: () => Promise.resolve({ data: { daily_limit: 10 }, error: null }),
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
                    gte: () => Promise.resolve({ count: 10, error: null }), // Limite raggiunto
                  }),
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await sendWorkspaceEmail(defaultParams);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Limite giornaliero');
      expect(mockRpc).not.toHaveBeenCalled();
    });

    it('dovrebbe usare default 100 se config non trovata', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'workspace_email_addresses') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  single: () => Promise.resolve({ data: mockAddress, error: null }),
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
                  single: () => Promise.resolve({ data: null, error: { message: 'Not found' } }),
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
                    gte: () => Promise.resolve({ count: 50, error: null }), // Sotto il default 100
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

      const result = await sendWorkspaceEmail(defaultParams);

      // Passa perché 50 < 100 (default)
      expect(result.success).toBe(true);
    });
  });

  describe('sanitizzazione HTML', () => {
    it('dovrebbe rimuovere tag script dal body', async () => {
      setupSuccessfulSendMocks();

      await sendWorkspaceEmail({
        ...defaultParams,
        bodyHtml: '<p>Ciao</p><script>alert("xss")</script>',
      });

      // Verifica che la RPC riceva HTML sanitizzato
      const rpcCall = mockRpc.mock.calls[0][1];
      expect(rpcCall.p_body_html).not.toContain('<script>');
      expect(rpcCall.p_body_html).toContain('<p>Ciao</p>');
    });

    it('dovrebbe rimuovere tag iframe', async () => {
      setupSuccessfulSendMocks();

      await sendWorkspaceEmail({
        ...defaultParams,
        bodyHtml: '<p>Info</p><iframe src="evil.com"></iframe>',
      });

      const rpcCall = mockRpc.mock.calls[0][1];
      expect(rpcCall.p_body_html).not.toContain('<iframe');
      expect(rpcCall.p_body_html).toContain('<p>Info</p>');
    });

    it('dovrebbe rimuovere event handler inline', async () => {
      setupSuccessfulSendMocks();

      await sendWorkspaceEmail({
        ...defaultParams,
        bodyHtml: '<img src="photo.jpg" onerror="alert(1)">',
      });

      const rpcCall = mockRpc.mock.calls[0][1];
      expect(rpcCall.p_body_html).not.toContain('onerror');
      expect(rpcCall.p_body_html).toContain('src="photo.jpg"');
    });

    it('dovrebbe rimuovere javascript: da href', async () => {
      setupSuccessfulSendMocks();

      await sendWorkspaceEmail({
        ...defaultParams,
        bodyHtml: '<a href="javascript:alert(1)">Click</a>',
      });

      const rpcCall = mockRpc.mock.calls[0][1];
      expect(rpcCall.p_body_html).not.toContain('javascript:');
    });

    it('dovrebbe preservare tag HTML sicuri', async () => {
      setupSuccessfulSendMocks();

      const safeHtml =
        '<h1>Titolo</h1><p>Paragrafo con <strong>grassetto</strong> e <a href="https://example.com">link</a></p>';
      await sendWorkspaceEmail({
        ...defaultParams,
        bodyHtml: safeHtml,
      });

      const rpcCall = mockRpc.mock.calls[0][1];
      expect(rpcCall.p_body_html).toContain('<h1>Titolo</h1>');
      expect(rpcCall.p_body_html).toContain('<strong>grassetto</strong>');
      expect(rpcCall.p_body_html).toContain('href="https://example.com"');
    });

    it('dovrebbe rimuovere tag style', async () => {
      setupSuccessfulSendMocks();

      await sendWorkspaceEmail({
        ...defaultParams,
        bodyHtml: '<style>.evil { display: none }</style><p>Testo</p>',
      });

      const rpcCall = mockRpc.mock.calls[0][1];
      expect(rpcCall.p_body_html).not.toContain('<style>');
      expect(rpcCall.p_body_html).toContain('<p>Testo</p>');
    });

    it('dovrebbe rimuovere tag form/input', async () => {
      setupSuccessfulSendMocks();

      await sendWorkspaceEmail({
        ...defaultParams,
        bodyHtml: '<form action="evil.com"><input type="text"><button>Send</button></form>',
      });

      const rpcCall = mockRpc.mock.calls[0][1];
      expect(rpcCall.p_body_html).not.toContain('<form');
      expect(rpcCall.p_body_html).not.toContain('<input');
      expect(rpcCall.p_body_html).not.toContain('<button');
    });

    // ─── BYPASS AVANZATI (FIX #7) ───

    it('dovrebbe bloccare HTML entity encoded javascript:', async () => {
      setupSuccessfulSendMocks();

      await sendWorkspaceEmail({
        ...defaultParams,
        bodyHtml: '<a href="&#106;avascript:alert(1)">Click</a>',
      });

      const rpcCall = mockRpc.mock.calls[0][1];
      expect(rpcCall.p_body_html).not.toContain('javascript:');
    });

    it('dovrebbe bloccare vbscript: protocol', async () => {
      setupSuccessfulSendMocks();

      await sendWorkspaceEmail({
        ...defaultParams,
        bodyHtml: '<a href="vbscript:MsgBox(1)">Click</a>',
      });

      const rpcCall = mockRpc.mock.calls[0][1];
      expect(rpcCall.p_body_html).not.toContain('vbscript:');
    });

    it('dovrebbe rimuovere tag svg', async () => {
      setupSuccessfulSendMocks();

      await sendWorkspaceEmail({
        ...defaultParams,
        bodyHtml: '<svg onload="alert(1)"></svg>',
      });

      const rpcCall = mockRpc.mock.calls[0][1];
      expect(rpcCall.p_body_html).not.toContain('<svg');
    });

    it('dovrebbe bloccare recomposition attack', async () => {
      setupSuccessfulSendMocks();

      await sendWorkspaceEmail({
        ...defaultParams,
        bodyHtml: '<scr<script>ipt>alert(1)</scr</script>ipt>',
      });

      const rpcCall = mockRpc.mock.calls[0][1];
      expect(rpcCall.p_body_html).not.toContain('<script');
    });
  });
});

describe('getWorkspaceEmailAddresses', () => {
  it('dovrebbe restituire indirizzi del workspace', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [mockAddress], error: null }),
        }),
      }),
    });

    const addresses = await getWorkspaceEmailAddresses(WORKSPACE_ID);

    expect(addresses).toHaveLength(1);
    expect(addresses[0].email_address).toBe('info@logisticamilano.it');
  });

  it('dovrebbe restituire array vuoto se errore', async () => {
    mockFrom.mockReturnValue({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: null, error: { message: 'DB error' } }),
        }),
      }),
    });

    const addresses = await getWorkspaceEmailAddresses(WORKSPACE_ID);

    expect(addresses).toEqual([]);
  });
});

describe('lookupWorkspaceByEmail', () => {
  it('dovrebbe restituire workspace_id per indirizzo mappato', async () => {
    mockRpc.mockResolvedValue({ data: WORKSPACE_ID, error: null });

    const wsId = await lookupWorkspaceByEmail('info@logisticamilano.it');

    expect(wsId).toBe(WORKSPACE_ID);
    expect(mockRpc).toHaveBeenCalledWith('lookup_workspace_by_email', {
      p_email_address: 'info@logisticamilano.it',
    });
  });

  it('dovrebbe restituire null per indirizzo non mappato', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const wsId = await lookupWorkspaceByEmail('random@gmail.com');

    expect(wsId).toBeNull();
  });

  it('dovrebbe restituire null in caso di errore', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'Function error' } });

    const wsId = await lookupWorkspaceByEmail('test@test.it');

    expect(wsId).toBeNull();
  });
});
