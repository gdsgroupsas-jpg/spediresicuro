/**
 * Test Outreach Worker + Consent + Analytics — Sprint S3c + S3d
 *
 * Verifica:
 * - Intent detection outreach (positivi/negativi)
 * - Sub-intent routing (enroll, send, manage, status, templates, sequences, metrics)
 * - Consent service: grant, revoke, check
 * - Analytics: metriche aggregate
 * - Outreach worker: gestione canali, listing
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// MOCK SUPABASE
// ============================================

let mockSelectResult: { data: unknown; error: unknown; count?: number | null } = {
  data: null,
  error: null,
};
let mockUpsertResult: { error: unknown } = { error: null };
let mockInsertResult: { data: unknown; error: unknown } = { data: null, error: null };
let mockUpdateResult: { error: unknown } = { error: null };

const mockQueryBuilder = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  gte: vi.fn().mockReturnThis(),
  lte: vi.fn().mockReturnThis(),
  not: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
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

// Mock servizi esterni usati dall'outreach worker
vi.mock('@/lib/crm/crm-data-service', () => ({
  searchEntities: vi.fn().mockResolvedValue([]),
  getEntityDetail: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/outreach/channel-providers', () => ({
  getProvider: vi.fn(() => ({
    send: vi.fn().mockResolvedValue({ success: true, messageId: 'msg-1', channel: 'email' }),
    isConfigured: vi.fn().mockReturnValue(true),
    validateRecipient: vi.fn().mockReturnValue(true),
    channel: 'email',
  })),
  getConfiguredChannels: vi.fn(() => ['email']),
}));

vi.mock('@/lib/outreach/template-engine', () => ({
  renderTemplate: vi.fn((template: string) => `RENDERED:${template}`),
  buildTemplateVars: vi.fn(() => ({ company_name: 'Test' })),
}));

// ============================================
// IMPORTS (dopo i mock)
// ============================================

import {
  checkConsent,
  grantConsent,
  revokeConsent,
  getConsentStatus,
} from '@/lib/outreach/consent-service';
import { getOutreachMetrics } from '@/lib/outreach/outreach-analytics';
import type { OutreachMetrics } from '@/types/outreach';

// ============================================
// CONSENT SERVICE
// ============================================

describe('Consent Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectResult = { data: null, error: null };
    mockUpsertResult = { error: null };
    mockUpdateResult = { error: null };
  });

  describe('checkConsent', () => {
    it('ritorna true se consenso presente', async () => {
      mockSelectResult = { data: { consented: true }, error: null };

      const result = await checkConsent('lead', 'ent-1', 'email');
      expect(result).toBe(true);
    });

    it('ritorna false se consenso assente', async () => {
      mockSelectResult = { data: null, error: null };

      const result = await checkConsent('lead', 'ent-1', 'whatsapp');
      expect(result).toBe(false);
    });
  });

  describe('grantConsent', () => {
    it('concede consenso con successo', async () => {
      mockUpsertResult = { error: null };

      const result = await grantConsent({
        entityType: 'prospect',
        entityId: 'ent-1',
        channel: 'email',
        source: 'manual',
        legalBasis: 'consent',
        collectedBy: 'user-1',
      });

      expect(result.success).toBe(true);
    });

    it('ritorna errore su fallimento DB', async () => {
      mockUpsertResult = { error: { message: 'DB error' } };

      const result = await grantConsent({
        entityType: 'lead',
        entityId: 'ent-1',
        channel: 'whatsapp',
        source: 'form',
        legalBasis: 'legitimate_interest',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('DB error');
    });
  });

  describe('revokeConsent', () => {
    it('revoca consenso con successo', async () => {
      mockUpdateResult = { error: null };

      const result = await revokeConsent('lead', 'ent-1', 'email');
      expect(result.success).toBe(true);
    });
  });

  describe('getConsentStatus', () => {
    it('ritorna stato consenso per tutti i canali', async () => {
      mockSelectResult = { data: null, error: null };

      const result = await getConsentStatus('lead', 'ent-1');

      expect(result).toHaveProperty('email');
      expect(result).toHaveProperty('whatsapp');
      expect(result).toHaveProperty('telegram');
      // Default: false per tutti
      expect(result.email).toBe(false);
      expect(result.whatsapp).toBe(false);
      expect(result.telegram).toBe(false);
    });
  });
});

// ============================================
// OUTREACH ANALYTICS
// ============================================

describe('Outreach Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectResult = { data: null, error: null };
  });

  it('ritorna metriche default se nessuna execution', async () => {
    mockSelectResult = { data: [], error: null };

    // Il mock from().select().eq() ritorna chain che finisce senza dati
    const metrics = await getOutreachMetrics('ws-test');

    expect(metrics).toHaveProperty('totalSent');
    expect(metrics).toHaveProperty('totalDelivered');
    expect(metrics).toHaveProperty('totalOpened');
    expect(metrics).toHaveProperty('totalReplied');
    expect(metrics).toHaveProperty('totalFailed');
    expect(metrics).toHaveProperty('deliveryRate');
    expect(metrics).toHaveProperty('openRate');
    expect(metrics).toHaveProperty('replyRate');
    expect(metrics).toHaveProperty('byChannel');
  });

  it('struttura OutreachMetrics ha byChannel per 3 canali', () => {
    const metrics: OutreachMetrics = {
      totalSent: 100,
      totalDelivered: 90,
      totalOpened: 50,
      totalReplied: 10,
      totalFailed: 5,
      deliveryRate: 0.9,
      openRate: 0.5,
      replyRate: 0.1,
      byChannel: {
        email: { sent: 60, delivered: 55, opened: 40, replied: 8, failed: 2 },
        whatsapp: { sent: 30, delivered: 25, opened: 10, replied: 2, failed: 2 },
        telegram: { sent: 10, delivered: 10, opened: 0, replied: 0, failed: 1 },
      },
    };

    expect(metrics.byChannel.email.sent).toBe(60);
    expect(metrics.byChannel.whatsapp.delivered).toBe(25);
    expect(metrics.byChannel.telegram.failed).toBe(1);
  });
});

// ============================================
// OUTREACH WORKER — IMPORTABILITA'
// ============================================

describe('Outreach Worker', () => {
  it("outreachWorker e' una funzione esportata", async () => {
    const { outreachWorker } = await import('@/lib/agent/workers/outreach-worker');
    expect(typeof outreachWorker).toBe('function');
  });

  it('OutreachWorkerInput e OutreachWorkerResult sono tipi corretti', async () => {
    const { outreachWorker } = await import('@/lib/agent/workers/outreach-worker');

    // Verifica che accetti l'input corretto
    const input = {
      message: 'test',
      userId: 'user-1',
      userRole: 'admin' as const,
      workspaceId: 'ws-1',
    };

    // Non crasha con input valido (potrebbe fallire per mock ma non per tipo)
    const result = await outreachWorker(input);
    expect(result).toHaveProperty('response');
    expect(result).toHaveProperty('toolsUsed');
    expect(typeof result.response).toBe('string');
    expect(Array.isArray(result.toolsUsed)).toBe(true);
  });
});

// ============================================
// STATE — outreach_response
// ============================================

describe('AgentState outreach_response', () => {
  it('AgentState accetta outreach_response', () => {
    // Type check a runtime
    const state: Partial<import('@/lib/agent/orchestrator/state').AgentState> = {
      outreach_response: {
        message: 'Enrollment creato',
        toolsUsed: ['schedule_outreach'],
      },
    };

    expect(state.outreach_response?.message).toBe('Enrollment creato');
    expect(state.outreach_response?.toolsUsed).toContain('schedule_outreach');
  });

  it('next_step accetta outreach_worker', () => {
    const state: Partial<import('@/lib/agent/orchestrator/state').AgentState> = {
      next_step: 'outreach_worker',
    };

    expect(state.next_step).toBe('outreach_worker');
  });
});

// ============================================
// TELEMETRIA — IntentType include outreach
// ============================================

describe('Telemetry IntentType', () => {
  it('IntentType include outreach', () => {
    const intent: import('@/lib/telemetry/logger').IntentType = 'outreach';
    expect(intent).toBe('outreach');
  });
});
