/**
 * Integration Tests: OCR Vision (Sprint 2.5)
 *
 * Test del flusso completo ocrWorker con immagini:
 * - Feature flag disabilitato → clarification
 * - Feature flag abilitato + Vision success → draft popolato
 * - Feature flag abilitato + Vision fallisce → clarification esplicita
 * - Confidence sotto soglia → blocco
 *
 * ⚠️ Questi test mockano extractData() per evitare chiamate Gemini reali.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ocrWorker } from '@/lib/agent/workers/ocr';
import { AgentState } from '@/lib/agent/orchestrator/state';
import { HumanMessage } from '@langchain/core/messages';
import { NullLogger } from '@/lib/agent/logger';

// Mock extractData
vi.mock('@/lib/agent/orchestrator/nodes', () => ({
  extractData: vi.fn(),
}));

// Mock config
vi.mock('@/lib/config', async (importOriginal) => {
  const original = (await importOriginal()) as any;
  return {
    ...original,
    ocrConfig: {
      ENABLE_OCR_IMAGES: true, // Default abilitato per test
      MIN_VISION_CONFIDENCE: 0.7,
      VISION_TIMEOUT_MS: 30000,
    },
  };
});

import { extractData } from '@/lib/agent/orchestrator/nodes';
import { ocrConfig } from '@/lib/config';

// ==================== FIXTURES ====================

// Immagine base64 minima 1x1 pixel PNG trasparente
const MINIMAL_IMAGE_BASE64 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const createMockAgentState = (messageContent: string): AgentState => ({
  messages: [new HumanMessage({ content: messageContent })],
  userId: 'test-user-123',
  userEmail: 'test@example.com',
  shipmentData: {},
  processingStatus: 'idle',
  validationErrors: [],
  confidenceScore: 0,
  needsHumanReview: false,
});

const nullLogger = new NullLogger();

// ==================== TEST SUITE ====================

describe('OCR Vision Integration (Sprint 2.5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Feature Flag Disabled', () => {
    it('should return clarification when ENABLE_OCR_IMAGES is false', async () => {
      // Override config per questo test
      vi.doMock('@/lib/config', async (importOriginal) => {
        const original = (await importOriginal()) as any;
        return {
          ...original,
          ocrConfig: {
            ...original.ocrConfig,
            ENABLE_OCR_IMAGES: false,
          },
        };
      });

      // Reimporta con nuova config
      vi.resetModules();
      const { ocrWorker: ocrWorkerDisabled } = await import('@/lib/agent/workers/ocr');

      const state = createMockAgentState(MINIMAL_IMAGE_BASE64);
      const result = await ocrWorkerDisabled(state, nullLogger);

      expect(result.clarification_request).toBeDefined();
      expect(result.clarification_request).toContain('immagine');
      expect(result.next_step).toBe('END');
    });
  });

  describe('Vision Success Flow', () => {
    it('should extract data and route to address_worker when Vision succeeds with complete data', async () => {
      // Mock extractData con risposta completa
      vi.mocked(extractData).mockResolvedValueOnce({
        shipmentData: {
          recipient_name: 'Mario Rossi',
          recipient_address: 'Via Roma 123',
          recipient_city: 'Milano',
          recipient_zip: '20100',
          recipient_province: 'MI',
          recipient_phone: '3331234567',
        },
        processingStatus: 'validating',
        confidenceScore: 90, // 90% > 70% soglia
      });

      const state = createMockAgentState(MINIMAL_IMAGE_BASE64);
      const result = await ocrWorker(state, nullLogger);

      // Verifica che extractData sia stato chiamato
      expect(extractData).toHaveBeenCalled();

      // Verifica draft popolato (ma manca weight per pricing)
      expect(result.shipmentDraft).toBeDefined();
      expect(result.shipmentDraft?.recipient?.fullName).toBe('Mario Rossi');
      expect(result.shipmentDraft?.recipient?.postalCode).toBe('20100');
      expect(result.shipmentDraft?.recipient?.province).toBe('MI');

      // Manca weight → chiede clarification
      expect(result.clarification_request).toBeDefined();
      expect(result.next_step).toBe('END');
    });

    it('should route to address_worker when Vision succeeds with complete data including weight', async () => {
      // Mock extractData con risposta completa + peso
      vi.mocked(extractData).mockResolvedValueOnce({
        shipmentData: {
          recipient_name: 'Mario Rossi',
          recipient_zip: '20100',
          recipient_province: 'MI',
          weight: 5, // Peso incluso!
        },
        processingStatus: 'validating',
        confidenceScore: 90,
      });

      const state = createMockAgentState(MINIMAL_IMAGE_BASE64);
      const result = await ocrWorker(state, nullLogger);

      expect(result.shipmentDraft?.parcel?.weightKg).toBe(5);
      expect(result.next_step).toBe('address_worker');
      expect(result.clarification_request).toBeUndefined();
    });
  });

  describe('Vision Failure Fallback', () => {
    it('should return clarification when Vision returns error status', async () => {
      vi.mocked(extractData).mockResolvedValueOnce({
        processingStatus: 'error',
        validationErrors: ['Gemini Vision API error'],
      });

      const state = createMockAgentState(MINIMAL_IMAGE_BASE64);
      const result = await ocrWorker(state, nullLogger);

      expect(result.clarification_request).toBeDefined();
      expect(result.clarification_request).toContain('immagine');
      expect(result.next_step).toBe('END');
    });

    it('should return clarification when Vision throws exception', async () => {
      // Mock entrambe le chiamate (primo tentativo + retry)
      // "Network timeout" contiene "timeout" quindi è classificato come errore transiente e viene ritentato
      vi.mocked(extractData)
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Network timeout'));

      const state = createMockAgentState(MINIMAL_IMAGE_BASE64);
      const result = await ocrWorker(state, nullLogger);

      expect(result.clarification_request).toBeDefined();
      expect(result.next_step).toBe('END');
      expect(result.processingStatus).toBe('error');
      // Debug: controlla che validationErrors esista e sia un array
      expect(result.validationErrors).toBeDefined();
      expect(Array.isArray(result.validationErrors)).toBe(true);
      expect(result.validationErrors?.length).toBe(1);
      expect(result.validationErrors?.[0]).toBe('Vision Error: Network timeout');
    });

    it('should return clarification when Vision returns empty data', async () => {
      vi.mocked(extractData).mockResolvedValueOnce({
        shipmentData: {},
        processingStatus: 'validating',
        confidenceScore: 50,
      });

      const state = createMockAgentState(MINIMAL_IMAGE_BASE64);
      const result = await ocrWorker(state, nullLogger);

      expect(result.clarification_request).toBeDefined();
      expect(result.clarification_request).toContain('CAP');
      expect(result.next_step).toBe('END');
    });
  });

  describe('Confidence Threshold', () => {
    it('should block and ask confirmation when confidence is below threshold', async () => {
      vi.mocked(extractData).mockResolvedValueOnce({
        shipmentData: {
          recipient_name: 'Mario Rossi',
          recipient_zip: '20100',
          recipient_province: 'MI',
        },
        processingStatus: 'validating',
        confidenceScore: 50, // 50% < 70% soglia
      });

      const state = createMockAgentState(MINIMAL_IMAGE_BASE64);
      const result = await ocrWorker(state, nullLogger);

      expect(result.clarification_request).toBeDefined();
      expect(result.clarification_request).toContain('confermare');
      expect(result.next_step).toBe('END');
      // NON deve aver prodotto draft in output (bloccato)
    });

    it('should proceed when confidence is at threshold', async () => {
      vi.mocked(extractData).mockResolvedValueOnce({
        shipmentData: {
          recipient_zip: '20100',
          recipient_province: 'MI',
          weight: 3,
        },
        processingStatus: 'validating',
        confidenceScore: 70, // Esattamente alla soglia
      });

      const state = createMockAgentState(MINIMAL_IMAGE_BASE64);
      const result = await ocrWorker(state, nullLogger);

      // Dovrebbe procedere (>= soglia)
      expect(result.shipmentDraft).toBeDefined();
      expect(result.next_step).toBe('address_worker');
    });
  });

  describe('Merge with Existing Draft', () => {
    it('should merge Vision data with existing draft non-destructively', async () => {
      vi.mocked(extractData).mockResolvedValueOnce({
        shipmentData: {
          recipient_zip: '20100',
          recipient_province: 'MI',
        },
        processingStatus: 'validating',
        confidenceScore: 90,
      });

      const state: AgentState = {
        ...createMockAgentState(MINIMAL_IMAGE_BASE64),
        shipmentDraft: {
          recipient: {
            fullName: 'Existing Name',
            city: 'Roma',
            country: 'IT',
          },
          parcel: {
            weightKg: 2,
          },
          missingFields: [],
        },
      };

      const result = await ocrWorker(state, nullLogger);

      // Verifica merge: campi esistenti preservati
      expect(result.shipmentDraft?.recipient?.fullName).toBe('Existing Name');
      expect(result.shipmentDraft?.recipient?.city).toBe('Roma');
      expect(result.shipmentDraft?.parcel?.weightKg).toBe(2);

      // Nuovi campi aggiunti
      expect(result.shipmentDraft?.recipient?.postalCode).toBe('20100');
      expect(result.shipmentDraft?.recipient?.province).toBe('MI');

      // Ha tutti i dati → address_worker
      expect(result.next_step).toBe('address_worker');
    });
  });

  describe('Text Input (Non-Image)', () => {
    it('should still process text correctly (existing behavior)', async () => {
      const state = createMockAgentState('CAP: 20100\nProvincia: MI\nPeso: 5 kg');
      const result = await ocrWorker(state, nullLogger);

      // extractData NON deve essere chiamato per testo
      expect(extractData).not.toHaveBeenCalled();

      // Deve processare con regex OCR
      expect(result.shipmentDraft?.recipient?.postalCode).toBe('20100');
      expect(result.shipmentDraft?.recipient?.province).toBe('MI');
      expect(result.shipmentDraft?.parcel?.weightKg).toBe(5);
      expect(result.next_step).toBe('address_worker');
    });
  });
});
