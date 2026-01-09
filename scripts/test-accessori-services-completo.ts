/**
 * 🔬 SCRIPT DI TEST METICOLOSO - Servizi Accessori Spedisci.Online
 * 
 * ⚠️⚠️⚠️ ATTENZIONE CRITICA ⚠️⚠️⚠️
 * 
 * QUESTO SCRIPT CREA SPEDIZIONI REALI!
 * Ogni test chiama POST /api/v2/shipping/create e crea una spedizione vera.
 * 
 * ⚠️ NON USARE IN PRODUZIONE SENZA SUPERVISIONE!
 * ⚠️ Le spedizioni create vanno poi cancellate manualmente!
 * 
 * Questo script prova TUTTI i formati possibili per accessoriServices
 * nell'endpoint POST /api/v2/shipping/create
 * 
 * Esegui con: 
 *   npx ts-node --project tsconfig.scripts.json scripts/test-accessori-services-completo.ts
 * 
 * Modalità DRY-RUN (non crea spedizioni reali):
 *   npx ts-node --project tsconfig.scripts.json scripts/test-accessori-services-completo.ts --dry-run
 */

import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';

// ⚠️ FLAG DRY-RUN: Se true, NON crea spedizioni reali (solo testa formati)
const DRY_RUN = process.argv.includes('--dry-run') || process.argv.includes('-d');

// ⚠️ CONFIGURAZIONE: Modifica questi valori per il tuo test
const TEST_CONFIG = {
  // Usa un indirizzo reale che funziona con il tuo contratto
  shipFrom: {
    name: 'Test Mittente',
    company: 'Test Company',
    street1: 'Via Roma 1',
    street2: '',
    city: 'Striano',
    state: 'NA',
    postalCode: '80040',
    country: 'IT',
    phone: null,
    email: 'test@example.com',
  },
  shipTo: {
    name: 'Test Destinatario',
    company: '',
    street1: 'Via Napoli 1',
    street2: '',
    city: 'Sarno',
    state: 'SA',
    postalCode: '84087',
    country: 'IT',
    phone: null,
    email: 'dest@example.com',
  },
  packages: [{
    length: 30,
    width: 20,
    height: 15,
    weight: 1,
  }],
  carrierCode: 'gls', // Modifica se necessario
  contractCode: 'gls-GLS-5000', // Modifica con il tuo contratto
  notes: 'Test servizi accessori',
  insuranceValue: 0,
  codValue: 0,
};

