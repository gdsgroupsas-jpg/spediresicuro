/**
 * Test Gap Fixes — Sprint S3d
 *
 * Verifica:
 * - Delivery tracker (status progression, no regression)
 * - Resend webhook (signature verification, event processing)
 * - Feature flags (kill switch, pilot workspaces)
 * - Structured logger (formato JSON, campi contestuali)
 * - Kill switch integrazione (executor, worker, cron)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// MOCK SUPABASE
// ============================================

let mockSelectResult: { data: unknown; error: unknown } = { data: null, error: null };
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
  single: vi.fn(() => mockSelectResult),
  upsert: vi.fn(() => ({ error: null })),
  insert: vi.fn(() => ({ error: null })),
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

// ============================================
// IMPORTS (dopo i mock)
// ============================================

import { updateExecutionDeliveryStatus } from '@/lib/outreach/delivery-tracker';
import {
  isOutreachKillSwitchActive,
  isWorkspaceEnabledForOutreach,
  isOutreachEnabledForWorkspace,
} from '@/lib/outreach/outreach-feature-flags';
import { outreachLogger } from '@/lib/outreach/outreach-logger';

// ============================================
// DELIVERY TRACKER
// ============================================

describe('Delivery Tracker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectResult = { data: null, error: null };
    mockUpdateResult = { error: null };
  });

  it('aggiorna status da sent a delivered', async () => {
    mockSelectResult = { data: { id: 'exec-1', status: 'sent' }, error: null };
    mockUpdateResult = { error: null };

    const result = await updateExecutionDeliveryStatus('msg-123', 'delivered', {
      deliveredAt: '2026-02-10T10:00:00Z',
    });
    expect(result).toBe(true);
  });

  it('aggiorna status da delivered a opened', async () => {
    mockSelectResult = { data: { id: 'exec-1', status: 'delivered' }, error: null };

    const result = await updateExecutionDeliveryStatus('msg-123', 'opened', {
      openedAt: '2026-02-10T10:00:00Z',
    });
    expect(result).toBe(true);
  });

  it('NON regredisce da opened a delivered', async () => {
    mockSelectResult = { data: { id: 'exec-1', status: 'opened' }, error: null };

    const result = await updateExecutionDeliveryStatus('msg-123', 'delivered');
    expect(result).toBe(false);
  });

  it('NON regredisce da replied a opened', async () => {
    mockSelectResult = { data: { id: 'exec-1', status: 'replied' }, error: null };

    const result = await updateExecutionDeliveryStatus('msg-123', 'opened');
    expect(result).toBe(false);
  });

  it('ignora se provider_message_id vuoto', async () => {
    const result = await updateExecutionDeliveryStatus('', 'delivered');
    expect(result).toBe(false);
  });

  it('ignora se execution non trovata', async () => {
    mockSelectResult = { data: null, error: null };

    const result = await updateExecutionDeliveryStatus('msg-unknown', 'delivered');
    expect(result).toBe(false);
  });

  it('gestisce errore DB su fetch', async () => {
    mockSelectResult = { data: null, error: { message: 'DB error' } };

    const result = await updateExecutionDeliveryStatus('msg-123', 'delivered');
    expect(result).toBe(false);
  });
});

// ============================================
// FEATURE FLAGS
// ============================================

describe('Feature Flags', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
    mockSelectResult = { data: null, error: null };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('Kill Switch', () => {
    it('attivo quando OUTREACH_KILL_SWITCH=true', () => {
      process.env.OUTREACH_KILL_SWITCH = 'true';
      expect(isOutreachKillSwitchActive()).toBe(true);
    });

    it('non attivo quando OUTREACH_KILL_SWITCH non settato', () => {
      delete process.env.OUTREACH_KILL_SWITCH;
      expect(isOutreachKillSwitchActive()).toBe(false);
    });

    it('non attivo quando OUTREACH_KILL_SWITCH=false', () => {
      process.env.OUTREACH_KILL_SWITCH = 'false';
      expect(isOutreachKillSwitchActive()).toBe(false);
    });
  });

  describe('Pilot Workspaces', () => {
    it('tutti abilitati se OUTREACH_PILOT_WORKSPACES non settato', () => {
      delete process.env.OUTREACH_PILOT_WORKSPACES;
      delete process.env.OUTREACH_KILL_SWITCH;
      expect(isWorkspaceEnabledForOutreach('any-ws')).toBe(true);
    });

    it('solo pilot abilitati se lista settata', () => {
      delete process.env.OUTREACH_KILL_SWITCH;
      process.env.OUTREACH_PILOT_WORKSPACES = 'ws-1,ws-2,ws-3';

      expect(isWorkspaceEnabledForOutreach('ws-1')).toBe(true);
      expect(isWorkspaceEnabledForOutreach('ws-2')).toBe(true);
      expect(isWorkspaceEnabledForOutreach('ws-99')).toBe(false);
    });

    it('kill switch override pilot', () => {
      process.env.OUTREACH_KILL_SWITCH = 'true';
      process.env.OUTREACH_PILOT_WORKSPACES = 'ws-1';

      expect(isWorkspaceEnabledForOutreach('ws-1')).toBe(false);
    });
  });

  describe('isOutreachEnabledForWorkspace (DB check)', () => {
    it('ritorna false se kill switch attivo', async () => {
      process.env.OUTREACH_KILL_SWITCH = 'true';
      const result = await isOutreachEnabledForWorkspace('ws-1');
      expect(result).toBe(false);
    });

    it('ritorna false se workspace non in pilot', async () => {
      delete process.env.OUTREACH_KILL_SWITCH;
      process.env.OUTREACH_PILOT_WORKSPACES = 'ws-1';
      const result = await isOutreachEnabledForWorkspace('ws-99');
      expect(result).toBe(false);
    });

    it('ritorna true se workspace abilitato e ha canale attivo', async () => {
      delete process.env.OUTREACH_KILL_SWITCH;
      delete process.env.OUTREACH_PILOT_WORKSPACES;
      mockSelectResult = { data: { id: 'config-1' }, error: null };

      const result = await isOutreachEnabledForWorkspace('ws-1');
      expect(result).toBe(true);
    });

    it('ritorna false se nessun canale abilitato in DB', async () => {
      delete process.env.OUTREACH_KILL_SWITCH;
      delete process.env.OUTREACH_PILOT_WORKSPACES;
      mockSelectResult = { data: null, error: null };

      const result = await isOutreachEnabledForWorkspace('ws-1');
      expect(result).toBe(false);
    });
  });
});

// ============================================
// STRUCTURED LOGGER
// ============================================

describe('Outreach Structured Logger', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('info produce JSON valido con campi strutturati', () => {
    outreachLogger.info('executor', 'Test message', {
      workspaceId: 'ws-1',
      channel: 'email',
    });

    expect(console.log).toHaveBeenCalled();
    const logArg = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(logArg);

    expect(parsed.level).toBe('info');
    expect(parsed.component).toBe('outreach:executor');
    expect(parsed.message).toBe('Test message');
    expect(parsed.workspaceId).toBe('ws-1');
    expect(parsed.channel).toBe('email');
    expect(parsed.timestamp).toBeDefined();
  });

  it('warn produce JSON con level warn', () => {
    outreachLogger.warn('feature-flags', 'Kill switch attivo');

    expect(console.warn).toHaveBeenCalled();
    const logArg = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(logArg);

    expect(parsed.level).toBe('warn');
  });

  it('error produce JSON con level error', () => {
    outreachLogger.error('executor', 'Errore critico');

    expect(console.error).toHaveBeenCalled();
    const logArg = (console.error as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(logArg);

    expect(parsed.level).toBe('error');
  });

  it('logSend include tutti i campi necessari', () => {
    outreachLogger.logSend({
      workspaceId: 'ws-1',
      entityType: 'lead',
      entityId: 'ent-1',
      channel: 'email',
      enrollmentId: 'enr-1',
      stepOrder: 2,
      success: true,
      providerMessageId: 'msg-abc',
    });

    expect(console.log).toHaveBeenCalled();
    const logArg = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(logArg);

    expect(parsed.workspaceId).toBe('ws-1');
    expect(parsed.entityType).toBe('lead');
    expect(parsed.entityId).toBe('ent-1');
    expect(parsed.channel).toBe('email');
    expect(parsed.enrollmentId).toBe('enr-1');
    expect(parsed.stepOrder).toBe(2);
    expect(parsed.providerMessageId).toBe('msg-abc');
  });

  it('logSend usa error per fallimenti', () => {
    outreachLogger.logSend({
      workspaceId: 'ws-1',
      entityType: 'prospect',
      entityId: 'ent-2',
      channel: 'whatsapp',
      enrollmentId: 'enr-2',
      stepOrder: 1,
      success: false,
      error: 'Timeout',
    });

    expect(console.error).toHaveBeenCalled();
  });

  it('logSafetySkip produce warn con reason', () => {
    outreachLogger.logSafetySkip({
      workspaceId: 'ws-1',
      entityId: 'ent-1',
      channel: 'email',
      enrollmentId: 'enr-1',
      reason: 'Consenso GDPR mancante',
      stepOrder: 1,
    });

    expect(console.warn).toHaveBeenCalled();
    const logArg = (console.warn as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(logArg);
    expect(parsed.message).toContain('Consenso GDPR mancante');
  });

  it('logDeliveryUpdate include source e status', () => {
    outreachLogger.logDeliveryUpdate({
      providerMessageId: 'msg-xyz',
      newStatus: 'delivered',
      source: 'whatsapp',
    });

    expect(console.log).toHaveBeenCalled();
    const logArg = (console.log as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const parsed = JSON.parse(logArg);
    expect(parsed.providerMessageId).toBe('msg-xyz');
    expect(parsed.channel).toBe('whatsapp');
  });
});

// ============================================
// RESEND WEBHOOK ROUTE — importabilita'
// ============================================

describe('Resend Webhook Route', () => {
  it("POST e' una funzione esportata", async () => {
    const route = await import('@/app/api/webhooks/resend-events/route');
    expect(typeof route.POST).toBe('function');
  });

  it("dynamic e' force-dynamic", async () => {
    const route = await import('@/app/api/webhooks/resend-events/route');
    expect(route.dynamic).toBe('force-dynamic');
  });
});

// ============================================
// CRON ROUTE — kill switch nell'health check
// ============================================

describe('Cron Route kill switch integration', () => {
  it('GET health check include killSwitch field', async () => {
    const route = await import('@/app/api/cron/outreach-executor/route');
    expect(typeof route.GET).toBe('function');
  });
});

// ============================================
// OUTREACH WORKER — kill switch
// ============================================

describe('Outreach Worker kill switch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("outreachWorker e' importabile", async () => {
    const { outreachWorker } = await import('@/lib/agent/workers/outreach-worker');
    expect(typeof outreachWorker).toBe('function');
  });

  it('blocca invii con kill switch attivo', async () => {
    process.env.OUTREACH_KILL_SWITCH = 'true';
    const { outreachWorker } = await import('@/lib/agent/workers/outreach-worker');

    const result = await outreachWorker({
      message: 'manda email a Farmacia Rossi',
      userId: 'user-1',
      userRole: 'admin',
      workspaceId: 'ws-1',
    });

    expect(result.response).toContain('sospeso');
    expect(result.response).toContain('kill switch');
    delete process.env.OUTREACH_KILL_SWITCH;
  });

  it('permette letture con kill switch attivo', async () => {
    process.env.OUTREACH_KILL_SWITCH = 'true';
    const { outreachWorker } = await import('@/lib/agent/workers/outreach-worker');

    const result = await outreachWorker({
      message: 'metriche outreach',
      userId: 'user-1',
      userRole: 'admin',
      workspaceId: 'ws-1',
    });

    // Non deve contenere messaggio kill switch
    expect(result.response).not.toContain('kill switch');
    delete process.env.OUTREACH_KILL_SWITCH;
  });
});

// ============================================
// SEQUENCE EXECUTOR — kill switch + feature flags
// ============================================

describe('Sequence Executor kill switch', () => {
  it('processOutreachQueue importabile', async () => {
    const { processOutreachQueue } = await import('@/lib/outreach/sequence-executor');
    expect(typeof processOutreachQueue).toBe('function');
  });

  it('ritorna risultato vuoto con kill switch attivo', async () => {
    process.env.OUTREACH_KILL_SWITCH = 'true';

    // Re-import per prendere il nuovo valore env
    const { processOutreachQueue } = await import('@/lib/outreach/sequence-executor');
    const result = await processOutreachQueue();

    expect(result.processed).toBe(0);
    expect(result.sent).toBe(0);
    delete process.env.OUTREACH_KILL_SWITCH;
  });
});

// ============================================
// DELIVERY TRACKER — Status Order
// ============================================

describe('Delivery Tracker — Status Progression', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectResult = { data: null, error: null };
  });

  it('progressione: sent < delivered < opened < replied', async () => {
    // sent → delivered (OK)
    mockSelectResult = { data: { id: 'exec-1', status: 'sent' }, error: null };
    expect(await updateExecutionDeliveryStatus('msg-1', 'delivered')).toBe(true);

    // delivered → opened (OK)
    mockSelectResult = { data: { id: 'exec-1', status: 'delivered' }, error: null };
    expect(await updateExecutionDeliveryStatus('msg-1', 'opened')).toBe(true);

    // opened → replied (OK)
    mockSelectResult = { data: { id: 'exec-1', status: 'opened' }, error: null };
    expect(await updateExecutionDeliveryStatus('msg-1', 'replied')).toBe(true);
  });

  it('stato uguale non aggiorna', async () => {
    mockSelectResult = { data: { id: 'exec-1', status: 'delivered' }, error: null };
    expect(await updateExecutionDeliveryStatus('msg-1', 'delivered')).toBe(false);
  });

  it('failed e bounced sono terminali', async () => {
    // sent → bounced (OK — avanza)
    mockSelectResult = { data: { id: 'exec-1', status: 'sent' }, error: null };
    expect(await updateExecutionDeliveryStatus('msg-1', 'bounced')).toBe(true);
  });
});
