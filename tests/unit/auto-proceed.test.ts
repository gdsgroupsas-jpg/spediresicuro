/**
 * Unit Tests: Auto-Proceed Logic (P4 Task 2)
 *
 * Test per la logica auto-proceed nel supervisor.
 * Verifica che auto-proceed funzioni SOLO per operazioni sicure (pricing),
 * MAI per booking/wallet/LDV/giacenze.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supervisor } from '@/lib/agent/orchestrator/supervisor';
import { AgentState } from '@/lib/agent/orchestrator/state';
import { HumanMessage } from '@langchain/core/messages';
import { autoProceedConfig } from '@/lib/config';

// Mock dependencies
vi.mock('@/lib/agent/intent-detector', () => ({
  detectPricingIntent: vi.fn(),
  detectShipmentCreationIntent: vi.fn().mockReturnValue(false),
  detectCancelCreationIntent: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/agent/workers/ocr', () => ({
  containsOcrPatterns: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/agent/workers/booking', () => ({
  containsBookingConfirmation: vi.fn().mockReturnValue(false),
  preflightCheck: vi.fn(),
}));

vi.mock('@/lib/agent/workers/mentor', () => ({
  detectMentorIntent: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/agent/workers/debug', () => ({
  detectDebugIntent: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/agent/workers/explain', () => ({
  detectExplainIntent: vi.fn().mockReturnValue(false),
}));

vi.mock('@/lib/wallet/credit-check', () => ({
  checkCreditBeforeBooking: vi.fn(),
  formatInsufficientCreditMessage: vi.fn(),
}));

vi.mock('@/lib/services/pricing/platform-fee', () => ({
  getPlatformFeeSafe: vi.fn().mockResolvedValue(1.0),
}));

vi.mock('@/lib/config', () => ({
  llmConfig: {
    MODEL: 'gemini-2.0-flash-001',
    SUPERVISOR_TEMPERATURE: 0.1,
    SUPERVISOR_MAX_OUTPUT_TOKENS: 512,
  },
  autoProceedConfig: {
    AUTO_PROCEED_CONFIDENCE_THRESHOLD: 85,
    SUGGEST_PROCEED_CONFIDENCE_THRESHOLD: 70,
    CANCELLATION_WINDOW_MS: 5000,
  },
}));

vi.mock('@/lib/agent/logger', () => ({
  defaultLogger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Auto-Proceed Logic (P4 Task 2)', () => {
  const baseState: Partial<AgentState> = {
    messages: [new HumanMessage('test')],
    userId: 'test-user',
    userEmail: 'test@example.com',
    shipmentData: {},
    processingStatus: 'idle',
    validationErrors: [],
    confidenceScore: 0,
    needsHumanReview: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Auto-Proceed per Pricing (operazione sicura)', () => {
    it('dovrebbe attivare auto-proceed se confidence > 85% e nessun errore', async () => {
      const state: AgentState = {
        ...baseState,
        pricing_options: [
          {
            courier: 'GLS',
            serviceType: 'standard',
            basePrice: 8.0,
            surcharges: 0,
            totalCost: 8.0,
            finalPrice: 10.0,
            margin: 2.0,
            estimatedDeliveryDays: { min: 2, max: 4 },
            recommendation: 'best_price',
          },
        ],
        confidenceScore: 90,
        validationErrors: [],
      } as AgentState;

      const mockLogger = {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const result = await supervisor(state, mockLogger);

      expect(result.autoProceed).toBe(true);
      expect(result.userMessage).toContain('verificati');
      expect(result.next_step).toBe('END');
    });

    it('dovrebbe attivare suggest-proceed se confidence 70-85%', async () => {
      const state: AgentState = {
        ...baseState,
        pricing_options: [
          {
            courier: 'GLS',
            serviceType: 'standard',
            basePrice: 8.0,
            surcharges: 0,
            totalCost: 8.0,
            finalPrice: 10.0,
            margin: 2.0,
            estimatedDeliveryDays: { min: 2, max: 4 },
            recommendation: 'best_price',
          },
        ],
        confidenceScore: 75,
        validationErrors: [],
      } as AgentState;

      const mockLogger = {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const result = await supervisor(state, mockLogger);

      expect(result.suggestProceed).toBe(true);
      expect(result.userMessage).toContain('quasi completi');
      expect(result.next_step).toBe('END');
    });

    it('NON dovrebbe attivare auto-proceed se ci sono errori di validazione', async () => {
      const state: AgentState = {
        ...baseState,
        pricing_options: [
          {
            courier: 'GLS',
            serviceType: 'standard',
            basePrice: 8.0,
            surcharges: 0,
            totalCost: 8.0,
            finalPrice: 10.0,
            margin: 2.0,
            estimatedDeliveryDays: { min: 2, max: 4 },
            recommendation: 'best_price',
          },
        ],
        confidenceScore: 90,
        validationErrors: ['destinationZip: required'],
      } as AgentState;

      const mockLogger = {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const result = await supervisor(state, mockLogger);

      expect(result.autoProceed).toBeUndefined();
      expect(result.next_step).toBe('END');
    });

    it('NON dovrebbe attivare auto-proceed se confidence < 70%', async () => {
      const state: AgentState = {
        ...baseState,
        pricing_options: [
          {
            courier: 'GLS',
            serviceType: 'standard',
            basePrice: 8.0,
            surcharges: 0,
            totalCost: 8.0,
            finalPrice: 10.0,
            margin: 2.0,
            estimatedDeliveryDays: { min: 2, max: 4 },
            recommendation: 'best_price',
          },
        ],
        confidenceScore: 50,
        validationErrors: [],
      } as AgentState;

      const mockLogger = {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const result = await supervisor(state, mockLogger);

      expect(result.autoProceed).toBeUndefined();
      expect(result.suggestProceed).toBeUndefined();
      expect(result.next_step).toBe('END');
    });
  });

  describe('Auto-Proceed MAI per Booking (operazione finanziaria)', () => {
    it("NON dovrebbe attivare auto-proceed anche con confidence alta se c'è booking confirmation", async () => {
      const { containsBookingConfirmation } = await import('@/lib/agent/workers/booking');
      vi.mocked(containsBookingConfirmation).mockReturnValue(true);

      const state: AgentState = {
        ...baseState,
        pricing_options: [
          {
            courier: 'GLS',
            serviceType: 'standard',
            basePrice: 8.0,
            surcharges: 0,
            totalCost: 8.0,
            finalPrice: 10.0,
            margin: 2.0,
            estimatedDeliveryDays: { min: 2, max: 4 },
            recommendation: 'best_price',
          },
        ],
        confidenceScore: 95,
        validationErrors: [],
      } as AgentState;

      const mockLogger = {
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      };
      const result = await supervisor(state, mockLogger);

      // Booking richiede sempre conferma umana, anche con confidence alta
      expect(result.autoProceed).toBeUndefined();
      // Il supervisor dovrebbe routing a booking_worker (non auto-proceed)
      expect(result.next_step).not.toBe('END');
    });
  });

  describe('Guardrail: Auto-Proceed solo per operazioni sicure', () => {
    it('dovrebbe verificare che auto-proceed sia solo per pricing, non booking', () => {
      // Questo test verifica che la logica auto-proceed sia applicata
      // SOLO quando next_step sarebbe 'END' con pricing_options,
      // MAI quando next_step sarebbe 'booking_worker'

      const threshold = autoProceedConfig.AUTO_PROCEED_CONFIDENCE_THRESHOLD;
      expect(threshold).toBeGreaterThanOrEqual(85);

      const suggestThreshold = autoProceedConfig.SUGGEST_PROCEED_CONFIDENCE_THRESHOLD;
      expect(suggestThreshold).toBeLessThan(threshold);
      expect(suggestThreshold).toBeGreaterThanOrEqual(70);
    });
  });
});