// 🎯 FORMATI DA TESTARE (TUTTI i possibili)
const FORMATI_DA_TESTARE = [
  // === FORMATO 1: Array di stringhe semplici ===
  { name: 'string[] - ["Exchange"]', format: ['Exchange'] },
  { name: 'string[] - ["exchange"]', format: ['exchange'] },
  { name: 'string[] - ["EXCHANGE"]', format: ['EXCHANGE'] },
  { name: 'string[] - ["GLS_Exchange"]', format: ['GLS_Exchange'] },
  { name: 'string[] - ["gls-exchange"]', format: ['gls-exchange'] },
  { name: 'string[] - ["Exchange", "COD"]', format: ['Exchange', 'COD'] },
  
  // === FORMATO 2: Array di oggetti con {name} ===
  { name: 'object[] - [{name: "Exchange"}]', format: [{ name: 'Exchange' }] },
  { name: 'object[] - [{name: "exchange"}]', format: [{ name: 'exchange' }] },
  { name: 'object[] - [{name: "Exchange", value: "Exchange"}]', format: [{ name: 'Exchange', value: 'Exchange' }] },
  
  // === FORMATO 3: Array di oggetti con {code} ===
  { name: 'object[] - [{code: "Exchange"}]', format: [{ code: 'Exchange' }] },
  { name: 'object[] - [{code: "EXC"}]', format: [{ code: 'EXC' }] },
  { name: 'object[] - [{code: "exchange"}]', format: [{ code: 'exchange' }] },
  
  // === FORMATO 4: Array di oggetti con {service} ===
  { name: 'object[] - [{service: "Exchange"}]', format: [{ service: 'Exchange' }] },
  { name: 'object[] - [{service: "exchange"}]', format: [{ service: 'exchange' }] },
  
  // === FORMATO 5: Array di oggetti con {id} ===
  { name: 'object[] - [{id: "Exchange"}]', format: [{ id: 'Exchange' }] },
  { name: 'object[] - [{id: "1"}]', format: [{ id: '1' }] },
  { name: 'object[] - [{id: 1}]', format: [{ id: 1 }] },
  
  // === FORMATO 6: Array di oggetti con {value} ===
  { name: 'object[] - [{value: "Exchange"}]', format: [{ value: 'Exchange' }] },
  { name: 'object[] - [{value: "exchange"}]', format: [{ value: 'exchange' }] },
  
  // === FORMATO 7: Array di oggetti con {type} ===
  { name: 'object[] - [{type: "Exchange"}]', format: [{ type: 'Exchange' }] },
  { name: 'object[] - [{type: "exchange"}]', format: [{ type: 'exchange' }] },
  
  // === FORMATO 8: Array di oggetti con {key} ===
  { name: 'object[] - [{key: "Exchange"}]', format: [{ key: 'Exchange' }] },
  { name: 'object[] - [{key: "exchange"}]', format: [{ key: 'exchange' }] },
  
  // === FORMATO 9: Array di oggetti con {label} ===
  { name: 'object[] - [{label: "Exchange"}]', format: [{ label: 'Exchange' }] },
  
  // === FORMATO 10: Array di oggetti con {slug} ===
  { name: 'object[] - [{slug: "Exchange"}]', format: [{ slug: 'Exchange' }] },
  { name: 'object[] - [{slug: "exchange"}]', format: [{ slug: 'exchange' }] },
  
  // === FORMATO 11: Oggetti con più proprietà ===
  { name: 'object[] - [{name: "Exchange", code: "EXC"}]', format: [{ name: 'Exchange', code: 'EXC' }] },
  { name: 'object[] - [{code: "EXC", value: "Exchange"}]', format: [{ code: 'EXC', value: 'Exchange' }] },
  { name: 'object[] - [{id: 1, name: "Exchange"}]', format: [{ id: 1, name: 'Exchange' }] },
  
  // === FORMATO 12: Edge cases ===
  { name: 'object[] - [{}]', format: [{}] }, // Oggetto vuoto
  { name: 'object[] - [{service: null}]', format: [{ service: null }] },
  { name: 'object[] - [{service: ""}]', format: [{ service: '' }] },
  
  // === FORMATO 13: ID NUMERICI REALI (dal pannello Spedisci.Online) ===
  // ⚠️ IMPORTANTE: I servizi accessori usano ID numerici, non nomi!
  // Exchange = 200001, Document Return = 200002, Saturday Service = 200003, etc.
  { name: 'number[] - [200001] (Exchange)', format: [200001] },
  { name: 'number[] - [200002] (Document Return)', format: [200002] },
  { name: 'number[] - [200003] (Saturday Service)', format: [200003] },
  { name: 'number[] - [200004] (Express12)', format: [200004] },
  { name: 'number[] - [200005] (Preavviso Telefonico)', format: [200005] },
  { name: 'number[] - [200001, 200002] (Multi)', format: [200001, 200002] },
  
  // Stringhe numeriche
  { name: 'string[] - ["200001"] (Exchange)', format: ['200001'] },
  { name: 'string[] - ["200002"] (Document Return)', format: ['200002'] },
  { name: 'string[] - ["200001", "200002"] (Multi)', format: ['200001', '200002'] },
  
  // Oggetti con ID numerico
  { name: 'object[] - [{id: 200001}] (Exchange)', format: [{ id: 200001 }] },
  { name: 'object[] - [{id: 200002}] (Document Return)', format: [{ id: 200002 }] },
  { name: 'object[] - [{value: 200001}] (Exchange)', format: [{ value: 200001 }] },
  { name: 'object[] - [{value: "200001"}] (Exchange string)', format: [{ value: '200001' }] },
  { name: 'object[] - [{code: 200001}] (Exchange)', format: [{ code: 200001 }] },
  { name: 'object[] - [{service_id: 200001}] (Exchange)', format: [{ service_id: 200001 }] },
  { name: 'object[] - [{vector_service_id: 200001}] (Exchange)', format: [{ vector_service_id: 200001 }] },
  
  // Array di numeri generici (per confronto)
  { name: 'number[] - [1]', format: [1] },
  { name: 'number[] - [2]', format: [2] },
  { name: 'string[] - ["1"]', format: ['1'] },
  
  // === FORMATO 14: Altri nomi servizi comuni ===
  { name: 'string[] - ["COD"]', format: ['COD'] },
  { name: 'string[] - ["cod"]', format: ['cod'] },
  { name: 'string[] - ["Insurance"]', format: ['Insurance'] },
  { name: 'string[] - ["Return"]', format: ['Return'] },
  { name: 'string[] - ["SaturdayDelivery"]', format: ['SaturdayDelivery'] },
  { name: 'string[] - ["Signature"]', format: ['Signature'] },
  { name: 'object[] - [{name: "COD"}]', format: [{ name: 'COD' }] },
  { name: 'object[] - [{code: "COD"}]', format: [{ code: 'COD' }] },
  { name: 'object[] - [{service: "COD"}]', format: [{ service: 'COD' }] },
  
  // === FORMATO 15: Formati con array annidati (edge case) ===
  { name: 'nested[] - [["Exchange"]]', format: [['Exchange']] },
  { name: 'nested[] - [[{name: "Exchange"}]]', format: [[{ name: 'Exchange' }]] },
  
  // === FORMATO 16: Array vuoto (baseline) ===
  { name: '[] - Array vuoto (baseline)', format: [] },
];

