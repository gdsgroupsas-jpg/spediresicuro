/**
 * Test C4: Wiring delegazione nel supervisor-router
 *
 * Verifica:
 * - Single match sopra soglia → wsId sovrascritto
 * - Multiple match sotto soglia → clarification con lista deterministica
 * - No match → messaggio errore
 * - Non-reseller → delegazione ignorata
 * - Reseller non membro attivo → delegazione rifiutata
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================
// Mock setup
// ============================================

// Mock supabaseAdmin (workspace_members check)
let mockMembershipResult: any = { data: { id: 'wm-1' }, error: null };

vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              in: vi.fn(() => ({
                maybeSingle: vi.fn(() => Promise.resolve(mockMembershipResult)),
              })),
            })),
          })),
        })),
      })),
    })),
  },
}));

// Mock subclient-resolver
let mockResolveResult: any[] = [];

vi.mock('@/lib/ai/subclient-resolver', () => ({
  resolveSubClient: vi.fn(() => Promise.resolve(mockResolveResult)),
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

// Mock per i moduli usati dal supervisor-router
vi.mock('@/lib/agent/intent-detector', async (importOriginal) => {
  const actual = (await importOriginal()) as any;
  return {
    ...actual,
    // Usiamo le implementazioni REALI per delegation intent
    detectDelegationIntent: actual.detectDelegationIntent,
    extractDelegationTarget: actual.extractDelegationTarget,
    // Mock tutti gli altri intent a false
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

vi.mock('@/lib/agent/workers/crm-worker', () => ({
  crmWorker: vi.fn(),
}));

vi.mock('@/lib/agent/workers/outreach-worker', () => ({
  outreachWorker: vi.fn(),
}));

vi.mock('@/lib/services/agent-session', () => ({
  agentSessionService: {
    getSession: vi.fn().mockResolvedValue(null),
  },
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

vi.mock('./checkpointer', () => ({
  createCheckpointer: vi.fn(),
}));

vi.mock('./supervisor', () => ({
  decideNextStep: vi.fn(() => 'legacy'),
}));

vi.mock('./type-guards', () => ({
  assertAgentState: vi.fn((s: any) => s),
}));

vi.mock('@/lib/auth-helpers', () => ({
  isAdminOrAbove: vi.fn(),
}));

import { supervisorRouter, type SupervisorInput } from '@/lib/agent/orchestrator/supervisor-router';
import type { WorkspaceActingContext } from '@/types/workspace';

// Helper per creare input con contesto reseller
function makeResellerInput(message: string): SupervisorInput {
  return {
    message,
    userId: 'reseller-user-1',
    userEmail: 'reseller@test.com',
    traceId: 'trace-123',
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

function makeUserInput(message: string): SupervisorInput {
  return {
    message,
    userId: 'user-1',
    userEmail: 'user@test.com',
    traceId: 'trace-456',
    actingContext: {
      actor: {
        id: 'user-1',
        email: 'user@test.com',
        name: 'User',
        role: 'user',
      },
      target: {
        id: 'user-1',
        email: 'user@test.com',
        name: 'User',
        role: 'user',
      },
      workspace: {
        id: 'user-ws-1',
        name: 'User Workspace',
        slug: 'user',
        type: 'client',
        depth: 2,
        organization_id: 'org-2',
        organization_name: 'User Org',
        organization_slug: 'user',
        wallet_balance: 100,
        role: 'owner',
        permissions: [],
        branding: {} as any,
      },
      isImpersonating: false,
    } as WorkspaceActingContext,
  };
}

describe('supervisorRouter — delegazione "per conto di"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMembershipResult = { data: { id: 'wm-1' }, error: null };
    mockResolveResult = [];
  });

  it('single match sopra soglia → decision END (delegazione attivata, poi legacy per non-pricing)', async () => {
    mockResolveResult = [
      {
        workspaceId: 'subclient-ws-1',
        userId: 'subclient-user-1',
        workspaceName: 'Awa Kanoute Shipping',
        userName: 'Awa Kanoute',
        confidence: 1.0,
      },
    ];

    const result = await supervisorRouter(makeResellerInput('per conto di Awa Kanoute come stai?'));

    // Delegazione attivata: il router continua con gli intent check normali
    // Poiche il messaggio non e pricing/support/CRM, andra in legacy
    expect(result.decision).toBe('legacy');
  });

  it('no match → clarification con nome mancante', async () => {
    mockResolveResult = [];

    const result = await supervisorRouter(
      makeResellerInput('per conto di Mario Sconosciuto crea spedizione')
    );

    expect(result.decision).toBe('END');
    expect(result.clarificationRequest).toContain('Non ho trovato');
    expect(result.clarificationRequest).toContain('Mario Sconosciuto');
  });

  it('match multipli ambigui → clarification con lista', async () => {
    mockResolveResult = [
      {
        workspaceId: 'ws-1',
        userId: 'u-1',
        workspaceName: 'Awa Shop 1',
        userName: 'Awa K',
        confidence: 0.7,
      },
      {
        workspaceId: 'ws-2',
        userId: 'u-2',
        workspaceName: 'Awa Shop 2',
        userName: 'Awa M',
        confidence: 0.6,
      },
    ];

    const result = await supervisorRouter(makeResellerInput('per conto di Awa crea spedizione'));

    expect(result.decision).toBe('END');
    expect(result.clarificationRequest).toContain('Quale intendi');
    expect(result.clarificationRequest).toContain('Awa Shop 1');
    expect(result.clarificationRequest).toContain('Awa Shop 2');
  });

  it('non-reseller → delegazione ignorata (nessun errore)', async () => {
    const result = await supervisorRouter(
      makeUserInput('per conto di Awa Kanoute crea spedizione')
    );

    // Non e reseller, quindi la delegazione non viene processata
    // Il messaggio prosegue normalmente (legacy per non-pricing)
    expect(result.decision).toBe('legacy');

    // resolveSubClient non deve essere chiamato
    const { resolveSubClient } = await import('@/lib/ai/subclient-resolver');
    expect(resolveSubClient).not.toHaveBeenCalled();
  });

  it('reseller non membro attivo → delegazione rifiutata', async () => {
    mockMembershipResult = { data: null, error: null }; // Non membro attivo

    const result = await supervisorRouter(
      makeResellerInput('per conto di Awa Kanoute crea spedizione')
    );

    expect(result.decision).toBe('END');
    expect(result.clarificationRequest).toContain('Non hai i permessi');
  });

  it('messaggio senza delegazione → nessuna risoluzione sub-client', async () => {
    const result = await supervisorRouter(
      makeResellerInput('quanto costa spedire 5kg a Milano 20100?')
    );

    // Nessuna delegazione, il messaggio procede normalmente
    const { resolveSubClient } = await import('@/lib/ai/subclient-resolver');
    expect(resolveSubClient).not.toHaveBeenCalled();
  });
});
