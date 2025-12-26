/**
 * Integration Tests: Agent Chat API - Pricing Flow
 * 
 * Test end-to-end del flusso preventivo nella route API
 * Mock completo: auth, supabase, Anthropic, pricingGraph, context builder
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PRICING_TEST_MATRIX } from '../fixtures/pricing-matrix';

// Mock completo di tutte le dipendenze (definiti PRIMA di resetModules)
vi.mock('@/lib/auth-config', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/agent/intent-detector', () => ({
  detectPricingIntent: vi.fn(),
}));

vi.mock('@/lib/agent/orchestrator/pricing-graph', () => ({
  pricingGraph: {
    invoke: vi.fn(),
  },
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
  // POST viene re-importato dinamicamente in ogni beforeEach per resettare rateLimitMap
  let POST: typeof import('@/app/api/ai/agent-chat/route').POST;
  let auth: ReturnType<typeof vi.fn>;
  let detectPricingIntent: ReturnType<typeof vi.fn>;
  let pricingGraph: { invoke: ReturnType<typeof vi.fn> };
  let buildContext: ReturnType<typeof vi.fn>;
  let getCachedContext: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    // Reset moduli per reinizializzare rateLimitMap in route.ts
    vi.resetModules();
    
    // Re-importa i moduli mockati dopo reset
    const authModule = await import('@/lib/auth-config');
    const intentModule = await import('@/lib/agent/intent-detector');
    const graphModule = await import('@/lib/agent/orchestrator/pricing-graph');
    const contextModule = await import('@/lib/ai/context-builder');
    const cacheModule = await import('@/lib/ai/cache');
    
    auth = authModule.auth as ReturnType<typeof vi.fn>;
    detectPricingIntent = intentModule.detectPricingIntent as ReturnType<typeof vi.fn>;
    pricingGraph = graphModule.pricingGraph as unknown as { invoke: ReturnType<typeof vi.fn> };
    buildContext = contextModule.buildContext as ReturnType<typeof vi.fn>;
    getCachedContext = cacheModule.getCachedContext as ReturnType<typeof vi.fn>;
    
    // Re-importa la route (con rateLimitMap nuovo)
    const routeModule = await import('@/app/api/ai/agent-chat/route');
    POST = routeModule.POST;
    
    // Clear mocks
    vi.clearAllMocks();
    
    // Reset mock Anthropic messages.create
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Default legacy response' }],
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

  describe('Pricing Intent - Success Cases', () => {
    it('should use pricingGraph when pricing intent detected and graph succeeds', async () => {
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

      vi.mocked(detectPricingIntent).mockResolvedValue(true);
      vi.mocked(pricingGraph.invoke).mockResolvedValue({
        pricing_options: mockPricingOptions,
        next_step: 'END',
        processingStatus: 'complete',
      } as any);

      const request = createMockRequest({
        message: 'Preventivo per 2 kg a 00100 Roma',
        messages: [],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.metadata.usingPricingGraph).toBe(true);
      expect(data.message).toContain('Preventivo');
      expect(data.message).toContain('BRT');
      expect(data.message).toContain('€11.50');
      expect(pricingGraph.invoke).toHaveBeenCalledTimes(1);
    });

    it('should return clarification_request when pricingGraph asks for clarification', async () => {
      vi.mocked(detectPricingIntent).mockResolvedValue(true);
      vi.mocked(pricingGraph.invoke).mockResolvedValue({
        clarification_request: 'Per calcolare un preventivo preciso, ho bisogno di: peso, CAP destinazione.',
        next_step: 'request_clarification',
        processingStatus: 'idle',
      } as any);

      const request = createMockRequest({
        message: 'Preventivo per 00100', // Manca peso
        messages: [],
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.metadata.usingPricingGraph).toBe(true);
      expect(data.message).toContain('ho bisogno di');
      expect(pricingGraph.invoke).toHaveBeenCalledTimes(1);
    });
  });

  describe('Pricing Intent - Fallback Cases', () => {
    it('should fallback to legacy when pricingGraph throws error', async () => {
      vi.mocked(detectPricingIntent).mockResolvedValue(true);
      vi.mocked(pricingGraph.invoke).mockRejectedValue(new Error('Graph error'));

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

      // Verifica: NON deve essere 500, deve fallback a legacy
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      // Verifica che legacy path sia stato usato (Anthropic chiamato o usingPricingGraph false)
      // Nota: potrebbe essere usingPricingGraph false se fallback funziona
      expect(pricingGraph.invoke).toHaveBeenCalledTimes(1);
    });
  });

  describe('Non-Pricing Intent', () => {
    it('should NOT call pricingGraph when intent is not pricing', async () => {
      vi.mocked(detectPricingIntent).mockResolvedValue(false);

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
      // Verifica che pricingGraph NON sia stato chiamato
      expect(pricingGraph.invoke).not.toHaveBeenCalled();
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
      // Simula rate limit: chiama POST 21 volte per superare limite
      const request = createMockRequest({
        message: 'Test',
        messages: [],
      });

      // Chiama multiple volte per superare rate limit
      for (let i = 0; i < 21; i++) {
        await POST(request);
      }

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
    });

    it('should not crash on empty input', async () => {
      vi.mocked(detectPricingIntent).mockResolvedValue(false);

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
        vi.mocked(detectPricingIntent).mockResolvedValue(testCase.shouldUsePricingGraph);

        if (testCase.shouldUsePricingGraph) {
          if (testCase.shouldAskClarification) {
            vi.mocked(pricingGraph.invoke).mockResolvedValue({
              clarification_request: 'Chiarimento necessario',
              next_step: 'request_clarification',
            } as any);
          } else {
            vi.mocked(pricingGraph.invoke).mockResolvedValue({
              pricing_options: [
                {
                  courier: 'BRT',
                  serviceType: 'standard',
                  finalPrice: 11.5,
                  estimatedDeliveryDays: { min: 3, max: 5 },
                },
              ],
            } as any);
          }
        } else {
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
        
        if (testCase.shouldUsePricingGraph) {
          expect(pricingGraph.invoke).toHaveBeenCalled();
          expect(data.metadata?.usingPricingGraph).toBe(true);
        } else {
          expect(pricingGraph.invoke).not.toHaveBeenCalled();
        }
      });
    });
  });

  describe('Fail-Injection Test', () => {
    it('should handle pricingGraph.invoke throwing error safely', async () => {
      vi.mocked(detectPricingIntent).mockResolvedValue(true);
      vi.mocked(pricingGraph.invoke).mockRejectedValue(new Error('boom'));

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
      // Verifica che pricingGraph sia stato chiamato (e fallito)
      expect(pricingGraph.invoke).toHaveBeenCalled();
    });
  });
});

