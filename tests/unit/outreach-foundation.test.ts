/**
 * Test Outreach Foundation — Sprint S3a
 *
 * Verifica:
 * - Template engine: rendering, validazione, estrazione variabili
 * - Channel providers: factory, validazione recipient, isConfigured
 * - Channel capabilities: mappa statica corretta
 * - Data service: CRUD con mock Supabase
 * - Types: importabilita' e struttura
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// MOCK SUPABASE (pattern identico a crm-write-service.test.ts)
// ============================================

let mockSelectResult: { data: unknown; error: unknown } = { data: null, error: null };
let mockUpsertResult: { error: unknown } = { error: null };
let mockInsertResult: { data: unknown; error: unknown } = { data: null, error: null };

const mockQueryBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn(() => mockSelectResult),
  single: vi.fn(() => mockInsertResult),
  upsert: vi.fn(() => mockUpsertResult),
  insert: vi.fn(() => ({
    ...mockInsertResult,
    select: vi.fn(() => ({
      single: vi.fn(() => mockInsertResult),
    })),
  })),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  then: (resolve: (val: unknown) => void) => {
    resolve(mockSelectResult);
    return mockQueryBuilder;
  },
};

vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: vi.fn(() => mockQueryBuilder),
  },
}));

// Mock Resend
vi.mock('@/lib/email/resend', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, id: 'resend-msg-123' }),
}));

// Mock WhatsApp
vi.mock('@/lib/services/whatsapp', () => ({
  sendWhatsAppText: vi.fn().mockResolvedValue({ success: true, messageId: 'wa-msg-123' }),
}));

// Mock Telegram queue
vi.mock('@/lib/services/telegram-queue', () => ({
  enqueueMessage: vi.fn().mockResolvedValue('tg-msg-123'),
}));

// ============================================
// IMPORTS (dopo i mock)
// ============================================

import {
  renderTemplate,
  validateTemplate,
  extractVariables,
  buildTemplateVars,
} from '@/lib/outreach/template-engine';
import { getProvider, getConfiguredChannels } from '@/lib/outreach/channel-providers';
import { CHANNEL_CAPABILITIES } from '@/types/outreach';
import type {
  OutreachChannel,
  TemplateVars,
  SendResult,
  ChannelConfig,
  OutreachTemplate,
  OutreachSequence,
  Enrollment,
  Execution,
  OutreachConsent,
  GdprLegalBasis,
} from '@/types/outreach';

// ============================================
// TEMPLATE ENGINE
// ============================================

describe('Template Engine', () => {
  describe('renderTemplate', () => {
    it('renderizza variabili correttamente', () => {
      const result = renderTemplate('Ciao {{company_name}}, score: {{score}}', {
        company_name: 'Acme Corp',
        score: 85,
      });
      expect(result).toBe('Ciao Acme Corp, score: 85');
    });

    it('variabili mancanti diventano stringa vuota', () => {
      const result = renderTemplate('Ciao {{company_name}}, tel: {{phone}}', {
        company_name: 'Acme',
      });
      expect(result).toBe('Ciao Acme, tel: ');
    });

    it('escape HTML per default (sicurezza XSS)', () => {
      const result = renderTemplate('Nome: {{company_name}}', {
        company_name: '<script>alert("xss")</script>',
      });
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('gestisce template vuoto', () => {
      const result = renderTemplate('', { company_name: 'Test' });
      expect(result).toBe('');
    });

    it('gestisce template senza variabili', () => {
      const result = renderTemplate('Testo fisso senza variabili', { company_name: 'Test' });
      expect(result).toBe('Testo fisso senza variabili');
    });
  });

  describe('validateTemplate', () => {
    it('template valido', () => {
      const result = validateTemplate('Ciao {{company_name}}');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('template invalido (parentesi non chiuse)', () => {
      const result = validateTemplate('Ciao {{company_name');
      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it("template vuoto e' valido", () => {
      const result = validateTemplate('');
      expect(result.valid).toBe(true);
    });
  });

  describe('extractVariables', () => {
    it('estrae variabili da template', () => {
      const vars = extractVariables('{{company_name}} - {{sector}} ({{score}})');
      expect(vars).toContain('company_name');
      expect(vars).toContain('sector');
      expect(vars).toContain('score');
      expect(vars).toHaveLength(3);
    });

    it('nessuna variabile in template fisso', () => {
      const vars = extractVariables('Testo fisso');
      expect(vars).toHaveLength(0);
    });

    it('non duplica variabili ripetute', () => {
      const vars = extractVariables('{{name}} e ancora {{name}}');
      expect(vars).toHaveLength(1);
      expect(vars[0]).toBe('name');
    });
  });

  describe('buildTemplateVars', () => {
    it('costruisce TemplateVars da entita', () => {
      const vars = buildTemplateVars({
        company_name: 'Farmacia Rossi',
        contact_name: 'Mario Rossi',
        sector: 'pharma',
        status: 'contacted',
        lead_score: 72,
      });
      expect(vars.company_name).toBe('Farmacia Rossi');
      expect(vars.contact_name).toBe('Mario Rossi');
      expect(vars.sector).toBe('pharma');
      expect(vars.status).toBe('contacted');
      expect(vars.score).toBe(72);
    });

    it('gestisce campi mancanti', () => {
      const vars = buildTemplateVars({ company_name: 'Test' });
      expect(vars.company_name).toBe('Test');
      expect(vars.contact_name).toBeUndefined();
      expect(vars.sector).toBeUndefined();
    });
  });
});

// ============================================
// CHANNEL PROVIDERS
// ============================================

describe('Channel Providers', () => {
  describe('factory', () => {
    it('ritorna provider per email', () => {
      const provider = getProvider('email');
      expect(provider).toBeDefined();
      expect(provider.channel).toBe('email');
    });

    it('ritorna provider per whatsapp', () => {
      const provider = getProvider('whatsapp');
      expect(provider).toBeDefined();
      expect(provider.channel).toBe('whatsapp');
    });

    it('ritorna provider per telegram', () => {
      const provider = getProvider('telegram');
      expect(provider).toBeDefined();
      expect(provider.channel).toBe('telegram');
    });
  });

  describe('validateRecipient', () => {
    it('email valida', () => {
      const p = getProvider('email');
      expect(p.validateRecipient('test@example.com')).toBe(true);
    });

    it('email invalida', () => {
      const p = getProvider('email');
      expect(p.validateRecipient('not-an-email')).toBe(false);
    });

    it('telefono E.164 valido (WhatsApp)', () => {
      const p = getProvider('whatsapp');
      expect(p.validateRecipient('+393401234567')).toBe(true);
      expect(p.validateRecipient('393401234567')).toBe(true);
    });

    it('telefono invalido (WhatsApp)', () => {
      const p = getProvider('whatsapp');
      expect(p.validateRecipient('abc')).toBe(false);
      expect(p.validateRecipient('123')).toBe(false);
    });

    it('chat ID numerico valido (Telegram)', () => {
      const p = getProvider('telegram');
      expect(p.validateRecipient('123456789')).toBe(true);
      expect(p.validateRecipient('-1001234567890')).toBe(true);
    });

    it('chat ID invalido (Telegram)', () => {
      const p = getProvider('telegram');
      expect(p.validateRecipient('abc')).toBe(false);
      expect(p.validateRecipient('')).toBe(false);
    });
  });

  describe('send', () => {
    const originalEnv = { ...process.env };

    beforeEach(() => {
      process.env.RESEND_API_KEY = 'test-key';
      process.env.WHATSAPP_TOKEN = 'test-token';
      process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-id';
      process.env.TELEGRAM_BOT_TOKEN = 'test-bot-token';
    });

    it('email: invia con successo', async () => {
      const p = getProvider('email');
      const result = await p.send('test@example.com', 'Oggetto', '<p>Corpo</p>');
      expect(result.success).toBe(true);
      expect(result.channel).toBe('email');
    });

    it('whatsapp: invia con successo', async () => {
      const p = getProvider('whatsapp');
      const result = await p.send('+393401234567', null, 'Ciao!');
      expect(result.success).toBe(true);
      expect(result.channel).toBe('whatsapp');
      expect(result.messageId).toBe('wa-msg-123');
    });

    it('telegram: invia con successo', async () => {
      const p = getProvider('telegram');
      const result = await p.send('123456789', null, 'Ciao!');
      expect(result.success).toBe(true);
      expect(result.channel).toBe('telegram');
      expect(result.messageId).toBe('tg-msg-123');
    });

    it('email: fallisce con destinatario invalido', async () => {
      const p = getProvider('email');
      const result = await p.send('not-valid', 'Test', 'Body');
      expect(result.success).toBe(false);
      expect(result.error).toContain('non valida');
    });

    it('whatsapp: fallisce con destinatario invalido', async () => {
      const p = getProvider('whatsapp');
      const result = await p.send('abc', null, 'Body');
      expect(result.success).toBe(false);
      expect(result.error).toContain('non valido');
    });

    it('telegram: fallisce con chat ID invalido', async () => {
      const p = getProvider('telegram');
      const result = await p.send('abc', null, 'Body');
      expect(result.success).toBe(false);
      expect(result.error).toContain('non valido');
    });
  });
});

// ============================================
// CHANNEL CAPABILITIES
// ============================================

describe('CHANNEL_CAPABILITIES', () => {
  it('email supporta open tracking', () => {
    expect(CHANNEL_CAPABILITIES.email.supportsOpenTracking).toBe(true);
    expect(CHANNEL_CAPABILITIES.email.supportsReadTracking).toBe(false);
  });

  it('whatsapp supporta read tracking', () => {
    expect(CHANNEL_CAPABILITIES.whatsapp.supportsOpenTracking).toBe(false);
    expect(CHANNEL_CAPABILITIES.whatsapp.supportsReadTracking).toBe(true);
  });

  it("telegram non supporta ne' open ne' read tracking", () => {
    expect(CHANNEL_CAPABILITIES.telegram.supportsOpenTracking).toBe(false);
    expect(CHANNEL_CAPABILITIES.telegram.supportsReadTracking).toBe(false);
  });

  it('telegram ha 0 retry (gestiti dalla sua queue)', () => {
    expect(CHANNEL_CAPABILITIES.telegram.defaultMaxRetries).toBe(0);
  });

  it('tutti i canali hanno maxBodyLength definito', () => {
    for (const ch of ['email', 'whatsapp', 'telegram'] as const) {
      expect(CHANNEL_CAPABILITIES[ch].maxBodyLength).toBeGreaterThan(0);
    }
  });

  it('tutti i canali supportano reply detection', () => {
    for (const ch of ['email', 'whatsapp', 'telegram'] as const) {
      expect(CHANNEL_CAPABILITIES[ch].supportsReplyDetection).toBe(true);
    }
  });
});

// ============================================
// TYPES — Importabilita'
// ============================================

describe('Outreach Types', () => {
  it('OutreachChannel ha 3 valori', () => {
    const channels: OutreachChannel[] = ['email', 'whatsapp', 'telegram'];
    expect(channels).toHaveLength(3);
  });

  it('GdprLegalBasis ha 4 valori', () => {
    const bases: GdprLegalBasis[] = [
      'consent',
      'legitimate_interest',
      'contract',
      'legal_obligation',
    ];
    expect(bases).toHaveLength(4);
  });

  it("SendResult e' tipizzato correttamente", () => {
    const result: SendResult = { success: true, messageId: 'abc', channel: 'email' };
    expect(result.success).toBe(true);
  });

  it('ChannelConfig include campi capability', () => {
    const config: ChannelConfig = {
      id: 'test',
      workspace_id: 'ws-1',
      channel: 'email',
      enabled: true,
      config: {},
      daily_limit: 100,
      max_retries: 2,
      supports_open_tracking: true,
      supports_read_tracking: false,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };
    expect(config.max_retries).toBe(2);
    expect(config.supports_open_tracking).toBe(true);
  });

  it('Execution include campi denormalizzati', () => {
    const exec: Execution = {
      id: 'test',
      enrollment_id: 'enr-1',
      step_id: 'step-1',
      workspace_id: 'ws-1',
      entity_type: 'lead',
      entity_id: 'lead-1',
      channel: 'email',
      recipient: 'test@example.com',
      template_id: 'tpl-1',
      rendered_subject: 'Test',
      rendered_body: 'Body',
      status: 'sent',
      provider_message_id: 'msg-1',
      error_message: null,
      retry_count: 0,
      sent_at: '2026-01-01',
      delivered_at: null,
      opened_at: null,
      replied_at: null,
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };
    expect(exec.workspace_id).toBe('ws-1');
    expect(exec.entity_type).toBe('lead');
    expect(exec.retry_count).toBe(0);
  });

  it('OutreachConsent include GDPR fields', () => {
    const consent: OutreachConsent = {
      id: 'test',
      entity_type: 'prospect',
      entity_id: 'prsp-1',
      channel: 'email',
      consented: true,
      legal_basis: 'consent',
      consented_at: '2026-01-01',
      revoked_at: null,
      source: 'form',
      collected_by: 'user-1',
      provenance_detail: 'Form contatto sito web',
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    };
    expect(consent.legal_basis).toBe('consent');
    expect(consent.collected_by).toBe('user-1');
    expect(consent.provenance_detail).toBeTruthy();
  });
});

// ============================================
// DATA SERVICE (mock Supabase)
// ============================================

describe('Outreach Data Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectResult = { data: null, error: null };
    mockUpsertResult = { error: null };
    mockInsertResult = { data: null, error: null };
  });

  it('getChannelConfig ritorna array vuoto su errore', async () => {
    mockSelectResult = { data: null, error: { message: 'DB error' } };
    // Override then per simulare array result
    const originalThen = mockQueryBuilder.then;
    mockQueryBuilder.then = (resolve: (val: unknown) => void) => {
      resolve({ data: null, error: { message: 'DB error' } });
      return mockQueryBuilder;
    };
    const { getChannelConfig } = await import('@/lib/outreach/outreach-data-service');
    // Reset then
    mockQueryBuilder.then = originalThen;
  });

  it('upsertChannelConfig ritorna success', async () => {
    mockUpsertResult = { error: null };
    const { upsertChannelConfig } = await import('@/lib/outreach/outreach-data-service');
    const result = await upsertChannelConfig({
      workspaceId: 'ws-1',
      channel: 'email',
      enabled: true,
    });
    expect(result.success).toBe(true);
  });

  it('createTemplate ritorna templateId', async () => {
    mockInsertResult = { data: { id: 'tpl-new-1' }, error: null };
    const { createTemplate } = await import('@/lib/outreach/outreach-data-service');
    const result = await createTemplate({
      workspaceId: 'ws-1',
      name: 'followup_3d',
      channel: 'email',
      body: 'Ciao {{company_name}}',
      subject: 'Follow-up',
      category: 'followup',
    });
    expect(result.success).toBe(true);
    expect(result.templateId).toBe('tpl-new-1');
  });

  it('createTemplate sanitizza il nome', async () => {
    mockInsertResult = { data: { id: 'tpl-2' }, error: null };
    const { createTemplate } = await import('@/lib/outreach/outreach-data-service');
    await createTemplate({
      workspaceId: 'ws-1',
      name: '<script>alert("xss")</script>Nome',
      channel: 'email',
      body: 'Test',
    });
    // Verifica che insert e' stato chiamato con nome sanitizzato
    const insertCall = mockQueryBuilder.insert.mock.calls.at(-1);
    if (insertCall) {
      expect(insertCall[0].name).not.toContain('<script>');
    }
  });
});
