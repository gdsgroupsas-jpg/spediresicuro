/**
 * TEST REALE: Sincronizzazione Listini da Spedisci.Online
 *
 * Questo script esegue un test completo della sincronizzazione:
 * 1. Testa la connessione API
 * 2. Verifica i rates ottenuti
 * 3. Simula il raggruppamento
 * 4. Identifica problemi
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Variabili d'ambiente mancanti");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TEST_EMAIL = 'testspediresicuro+postaexpress@gmail.com';

// Zone e pesi per il test (come nel codice reale)
const ZONES = [
  { code: 'IT-STD', city: 'Milano', state: 'MI', postalCode: '20100' },
  { code: 'IT-CAL', city: 'Reggio Calabria', state: 'RC', postalCode: '89100' },
  { code: 'IT-SIC', city: 'Palermo', state: 'PA', postalCode: '90100' },
  { code: 'IT-SAR', city: 'Cagliari', state: 'CA', postalCode: '09100' },
];

const WEIGHTS = [1, 2, 3, 5, 10, 15, 20, 30, 50, 70, 100];

async function main() {
  console.log('🚀 TEST REALE SYNC LISTINI');
  console.log('═'.repeat(60));

  // 1. Recupera utente e configurazione
  console.log('\n📋 STEP 1: Recupero utente e configurazione...');

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, account_type, is_reseller')
    .eq('email', TEST_EMAIL)
    .single();

  if (userError || !user) {
    console.error('❌ Utente non trovato:', userError?.message);
    return;
  }

  console.log(`✅ Utente: ${user.email} (${user.account_type}, is_reseller: ${user.is_reseller})`);

  // 2. Recupera configurazione API
  const { data: configs, error: configError } = await supabase
    .from('courier_configs')
    .select('id, provider_id, is_active, is_default, owner_user_id')
    .or(`owner_user_id.eq.${user.id},is_default.eq.true`)
    .eq('is_active', true);

  if (configError) {
    console.error('❌ Errore recupero config:', configError.message);
    return;
  }

  console.log(`✅ Configurazioni trovate: ${configs?.length || 0}`);
  configs?.forEach((c, i) => {
    console.log(
      `   ${i + 1}. ${c.provider_id} (ID: ${c.id.substring(0, 8)}..., owner: ${c.owner_user_id?.substring(0, 8) || 'null'}, default: ${c.is_default})`
    );
  });

  // Testa TUTTE le configurazioni dell'utente
  const userConfigs = configs?.filter((c) => c.owner_user_id === user.id) || [];

  if (userConfigs.length === 0) {
    console.error('❌ Nessuna configurazione API trovata');
    return;
  }

  console.log(`\n📡 Trovate ${userConfigs.length} configurazioni dell'utente, testerò entrambe...`);

  // Prova entrambe le configurazioni per trovare quella funzionante
  let workingConfig: any = null;
  let workingApiKey: string | null = null;

  for (const cfg of userConfigs) {
    console.log(`\n🔍 Test configurazione: ${cfg.id.substring(0, 8)}...`);

    const { data: cfgData } = await supabase
      .from('courier_configs')
      .select('*')
      .eq('id', cfg.id)
      .single();

    if (!cfgData) continue;

    const { decryptCredential, isEncrypted } = await import('../lib/security/encryption');

    let testApiKey: string | null = null;

    // Prova api_key (può essere criptata)
    if ((cfgData as any).api_key) {
      testApiKey = (cfgData as any).api_key as string;
      if (testApiKey && isEncrypted(testApiKey)) {
        console.log(`   API Key è criptata, decripto...`);
        testApiKey = decryptCredential(testApiKey);
      }
    } else if (cfgData.credentials_encrypted) {
      try {
        const decryptedStr = decryptCredential(cfgData.credentials_encrypted);
        const decrypted = JSON.parse(decryptedStr);
        testApiKey = decrypted.api_key;
      } catch {}
    }

    if (!testApiKey) {
      console.log(`   ⚠️ Nessuna API key`);
      continue;
    }

    console.log(`   API Key: ${testApiKey.substring(0, 8)}...`);

    // Test rapido
    const { SpedisciOnlineAdapter } = await import('../lib/adapters/couriers/spedisci-online');
    const testAdapter = new SpedisciOnlineAdapter({
      api_key: testApiKey,
      base_url: 'https://infinity.spedisci.online/api/v2/',
    });

    const testResult = await testAdapter.getRates({
      packages: [{ length: 30, width: 20, height: 15, weight: 1 }],
      shipFrom: {
        name: 'Test',
        street1: 'Via Roma 1',
        city: 'Roma',
        state: 'RM',
        postalCode: '00100',
        country: 'IT',
      },
      shipTo: {
        name: 'Test',
        street1: 'Via Milano 1',
        city: 'Milano',
        state: 'MI',
        postalCode: '20100',
        country: 'IT',
      },
      notes: 'Test',
    });

    if (testResult.success && testResult.rates && testResult.rates.length > 0) {
      console.log(`   ✅ FUNZIONANTE! ${testResult.rates.length} rates trovati`);
      workingConfig = cfgData;
      workingApiKey = testApiKey;
      break;
    } else {
      console.log(`   ❌ Non funzionante: ${testResult.error || 'nessun rate'}`);
    }
  }

  if (!workingConfig || !workingApiKey) {
    console.error('❌ Nessuna configurazione funzionante trovata');
    return;
  }

  const userConfig = workingConfig;
  const apiKey = workingApiKey;

  console.log(`\n✅ Configurazione funzionante: ${userConfig.id.substring(0, 8)}...`);

  // 3. Crea adapter con la configurazione funzionante
  console.log('\n📋 STEP 2: Test API con probe zone/pesi...');

  const { SpedisciOnlineAdapter } = await import('../lib/adapters/couriers/spedisci-online');

  // Crea adapter
  const adapter = new SpedisciOnlineAdapter({
    api_key: apiKey,
    base_url: 'https://infinity.spedisci.online/api/v2/',
  });

  // 5. Esegui probe per ogni zona e peso
  console.log('\n📋 STEP 3: Probe API per zone e pesi...');

  const allRates: any[] = [];
  const errors: string[] = [];

  // Test solo prime 2 zone e 3 pesi per velocità
  const testZones = ZONES.slice(0, 2);
  const testWeights = [1, 5, 10];

  for (const zone of testZones) {
    for (const weight of testWeights) {
      const params = {
        packages: [{ length: 30, width: 20, height: 15, weight }],
        shipFrom: {
          name: 'Test Sender',
          street1: 'Via Roma 1',
          city: 'Roma',
          state: 'RM',
          postalCode: '00100',
          country: 'IT',
        },
        shipTo: {
          name: 'Test Receiver',
          street1: 'Via Test 1',
          city: zone.city,
          state: zone.state,
          postalCode: zone.postalCode,
          country: 'IT',
        },
        notes: 'Test sync',
        insuranceValue: 0,
        codValue: 0,
        accessoriServices: [],
      };

      try {
        const result = await adapter.getRates(params);

        if (result.success && result.rates) {
          console.log(`   ✅ ${zone.code} / ${weight}kg: ${result.rates.length} rates`);

          // Arricchisci i rates con metadata del probe
          for (const rate of result.rates) {
            (rate as any)._probe_weight = weight;
            (rate as any)._probe_zone = zone.code;
            allRates.push(rate);
          }
        } else {
          console.log(`   ⚠️ ${zone.code} / ${weight}kg: ${result.error || 'Nessun rate'}`);
          errors.push(`${zone.code}/${weight}kg: ${result.error}`);
        }
      } catch (e: any) {
        console.error(`   ❌ ${zone.code} / ${weight}kg: ${e.message}`);
        errors.push(`${zone.code}/${weight}kg: ${e.message}`);
      }

      // Delay per evitare rate limiting
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  console.log(`\n📊 Totale rates raccolti: ${allRates.length}`);

  if (allRates.length === 0) {
    console.error('❌ Nessun rate ottenuto. Verifica credenziali API.');
    return;
  }

  // 6. Analizza raggruppamento
  console.log('\n📋 STEP 4: Analisi raggruppamento rates...');

  const ratesByCarrier: Record<string, any[]> = {};

  for (const rate of allRates) {
    const carrierCode = rate.carrierCode;
    if (!carrierCode) {
      console.warn(`   ⚠️ Rate senza carrierCode:`, JSON.stringify(rate).substring(0, 100));
      continue;
    }
    if (!ratesByCarrier[carrierCode]) {
      ratesByCarrier[carrierCode] = [];
    }
    ratesByCarrier[carrierCode].push(rate);
  }

  const carrierCodes = Object.keys(ratesByCarrier);
  console.log(`\n📊 CORRIERI TROVATI: ${carrierCodes.length}`);
  console.log('═'.repeat(60));

  for (const [carrierCode, rates] of Object.entries(ratesByCarrier)) {
    console.log(`\n🚚 Corriere: ${carrierCode.toUpperCase()}`);
    console.log(`   Rates totali: ${rates.length}`);

    // Verifica consistenza
    const uniqueCarrierCodes = [...new Set(rates.map((r) => r.carrierCode))];
    console.log(`   CarrierCodes unici nel gruppo: ${uniqueCarrierCodes.join(', ')}`);

    if (uniqueCarrierCodes.length > 1) {
      console.error(`   ❌ ERRORE: Rates con carrierCode diversi nello stesso gruppo!`);
    }

    // Mostra sample rate
    const sample = rates[0];
    console.log(
      `   Sample: carrierCode=${sample.carrierCode}, contractCode=${sample.contractCode}, price=${sample.total_price}`
    );

    // Verifica zone e pesi
    const zones = [...new Set(rates.map((r) => (r as any)._probe_zone))];
    const weights = [...new Set(rates.map((r) => (r as any)._probe_weight))];
    console.log(`   Zone probate: ${zones.join(', ')}`);
    console.log(`   Pesi probati: ${weights.join(', ')}`);
  }

  // 7. Verifica listini esistenti
  console.log('\n📋 STEP 5: Verifica listini esistenti nel DB...');

  const { data: existingLists } = await supabase
    .from('price_lists')
    .select('id, name, courier_id, notes, created_at')
    .eq('created_by', user.id)
    .eq('list_type', 'supplier')
    .order('created_at', { ascending: false });

  console.log(`\n📦 Listini fornitore esistenti: ${existingLists?.length || 0}`);
  existingLists?.forEach((list, i) => {
    console.log(`   ${i + 1}. ${list.name}`);
    console.log(`      ID: ${list.id}`);
    console.log(`      Notes: ${list.notes?.substring(0, 50) || 'null'}`);
  });

  // 8. Verifica problema
  console.log('\n' + '═'.repeat(60));
  console.log('📋 DIAGNOSI:');
  console.log('═'.repeat(60));

  if (carrierCodes.length !== existingLists?.length) {
    console.log(`\n⚠️ PROBLEMA RILEVATO:`);
    console.log(`   - Corrieri da API: ${carrierCodes.length} (${carrierCodes.join(', ')})`);
    console.log(`   - Listini nel DB: ${existingLists?.length || 0}`);

    // Trova corrieri mancanti
    const existingCarriers =
      existingLists?.map((l) => {
        const match = l.name.match(/^([^_]+)/);
        return match?.[1]?.toLowerCase();
      }) || [];

    const missingCarriers = carrierCodes.filter((c) => !existingCarriers.includes(c.toLowerCase()));

    if (missingCarriers.length > 0) {
      console.log(`\n❌ CORRIERI MANCANTI NEL DB: ${missingCarriers.join(', ')}`);
    }
  } else {
    console.log(`\n✅ Numero corrieri corrisponde (${carrierCodes.length})`);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('🏁 TEST COMPLETATO');
  console.log('═'.repeat(60));
}

main().catch(console.error);
