/**
 * Script di test per verificare i formati dei servizi accessori di Spedisci.Online
 * 
 * Esegui con: npx ts-node --project tsconfig.scripts.json scripts/test-accessory-services.ts
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const API_URL = 'https://api.spedisci.online/api/v2/shipping/rates';

// Lista di possibili formati per il servizio Exchange
const SERVICE_FORMATS = [
  'Exchange',
  'exchange',
  'EXCHANGE',
  'EXC',
  'exc',
  'GLS_Exchange',
  'gls_exchange',
  'GLS-Exchange',
  'gls-exchange',
  'exchangeservice',
  'ExchangeService',
  'SCAMBIO',
  'Scambio',
];

async function testServiceFormat(apiKey: string, serviceName: string) {
  const payload = {
    packages: [{
      length: 30,
      width: 20,
      height: 15,
      weight: 1,
    }],
    shipFrom: {
      name: 'Test Mittente',
      company: 'Test Company',
      street1: 'Via Roma 1',
      street2: '',
      city: 'Roma',
      state: 'RM',
      postalCode: '00100',
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
    notes: 'Test accessory services',
    insuranceValue: 0,
    codValue: 0,
    accessoriServices: [serviceName],
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const rates = await response.json();
      // Trova un rate GLS per confrontare services_price
      const glsRate = rates.find((r: any) => r.carrierCode === 'gls');
      if (glsRate) {
        return {
          service: serviceName,
          success: true,
          services_price: glsRate.services_price,
          total_price: glsRate.total_price,
        };
      }
      return {
        service: serviceName,
        success: true,
        services_price: 'N/A (no GLS)',
        total_price: 'N/A',
      };
    } else {
      const error = await response.text();
      return {
        service: serviceName,
        success: false,
        error: `HTTP ${response.status}: ${error.substring(0, 100)}`,
      };
    }
  } catch (error: any) {
    return {
      service: serviceName,
      success: false,
      error: error.message,
    };
  }
}

async function testWithoutService(apiKey: string) {
  const payload = {
    packages: [{
      length: 30,
      width: 20,
      height: 15,
      weight: 1,
    }],
    shipFrom: {
      name: 'Test Mittente',
      company: 'Test Company',
      street1: 'Via Roma 1',
      street2: '',
      city: 'Roma',
      state: 'RM',
      postalCode: '00100',
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
    notes: 'Test senza servizi',
    insuranceValue: 0,
    codValue: 0,
    accessoriServices: [],
  };

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const rates = await response.json();
      const glsRate = rates.find((r: any) => r.carrierCode === 'gls');
      if (glsRate) {
        return {
          service: '(NESSUNO)',
          success: true,
          services_price: glsRate.services_price,
          total_price: glsRate.total_price,
        };
      }
    }
    return { service: '(NESSUNO)', success: false, error: 'No GLS rate' };
  } catch (error: any) {
    return { service: '(NESSUNO)', success: false, error: error.message };
  }
}

async function main() {
  // Leggi API key dalle env (deve essere decriptata)
  // Per il test, usa una API key valida
  const apiKey = process.env.SPEDISCI_ONLINE_TEST_API_KEY;
  
  if (!apiKey) {
    console.error('❌ SPEDISCI_ONLINE_TEST_API_KEY non trovata in .env.local');
    console.log('Aggiungi SPEDISCI_ONLINE_TEST_API_KEY=<tua_api_key> a .env.local');
    process.exit(1);
  }

  console.log('🔍 Test Servizi Accessori Spedisci.Online');
  console.log('=========================================\n');

  // Prima test senza servizi (baseline)
  console.log('1. Test SENZA servizi accessori (baseline)...');
  const baseline = await testWithoutService(apiKey);
  console.log(`   Baseline: services_price=${baseline.services_price}, total=${baseline.total_price}\n`);

  // Poi test con ogni formato di servizio
  console.log('2. Test con diversi formati di "Exchange"...\n');
  
  for (const format of SERVICE_FORMATS) {
    const result = await testServiceFormat(apiKey, format);
    
    if (result.success) {
      const priceChanged = baseline.services_price !== result.services_price;
      console.log(
        `   ${priceChanged ? '✅' : '⚪'} "${format}": services_price=${result.services_price}, total=${result.total_price}` +
        (priceChanged ? ' ← PREZZO CAMBIATO!' : '')
      );
    } else {
      console.log(`   ❌ "${format}": ${result.error}`);
    }
    
    // Pausa per non sovraccaricare l'API
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n=========================================');
  console.log('Se nessun formato mostra prezzo diverso, i servizi accessori');
  console.log('potrebbero essere gestiti nel pannello Spedisci.Online, non via API.');
}

main().catch(console.error);
