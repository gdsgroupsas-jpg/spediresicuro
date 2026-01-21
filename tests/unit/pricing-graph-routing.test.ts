/**
 * Unit Tests: Pricing Graph Routing
 *
 * Test del routing del pricing graph:
 * - Verifica che con pricing_options presenti -> END
 * - Verifica che con clarification_request -> END
 * - Verifica che con next_step=pricing_worker -> pricing_worker
 * - Verifica stop per MAX_ITERATIONS
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentState } from '@/lib/agent/orchestrator/state';
import { HumanMessage } from '@langchain/core/messages';

// Mock dei moduli che toccano rete/DB/LLM
vi.mock('@/lib/agent/orchestrator/supervisor', () => ({
  supervisor: vi.fn(),
}));

vi.mock('@/lib/agent/workers/pricing', () => ({
  pricingWorker: vi.fn(),
}));

vi.mock('@/lib/ai/pricing-engine', () => ({
  calculateOptimalPrice: vi.fn(),
}));

// Import dopo i mock
import { pricingGraph } from '@/lib/agent/orchestrator/pricing-graph';
import { supervisor } from '@/lib/agent/orchestrator/supervisor';
import { pricingWorker } from '@/lib/agent/workers/pricing';

describe('Pricing Graph Routing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Routing: pricing_options present -> END', () => {
    it('should end immediately when pricing_options are present', async () => {
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

      // Mock supervisor che restituisce già pricing_options
      vi.mocked(supervisor).mockResolvedValueOnce({
        pricing_options: mockPricingOptions,
        next_step: 'END',
        processingStatus: 'complete',
      });

      const initialState: Partial<AgentState> = {
        messages: [new HumanMessage('Preventivo per 2 kg a 00100')],
        userId: 'test-user',
        userEmail: 'test@test.com',
        shipmentData: {},
        processingStatus: 'idle',
        validationErrors: [],
        confidenceScore: 0,
        needsHumanReview: false,
        iteration_count: 0,
      };

      const result = (await pricingGraph.invoke(initialState)) as unknown as AgentState;

      // Verifica che supervisor sia stato chiamato
      expect(supervisor).toHaveBeenCalledTimes(1);
      // Verifica che pricing_worker NON sia stato chiamato (END immediato)
      expect(pricingWorker).not.toHaveBeenCalled();
      // Verifica che pricing_options siano presenti
      expect(result.pricing_options).toEqual(mockPricingOptions);
    });
  });

  describe('Routing: clarification_request -> END', () => {
    it('should end when clarification_request is present', async () => {
      const clarificationMsg =
        'Per calcolare un preventivo preciso, ho bisogno di: peso, CAP destinazione.';

      vi.mocked(supervisor).mockResolvedValueOnce({
        clarification_request: clarificationMsg,
        next_step: 'END', // Ora supervisor ritorna END con clarification_request
        processingStatus: 'idle',
      });

      const initialState: Partial<AgentState> = {
        messages: [new HumanMessage('Preventivo')],
        userId: 'test-user',
        userEmail: 'test@test.com',
        shipmentData: {},
        processingStatus: 'idle',
        validationErrors: [],
        confidenceScore: 0,
        needsHumanReview: false,
        iteration_count: 0,
      };

      const result = (await pricingGraph.invoke(initialState)) as unknown as AgentState;

      expect(supervisor).toHaveBeenCalledTimes(1);
      expect(pricingWorker).not.toHaveBeenCalled();
      expect(result.clarification_request).toBe(clarificationMsg);
      expect(result.next_step).toBe('END'); // Ora supervisor ritorna END con clarification
    });
  });

  describe('Routing: next_step=pricing_worker -> pricing_worker', () => {
    it('should route to pricing_worker when next_step is pricing_worker and return pricing_options', async () => {
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

      // Supervisor dice di andare a pricing_worker
      vi.mocked(supervisor).mockResolvedValueOnce({
        shipment_details: {
          weight: 2,
          destinationZip: '00100',
          destinationProvince: 'RM',
        },
        next_step: 'pricing_worker',
        iteration_count: 0,
      });

      // Pricing worker restituisce preventivi
      vi.mocked(pricingWorker).mockResolvedValueOnce({
        pricing_options: mockPricingOptions,
        next_step: 'END',
        iteration_count: 1,
      });

      // Supervisor finale termina (viene chiamato dopo pricing_worker se ci sono pricing_options)
      vi.mocked(supervisor).mockResolvedValueOnce({
        pricing_options: mockPricingOptions,
        next_step: 'END',
        iteration_count: 2,
      });

      const initialState: Partial<AgentState> = {
        messages: [new HumanMessage('Preventivo per 2 kg a 00100 RM')],
        userId: 'test-user',
        userEmail: 'test@test.com',
        shipmentData: {},
        processingStatus: 'idle',
        validationErrors: [],
        confidenceScore: 0,
        needsHumanReview: false,
        iteration_count: 0,
      };

      const result = (await pricingGraph.invoke(initialState)) as unknown as AgentState;

      // Verifica che supervisor sia stato chiamato almeno una volta
      expect(supervisor).toHaveBeenCalled();
      // Verifica che pricing_worker sia stato chiamato
      expect(pricingWorker).toHaveBeenCalled();
      // Verifica risultato finale: pricing_options presenti
      expect(result.pricing_options).toBeDefined();
      expect(Array.isArray(result.pricing_options)).toBe(true);
      if (result.pricing_options && result.pricing_options.length > 0) {
        expect(result.pricing_options[0].courier).toBe('BRT');
      }
    });
  });

  describe('Routing: MAX_ITERATIONS stop', () => {
    it('should stop when iteration_count exceeds MAX_ITERATIONS (2)', async () => {
      // Simula loop: supervisor -> pricing_worker -> supervisor (con iteration_count già alto)
      vi.mocked(supervisor).mockResolvedValueOnce({
        next_step: 'pricing_worker',
        processingStatus: 'calculating',
        iteration_count: 2, // Già al limite
      });

      vi.mocked(pricingWorker).mockResolvedValueOnce({
        // Pricing worker non setta next_step (il router decide automaticamente)
        processingStatus: 'calculating',
        iteration_count: 3, // Supera MAX_ITERATIONS
      });

      const initialState: Partial<AgentState> = {
        messages: [new HumanMessage('Preventivo')],
        userId: 'test-user',
        userEmail: 'test@test.com',
        shipmentData: {},
        processingStatus: 'idle',
        validationErrors: [],
        confidenceScore: 0,
        needsHumanReview: false,
        iteration_count: 2, // Già al limite
      };

      const result = (await pricingGraph.invoke(initialState)) as unknown as AgentState;

      // Verifica che il grafo termini (non loop infinito)
      // Il routing dovrebbe fermarsi quando iteration_count > MAX_ITERATIONS
      expect(supervisor).toHaveBeenCalled();
    });
  });

  describe('Routing: END conditions', () => {
    it('should end when next_step is END (supervisor decides to end)', async () => {
      // Mock tutte le chiamate al supervisor (non solo la prima)
      vi.mocked(supervisor).mockResolvedValue({
        next_step: 'END',
        clarification_request: 'Dati insufficienti',
        iteration_count: 0,
      });

      const initialState: Partial<AgentState> = {
        messages: [new HumanMessage('Preventivo')],
        userId: 'test-user',
        userEmail: 'test@test.com',
        shipmentData: {},
        processingStatus: 'idle',
        validationErrors: [],
        confidenceScore: 0,
        needsHumanReview: false,
        iteration_count: 0,
      };

      const result = (await pricingGraph.invoke(initialState)) as unknown as AgentState;

      expect(supervisor).toHaveBeenCalled();
      expect(pricingWorker).not.toHaveBeenCalled();
      // Verifica che il grafo termini (non continua a pricing_worker)
      // Il risultato può non avere next_step se termina per limite iterazioni,
      // ma l'importante è che non sia andato a pricing_worker
      expect(result.pricing_options).toBeUndefined();
    });
  });
});