interface TestResult {
  formatName: string;
  format: any;
  success: boolean;
  status?: number;
  error?: string;
  response?: any;
  hasTracking?: boolean;
  hasLabel?: boolean;
  shipmentId?: number;
  trackingNumber?: string;
}

// ⚠️ TRACCIAMENTO SPEDIZIONI CREATE: Per cleanup automatico
interface CreatedShipment {
  shipmentId: number;
  trackingNumber?: string;
  formatName: string;
  createdAt: Date;
}

const createdShipments: CreatedShipment[] = [];

/**
 * Recupera credenziali Spedisci.Online dal database
 */
async function getCredentials(): Promise<{
  apiKey: string;
  baseUrl: string;
  contractCode: string;
} | null> {
  // Import dinamico per evitare problemi con path resolution
  const { decryptCredential, isEncrypted } = await import('../lib/security/encryption');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variabili ambiente Supabase mancanti');
    return null;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Recupera prima configurazione attiva Spedisci.Online
  const { data: configs, error } = await supabase
    .from('courier_configs')
    .select('*')
    .eq('provider_id', 'spedisci_online')
    .eq('is_active', true)
    .limit(1);

  if (error || !configs || configs.length === 0) {
    console.error('❌ Nessuna configurazione Spedisci.Online attiva trovata');
    return null;
  }

  const config = configs[0];
  let apiKey = config.credentials?.api_key || (config as any).api_key;

  if (!apiKey) {
    console.error('❌ API key non trovata nella configurazione');
    return null;
  }

  // Decripta se necessario
  if (isEncrypted(apiKey)) {
    try {
      apiKey = decryptCredential(apiKey);
    } catch (e: any) {
      console.error('❌ Errore decriptazione API key:', e.message);
      return null;
    }
  }

  const baseUrl = config.credentials?.base_url || config.base_url || 'https://infinity.spedisci.online/api/v2';
  const contractMapping = config.credentials?.contract_mapping || config.contract_mapping || {};
  
  // Usa il primo contratto disponibile o quello di test
  const contractCode = TEST_CONFIG.contractCode || Object.values(contractMapping)[0] as string || 'gls-GLS-5000';

  return { apiKey, baseUrl, contractCode };
}

