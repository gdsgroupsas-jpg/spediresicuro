/**
 * Test C5: Audit logging per delegazione (con idempotenza)
 *
 * Verifica:
 * - Audit log creato con actor (reseller) corretto
 * - Audit log contiene target workspace
 * - Audit log usa workspaceQuery (non supabaseAdmin diretto)
 * - Doppia chiamata con stesso trace_id + target → un solo log (idempotenza)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track audit operations
let insertCalls: any[] = [];
let selectResult: any = { data: null };

// Mock workspaceQuery
vi.mock('@/lib/db/workspace-query', () => ({
  workspaceQuery: vi.fn((wsId: string) => ({
    from: vi.fn((table: string) => {
      if (table === 'audit_logs') {
        return {
          // SELECT per check idempotenza
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(() => Promise.resolve(selectResult)),
                })),
              })),
            })),
          })),
          // INSERT per audit log
          insert: vi.fn((data: any) => {
            insertCalls.push({ wsId, table, data });
            return Promise.resolve({ error: null });
          }),
        };
      }
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve({ data: null })),
              })),
            })),
          })),
        })),
      };
    }),
  })),
}));

// Mock supabaseAdmin (workspace_members check)
vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'wm-1' }, error: null }),
              })),
            })),
          })),
        })),
      })),
    })),
  },
}));

// Mock subclient-resolver
vi.mock('@/lib/ai/subclient-resolver', () => ({
  resolveSubClient: vi.fn(() =>
    Promise.resolve([
      {
        workspaceId: 'subclient-ws-1',
        userId: 'subclient-user-1',
        workspaceName: 'Awa Kanoute Shipping',
        userName: 'Awa Kanoute',
        confidence: 1.0,
      },
    ])
  ),
  DELEGATION_CONFIDENCE_THRESHOLD: 0.9,
}));

// Mock delegation-context
vi.mock('@/lib/ai/delegation-context', () => ({
  buildDelegatedActingContext: vi.fn((original: any, delegation: any) => ({
    ...original,
    target: {
      id: delegation.subClientUserId,
      email: null,
      name: delegation.subClientName,
      role: 'user',
    },
    workspace: {
      ...original.workspace,
      id: delegation.delegatedWorkspaceId,
      name: delegation.subClientWorkspaceName,
    },
    isImpersonating: true,
    metadata: { reason: 'delegation:per_conto_di' },
  })),
}));

// Mock tutti gli altri moduli usati dal supervisor-router
vi.mock('@/lib/agent/intent-detector', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    detectDelegationIntent: actual.detectDelegationIntent,
    extractDelegationTarget: actual.extractDelegationTarget,
    detectPricingIntent: vi.fn().mockResolvedValue(false),
    detectCrmIntent: vi.fn().mockReturnValue(false),
    detectOutreachIntent: vi.fn().mockReturnValue(false),
    detectShipmentCreationIntent: vi.fn().mockReturnValue(false),
  };
});

vi.mock('@/lib/agent/workers/ocr', () => ({
  containsOcrPatterns: vi.fn(() => false),
}));
vi.mock('@/lib/agent/workers/support-worker', () => ({
  detectSupportIntent: vi.fn(() => false),
  supportWorker: vi.fn(),
}));
vi.mock('@/lib/agent/workers/crm-worker', () => ({ crmWorker: vi.fn() }));
vi.mock('@/lib/agent/workers/outreach-worker', () => ({ outreachWorker: vi.fn() }));
vi.mock('@/lib/services/agent-session', () => ({
  agentSessionService: { getSession: vi.fn().mockResolvedValue(null) },
}));
vi.mock('@/lib/telemetry/logger', () => ({
  logIntentDetected: vi.fn(),
  logUsingPricingGraph: vi.fn(),
  logGraphFailed: vi.fn(),
  logFallbackToLegacy: vi.fn(),
  logSupervisorDecision: vi.fn(),
  logSupervisorRouterComplete: vi.fn(),
}));
vi.mock('@/lib/realtime/typing-indicators', () => ({
  createTypingChannel: vi.fn().mockResolvedValue(null),
}));
vi.mock('./pricing-graph', () => ({
  pricingGraph: {},
  createPricingGraphWithCheckpointer: vi.fn(),
}));
vi.mock('./checkpointer', () => ({ createCheckpointer: vi.fn() }));
vi.mock('./supervisor', () => ({ decideNextStep: vi.fn(() => 'legacy') }));
vi.mock('./type-guards', () => ({ assertAgentState: vi.fn((s: any) => s) }));
vi.mock('@/lib/auth-helpers', () => ({ isAdminOrAbove: vi.fn() }));

import { supervisorRouter, type SupervisorInput } from '@/lib/agent/orchestrator/supervisor-router';
import type { WorkspaceActingContext } from '@/types/workspace';

function makeResellerInput(message: string, traceId = 'trace-123'): SupervisorInput {
  return {
    message,
    userId: 'reseller-user-1',
    userEmail: 'reseller@test.com',
    traceId,
    actingContext: {
      actor: {
        id: 'reseller-user-1',
        email: 'reseller@test.com',
        name: 'GDS Group',
        role: 'reseller',
        account_type: 'reseller',
        is_reseller: true,
      },
      target: {
        id: 'reseller-user-1',
        email: 'reseller@test.com',
        name: 'GDS Group',
        role: 'reseller',
      },
      workspace: {
        id: 'reseller-ws-1',
        name: 'GDS Group Workspace',
        slug: 'gds',
        type: 'reseller',
        depth: 1,
        organization_id: 'org-1',
        organization_name: 'GDS',
        organization_slug: 'gds',
        wallet_balance: 1000,
        role: 'owner',
        permissions: [],
        branding: {} as any,
      },
      isImpersonating: false,
    } as WorkspaceActingContext,
  };
}

describe('Audit logging delegazione', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insertCalls = [];
    selectResult = { data: null }; // Nessun log esistente
  });

  it('crea audit log con dati corretti dopo delegazione attivata', async () => {
    await supervisorRouter(makeResellerInput('per conto di Awa Kanoute come stai?'));

    // Verifica almeno un insert su audit_logs
    const auditInserts = insertCalls.filter((c) => c.table === 'audit_logs');
    expect(auditInserts).toHaveLength(1);

    const log = auditInserts[0];
    // Audit scritto nel workspace del RESELLER
    expect(log.wsId).toBe('reseller-ws-1');
    // Dati corretti
    expect(log.data.action).toBe('DELEGATION_ACTIVATED');
    expect(log.data.resource_type).toBe('workspace');
    expect(log.data.resource_id).toBe('subclient-ws-1');
    expect(log.data.user_id).toBe('reseller-user-1');
    expect(log.data.workspace_id).toBe('reseller-ws-1');
    expect(log.data.metadata.sub_client_name).toBe('Awa Kanoute');
    expect(log.data.metadata.trace_id).toBe('trace-123');
  });

  it('usa workspaceQuery (non supabaseAdmin) per audit', async () => {
    await supervisorRouter(makeResellerInput('per conto di Awa Kanoute come stai?'));

    const { workspaceQuery } = await import('@/lib/db/workspace-query');
    // workspaceQuery deve essere stato chiamato con il workspace del reseller
    expect(workspaceQuery).toHaveBeenCalledWith('reseller-ws-1');
  });

  it('idempotenza: se log esiste gia con stesso trace_id+target, non inserisce duplicato', async () => {
    // Simula log esistente
    selectResult = { data: { id: 'existing-log-1' } };

    await supervisorRouter(makeResellerInput('per conto di Awa Kanoute come stai?'));

    // Nessun insert (log gia esistente)
    const auditInserts = insertCalls.filter((c) => c.table === 'audit_logs');
    expect(auditInserts).toHaveLength(0);
  });

  it('tronca action_requested a 200 caratteri', async () => {
    const longMsg = 'per conto di Awa Kanoute ' + 'x'.repeat(300);
    await supervisorRouter(makeResellerInput(longMsg));

    const auditInserts = insertCalls.filter((c) => c.table === 'audit_logs');
    if (auditInserts.length > 0) {
      expect(auditInserts[0].data.metadata.action_requested.length).toBeLessThanOrEqual(200);
    }
  });
});
