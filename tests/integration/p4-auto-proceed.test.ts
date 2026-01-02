/**
 * Integration Tests: Auto-Proceed End-to-End (P4 Task 2)
 * 
 * Test end-to-end per verificare che auto-proceed funzioni correttamente
 * nel flusso completo supervisor-router -> supervisor -> response.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supervisorRouter } from '@/lib/agent/orchestrator/supervisor-router';
import { ActingContext } from '@/lib/safe-auth';

// Mock dependencies
vi.mock('@/lib/agent/intent-detector', () => ({
  detectPricingIntent: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/lib/agent/orchestrator/supervisor', () => ({
  decideNextStep: vi.fn(),
  supervisor: vi.fn(),
}));

vi.mock('@/lib/services/agent-session', () => ({
  agentSessionService: {
    getSession: vi.fn().mockResolvedValue(null),
    saveSession: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/agent/orchestrator/checkpointer', () => ({
  createCheckpointer: vi.fn(),
}));

vi.mock('@/lib/agent/orchestrator/pricing-graph', () => ({
  createPricingGraphWithCheckpointer: vi.fn().mockReturnValue({
    invoke: vi.fn().mockResolvedValue({
      messages: [],
      userId: 'user-id',
      userEmail: 'user@test.com',
      shipmentData: {},
      processingStatus: 'complete',
      validationErrors: [],
      confidenceScore: 90,
      needsHumanReview: false,
      pricing_options: [
        {
          courier: 'GLS',
          serviceType: 'standard',
          finalPrice: 10.0,
          estimatedDeliveryDays: { min: 2, max: 4 },
          reliabilityScore: 90,
        },
      ],
      autoProceed: true,
      userMessage: '✅ Dati verificati, procedo automaticamente',
      next_step: 'END',
    }),
  }),
}));

describe('Auto-Proceed Integration (P4 Task 2)', () => {
  const mockActingContext: ActingContext = {
    actor: {
      id: 'admin-id',
      email: 'admin@test.com',
      name: 'Admin User',
      role: 'admin',
    },
    target: {
      id: 'user-id',
      email: 'user@test.com',
      name: 'Test User',
      role: 'user',
    },
    isImpersonating: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dovrebbe includere agentState con autoProceed nel risultato', async () => {
    const result = await supervisorRouter({
      message: 'Preventivo per 2kg a Milano',
      userId: 'user-id',
      userEmail: 'user@test.com',
      traceId: 'test-trace',
      actingContext: mockActingContext,
    });

    expect(result.agentState).toBeDefined();
    expect(result.agentState?.autoProceed).toBe(true);
    expect(result.agentState?.userMessage).toContain('verificati');
    expect(result.decision).toBe('END');
  });

  it('dovrebbe includere agentState con suggestProceed se confidence 70-85%', async () => {
    const { createPricingGraphWithCheckpointer } = await import('@/lib/agent/orchestrator/pricing-graph');
    vi.mocked(createPricingGraphWithCheckpointer).mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        messages: [],
        userId: 'user-id',
        userEmail: 'user@test.com',
        shipmentData: {},
        processingStatus: 'complete',
        validationErrors: [],
        confidenceScore: 75,
        needsHumanReview: false,
        pricing_options: [
          {
            courier: 'GLS',
            serviceType: 'standard',
            finalPrice: 10.0,
            estimatedDeliveryDays: { min: 2, max: 4 },
            reliabilityScore: 90,
          },
        ],
        suggestProceed: true,
        userMessage: '💡 Dati quasi completi, vuoi procedere?',
        next_step: 'END',
      }),
    } as any);

    const result = await supervisorRouter({
      message: 'Preventivo per 2kg a Milano',
      userId: 'user-id',
      userEmail: 'user@test.com',
      traceId: 'test-trace',
      actingContext: mockActingContext,
    });

    expect(result.agentState).toBeDefined();
    expect(result.agentState?.suggestProceed).toBe(true);
    expect(result.agentState?.autoProceed).toBeUndefined();
  });

  it('NON dovrebbe includere autoProceed se confidence < 70%', async () => {
    const { createPricingGraphWithCheckpointer } = await import('@/lib/agent/orchestrator/pricing-graph');
    vi.mocked(createPricingGraphWithCheckpointer).mockReturnValue({
      invoke: vi.fn().mockResolvedValue({
        messages: [],
        userId: 'user-id',
        userEmail: 'user@test.com',
        shipmentData: {},
        processingStatus: 'complete',
        validationErrors: [],
        confidenceScore: 50,
        needsHumanReview: false,
        pricing_options: [
          {
            courier: 'GLS',
            serviceType: 'standard',
            finalPrice: 10.0,
            estimatedDeliveryDays: { min: 2, max: 4 },
            reliabilityScore: 90,
          },
        ],
        next_step: 'END',
      }),
    } as any);

    const result = await supervisorRouter({
      message: 'Preventivo per 2kg a Milano',
      userId: 'user-id',
      userEmail: 'user@test.com',
      traceId: 'test-trace',
      actingContext: mockActingContext,
    });

    expect(result.agentState).toBeDefined();
    expect(result.agentState?.autoProceed).toBeUndefined();
    expect(result.agentState?.suggestProceed).toBeUndefined();
  });
});