/**
 * Testa un formato specifico di accessoriServices
 */
async function testFormat(
  apiKey: string,
  baseUrl: string,
  contractCode: string,
  formatName: string,
  format: any
): Promise<TestResult> {
  const url = `${baseUrl}/shipping/create`;

  const payload = {
    carrierCode: TEST_CONFIG.carrierCode,
    contractCode: contractCode,
    packages: TEST_CONFIG.packages,
    shipFrom: TEST_CONFIG.shipFrom,
    shipTo: TEST_CONFIG.shipTo,
    notes: TEST_CONFIG.notes,
    insuranceValue: TEST_CONFIG.insuranceValue,
    codValue: TEST_CONFIG.codValue,
    accessoriServices: format,
    label_format: 'PDF',
  };

  const startTime = Date.now();

  // ⚠️ DRY-RUN: Se attivo, simula risposta senza chiamare API
  if (DRY_RUN) {
    console.log(`   [DRY-RUN] Simulazione chiamata API con formato: ${formatName}`);
    // Simula risposta di successo per testare la logica
    return {
      formatName,
      format,
      success: true,
      status: 200,
      response: { trackingNumber: 'DRY-RUN-TEST', shipmentId: 999999 },
      hasTracking: true,
      hasLabel: true,
      shipmentId: 999999,
      trackingNumber: 'DRY-RUN-TEST',
    };
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseTime = Date.now() - startTime;
    const responseText = await response.text();

    let responseData: any = null;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { raw: responseText };
    }

    if (response.ok) {
      const hasTracking = !!responseData.trackingNumber || !!responseData.tracking_number;
      const hasLabel = !!responseData.labelData || !!responseData.label_data || !!responseData.label_pdf;
      const shipmentId = responseData.shipmentId || responseData.shipment_id;
      const trackingNumber = responseData.trackingNumber || responseData.tracking_number;

      // ⚠️ SALVA SPEDIZIONE CREATA per cleanup automatico
      if (shipmentId && !DRY_RUN) {
        createdShipments.push({
          shipmentId: typeof shipmentId === 'number' ? shipmentId : parseInt(String(shipmentId), 10),
          trackingNumber,
          formatName,
          createdAt: new Date(),
        });
        console.log(`   💾 [CLEANUP] Spedizione tracciata per cleanup: ID=${shipmentId}, Tracking=${trackingNumber || 'N/A'}`);
      }

      return {
        formatName,
        format,
        success: true,
        status: response.status,
        response: responseData,
        hasTracking,
        hasLabel,
        shipmentId,
        trackingNumber,
      };
    } else {
      const errorMessage = responseData.error || responseData.message || responseText.substring(0, 200);
      
      return {
        formatName,
        format,
        success: false,
        status: response.status,
        error: errorMessage,
        response: responseData,
      };
    }
  } catch (error: any) {
    return {
      formatName,
      format,
      success: false,
      error: error.message || 'Errore di connessione',
    };
  }
}

/**
 * 🗑️ CLEANUP AUTOMATICO: Cancella tutte le spedizioni create durante i test
 */
