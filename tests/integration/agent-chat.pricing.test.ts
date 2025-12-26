/**
 * Integration Tests: Agent Chat API - Supervisor Router Flow
 * 
 * Test end-to-end del flusso routing nella route API.
 * Il supervisor router decide tra pricing graph e legacy handler.
 * Mock completo: auth, supabase, Anthropic, supervisorRouter, context builder
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PRICING_TEST_MATRIX } from '../fixtures/pricing-matrix';

// Mock completo di tutte le dipendenze (definiti PRIMA di resetModules)
vi.mock('@/lib/auth-config', () => ({
  auth: vi.fn(),
}));

// Mock supervisor-router (entry point unico)
const mockSupervisorRouter = vi.fn();
const mockFormatPricingResponse = vi.fn();
vi.mock('@/lib/agent/orchestrator/supervisor-router', () => ({
  supervisorRouter: mockSupervisorRouter,
  formatPricingResponse: mockFormatPricingResponse,
}));

vi.mock('@/lib/ai/context-builder', () => ({
  buildContext: vi.fn(),
}));

vi.mock('@/lib/ai/cache', () => ({
  getCachedContext: vi.fn(),
  setCachedContext: vi.fn(),
  getContextCacheKey: vi.fn(() => 'test-cache-key'),
}));

vi.mock('@/lib/ai/prompts', () => ({
  buildSystemPrompt: vi.fn(() => 'Mock system prompt'),
  getVoicePrompt: vi.fn(() => 'Mock voice prompt'),
  getBasePrompt: vi.fn(() => 'Mock base prompt'),
  getAdminPrompt: vi.fn(() => 'Mock admin prompt'),
}));

vi.mock('@/lib/ai/tools', () => ({
  ANNE_TOOLS: [],
  executeTool: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        data: null,
        error: null,
      })),
    })),
  },
}));

// Mock rate-limit per test deterministici
const mockRateLimit = vi.fn();
vi.mock('@/lib/security/rate-limit', () => ({
  rateLimit: mockRateLimit,
  resetForTesting: vi.fn(),
}));

// Mock Anthropic come classe costruttore (deterministic)
const mockMessagesCreate = vi.fn().mockResolvedValue({
  content: [{ type: 'text', text: 'Default legacy response' }],
});

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages: {
      create: ReturnType<typeof vi.fn>;
    };

    constructor(_options?: { apiKey?: string }) {
      this.messages = {
        create: mockMessagesCreate,
      };
    }
  }

  return {
    default: MockAnthropic,
  };
});

describe('Agent Chat API - Pricing Flow Integration', () => {
  // POST viene re-importato dinamicamente in ogni beforeEach per resettare stato
  let POST: typeof import('@/app/api/ai/agent-chat/route').POST;
  let auth: ReturnType<typeof vi.fn>;
  let buildContext: ReturnType<typeof vi.fn>;
  let getCachedContext: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Reset moduli per reinizializzare stato
    vi.resetModules();
    
    // Re-importa i moduli mockati dopo reset
    const authModule = await import('@/lib/auth-config');
    const contextModule = await import('@/lib/ai/context-builder');
    const cacheModule = await import('@/lib/ai/cache');
    
    auth = authModule.auth as ReturnType<typeof vi.fn>;
    buildContext = contextModule.buildContext as ReturnType<typeof vi.fn>;
    getCachedContext = cacheModule.getCachedContext as ReturnType<typeof vi.fn>;
    
    // Re-importa la route
    const routeModule = await import('@/app/api/ai/agent-chat/route');
    POST = routeModule.POST;
    
    // Clear mocks
    vi.clearAllMocks();
    
    // Reset mock rate limiter - default: allowed
    mockRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 19,
      resetAt: Date.now() + 60000,
      source: 'memory',
    });
    
    // Default mock supervisor router - decision: legacy (default)
    mockSupervisorRouter.mockResolvedValue({
      decision: 'legacy',
      executionTimeMs: 10,
      source: 'supervisor_only',
    });
    
    // Reset mock Anthropic messages.create
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Default legacy response' }],
    });
    
    // Mock format pricing response
    mockFormatPricingResponse.mockImplementation((options) => {
      if (!options || options.length === 0) return 'Nessun preventivo';
      return `💰 Preventivo: €${options[0].finalPrice.toFixed(2)}`;
    });
    
    // Default mock: sessione valida
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'test-user-id',
        email: 'test@test.com',
        name: 'Test User',
      },
    } as any);

    // Default mock: no cached context
    vi.mocked(getCachedContext).mockReturnValue(null);
    
    // Default mock: buildContext success
    vi.mocked(buildContext).mockResolvedValue({
      user: {
        userId: 'test-user-id',
        userRole: 'user',
        userName: 'Test User',
        recentShipments: [],
      },
    } as any);
  });

  function createMockRequest(body: any) {
    return {
      json: vi.fn().mockResolvedValue(body),
    } as any;
  }

  describe('Supervisor Router - Success Cases', () => {
    it('should return pricing when supervisor returns END with pricing_options', async () => {
      const mockPricingOptions = [
        {
          courier: 'BRT',
          serviceType: 'standard',
          basePrice: 10,
          surcharges: 0,
          totalCost: 10,
          finalPrice: 11.5,
          margin: 1.5,
          estimatedDeliveryDays: { min: 3, max: 5 },
          recommendation: 'best_price' as const,
        },
      ];

      // Mock supervisor che ritorna END con pricing options
      mockSupervisorRouter.mockResolvedValue({
        decision: 'END',
        pricingOptions: mockPricingOptions,
        executionTimeMs: 50,
        source: 'pricing_graph',
      });

      const request = createMockRequest({
        message: 'Preventivo per 2 kg a 00100 Roma',
        messages: [],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.metadata.usingPricingGraph).toBe(true);
      expect(data.metadata.supervisorDecision).toBe('END');
      expect(mockSupervisorRouter).toHaveBeenCalledTimes(1);
    });

    it('should return clarification when supervisor returns END with clarification_request', async () => {
      // Mock supervisor che ritorna END con clarification
      mockSupervisorRouter.mockResolvedValue({
        decision: 'END',
        clarificationRequest: 'Per calcolare un preventivo preciso, ho bisogno di: peso, CAP destinazione.',
        executionTimeMs: 20,
        source: 'pricing_graph',
      });

      const request = createMockRequest({
        message: 'Preventivo per 00100', // Manca peso
        messages: [],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toContain('ho bisogno di');
      expect(mockSupervisorRouter).toHaveBeenCalledTimes(1);
    });
  });

  describe('Supervisor Router - Fallback Cases', () => {
    it('should fallback to legacy when supervisor returns decision: legacy', async () => {
      // Mock supervisor che ritorna legacy (graph fallito o non-pricing)
      mockSupervisorRouter.mockResolvedValue({
        decision: 'legacy',
        executionTimeMs: 10,
        source: 'pricing_graph',
      });

      // Mock Anthropic client per legacy path (deterministic)
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Legacy response' }],
      });
      process.env.ANTHROPIC_API_KEY = 'mock-key';

      const request = createMockRequest({
        message: 'Preventivo per 2 kg a 00100',
        messages: [],
      });

      const response = await POST(request);
      const data = await response.json();

      // Verifica: NON deve essere 500, deve usare legacy
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSupervisorRouter).toHaveBeenCalledTimes(1);
    });
  });

  describe('Non-Pricing Intent', () => {
    it('should use legacy handler when supervisor decides legacy', async () => {
      // Mock supervisor che ritorna legacy (non-pricing)
      mockSupervisorRouter.mockResolvedValue({
        decision: 'legacy',
        executionTimeMs: 5,
        source: 'supervisor_only',
      });

      // Mock Anthropic per legacy path (deterministic)
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Legacy response' }],
      });
      process.env.ANTHROPIC_API_KEY = 'mock-key';

      const request = createMockRequest({
        message: 'Ciao Anne, come va?',
        messages: [],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSupervisorRouter).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Cases', () => {
    it('should return 400 for invalid JSON body', async () => {
      const request = {
        json: vi.fn().mockRejectedValue(new Error('Invalid JSON')),
      } as any;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return 401 when no session', async () => {
      vi.mocked(auth).mockResolvedValue(null);

      const request = createMockRequest({
        message: 'Test',
        messages: [],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Non autenticato');
    });

    it('should return 429 when rate limit exceeded', async () => {
      // Mock rate limiter per simulare limite superato (deterministico)
      mockRateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 60000,
        source: 'memory',
      });

      const request = createMockRequest({
        message: 'Test',
        messages: [],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Troppe richieste');
    });

    it('should not crash on empty input', async () => {
      // Mock supervisor per legacy
      mockSupervisorRouter.mockResolvedValue({
        decision: 'legacy',
        executionTimeMs: 5,
        source: 'supervisor_only',
      });

      // Mock Anthropic per legacy path (deterministic)
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Response' }],
      });
      process.env.ANTHROPIC_API_KEY = 'mock-key';

      const request = createMockRequest({
        message: '',
        messages: [],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Test Matrix - Parametrized Tests', () => {
    PRICING_TEST_MATRIX.forEach((testCase) => {
      it(`Matrix: ${testCase.description}`, async () => {
        if (testCase.shouldUsePricingGraph) {
          if (testCase.shouldAskClarification) {
            // Mock supervisor con clarification
            mockSupervisorRouter.mockResolvedValue({
              decision: 'END',
              clarificationRequest: 'Chiarimento necessario',
              executionTimeMs: 20,
              source: 'pricing_graph',
            });
          } else {
            // Mock supervisor con pricing options
            mockSupervisorRouter.mockResolvedValue({
              decision: 'END',
              pricingOptions: [
                {
                  courier: 'BRT',
                  serviceType: 'standard',
                  finalPrice: 11.5,
                  estimatedDeliveryDays: { min: 3, max: 5 },
                },
              ],
              executionTimeMs: 50,
              source: 'pricing_graph',
            });
          }
        } else {
          // Mock supervisor con legacy
          mockSupervisorRouter.mockResolvedValue({
            decision: 'legacy',
            executionTimeMs: 5,
            source: 'supervisor_only',
          });
          // Legacy path (deterministic)
          mockMessagesCreate.mockResolvedValueOnce({
            content: [{ type: 'text', text: 'Legacy' }],
          });
          process.env.ANTHROPIC_API_KEY = 'mock-key';
        }

        const request = createMockRequest({
          message: testCase.message,
          messages: [],
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(testCase.expectedStatus);
        expect(mockSupervisorRouter).toHaveBeenCalled();
        
        if (testCase.shouldUsePricingGraph) {
          expect(data.metadata?.usingPricingGraph).toBe(true);
        }
      });
    });
  });

  describe('Fail-Injection Test', () => {
    it('should handle supervisor returning legacy on graph error safely', async () => {
      // Mock supervisor che ritorna legacy dopo errore graph
      mockSupervisorRouter.mockResolvedValue({
        decision: 'legacy',
        executionTimeMs: 100,
        source: 'pricing_graph', // Source è graph ma decision è legacy
      });

      // Mock legacy path (deterministic)
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Fallback response' }],
      });
      process.env.ANTHROPIC_API_KEY = 'mock-key';

      const request = createMockRequest({
        message: 'Preventivo per 2 kg a 00100',
        messages: [],
      });

      const response = await POST(request);
      const data = await response.json();

      // Verifica: NON 500, fallback funziona
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockSupervisorRouter).toHaveBeenCalled();
    });
  });
});

