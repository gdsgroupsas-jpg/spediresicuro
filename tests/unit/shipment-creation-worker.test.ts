/**
 * Test: Worker Creazione Spedizione
 *
 * Verifica il flusso conversazionale multi-turn:
 * - Fase collecting con dati parziali
 * - Fase ready con dati completi
 * - Generazione clarification e riepilogo
 * - Lettura sender completo (via getFullSenderData dal booking worker)
 * - Failure modes: pricing engine down, sender assente
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HumanMessage } from '@langchain/core/messages';
import type { AgentState } from '@/lib/agent/orchestrator/state';
import type { ShipmentDraft } from '@/lib/address/shipment-draft';

// Mock del modulo LLM per estrazione (controllato per test LLM-first/fallback)
const { mockExtractWithLLM } = vi.hoisted(() => ({
  mockExtractWithLLM: vi.fn(),
}));

vi.mock('@/lib/agent/workers/shipment-creation-llm', () => ({
  extractWithLLM: mockExtractWithLLM,
}));

// Mock di supabaseAdmin (usato da getFullSenderData come fallback)
vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              default_sender: {
                name: 'Test Mittente',
                address: 'Via Test 1',
                city: 'Roma',
                province: 'RM',
                postalCode: '00100',
                phone: '3331234567',
              },
              full_name: 'Test Mittente',
            },
            error: null,
          }),
        }),
      }),
    }),
  },
}));

// Mock di getUserMemory (usato da getFullSenderData come fonte primaria)
vi.mock('@/lib/ai/user-memory', () => ({
  getUserMemory: vi.fn().mockResolvedValue({
    defaultSender: {
      name: 'Test Mittente',
      address: 'Via Test 1',
      city: 'Roma',
      province: 'RM',
      zip: '00100',
      phone: '3331234567',
    },
  }),
}));

// Mock del pricing engine
vi.mock('@/lib/ai/pricing-engine', () => ({
  calculateOptimalPrice: vi.fn().mockResolvedValue([
    {
      courier: 'GLS',
      serviceType: 'standard',
      basePrice: 8,
      surcharges: 0,
      totalCost: 8,
      finalPrice: 9.5,
      margin: 1.5,
      estimatedDeliveryDays: { min: 2, max: 4 },
      recommendation: 'best_price',
    },
    {
      courier: 'DHL',
      serviceType: 'express',
      basePrice: 12,
      surcharges: 0,
      totalCost: 12,
      finalPrice: 14,
      margin: 2,
      estimatedDeliveryDays: { min: 1, max: 2 },
      recommendation: 'best_speed',
    },
  ]),
}));

// Silenzia console
let consoleSpy: ReturnType<typeof vi.spyOn>[];
beforeEach(() => {
  consoleSpy = [
    vi.spyOn(console, 'log').mockImplementation(() => {}),
    vi.spyOn(console, 'warn').mockImplementation(() => {}),
    vi.spyOn(console, 'error').mockImplementation(() => {}),
  ];
  // Default: LLM non disponibile → fallback regex (come comportamento pre-LLM)
  mockExtractWithLLM.mockResolvedValue(null);
});

afterEach(() => {
  // Ripristina solo console spy, NON i vi.mock globali
  consoleSpy.forEach((spy) => spy.mockRestore());
  mockExtractWithLLM.mockReset();
});

// Import DOPO i mock
import {
  shipmentCreationWorker,
  generateCreationClarification,
  formatShipmentSummary,
} from '@/lib/agent/workers/shipment-creation';
import { calculateOptimalPrice } from '@/lib/ai/pricing-engine';
import { getUserMemory } from '@/lib/ai/user-memory';

// ==================== HELPERS ====================

function makeState(overrides: Partial<AgentState> = {}): AgentState {
  return {
    messages: [new HumanMessage('test')],
    userId: 'test-user-123',
    userEmail: 'test@example.com',
    shipmentData: {},
    processingStatus: 'idle',
    validationErrors: [],
    confidenceScore: 0,
    needsHumanReview: false,
    ...overrides,
  };
}

function makeCompleteDraft(): ShipmentDraft {
  return {
    recipient: {
      fullName: 'Mario Rossi',
      addressLine1: 'Via Roma 1',
      city: 'Milano',
      postalCode: '20100',
      province: 'MI',
      country: 'IT',
    },
    parcel: { weightKg: 5 },
    missingFields: [],
  };
}

function makeFullSender() {
  return {
    name: 'Test Mittente',
    address: 'Via Test 1',
    city: 'Roma',
    province: 'RM',
    postalCode: '00100',
    phone: '3331234567',
  };
}

// ==================== generateCreationClarification ====================

describe('generateCreationClarification', () => {
  it('dovrebbe gestire un singolo campo mancante', () => {
    const result = generateCreationClarification(['parcel.weightKg']);
    expect(result).toContain('peso del pacco');
    expect(result).toContain('mi serve ancora');
  });

  it('dovrebbe gestire due campi mancanti con "e"', () => {
    const result = generateCreationClarification(['recipient.postalCode', 'recipient.province']);
    expect(result).toContain('CAP');
    expect(result).toContain('provincia');
    expect(result).toContain(' e ');
  });

  it('dovrebbe gestire piu di due campi mancanti con virgole', () => {
    const result = generateCreationClarification([
      'recipient.fullName',
      'recipient.addressLine1',
      'recipient.city',
    ]);
    expect(result).toContain('nome destinatario');
    expect(result).toContain('indirizzo');
    expect(result).toContain('citta');
  });

  it('dovrebbe gestire lista vuota', () => {
    const result = generateCreationClarification([]);
    expect(result).toContain('qualche dato in piu');
  });

  it('dovrebbe gestire campi sconosciuti con il nome raw', () => {
    const result = generateCreationClarification(['campo.sconosciuto']);
    expect(result).toContain('campo.sconosciuto');
  });
});

// ==================== formatShipmentSummary ====================

describe('formatShipmentSummary', () => {
  it('dovrebbe formattare riepilogo completo con indirizzo mittente', () => {
    const draft = makeCompleteDraft();
    const sender = makeFullSender();
    const pricing = [
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

    const result = formatShipmentSummary(draft, sender, pricing);
    // HIGH-1: deve mostrare indirizzo completo mittente
    expect(result).toContain('Mittente');
    expect(result).toContain('Test Mittente');
    expect(result).toContain('Via Test 1');
    expect(result).toContain('Roma');
    expect(result).toContain('RM');
    expect(result).toContain('00100');
    expect(result).toContain('3331234567');
    // Destinatario
    expect(result).toContain('Destinatario');
    expect(result).toContain('Mario Rossi');
    expect(result).toContain('Via Roma 1');
    expect(result).toContain('Milano');
    expect(result).toContain('5 kg');
    expect(result).toContain('GLS');
    expect(result).toContain('9.50');
    expect(result).toContain('procedi');
    expect(result).toContain('annulla');
  });

  it('dovrebbe mostrare warning quando sender è null', () => {
    const draft = makeCompleteDraft();
    const result = formatShipmentSummary(draft, null, []);
    expect(result).toContain('non configurato');
    expect(result).toContain('Destinatario');
    expect(result).toContain('Mario Rossi');
  });

  it('dovrebbe gestire pricing vuoto', () => {
    const draft = makeCompleteDraft();
    const result = formatShipmentSummary(draft, null, []);
    expect(result).toContain('Non sono riuscita a calcolare preventivi');
  });

  it('dovrebbe mostrare max 4 opzioni', () => {
    const draft = makeCompleteDraft();
    const pricing = Array(6)
      .fill(null)
      .map((_, i) => ({
        courier: `Courier${i}`,
        serviceType: 'standard',
        basePrice: 10 + i,
        surcharges: 0,
        totalCost: 10 + i,
        finalPrice: 12 + i,
        margin: 2,
        estimatedDeliveryDays: { min: 1, max: 3 },
        recommendation: 'best_price' as const,
      }));

    const result = formatShipmentSummary(draft, null, pricing);
    expect(result).toContain('Courier0');
    expect(result).toContain('Courier3');
    expect(result).not.toContain('Courier4');
  });
});

// ==================== shipmentCreationWorker ====================

describe('shipmentCreationWorker', () => {
  describe('Fase collecting — dati parziali', () => {
    it('dovrebbe chiedere integrazioni quando mancano campi', async () => {
      const state = makeState({
        messages: [new HumanMessage('Voglio spedire 5kg a Milano')],
      });

      const result = await shipmentCreationWorker(state);

      expect(result.shipment_creation_phase).toBe('collecting');
      expect(result.next_step).toBe('END');
      expect(result.clarification_request).toBeDefined();
      expect(result.shipmentDraft).toBeDefined();
      expect(result.shipmentDraft?.recipient?.city).toBe('Milano');
      expect(result.shipmentDraft?.parcel?.weightKg).toBe(5);
    });

    it('dovrebbe chiedere solo i campi effettivamente mancanti', async () => {
      const state = makeState({
        messages: [new HumanMessage('a Mario Rossi, Via Roma 1, Milano')],
        shipmentDraft: {
          parcel: { weightKg: 3 },
          missingFields: [],
        },
      });

      const result = await shipmentCreationWorker(state);

      expect(result.shipment_creation_phase).toBe('collecting');
      expect(result.clarification_request).toContain('CAP');
      expect(result.clarification_request).toContain('provincia');
    });
  });

  describe('Multi-turn progressivo', () => {
    it('dovrebbe accumulare dati su piu messaggi', async () => {
      // Primo messaggio: peso
      const state1 = makeState({
        messages: [new HumanMessage('5kg a Milano')],
      });
      const result1 = await shipmentCreationWorker(state1);
      expect(result1.shipment_creation_phase).toBe('collecting');
      expect(result1.shipmentDraft?.parcel?.weightKg).toBe(5);

      // Secondo messaggio: nome + CAP + provincia (senza "Via Roma" per evitare conflitto NLP)
      const state2 = makeState({
        messages: [new HumanMessage('Mario Rossi, Via Dante 7, 20100 MI')],
        shipmentDraft: result1.shipmentDraft,
      });
      const result2 = await shipmentCreationWorker(state2);

      // Il peso del primo turno deve essere preservato
      expect(result2.shipmentDraft?.parcel?.weightKg).toBe(5);
      // Deve avere almeno nome e CAP dal secondo turno
      expect(result2.shipmentDraft?.recipient?.fullName).toBe('Mario Rossi');
      expect(result2.shipmentDraft?.recipient?.postalCode).toBe('20100');
    });
  });

  describe('Fase ready — dati completi', () => {
    it('dovrebbe calcolare pricing e mostrare riepilogo con indirizzo mittente', async () => {
      const state = makeState({
        messages: [new HumanMessage('conferma spedizione')],
        shipmentDraft: makeCompleteDraft(),
      });

      const result = await shipmentCreationWorker(state);

      expect(result.shipment_creation_phase).toBe('ready');
      expect(result.next_step).toBe('END');
      expect(result.processingStatus).toBe('complete');
      expect(result.pricing_options).toHaveLength(2);
      expect(result.shipment_creation_summary).toContain('GLS');
      expect(result.shipment_creation_summary).toContain('DHL');
      expect(result.shipment_creation_summary).toContain('procedi');
      // HIGH-1: riepilogo deve contenere indirizzo mittente completo
      expect(result.shipment_creation_summary).toContain('Via Test 1');
      expect(result.shipment_creation_summary).toContain('Roma');
    });

    it('NON dovrebbe chiamare booking', async () => {
      const state = makeState({
        messages: [new HumanMessage('conferma spedizione')],
        shipmentDraft: makeCompleteDraft(),
      });

      const result = await shipmentCreationWorker(state);

      expect(result.next_step).toBe('END');
      expect(result.booking_result).toBeUndefined();
    });
  });

  // ==================== FAILURE MODES (P0) ====================

  describe('Failure modes', () => {
    it('dovrebbe gestire pricing engine che lancia eccezione', async () => {
      vi.mocked(calculateOptimalPrice).mockRejectedValueOnce(new Error('Corriere non disponibile'));

      const state = makeState({
        messages: [new HumanMessage('test')],
        shipmentDraft: makeCompleteDraft(),
      });

      const result = await shipmentCreationWorker(state);

      // Deve arrivare a ready (dati completi) ma con pricing vuoto
      expect(result.shipment_creation_phase).toBe('ready');
      expect(result.pricing_options).toEqual([]);
      expect(result.shipment_creation_summary).toContain(
        'Non sono riuscita a calcolare preventivi'
      );
    });

    it('dovrebbe gestire sender non trovato (getUserMemory null)', async () => {
      vi.mocked(getUserMemory).mockResolvedValueOnce(null);
      // Anche il fallback DB ritorna null (simulato tramite supabaseAdmin mock che ritorna dati)
      // Ma getFullSenderData cerca address+city nel default_sender, che il mock base ha

      const state = makeState({
        messages: [new HumanMessage('test')],
        shipmentDraft: makeCompleteDraft(),
      });

      const result = await shipmentCreationWorker(state);

      // Deve comunque arrivare a ready (il fallback DB ha i dati)
      expect(result.shipment_creation_phase).toBe('ready');
    });
  });

  describe('Edge cases', () => {
    it('dovrebbe gestire messaggio vuoto', async () => {
      const state = makeState({
        messages: [new HumanMessage('')],
      });

      const result = await shipmentCreationWorker(state);
      expect(result.shipment_creation_phase).toBe('collecting');
      expect(result.clarification_request).toBeDefined();
    });

    it('dovrebbe preservare draft esistente quando messaggio aggiunge dati', async () => {
      const existingDraft = makeCompleteDraft();
      // Rimuovi un campo per testare collecting
      delete existingDraft.recipient!.fullName;

      const state = makeState({
        messages: [new HumanMessage('Mario Rossi')],
        shipmentDraft: existingDraft,
      });

      const result = await shipmentCreationWorker(state);

      // Dati precedenti preservati
      expect(result.shipmentDraft?.recipient?.postalCode).toBe('20100');
      expect(result.shipmentDraft?.parcel?.weightKg).toBe(5);
    });
  });

  // ==================== LLM-FIRST + FALLBACK (FASE 3) ====================

  describe('Strategia LLM-first con fallback', () => {
    it('dovrebbe usare dati LLM quando disponibile', async () => {
      mockExtractWithLLM.mockResolvedValueOnce({
        extractedData: {
          recipient: {
            fullName: 'Mario Rossi',
            addressLine1: 'Via Roma 1',
            city: 'Milano',
            postalCode: '20100',
            province: 'MI',
          },
          parcel: { weightKg: 5 },
        },
        conversationalQuestion: null,
        confidence: 95,
      });

      const state = makeState({
        messages: [new HumanMessage('Spedire 5kg a Mario Rossi, Via Roma 1, 20100 Milano MI')],
      });

      const result = await shipmentCreationWorker(state);

      // LLM ha estratto tutti i dati → fase ready
      expect(result.shipment_creation_phase).toBe('ready');
      expect(result.shipmentDraft?.recipient?.fullName).toBe('Mario Rossi');
      expect(result.shipmentDraft?.recipient?.city).toBe('Milano');
      expect(result.shipmentDraft?.parcel?.weightKg).toBe(5);
      expect(mockExtractWithLLM).toHaveBeenCalledOnce();
    });

    it('dovrebbe usare domanda conversazionale LLM (non template)', async () => {
      mockExtractWithLLM.mockResolvedValueOnce({
        extractedData: {
          recipient: {
            fullName: 'Mario Rossi',
            city: 'Milano',
          },
          parcel: { weightKg: 5 },
        },
        conversationalQuestion:
          'Ho capito, 5kg a Mario Rossi a Milano! Mi mancano via e CAP, me li dici?',
        confidence: 70,
      });

      const state = makeState({
        messages: [new HumanMessage('5kg a Mario Rossi a Milano')],
      });

      const result = await shipmentCreationWorker(state);

      expect(result.shipment_creation_phase).toBe('collecting');
      // Usa la domanda conversazionale LLM, NON il template deterministico
      expect(result.clarification_request).toBe(
        'Ho capito, 5kg a Mario Rossi a Milano! Mi mancano via e CAP, me li dici?'
      );
    });

    it('dovrebbe fare fallback a regex quando LLM non disponibile', async () => {
      // mockExtractWithLLM gia ritorna null dal beforeEach
      const state = makeState({
        messages: [new HumanMessage('5kg a Milano')],
      });

      const result = await shipmentCreationWorker(state);

      // Fallback regex estrae peso e citta
      expect(result.shipment_creation_phase).toBe('collecting');
      expect(result.shipmentDraft?.parcel?.weightKg).toBe(5);
      expect(result.shipmentDraft?.recipient?.city).toBe('Milano');
      // Usa template deterministico (non domanda conversazionale)
      expect(result.clarification_request).toContain('nome destinatario');
    });

    it('dovrebbe fare fallback a template quando LLM non genera domanda', async () => {
      mockExtractWithLLM.mockResolvedValueOnce({
        extractedData: {
          recipient: { city: 'Roma' },
          parcel: { weightKg: 3 },
        },
        conversationalQuestion: null, // LLM non ha generato domanda
        confidence: 60,
      });

      const state = makeState({
        messages: [new HumanMessage('3kg a Roma')],
      });

      const result = await shipmentCreationWorker(state);

      expect(result.shipment_creation_phase).toBe('collecting');
      // Senza domanda conversazionale → template deterministico
      expect(result.clarification_request).toContain('nome destinatario');
    });

    it('dovrebbe mergiare dati LLM con draft esistente', async () => {
      mockExtractWithLLM.mockResolvedValueOnce({
        extractedData: {
          recipient: {
            addressLine1: 'Via Dante 7',
            postalCode: '20100',
            province: 'MI',
          },
        },
        conversationalQuestion: null,
        confidence: 90,
      });

      const state = makeState({
        messages: [new HumanMessage('Via Dante 7, 20100 MI')],
        shipmentDraft: {
          recipient: { fullName: 'Mario Rossi', city: 'Milano' },
          parcel: { weightKg: 5 },
          missingFields: [],
        },
      });

      const result = await shipmentCreationWorker(state);

      // Dati LLM + dati draft precedente = completo → ready
      expect(result.shipment_creation_phase).toBe('ready');
      expect(result.shipmentDraft?.recipient?.fullName).toBe('Mario Rossi');
      expect(result.shipmentDraft?.recipient?.addressLine1).toBe('Via Dante 7');
      expect(result.shipmentDraft?.recipient?.city).toBe('Milano');
      expect(result.shipmentDraft?.recipient?.postalCode).toBe('20100');
      expect(result.shipmentDraft?.parcel?.weightKg).toBe(5);
    });

    it('dovrebbe passare il draft esistente al LLM come contesto', async () => {
      mockExtractWithLLM.mockResolvedValueOnce(null);

      const existingDraft: ShipmentDraft = {
        recipient: { fullName: 'Test', city: 'Roma' },
        parcel: { weightKg: 2 },
        missingFields: [],
      };

      const state = makeState({
        messages: [new HumanMessage('Via Appia 10')],
        shipmentDraft: existingDraft,
      });

      await shipmentCreationWorker(state);

      // Verifica che extractWithLLM riceva il draft esistente
      expect(mockExtractWithLLM).toHaveBeenCalledWith(
        'Via Appia 10',
        existingDraft,
        expect.anything() // logger
      );
    });

    it('dovrebbe gestire LLM con dati completamente vuoti → collecting', async () => {
      mockExtractWithLLM.mockResolvedValueOnce({
        extractedData: {
          recipient: {},
          parcel: undefined,
        },
        conversationalQuestion: 'Dimmi cosa devo spedire!',
        confidence: 20,
      });

      const state = makeState({
        messages: [new HumanMessage('ciao')],
      });

      const result = await shipmentCreationWorker(state);

      expect(result.shipment_creation_phase).toBe('collecting');
      expect(result.clarification_request).toBe('Dimmi cosa devo spedire!');
    });

    it('dovrebbe sovrascrivere dati draft quando LLM estrae campo diverso (merge)', async () => {
      // Draft ha citta=Roma, LLM corregge a Milano
      mockExtractWithLLM.mockResolvedValueOnce({
        extractedData: {
          recipient: {
            fullName: 'Mario Rossi',
            addressLine1: 'Via Roma 1',
            city: 'Milano', // sovrascrive Roma dal draft
            postalCode: '20100',
            province: 'MI',
          },
          parcel: { weightKg: 5 },
        },
        conversationalQuestion: null,
        confidence: 95,
      });

      const state = makeState({
        messages: [new HumanMessage('No aspetta, Milano non Roma')],
        shipmentDraft: {
          recipient: { fullName: 'Mario Rossi', city: 'Roma' },
          parcel: { weightKg: 5 },
          missingFields: [],
        },
      });

      const result = await shipmentCreationWorker(state);

      // LLM ha corretto la citta → merge sovrascrive
      expect(result.shipmentDraft?.recipient?.city).toBe('Milano');
      expect(result.shipmentDraft?.recipient?.fullName).toBe('Mario Rossi');
    });
  });
});
