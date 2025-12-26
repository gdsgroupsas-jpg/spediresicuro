/**
 * Unit Tests: address-worker.ts
 * 
 * Test coverage per Address Worker:
 * - Merge non distruttivo (state esistente + nuovo input parziale)
 * - missingFields correttamente calcolati
 * - clarification_request quando mancano dati
 * - next_step logic (pricing_worker vs END)
 * - Gestione errori e edge cases
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  addressWorker, 
  processAddressSync,
  AddressWorkerResult,
} from '@/lib/agent/workers/address';
import { AgentState } from '@/lib/agent/orchestrator/state';
import { ShipmentDraft } from '@/lib/address/shipment-draft';
import { HumanMessage } from '@langchain/core/messages';

// Silenzia console nei test
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ==================== FIXTURES ====================

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

const createCompleteShipmentDraft = (): ShipmentDraft => ({
  recipient: {
    country: 'IT',
    fullName: 'Mario Rossi',
    addressLine1: 'Via Roma 123',
    city: 'Milano',
    province: 'MI',
    postalCode: '20100',
  },
  parcel: {
    weightKg: 5,
  },
  missingFields: [],
});

// ==================== processAddressSync TESTS ====================

describe('processAddressSync', () => {
  describe('missingFields calculation', () => {
    it('should return empty missingFields when all pricing data present', () => {
      const message = 'Spedire a 20100 Milano MI, peso 5 kg';
      const result = processAddressSync(message);
      
      expect(result.missingFields).toHaveLength(0);
      expect(result.nextStep).toBe('pricing_worker');
    });
    
    it('should include recipient.postalCode when CAP missing', () => {
      const message = 'Spedire a Milano MI, peso 5 kg';
      const result = processAddressSync(message);
      
      expect(result.missingFields).toContain('recipient.postalCode');
    });
    
    it('should include recipient.province when province missing', () => {
      const message = 'Spedire a 20100 Milano, peso 5 kg';
      const result = processAddressSync(message);
      
      expect(result.missingFields).toContain('recipient.province');
    });
    
    it('should include parcel.weightKg when weight missing', () => {
      const message = 'Spedire a 20100 Milano MI';
      const result = processAddressSync(message);
      
      expect(result.missingFields).toContain('parcel.weightKg');
    });
    
    it('should include multiple missing fields', () => {
      const message = 'ciao, voglio spedire';
      const result = processAddressSync(message);
      
      expect(result.missingFields).toContain('recipient.postalCode');
      expect(result.missingFields).toContain('recipient.province');
      expect(result.missingFields).toContain('parcel.weightKg');
      expect(result.missingFields).toHaveLength(3);
    });
  });
  
  describe('merge non-destructive', () => {
    it('should preserve existing recipient fields when new input partial', () => {
      const existing: ShipmentDraft = {
        recipient: {
          country: 'IT',
          fullName: 'Mario Rossi',
          addressLine1: 'Via Roma 123',
          city: 'Milano',
          province: 'MI',
          postalCode: '20100',
        },
        parcel: {},
        missingFields: ['parcel.weightKg'],
      };
      
      // Input con solo peso
      const result = processAddressSync('peso 5 kg', existing);
      
      // Dati esistenti NON cancellati
      expect(result.shipmentDraft.recipient?.fullName).toBe('Mario Rossi');
      expect(result.shipmentDraft.recipient?.addressLine1).toBe('Via Roma 123');
      expect(result.shipmentDraft.recipient?.city).toBe('Milano');
      expect(result.shipmentDraft.recipient?.province).toBe('MI');
      expect(result.shipmentDraft.recipient?.postalCode).toBe('20100');
      // Nuovo dato aggiunto
      expect(result.shipmentDraft.parcel?.weightKg).toBe(5);
    });
    
    it('should preserve existing parcel fields when new input partial', () => {
      const existing: ShipmentDraft = {
        recipient: { country: 'IT' },
        parcel: {
          weightKg: 3,
          lengthCm: 30,
          widthCm: 20,
          heightCm: 15,
        },
        missingFields: [],
      };
      
      // Input con indirizzo
      const result = processAddressSync('20100 Milano MI', existing);
      
      // Dati pacco NON cancellati
      expect(result.shipmentDraft.parcel?.weightKg).toBe(3);
      expect(result.shipmentDraft.parcel?.lengthCm).toBe(30);
      expect(result.shipmentDraft.parcel?.widthCm).toBe(20);
      expect(result.shipmentDraft.parcel?.heightCm).toBe(15);
      // Nuovi dati indirizzo aggiunti
      expect(result.shipmentDraft.recipient?.postalCode).toBe('20100');
      expect(result.shipmentDraft.recipient?.province).toBe('MI');
    });
    
    it('should NOT delete fields when input does not contain them', () => {
      const existing = createCompleteShipmentDraft();
      
      // Input generico che non estrae nulla di nuovo
      const result = processAddressSync('ok grazie', existing);
      
      // Tutti i dati esistenti preservati
      expect(result.shipmentDraft.recipient?.fullName).toBe('Mario Rossi');
      expect(result.shipmentDraft.recipient?.postalCode).toBe('20100');
      expect(result.shipmentDraft.recipient?.province).toBe('MI');
      expect(result.shipmentDraft.parcel?.weightKg).toBe(5);
    });
    
    it('should work with undefined existing draft', () => {
      const result = processAddressSync('20100 Milano MI peso 5kg', undefined);
      
      expect(result.shipmentDraft.recipient?.postalCode).toBe('20100');
      expect(result.shipmentDraft.recipient?.province).toBe('MI');
      expect(result.shipmentDraft.parcel?.weightKg).toBe(5);
    });
  });
  
  describe('clarificationQuestion generation', () => {
    it('should generate clarification when CAP missing', () => {
      const result = processAddressSync('peso 5 kg');
      
      expect(result.clarificationQuestion).toBeDefined();
      expect(result.clarificationQuestion).toContain('CAP');
    });
    
    it('should generate clarification when province missing', () => {
      const result = processAddressSync('20100 Milano peso 5kg');
      
      expect(result.clarificationQuestion).toBeDefined();
      expect(result.clarificationQuestion).toContain('provincia');
    });
    
    it('should generate clarification when weight missing', () => {
      const result = processAddressSync('20100 Milano MI');
      
      expect(result.clarificationQuestion).toBeDefined();
      expect(result.clarificationQuestion).toContain('peso');
    });
    
    it('should NOT generate clarification when all data present', () => {
      const result = processAddressSync('20100 Milano MI peso 5 kg');
      
      expect(result.clarificationQuestion).toBeUndefined();
    });
    
    it('should format single missing field correctly', () => {
      const existing: ShipmentDraft = {
        recipient: { country: 'IT', postalCode: '20100', province: 'MI' },
        parcel: {},
        missingFields: [],
      };
      
      const result = processAddressSync('ok', existing);
      
      // Solo peso manca
      expect(result.clarificationQuestion).toContain('**peso');
      expect(result.clarificationQuestion).toMatch(/mi serve ancora/i);
    });
    
    it('should format two missing fields with "e"', () => {
      const existing: ShipmentDraft = {
        recipient: { country: 'IT', postalCode: '20100' },
        parcel: {},
        missingFields: [],
      };
      
      const result = processAddressSync('ok', existing);
      
      // Mancano provincia e peso
      expect(result.clarificationQuestion).toContain(' e ');
    });
    
    it('should format multiple missing fields with commas', () => {
      const result = processAddressSync('ciao');
      
      // Mancano CAP, provincia, peso
      expect(result.clarificationQuestion).toMatch(/,.*,.*e/);
    });
  });
  
  describe('nextStep logic', () => {
    it('should return pricing_worker when enough data', () => {
      const result = processAddressSync('20100 Milano MI peso 5 kg');
      
      expect(result.nextStep).toBe('pricing_worker');
    });
    
    it('should return END when data incomplete', () => {
      const result = processAddressSync('ciao');
      
      expect(result.nextStep).toBe('END');
    });
    
    it('should return pricing_worker when existing draft has all data', () => {
      const existing = createCompleteShipmentDraft();
      const result = processAddressSync('ok', existing);
      
      expect(result.nextStep).toBe('pricing_worker');
    });
  });
  
  describe('addressNormalized flag', () => {
    it('should be true when something extracted', () => {
      const result = processAddressSync('20100 Milano');
      
      expect(result.addressNormalized).toBe(true);
    });
    
    it('should be false when nothing extracted', () => {
      const result = processAddressSync('ciao come stai');
      
      expect(result.addressNormalized).toBe(false);
    });
  });
});

// ==================== addressWorker (async) TESTS ====================

describe('addressWorker', () => {
  it('should update shipmentDraft in state', async () => {
    const state = createMockAgentState({
      messages: [new HumanMessage('Spedire a 20100 Milano MI peso 5 kg')],
    });
    
    const result = await addressWorker(state);
    
    expect(result.shipmentDraft).toBeDefined();
    expect(result.shipmentDraft?.recipient?.postalCode).toBe('20100');
    expect(result.shipmentDraft?.recipient?.province).toBe('MI');
    expect(result.shipmentDraft?.parcel?.weightKg).toBe(5);
  });
  
  it('should set next_step to pricing_worker when data complete', async () => {
    const state = createMockAgentState({
      messages: [new HumanMessage('20100 Milano MI peso 5 kg')],
    });
    
    const result = await addressWorker(state);
    
    expect(result.next_step).toBe('pricing_worker');
    expect(result.processingStatus).toBe('calculating');
  });
  
  it('should set next_step to END with clarification when data incomplete', async () => {
    const state = createMockAgentState({
      messages: [new HumanMessage('ciao')],
    });
    
    const result = await addressWorker(state);
    
    expect(result.next_step).toBe('END');
    expect(result.clarification_request).toBeDefined();
    expect(result.processingStatus).toBe('idle');
  });
  
  it('should merge with existing shipmentDraft', async () => {
    const existing: ShipmentDraft = {
      recipient: {
        country: 'IT',
        fullName: 'Mario Rossi',
        postalCode: '20100',
        province: 'MI',
      },
      parcel: {},
      missingFields: ['parcel.weightKg'],
    };
    
    const state = createMockAgentState({
      shipmentDraft: existing,
      messages: [new HumanMessage('peso 5 kg')],
    });
    
    const result = await addressWorker(state);
    
    // Existing data preserved
    expect(result.shipmentDraft?.recipient?.fullName).toBe('Mario Rossi');
    expect(result.shipmentDraft?.recipient?.postalCode).toBe('20100');
    // New data added
    expect(result.shipmentDraft?.parcel?.weightKg).toBe(5);
    // Ready for pricing
    expect(result.next_step).toBe('pricing_worker');
  });
  
  it('should sync shipment_details for pricing worker compatibility', async () => {
    const state = createMockAgentState({
      messages: [new HumanMessage('20100 Milano MI peso 5 kg')],
    });
    
    const result = await addressWorker(state);
    
    expect(result.shipment_details).toBeDefined();
    expect(result.shipment_details?.weight).toBe(5);
    expect(result.shipment_details?.destinationZip).toBe('20100');
    expect(result.shipment_details?.destinationProvince).toBe('MI');
  });
  
  it('should handle empty message', async () => {
    const state = createMockAgentState({
      messages: [new HumanMessage('')],
    });
    
    const result = await addressWorker(state);
    
    expect(result.next_step).toBe('END');
    expect(result.clarification_request).toBeDefined();
    expect(result.clarification_request).toContain('CAP');
  });
  
  it('should handle missing messages array', async () => {
    const state = createMockAgentState({
      messages: [],
    });
    
    const result = await addressWorker(state);
    
    expect(result.next_step).toBe('END');
    expect(result.clarification_request).toBeDefined();
  });
});

// ==================== EDGE CASES ====================

describe('Edge Cases', () => {
  describe('Input normalization', () => {
    it('should handle lowercase province', () => {
      const result = processAddressSync('20100 Milano mi peso 5kg');
      
      expect(result.shipmentDraft.recipient?.province).toBe('MI');
    });
    
    it('should handle mixed case city', () => {
      const result = processAddressSync('20100 MILANO MI peso 5kg');
      
      expect(result.shipmentDraft.recipient?.city).toBe('Milano');
    });
    
    it('should handle extra spaces', () => {
      const result = processAddressSync('  20100   Milano   MI   peso  5  kg  ');
      
      expect(result.shipmentDraft.recipient?.postalCode).toBe('20100');
      expect(result.shipmentDraft.recipient?.province).toBe('MI');
      expect(result.shipmentDraft.parcel?.weightKg).toBe(5);
    });
  });
  
  describe('Invalid input handling', () => {
    it('should handle CAP with wrong length', () => {
      // 4 cifre, non valido
      const result = processAddressSync('2010 Milano MI peso 5kg');
      
      expect(result.shipmentDraft.recipient?.postalCode).toBeUndefined();
      expect(result.missingFields).toContain('recipient.postalCode');
    });
    
    it('should reject invalid province code', () => {
      // XX non è una provincia valida
      const result = processAddressSync('20100 Milano XX peso 5kg');
      
      // XX non matchato, cerca altro pattern
      expect(result.shipmentDraft.recipient?.province).toBeUndefined();
    });
    
    it('should handle weight with comma decimal', () => {
      const result = processAddressSync('20100 Milano MI peso 2,5kg');
      
      expect(result.shipmentDraft.parcel?.weightKg).toBe(2.5);
    });
  });
  
  describe('Incremental data collection', () => {
    it('should collect data across multiple messages', () => {
      // Primo messaggio: solo CAP e città
      let result = processAddressSync('20100 Milano');
      
      expect(result.missingFields).toContain('recipient.province');
      expect(result.missingFields).toContain('parcel.weightKg');
      
      // Secondo messaggio: provincia
      result = processAddressSync('provincia MI', result.shipmentDraft);
      
      expect(result.shipmentDraft.recipient?.province).toBe('MI');
      expect(result.missingFields).not.toContain('recipient.province');
      expect(result.missingFields).toContain('parcel.weightKg');
      
      // Terzo messaggio: peso
      result = processAddressSync('peso 5 kg', result.shipmentDraft);
      
      expect(result.shipmentDraft.parcel?.weightKg).toBe(5);
      expect(result.missingFields).toHaveLength(0);
      expect(result.nextStep).toBe('pricing_worker');
    });
    
    it('should allow updating existing fields', () => {
      const existing: ShipmentDraft = {
        recipient: { country: 'IT', postalCode: '20100', province: 'MI' },
        parcel: { weightKg: 3 },
        missingFields: [],
      };
      
      // Utente corregge il peso
      const result = processAddressSync('no scusa, peso 5 kg', existing);
      
      // Peso aggiornato
      expect(result.shipmentDraft.parcel?.weightKg).toBe(5);
      // Altri dati preservati
      expect(result.shipmentDraft.recipient?.postalCode).toBe('20100');
    });
  });
  
  describe('Complex real-world inputs', () => {
    it('should handle OCR-like text', () => {
      const ocrText = `
        Destinatario: Mario Rossi
        Via Roma 123
        20100 Milano MI
        Tel: 333 1234567
        Peso: 2,5 kg
      `;
      
      const result = processAddressSync(ocrText);
      
      expect(result.shipmentDraft.recipient?.postalCode).toBe('20100');
      expect(result.shipmentDraft.recipient?.province).toBe('MI');
      expect(result.shipmentDraft.recipient?.city).toBe('Milano');
      expect(result.shipmentDraft.parcel?.weightKg).toBe(2.5);
      expect(result.nextStep).toBe('pricing_worker');
    });
    
    it('should handle conversational input', () => {
      // Formato chiaro con provincia isolata
      const input = 'pacco 3 chili Roma 00100 RM';
      
      const result = processAddressSync(input);
      
      expect(result.shipmentDraft.recipient?.postalCode).toBe('00100');
      expect(result.shipmentDraft.recipient?.province).toBe('RM');
      expect(result.shipmentDraft.recipient?.city).toBe('Roma');
      expect(result.shipmentDraft.parcel?.weightKg).toBe(3);
    });
    
    it('should handle verbose conversational input with province after è', () => {
      // Questo è un caso limite: "provincia è RM" - il regex \b non cattura dopo "è"
      const input = 'cap è 00100, provincia RM';
      
      const result = processAddressSync(input);
      
      expect(result.shipmentDraft.recipient?.postalCode).toBe('00100');
      // La provincia dovrebbe essere estratta
      expect(result.shipmentDraft.recipient?.province).toBe('RM');
    });
    
    it('should handle abbreviated input', () => {
      const input = 'MI 20100 5kg';
      
      const result = processAddressSync(input);
      
      expect(result.shipmentDraft.recipient?.postalCode).toBe('20100');
      expect(result.shipmentDraft.recipient?.province).toBe('MI');
      expect(result.shipmentDraft.parcel?.weightKg).toBe(5);
    });
  });
});

