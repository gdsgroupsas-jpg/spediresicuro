/**
 * Integration Tests: Shipment Lifecycle (Create + Cancel)
 * 
 * ⚠️ IMPORTANT: These tests create REAL shipments on external APIs.
 * They are SKIPPED by default unless RUN_SHIPMENT_LIFECYCLE_TESTS=true
 * 
 * Test cases:
 * 1. Create shipment on Spedisci.Online → Verify PDF → Cancel
 * 2. Create shipment on Poste Italiane → Verify PDF → Cancel (when implemented)
 * 3. Create shipment on GLS → Verify PDF → Cancel (when implemented)
 * 4. Create shipment on BRT → Verify PDF → Cancel (when implemented)
 * 
 * Run manually with:
 *   RUN_SHIPMENT_LIFECYCLE_TESTS=true npm run test:integration -- tests/integration/shipment-lifecycle.test.ts
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SpedisciOnlineAdapter } from '@/lib/adapters/couriers/spedisci-online';

// ==================== TEST CONFIGURATION ====================

const SHOULD_RUN = process.env.RUN_SHIPMENT_LIFECYCLE_TESTS === 'true';

// Test shipment data (indirizzo fittizio ma valido per test)
const TEST_SHIPMENT_DATA = {
  sender_name: 'Test SpedireSicuro',
  sender_address: 'Via Test 1',
  sender_city: 'Milano',
  sender_zip: '20100',
  sender_province: 'MI',
  sender_phone: '+39 02 1234567',
  sender_email: 'test@spediresicuro.test',
  recipient_name: 'Destinatario Test',
  recipient_address: 'Via Destinazione 2',
  recipient_city: 'Roma',
  recipient_zip: '00100',
  recipient_province: 'RM',
  recipient_phone: '+39 06 7654321',
  recipient_email: 'dest@test.test',
  weight: 1,
  length: 20,
  width: 15,
  height: 10,
  notes: 'TEST - DA CANCELLARE AUTOMATICAMENTE',
  codValue: 0,
  corriere: 'postedeliverybusiness', // Verrà mappato al contratto configurato
};

// ==================== SPEDISCI.ONLINE TESTS ====================

describe.skipIf(!SHOULD_RUN)('Shipment Lifecycle: Spedisci.Online', () => {
  let adapter: SpedisciOnlineAdapter;
  let createdShipmentId: string | undefined;
  let createdTrackingNumber: string | undefined;

  beforeAll(async () => {
    // Verifica che le credenziali siano configurate
    const apiKey = process.env.SPEDISCI_ONLINE_API_KEY;
    const baseUrl = process.env.SPEDISCI_ONLINE_BASE_URL || 'https://infinity.spedisci.online/api/v2/';
    const contractMapping = process.env.SPEDISCI_ONLINE_CONTRACT_MAPPING 
      ? JSON.parse(process.env.SPEDISCI_ONLINE_CONTRACT_MAPPING)
      : {
          // Default per test - usa il contratto corretto con tripli trattini
          'postedeliverybusiness-SDA---Express---H24+': 'PosteDeliveryBusiness'
        };

    if (!apiKey) {
      throw new Error('SPEDISCI_ONLINE_API_KEY non configurata. Imposta la variabile d\'ambiente.');
    }

    adapter = new SpedisciOnlineAdapter({
      api_key: apiKey,
      base_url: baseUrl,
      contract_mapping: contractMapping,
    });
  });

  afterAll(async () => {
    // ⚠️ CLEANUP AUTOMATICO: Cancella la spedizione se è stata creata
    if (createdShipmentId || createdTrackingNumber) {
      console.log('🧹 [CLEANUP] Cancellazione spedizione di test...');
      
      try {
        // Prova prima con shipmentId (più affidabile)
        const idToCancel = createdShipmentId || createdTrackingNumber!;
        const result = await adapter.cancelShipmentOnPlatform(idToCancel);
        
        if (result.success) {
          console.log('✅ [CLEANUP] Spedizione cancellata:', result.message);
        } else {
          console.error('❌ [CLEANUP] Errore cancellazione:', result.error);
          // Non fallire il test per errori di cleanup, ma logga chiaramente
          console.warn('⚠️ [CLEANUP] La spedizione potrebbe richiedere cancellazione manuale:', {
            shipmentId: createdShipmentId,
            trackingNumber: createdTrackingNumber,
          });
        }
      } catch (error) {
        console.error('❌ [CLEANUP] Eccezione durante cancellazione:', error);
      }
    }
  });

  it('should create a shipment with PDF label and then cancel it', async () => {
    // ==================== FASE 1: CREAZIONE ====================
    console.log('📦 [TEST] Creazione spedizione di test...');

    const result = await adapter.createShipment(TEST_SHIPMENT_DATA);

    // Verifica risultato creazione
    expect(result).toBeDefined();
    expect(result.tracking_number).toBeDefined();
    expect(result.tracking_number.length).toBeGreaterThan(0);

    // Salva per cleanup (in caso di fallimento prima della cancellazione)
    createdTrackingNumber = result.tracking_number;
    createdShipmentId = result.shipmentId || result.metadata?.shipmentId || result.metadata?.increment_id;

    console.log('✅ [TEST] Spedizione creata:', {
      tracking: createdTrackingNumber,
      shipmentId: createdShipmentId,
      hasLabel: !!result.label_pdf,
      labelSize: result.label_pdf?.length,
    });

    // Verifica che abbiamo il PDF
    expect(result.label_pdf).toBeDefined();
    expect(result.label_pdf instanceof Buffer).toBe(true);
    expect(result.label_pdf!.length).toBeGreaterThan(1000); // PDF dovrebbe essere > 1KB

    // Verifica che abbiamo l'ID per cancellazione
    expect(createdShipmentId).toBeDefined();
    expect(createdShipmentId!.length).toBeGreaterThan(0);

    // ==================== FASE 2: CANCELLAZIONE ====================
    console.log('🗑️ [TEST] Cancellazione spedizione...');

    const idToCancel = createdShipmentId || createdTrackingNumber!;
    const cancelResult = await adapter.cancelShipmentOnPlatform(idToCancel);

    console.log('📋 [TEST] Risultato cancellazione:', cancelResult);

    expect(cancelResult.success).toBe(true);
    expect(cancelResult.message).toBeDefined();

    console.log('✅ [TEST] Spedizione creata E cancellata con successo!');

    // Resetta per evitare doppia cancellazione in afterAll
    createdShipmentId = undefined;
    createdTrackingNumber = undefined;
  }, 30000); // Timeout 30s per creazione + cancellazione
});

// ==================== FUTURE: POSTE ITALIANE TESTS ====================

describe.skip('Shipment Lifecycle: Poste Italiane (TODO)', () => {
  it('should create and cancel shipment', async () => {
    // TODO: Implementare quando PosteAdapter avrà cancelShipment
  });
});

// ==================== FUTURE: GLS TESTS ====================

describe.skip('Shipment Lifecycle: GLS (TODO)', () => {
  it('should create and cancel shipment', async () => {
    // TODO: Implementare quando GLS adapter sarà disponibile
  });
});

// ==================== FUTURE: BRT TESTS ====================

describe.skip('Shipment Lifecycle: BRT (TODO)', () => {
  it('should create and cancel shipment', async () => {
    // TODO: Implementare quando BRT adapter sarà disponibile
  });
});
