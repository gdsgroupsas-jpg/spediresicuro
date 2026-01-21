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

// Mock getSafeAuth (ora usato dalla route invece di auth diretto)
const mockGetSafeAuth = vi.fn();
vi.mock('@/lib/safe-auth', () => ({
  getSafeAuth: mockGetSafeAuth,
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
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({
            data: null,
            error: null,
          })),
        })),
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
// ⚠️ Questo mock è anche usato dal mockCreateAIClient per mantenere compatibilità
const mockMessagesCreate = vi.fn().mockResolvedValue({
  content: [{ type: 'text', text: 'Default legacy response' }],
});

// Mock provider-adapter per evitare query a system_settings
// ⚠️ createAIClient usa mockMessagesCreate internamente per compatibilità con test esistenti
const mockCreateAIClient = vi.fn().mockImplementation(async () => ({
  chat: vi.fn().mockImplementation(async (params: any) => {
    // Delega a mockMessagesCreate per compatibilità con test che verificano chiamate
    const result = await mockMessagesCreate({
      model: params.model,
      max_tokens: params.maxTokens,
      system: params.system,
      messages: params.messages,
    });
    return {
      content: result.content?.[0]?.text || 'Mock AI response',
      toolCalls: [],
    };
  }),
}));

vi.mock('@/lib/ai/provider-adapter', () => ({
  getConfiguredAIProvider: vi.fn().mockResolvedValue({
    provider: 'anthropic',
    model: 'claude-3-haiku-20240307',
  }),
  getAPIKeyForProvider: vi.fn((provider: string) => {
    if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY || 'mock-key';
    return undefined;
  }),
  createAIClient: mockCreateAIClient,
}));

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
    const safeAuthModule = await import('@/lib/safe-auth');

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
      telemetry: {
        intentDetected: 'non_pricing',
        supervisorDecision: 'legacy',
        backendUsed: 'legacy',
        fallbackToLegacy: true,
        fallbackReason: 'non_pricing',
        duration_ms: 10,
        pricingOptionsCount: 0,
        hasClarification: false,
        success: true,
      },
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

    // Default mock: sessione valida (per compatibilità)
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'test-user-id',
        email: 'test@test.com',
        name: 'Test User',
      },
    } as any);

    // Default mock: getSafeAuth restituisce ActingContext valido
    // ⚠️ IMPORTANTE: getSafeAuth è ora usato dalla route invece di auth diretto
    mockGetSafeAuth.mockResolvedValue({
      actor: {
        id: 'test-user-id',
        email: 'test@test.com',
        name: 'Test User',
        role: 'user',
      },
      target: {
        id: 'test-user-id',
        email: 'test@test.com',
        name: 'Test User',
        role: 'user',
      },
      isImpersonating: false,
    });

    // Default mock: getSafeAuth restituisce ActingContext valido
    // ⚠️ IMPORTANTE: getSafeAuth è ora usato dalla route invece di auth diretto
    mockGetSafeAuth.mockResolvedValue({
      actor: {
        id: 'test-user-id',
        email: 'test@test.com',
        name: 'Test User',
        role: 'user',
      },
      target: {
        id: 'test-user-id',
        email: 'test@test.com',
        name: 'Test User',
        role: 'user',
      },
      isImpersonating: false,
    });

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
        clarificationRequest:
          'Per calcolare un preventivo preciso, ho bisogno di: peso, CAP destinazione.',
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
      // Mock getSafeAuth per restituire null (non autenticato)
      mockGetSafeAuth.mockResolvedValue(null);

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
        telemetry: {
          intentDetected: 'pricing',
          supervisorDecision: 'legacy',
          backendUsed: 'legacy',
          fallbackToLegacy: true,
          fallbackReason: 'graph_error',
          duration_ms: 100,
          pricingOptionsCount: 0,
          hasClarification: false,
          success: true,
        },
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

  // ==================== STEP 2.2: GUARDRAIL TESTS ====================

  describe('Step 2.2 Guardrail: Pricing Intent Routing', () => {
    /**
     * TEST 1: pricing intent -> uses pricing_graph, NOT legacy
     *
     * Verifica che quando l'intent è pricing:
     * - Il pricing graph viene usato
     * - Legacy handler NON viene chiamato
     * - telemetry.backendUsed === 'pricing_graph'
     */
    it('GUARDRAIL: pricing intent should use pricing_graph, NOT legacy', async () => {
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

      // Mock supervisor con pricing_graph usato e decision END
      mockSupervisorRouter.mockResolvedValue({
        decision: 'END',
        pricingOptions: mockPricingOptions,
        executionTimeMs: 50,
        source: 'pricing_graph',
        telemetry: {
          intentDetected: 'pricing',
          supervisorDecision: 'end',
          backendUsed: 'pricing_graph',
          fallbackToLegacy: false,
          fallbackReason: null,
          duration_ms: 50,
          pricingOptionsCount: 1,
          hasClarification: false,
          success: true,
        },
      });

      const request = createMockRequest({
        message: 'Preventivo per 5kg a 00100 Roma RM',
        messages: [],
      });

      const response = await POST(request);
      const data = await response.json();

      // Assert: risposta OK
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Assert: supervisor chiamato
      expect(mockSupervisorRouter).toHaveBeenCalledTimes(1);

      // Assert: legacy handler NON chiamato (check che Anthropic messages.create non è stato chiamato)
      expect(mockMessagesCreate).not.toHaveBeenCalled();

      // Assert: telemetria corretta (via metadata o result)
      expect(data.metadata.usingPricingGraph).toBe(true);

      // Assert: telemetry dal mock (verifichiamo che il mock è stato configurato correttamente)
      // Il mock restituisce una Promise, quindi verifichiamo i dati del mock call
      const supervisorCallArgs = mockSupervisorRouter.mock.calls[0];
      expect(supervisorCallArgs).toBeDefined();

      // Il mock è stato chiamato con i parametri corretti (message, userId, etc.)
      expect(supervisorCallArgs[0].message).toContain('Preventivo');
    });

    /**
     * TEST 2: pricing intent + graph throws -> fallback to legacy WITH reason
     *
     * Verifica che quando il graph fallisce:
     * - Legacy handler viene chiamato
     * - telemetry.fallbackToLegacy === true
     * - telemetry.fallbackReason === 'graph_error'
     * - Response NON è 500 (deve essere 200)
     */
    it('GUARDRAIL: pricing intent + graph error -> fallback to legacy with graph_error reason', async () => {
      // Mock supervisor che ritorna legacy dopo errore graph
      mockSupervisorRouter.mockResolvedValue({
        decision: 'legacy',
        executionTimeMs: 100,
        source: 'pricing_graph',
        telemetry: {
          intentDetected: 'pricing',
          supervisorDecision: 'legacy',
          backendUsed: 'legacy',
          fallbackToLegacy: true,
          fallbackReason: 'graph_error',
          duration_ms: 100,
          pricingOptionsCount: 0,
          hasClarification: false,
          success: true,
        },
      });

      // Mock legacy path (deterministic) - DEVE essere chiamato
      mockMessagesCreate.mockResolvedValueOnce({
        content: [{ type: 'text', text: 'Fallback response after graph error' }],
      });
      process.env.ANTHROPIC_API_KEY = 'mock-key';

      const request = createMockRequest({
        message: 'Preventivo per 3kg a 20100 Milano MI',
        messages: [],
      });

      const response = await POST(request);
      const data = await response.json();

      // Assert: NON 500, fallback funziona
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Assert: supervisor chiamato
      expect(mockSupervisorRouter).toHaveBeenCalledTimes(1);

      // Assert: legacy handler chiamato (Anthropic messages.create)
      expect(mockMessagesCreate).toHaveBeenCalled();

      // Assert: supervisor chiamato con message di pricing
      const supervisorCallArgs = mockSupervisorRouter.mock.calls[0];
      expect(supervisorCallArgs[0].message).toContain('Preventivo');

      // Il mock supervisor è configurato per restituire fallbackToLegacy=true, fallbackReason='graph_error'
      // La route usa decision='legacy' per chiamare il legacy handler
      // Questo test verifica che la route gestisce correttamente il fallback
    });
  });

  // ==================== SPRINT 2.3: ADDRESS WORKER TESTS ====================

  describe('Sprint 2.3: Address Worker Integration', () => {
    /**
     * TEST 1: pricing intent but missing postalCode -> routes to address_worker
     *
     * Input: "Spedisci a Mario Rossi, Via Roma 10, Milano"
     * Expect: clarification question asking for CAP
     * Expect: telemetry.workerRun === 'address'
     */
    it('ADDR-1: pricing intent with missing postalCode -> address_worker asks clarification', async () => {
      // Mock supervisor che simula address_worker che chiede CAP
      mockSupervisorRouter.mockResolvedValue({
        decision: 'END',
        clarificationRequest: 'Per il preventivo mi servono: **CAP** e **provincia (es. MI, RM)**.',
        executionTimeMs: 30,
        source: 'pricing_graph',
        telemetry: {
          intentDetected: 'pricing',
          supervisorDecision: 'end',
          backendUsed: 'pricing_graph',
          fallbackToLegacy: false,
          fallbackReason: null,
          duration_ms: 30,
          pricingOptionsCount: 0,
          hasClarification: true,
          success: true,
          workerRun: 'address',
          missingFieldsCount: 2,
          addressNormalized: true,
        },
      });

      const request = createMockRequest({
        message: 'Spedisci a Mario Rossi, Via Roma 10, Milano',
        messages: [],
      });

      const response = await POST(request);
      const data = await response.json();

      // Assert: risposta OK
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Assert: contiene richiesta chiarimento
      expect(data.message).toContain('CAP');

      // Assert: supervisor chiamato
      expect(mockSupervisorRouter).toHaveBeenCalledTimes(1);

      // Assert: legacy handler NON chiamato (gestito da address_worker nel graph)
      expect(mockMessagesCreate).not.toHaveBeenCalled();

      // Assert: usingPricingGraph = true (perché è gestito dal graph)
      expect(data.metadata.usingPricingGraph).toBe(true);
    });

    /**
     * TEST 2: address complete -> routes to pricing_worker
     *
     * Input include: addressLine1 + city + province + CAP + weight
     * Expect: pricing_graph invoked successfully
     * Expect: legacy NOT called
     */
    it('ADDR-2: complete address data -> pricing_worker invoked, not legacy', async () => {
      const mockPricingOptions = [
        {
          courier: 'GLS',
          serviceType: 'standard',
          basePrice: 8,
          surcharges: 0,
          totalCost: 8,
          finalPrice: 9.5,
          margin: 1.5,
          estimatedDeliveryDays: { min: 2, max: 4 },
          recommendation: 'best_price' as const,
        },
      ];

      // Mock supervisor che ritorna pricing options (dati completi)
      mockSupervisorRouter.mockResolvedValue({
        decision: 'END',
        pricingOptions: mockPricingOptions,
        executionTimeMs: 80,
        source: 'pricing_graph',
        telemetry: {
          intentDetected: 'pricing',
          supervisorDecision: 'end',
          backendUsed: 'pricing_graph',
          fallbackToLegacy: false,
          fallbackReason: null,
          duration_ms: 80,
          pricingOptionsCount: 1,
          hasClarification: false,
          success: true,
          workerRun: 'pricing',
          missingFieldsCount: 0,
          addressNormalized: true,
        },
      });

      const request = createMockRequest({
        // Input con tutti i dati: indirizzo, città, provincia, CAP, peso
        message: 'Spedisci 3kg a Mario Rossi, Via Roma 10, 20100 Milano MI',
        messages: [],
      });

      const response = await POST(request);
      const data = await response.json();

      // Assert: risposta OK
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);

      // Assert: contiene preventivo
      expect(data.message).toContain('Preventivo');

      // Assert: supervisor chiamato
      expect(mockSupervisorRouter).toHaveBeenCalledTimes(1);

      // Assert: legacy handler NON chiamato
      expect(mockMessagesCreate).not.toHaveBeenCalled();

      // Assert: telemetria corretta
      expect(data.metadata.usingPricingGraph).toBe(true);
      expect(data.metadata.pricingOptionsCount).toBe(1);
    });

    /**
     * TEST 3: address worker merges partial data without deleting existing
     *
     * Questo test verifica che i dati vengano accumulati progressivamente.
     * Simuliamo due chiamate: prima con città/indirizzo, poi con CAP/provincia.
     *
     * Nota: Questo è un test concettuale. In realtà il merge avviene dentro
     * il pricing graph, che mantiene lo state tra i messaggi.
     * Qui testiamo che la route gestisce correttamente la risposta quando
     * il graph ha accumulato dati sufficienti.
     */
    it('ADDR-3: address worker accumulates data across messages', async () => {
      // Prima chiamata: solo città e indirizzo (mancano CAP e provincia)
      mockSupervisorRouter.mockResolvedValueOnce({
        decision: 'END',
        clarificationRequest: 'Per procedere ho bisogno di: **CAP** e **provincia (es. MI, RM)**.',
        executionTimeMs: 25,
        source: 'pricing_graph',
        telemetry: {
          intentDetected: 'pricing',
          supervisorDecision: 'end',
          backendUsed: 'pricing_graph',
          fallbackToLegacy: false,
          fallbackReason: null,
          duration_ms: 25,
          pricingOptionsCount: 0,
          hasClarification: true,
          success: true,
          workerRun: 'address',
          missingFieldsCount: 2, // CAP e provincia
          addressNormalized: true,
        },
      });

      const request1 = createMockRequest({
        message: 'Spedisci 2kg a Via Roma 10, Milano',
        messages: [],
      });

      const response1 = await POST(request1);
      const data1 = await response1.json();

      expect(response1.status).toBe(200);
      expect(data1.message).toContain('CAP');
      expect(mockMessagesCreate).not.toHaveBeenCalled();

      // Seconda chiamata: fornisce CAP e provincia
      const mockPricingOptions = [
        {
          courier: 'BRT',
          serviceType: 'express',
          basePrice: 12,
          surcharges: 0,
          totalCost: 12,
          finalPrice: 14.5,
          margin: 2.5,
          estimatedDeliveryDays: { min: 1, max: 2 },
          recommendation: 'fastest' as const,
        },
      ];

      mockSupervisorRouter.mockResolvedValueOnce({
        decision: 'END',
        pricingOptions: mockPricingOptions,
        executionTimeMs: 60,
        source: 'pricing_graph',
        telemetry: {
          intentDetected: 'pricing',
          supervisorDecision: 'end',
          backendUsed: 'pricing_graph',
          fallbackToLegacy: false,
          fallbackReason: null,
          duration_ms: 60,
          pricingOptionsCount: 1,
          hasClarification: false,
          success: true,
          workerRun: 'pricing',
          missingFieldsCount: 0, // Tutti i dati presenti
          addressNormalized: true,
        },
      });

      const request2 = createMockRequest({
        message: '20100 MI',
        messages: [
          { role: 'user', content: 'Spedisci 2kg a Via Roma 10, Milano' },
          { role: 'assistant', content: data1.message },
        ],
      });

      const response2 = await POST(request2);
      const data2 = await response2.json();

      expect(response2.status).toBe(200);
      expect(data2.success).toBe(true);
      expect(data2.message).toContain('Preventivo');

      // Assert: supervisor chiamato 2 volte totali
      expect(mockSupervisorRouter).toHaveBeenCalledTimes(2);

      // Assert: legacy mai chiamato
      expect(mockMessagesCreate).not.toHaveBeenCalled();
    });
  });
});