async function cleanupCreatedShipments(
  apiKey: string,
  baseUrl: string
): Promise<void> {
  if (DRY_RUN || createdShipments.length === 0) {
    return; // Nessuna spedizione da cancellare
  }

  console.log('');
  console.log('═'.repeat(80));
  console.log('🗑️  CLEANUP AUTOMATICO - Cancellazione spedizioni create');
  console.log('═'.repeat(80));
  console.log(`   Totale spedizioni da cancellare: ${createdShipments.length}`);
  console.log('');

  let successCount = 0;
  let failureCount = 0;

  for (const shipment of createdShipments) {
    try {
      // Usa POST /shipping/delete con increment_id
      const deleteUrl = `${baseUrl}/shipping/delete`;
      
      console.log(`   🗑️  Cancellazione: ID=${shipment.shipmentId}, Tracking=${shipment.trackingNumber || 'N/A'}, Format=${shipment.formatName}`);

      const response = await fetch(deleteUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          increment_id: shipment.shipmentId,
        }),
      });

      if (response.ok) {
        successCount++;
        console.log(`      ✅ Cancellata con successo`);
      } else {
        failureCount++;
        const errorText = await response.text();
        console.log(`      ❌ Fallita: HTTP ${response.status} - ${errorText.substring(0, 100)}`);
      }

      // Pausa breve per non sovraccaricare API
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error: any) {
      failureCount++;
      console.log(`      ❌ Errore: ${error.message}`);
    }
  }

  console.log('');
  console.log('═'.repeat(80));
  console.log(`📊 CLEANUP COMPLETATO: ${successCount} successi, ${failureCount} falliti`);
  console.log('═'.repeat(80));
  
  if (failureCount > 0) {
    console.log('');
    console.log('⚠️  ATTENZIONE: Alcune spedizioni potrebbero non essere state cancellate.');
    console.log('   Verifica manualmente nel dashboard e cancella se necessario.');
    console.log('');
    console.log('   Spedizioni da verificare:');
    createdShipments.forEach(s => {
      console.log(`   - ID: ${s.shipmentId}, Tracking: ${s.trackingNumber || 'N/A'}, Format: ${s.formatName}`);
    });
  }
}

/**
 * Funzione principale
 */
