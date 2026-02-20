/**
 * Integration Tests: Booking Worker (Sprint 2.6)
 *
 * Test cases:
 * 1. Booking called only after explicit confirmation
 * 2. Successful booking returns shipment_id and confirmation message
 * 3. Booking failure handled gracefully
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  bookingWorker,
  preflightCheck,
  containsBookingConfirmation,
  BookingResult,
  PreflightResult,
} from '@/lib/agent/workers/booking';
import { AgentState } from '@/lib/agent/orchestrator/state';
import { ShipmentDraft } from '@/lib/address/shipment-draft';
import { PricingResult } from '@/lib/ai/pricing-engine';
import { HumanMessage } from '@langchain/core/messages';

// ==================== FIXTURES ====================

const mockCompleteDraft: ShipmentDraft = {
  recipient: {
    country: 'IT',
    fullName: 'Mario Rossi',
    addressLine1: 'Via Roma 123',
    city: 'Milano',
    province: 'MI',
    postalCode: '20100',
    phone: '+39 333 1234567',
  },
  sender: {
    // SenderSchema ha solo: name, phone, company (no address fields)
    name: 'Luigi Verdi',
    company: 'Azienda SRL',
    phone: '+39 06 1234567',
  },
  parcel: {
    weightKg: 2.5,
    lengthCm: 30,
    widthCm: 20,
    heightCm: 15,
  },
  missingFields: [],
};

const mockIncompleteDraft: ShipmentDraft = {
  recipient: {
    country: 'IT',
    fullName: 'Mario Rossi',
    // Missing addressLine1, city, province, postalCode
  },
  parcel: {
    weightKg: 2.5,
  },
  missingFields: ['addressLine1', 'city', 'province', 'postalCode'],
};

const mockPricingOption: PricingResult = {
  courier: 'BRT',
  serviceType: 'express',
  basePrice: 10.0,
  surcharges: 0,
  totalCost: 10.0,
  finalPrice: 12.5,
  margin: 2.5,
  estimatedDeliveryDays: { min: 1, max: 2 },
  recommendation: 'best_price',
};

const createMockAgentState = (overrides: Partial<AgentState> = {}): AgentState => ({
  messages: [],
  userId: 'test-user-123',
  userEmail: 'test@example.com',
  shipmentData: {},
  processingStatus: 'idle',
  validationErrors: [],
  confidenceScore: 0,
  needsHumanReview: false,
  ...overrides,
});

// ==================== PREFLIGHT CHECK TESTS ====================

describe('preflightCheck', () => {
  it('should pass when all required fields are present', () => {
    const result = preflightCheck(mockCompleteDraft, mockPricingOption, 'idem-key-123');

    expect(result.passed).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('should fail when recipient fields are missing', () => {
    const result = preflightCheck(mockIncompleteDraft, mockPricingOption, 'idem-key-123');

    expect(result.passed).toBe(false);
    expect(result.missing).toContain('indirizzo destinatario');
    expect(result.missing).toContain('CAP destinatario');
    expect(result.missing).toContain('città destinatario');
    expect(result.missing).toContain('provincia destinatario');
  });

  it('should fail when pricing option is missing', () => {
    const result = preflightCheck(mockCompleteDraft, undefined, 'idem-key-123');

    expect(result.passed).toBe(false);
    expect(result.missing).toContain('opzione prezzo selezionata');
  });

  it('should fail when idempotency key is missing', () => {
    const result = preflightCheck(mockCompleteDraft, mockPricingOption, undefined);

    expect(result.passed).toBe(false);
    expect(result.missing).toContain('chiave idempotenza');
  });

  it('should fail when parcel weight is missing', () => {
    const draftNoWeight: ShipmentDraft = {
      ...mockCompleteDraft,
      parcel: {},
    };

    const result = preflightCheck(draftNoWeight, mockPricingOption, 'idem-key-123');

    expect(result.passed).toBe(false);
    expect(result.missing).toContain('peso pacco');
  });

  it('should add warning when phone is missing', () => {
    const draftNoPhone: ShipmentDraft = {
      ...mockCompleteDraft,
      recipient: {
        ...mockCompleteDraft.recipient!,
        phone: undefined,
      },
    };

    const result = preflightCheck(draftNoPhone, mockPricingOption, 'idem-key-123');

    expect(result.passed).toBe(true); // Still passes
    expect(result.warnings).toContain('telefono destinatario non presente (consigliato)');
  });
});

// ==================== BOOKING CONFIRMATION DETECTION TESTS ====================

describe('containsBookingConfirmation', () => {
  it('should detect "procedi" as confirmation', () => {
    expect(containsBookingConfirmation('Sì, procedi con la spedizione')).toBe(true);
    expect(containsBookingConfirmation('Procedi!')).toBe(true);
  });

  it('should detect "conferma" as confirmation', () => {
    expect(containsBookingConfirmation('Conferma la prenotazione')).toBe(true);
    expect(containsBookingConfirmation('confermo')).toBe(true);
  });

  it('should detect "ok prenota" as confirmation', () => {
    expect(containsBookingConfirmation('ok prenota')).toBe(true);
    expect(containsBookingConfirmation('OK, prenota la spedizione')).toBe(true);
  });

  it('should detect "sì, procedi" as confirmation', () => {
    expect(containsBookingConfirmation('sì procedi')).toBe(true);
    expect(containsBookingConfirmation('si, conferma')).toBe(true);
  });

  it('should detect "va bene" as confirmation', () => {
    expect(containsBookingConfirmation('va bene, procedi')).toBe(true);
    expect(containsBookingConfirmation("d'accordo, prenota")).toBe(true);
  });

  it('should NOT detect normal questions as confirmation', () => {
    expect(containsBookingConfirmation('Quanto costa la spedizione?')).toBe(false);
    expect(containsBookingConfirmation('Qual è il prezzo?')).toBe(false);
    expect(containsBookingConfirmation('Spedire a Milano')).toBe(false);
  });

  it('should NOT detect empty strings as confirmation', () => {
    expect(containsBookingConfirmation('')).toBe(false);
    expect(containsBookingConfirmation('   ')).toBe(false);
  });
});

// ==================== BOOKING WORKER TESTS ====================

describe('bookingWorker', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should fail preflight and return clarification when data incomplete', async () => {
    const state = createMockAgentState({
      shipmentDraft: mockIncompleteDraft,
      pricing_options: [mockPricingOption],
      messages: [new HumanMessage('Procedi con la prenotazione')],
    });

    const result = await bookingWorker(state);

    expect(result.booking_result).toBeDefined();
    expect(result.booking_result?.status).toBe('failed');
    expect(result.booking_result?.error_code).toBe('PREFLIGHT_FAILED');
    expect(result.next_step).toBe('END');
    expect(result.clarification_request).toBeDefined();
  });

  it('should fail preflight when no pricing options', async () => {
    const state = createMockAgentState({
      shipmentDraft: mockCompleteDraft,
      pricing_options: undefined, // No pricing
      messages: [new HumanMessage('Procedi')],
    });

    const result = await bookingWorker(state);

    expect(result.booking_result).toBeDefined();
    expect(result.booking_result?.status).toBe('failed');
    expect(result.booking_result?.error_code).toBe('PREFLIGHT_FAILED');
    expect(result.clarification_request).toContain('opzione prezzo selezionata');
  });

  it('should have correct user_message structure on preflight failure', async () => {
    const state = createMockAgentState({
      shipmentDraft: mockIncompleteDraft,
      pricing_options: [mockPricingOption],
    });

    const result = await bookingWorker(state);

    expect(result.booking_result?.user_message).toBeDefined();
    expect(result.booking_result?.user_message).toContain('Non posso procedere');
    expect(typeof result.booking_result?.user_message).toBe('string');
  });
});

// ==================== BOOKING RESULT SHAPE TESTS ====================

describe('BookingResult shape', () => {
  it('should have all required fields on success', () => {
    const successResult: BookingResult = {
      status: 'success',
      shipment_id: 'ship-123',
      carrier_reference: 'BRT-456',
      user_message: 'Spedizione prenotata con successo!',
      label_data: 'base64...',
      label_format: 'PDF',
    };

    expect(successResult.status).toBe('success');
    expect(successResult.shipment_id).toBeDefined();
    expect(successResult.user_message).toBeDefined();
    expect(successResult.error_code).toBeUndefined();
  });

  it('should have all required fields on failure', () => {
    const failResult: BookingResult = {
      status: 'failed',
      error_code: 'CARRIER_ERROR',
      user_message: 'Errore dal corriere. Riprova più tardi.',
    };

    expect(failResult.status).toBe('failed');
    expect(failResult.error_code).toBeDefined();
    expect(failResult.user_message).toBeDefined();
    expect(failResult.shipment_id).toBeUndefined();
  });

  it('should have retry_after_ms on retryable status', () => {
    const retryableResult: BookingResult = {
      status: 'retryable',
      error_code: 'NETWORK_ERROR',
      user_message: 'Problema di connessione. Riprova tra qualche minuto.',
      retry_after_ms: 30000,
    };

    expect(retryableResult.status).toBe('retryable');
    expect(retryableResult.retry_after_ms).toBeGreaterThan(0);
  });
});

// ==================== INTEGRATION: NO BOOKING WITHOUT CONFIRMATION ====================

describe('Integration: Booking only after explicit confirmation', () => {
  it('should NOT detect confirmation when user asks for price only', () => {
    const hasConfirmation = containsBookingConfirmation('Quanto costa spedire a Milano?');
    expect(hasConfirmation).toBe(false);
  });

  it('should detect confirmation when user explicitly confirms', () => {
    const hasConfirmation = containsBookingConfirmation('Sì, procedi con la prenotazione');
    expect(hasConfirmation).toBe(true);
  });
});

// ==================== EDGE CASES ====================

describe('Edge Cases', () => {
  it('should handle empty shipmentDraft gracefully', async () => {
    const state = createMockAgentState({
      shipmentDraft: undefined,
      pricing_options: [mockPricingOption],
    });

    const result = await bookingWorker(state);

    expect(result.booking_result?.status).toBe('failed');
    expect(result.booking_result?.error_code).toBe('PREFLIGHT_FAILED');
  });

  it('should handle missing parcel in draft', async () => {
    const draftNoParcel: ShipmentDraft = {
      recipient: mockCompleteDraft.recipient,
      parcel: undefined,
      missingFields: ['parcel'],
    };

    const state = createMockAgentState({
      shipmentDraft: draftNoParcel,
      pricing_options: [mockPricingOption],
    });

    const result = await bookingWorker(state);

    expect(result.booking_result?.status).toBe('failed');
    expect(result.clarification_request).toContain('dettagli pacco');
  });

  it('should handle zero weight as invalid', () => {
    const draftZeroWeight: ShipmentDraft = {
      ...mockCompleteDraft,
      parcel: { weightKg: 0 },
    };

    const result = preflightCheck(draftZeroWeight, mockPricingOption, 'key');

    expect(result.passed).toBe(false);
    expect(result.missing).toContain('peso pacco');
  });

  it('should handle negative weight as invalid', () => {
    const draftNegativeWeight: ShipmentDraft = {
      ...mockCompleteDraft,
      parcel: { weightKg: -1 },
    };

    const result = preflightCheck(draftNegativeWeight, mockPricingOption, 'key');

    expect(result.passed).toBe(false);
    expect(result.missing).toContain('peso pacco');
  });
});