async function main() {
  console.log('═'.repeat(80));
  console.log('🔬 TEST METICOLOSO - Servizi Accessori Spedisci.Online');
  console.log('═'.repeat(80));
  console.log('');
  if (DRY_RUN) {
    console.log('🔒 MODALITÀ DRY-RUN ATTIVA - Nessuna spedizione reale verrà creata');
    console.log('');
  } else {
    console.log('⚠️⚠️⚠️  ATTENZIONE: QUESTO SCRIPT CREA SPEDIZIONI REALI!  ⚠️⚠️⚠️');
    console.log('');
    console.log('Ogni test chiama POST /shipping/create e crea una spedizione vera.');
    console.log('Le spedizioni create vanno poi cancellate manualmente dal dashboard.');
    console.log('');
    console.log('💡 Usa --dry-run per testare senza creare spedizioni reali');
    console.log('');
    console.log('Premi CTRL+C per annullare, oppure attendi 5 secondi per continuare...');
    console.log('');
    
    // Pausa di sicurezza
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
  
  console.log('═'.repeat(80));
  console.log('');

  // 1. Recupera credenziali
  console.log('📋 Step 1: Recupero credenziali...');
  const credentials = await getCredentials();
  
  if (!credentials) {
    console.error('❌ Impossibile recuperare credenziali. Verifica configurazione.');
    process.exit(1);
  }

  console.log(`   ✅ API Key trovata (primi 15 char: ${credentials.apiKey.substring(0, 15)}...)`);
  console.log(`   ✅ Base URL: ${credentials.baseUrl}`);
  console.log(`   ✅ Contract Code: ${credentials.contractCode}`);
  console.log('');

  // 2. Test baseline (senza servizi)
  console.log('📋 Step 2: Test baseline (senza servizi accessori)...');
  const baseline = await testFormat(
    credentials.apiKey,
    credentials.baseUrl,
    credentials.contractCode,
    'BASELINE - []',
    []
  );

  if (!baseline.success) {
    console.error(`   ❌ Baseline fallito: ${baseline.error}`);
    console.error('   ⚠️  Se il baseline fallisce, verifica credenziali e contratto!');
    process.exit(1);
  }

  console.log(`   ✅ Baseline OK - Status: ${baseline.status}, Tracking: ${baseline.hasTracking ? 'SÌ' : 'NO'}, Label: ${baseline.hasLabel ? 'SÌ' : 'NO'}`);
  console.log('');

  // 3. Test tutti i formati
  console.log('📋 Step 3: Test di TUTTI i formati possibili...');
  console.log(`   Totale formati da testare: ${FORMATI_DA_TESTARE.length}`);
  console.log('');

  const results: TestResult[] = [];
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < FORMATI_DA_TESTARE.length; i++) {
    const formato = FORMATI_DA_TESTARE[i];
    const progress = `[${i + 1}/${FORMATI_DA_TESTARE.length}]`;

    console.log(`   ${progress} Test: ${formato.name}...`);

    const result = await testFormat(
      credentials.apiKey,
      credentials.baseUrl,
      credentials.contractCode,
      formato.name,
      formato.format
    );

    results.push(result);

    if (result.success) {
      successCount++;
      const details = [];
      if (result.hasTracking) details.push('Tracking');
      if (result.hasLabel) details.push('Label');
      if (result.shipmentId) details.push(`ID:${result.shipmentId}`);
      
      console.log(`      ✅ SUCCESSO! Status: ${result.status} ${details.length > 0 ? `(${details.join(', ')})` : ''}`);
      
      // ⚠️ IMPORTANTE: Se questo formato funziona, potrebbe essere quello corretto!
      if (formato.format.length > 0) {
        console.log(`      🎯 FORMATO FUNZIONANTE TROVATO!`);
        console.log(`      📝 Formato JSON: ${JSON.stringify(formato.format)}`);
      }
    } else {
      failureCount++;
      const errorShort = result.error?.substring(0, 80) || 'Errore sconosciuto';
      console.log(`      ❌ FALLITO - Status: ${result.status || 'N/A'}, Error: ${errorShort}`);
    }

    // Pausa per non sovraccaricare l'API (ma più veloce per test completo)
    if (i < FORMATI_DA_TESTARE.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  // 4. Riepilogo
  console.log('');
  console.log('═'.repeat(80));
  console.log('📊 RIEPILOGO RISULTATI');
  console.log('═'.repeat(80));
  console.log(`   Totale test: ${FORMATI_DA_TESTARE.length}`);
  console.log(`   ✅ Successi: ${successCount}`);
  console.log(`   ❌ Falliti: ${failureCount}`);
  console.log('');

  // 5. Formati funzionanti
  const formatiFunzionanti = results.filter(r => r.success && r.format && r.format.length > 0);
  
  if (formatiFunzionanti.length > 0) {
    console.log('🎯 FORMATI FUNZIONANTI TROVATI:');
    console.log('');
    formatiFunzionanti.forEach((result, idx) => {
      console.log(`   ${idx + 1}. ${result.formatName}`);
      console.log(`      Formato: ${JSON.stringify(result.format)}`);
      console.log(`      Status: ${result.status}, Tracking: ${result.hasTracking ? 'SÌ' : 'NO'}, Label: ${result.hasLabel ? 'SÌ' : 'NO'}`);
      if (result.shipmentId) {
        console.log(`      Shipment ID: ${result.shipmentId}`);
      }
      console.log('');
    });
  } else {
    console.log('⚠️  NESSUN FORMATO CON SERVIZI FUNZIONANTE TROVATO');
    console.log('');
    console.log('   📊 ANALISI RISULTATI:');
    console.log('');
    
    const implodeErrors = results.filter(r => r.error?.includes('implode')).length;
    const propertyErrors = results.filter(r => r.error?.includes('Property [value]')).length;
    
    console.log(`   • Array di stringhe: ${implodeErrors} errori "implode()"`);
    console.log(`   • Array di oggetti: ${propertyErrors} errori "Property [value] does not exist"`);
    console.log('');
    console.log('   💡 INTERPRETAZIONE:');
    console.log('   L\'errore "Property [value] does not exist" indica che l\'API Laravel');
    console.log('   sta cercando di accedere a una proprietà "value" su una collection,');
    console.log('   ma la collection non ha quella proprietà. Questo suggerisce che:');
    console.log('   1. Il formato atteso NON è quello documentato (array di oggetti)');
    console.log('   2. I servizi accessori potrebbero non essere supportati via API');
    console.log('   3. Potrebbero essere configurati solo nel pannello Spedisci.Online');
    console.log('   4. Potrebbe servire un formato completamente diverso (non testato)');
    console.log('');
    console.log('   📧 SUGGERIMENTO PER SPEDISCI.ONLINE:');
    console.log('   Invia questo report a Spedisci.Online con la richiesta:');
    console.log('   "Abbiamo testato 50+ formati per accessoriServices in POST /shipping/create');
    console.log('   e tutti falliscono. Potete fornire un esempio FUNZIONANTE?"');
    console.log('');
  }

  // 6. Errori più comuni
  const erroriComuni: Record<string, number> = {};
  results
    .filter(r => !r.success && r.error)
    .forEach(r => {
      const errorKey = r.error?.substring(0, 50) || 'Unknown';
      erroriComuni[errorKey] = (erroriComuni[errorKey] || 0) + 1;
    });

  if (Object.keys(erroriComuni).length > 0) {
    console.log('❌ ERRORI PIÙ COMUNI:');
    Object.entries(erroriComuni)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .forEach(([error, count]) => {
        console.log(`   ${count}x: ${error}...`);
      });
    console.log('');
  }

  // 7. Export risultati in JSON (per inviare a Spedisci.Online)
  const reportJson = {
    timestamp: new Date().toISOString(),
    contractCode: credentials.contractCode,
    carrierCode: TEST_CONFIG.carrierCode,
    totalTests: FORMATI_DA_TESTARE.length,
    successCount,
    failureCount,
    workingFormats: formatiFunzionanti.map(r => ({
      formatName: r.formatName,
      format: r.format,
      status: r.status,
      hasTracking: r.hasTracking,
      hasLabel: r.hasLabel,
      shipmentId: r.shipmentId,
    })),
    commonErrors: Object.entries(erroriComuni)
      .sort((a, b) => b[1] - a[1])
      .map(([error, count]) => ({ error, count })),
    allResults: results.map(r => ({
      formatName: r.formatName,
      format: r.format,
      success: r.success,
      status: r.status,
      error: r.error,
    })),
  };

  console.log('');
  console.log('💾 EXPORT RISULTATI:');
  console.log('   Salva questo JSON per inviarlo a Spedisci.Online:');
  console.log('');
  console.log(JSON.stringify(reportJson, null, 2));
  console.log('');

  // 🗑️ CLEANUP AUTOMATICO: Cancella tutte le spedizioni create
  if (credentials && !DRY_RUN) {
    await cleanupCreatedShipments(credentials.apiKey, credentials.baseUrl);
  }

  console.log('═'.repeat(80));
  console.log('✅ Test completato!');
  console.log('═'.repeat(80));
  console.log('');
  console.log('💡 PROSSIMI PASSI:');
  console.log('   1. Copia il JSON sopra');
  console.log('   2. Invia a Spedisci.Online con richiesta supporto');
  console.log('   3. Chiedi esempio FUNZIONANTE di accessoriServices');
  console.log('');
}

// ⚠️ GESTIONE INTERRUZIONE: Cleanup anche in caso di CTRL+C
process.on('SIGINT', async () => {
  console.log('');
  console.log('');
  console.log('⚠️  Interruzione rilevata (CTRL+C)');
  console.log('🗑️  Eseguo cleanup delle spedizioni create...');
  console.log('');
  
  try {
    const credentials = await getCredentials();
    if (credentials && !DRY_RUN && createdShipments.length > 0) {
      await cleanupCreatedShipments(credentials.apiKey, credentials.baseUrl);
    }
  } catch (error) {
    console.error('❌ Errore durante cleanup:', error);
  }
  
  console.log('');
  console.log('👋 Script terminato');
  process.exit(0);
});

main().catch(async (error) => {
  console.error('❌ Errore fatale:', error);
  
  // Cleanup anche in caso di errore
  try {
    const credentials = await getCredentials();
    if (credentials && !DRY_RUN && createdShipments.length > 0) {
      console.log('');
      console.log('🗑️  Eseguo cleanup delle spedizioni create prima di terminare...');
      await cleanupCreatedShipments(credentials.apiKey, credentials.baseUrl);
    }
  } catch (cleanupError) {
    console.error('❌ Errore durante cleanup:', cleanupError);
  }
  
  process.exit(1);
});
