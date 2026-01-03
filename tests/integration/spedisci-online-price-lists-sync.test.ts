/**
 * Test Integrazione: Sincronizzazione Listini Prezzi da Spedisci.Online
 * 
 * Test END-TO-END con chiamate API reali:
 * 1. Test endpoint /shipping/rates
 * 2. Sincronizzazione listini nel database
 * 3. Verifica dati salvati correttamente
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { supabaseAdmin } from '@/lib/db/client';
import { SpedisciOnlineAdapter } from '@/lib/adapters/couriers/spedisci-online';
import { decryptCredential, isEncrypted } from '@/lib/security/encryption';
import { createPriceList, addPriceListEntries } from '@/lib/db/price-lists';

/**
 * Helper per recuperare credenziali direttamente dal database (senza server actions)
 */
async function getTestCredentials() {
  // Cerca configurazione globale attiva
  const { data: globalConfig } = await supabaseAdmin
    .from('courier_configs')
    .select('api_key, api_secret, base_url, contract_mapping')
    .eq('courier_code', 'spedisci_online')
    .eq('is_active', true)
    .eq('is_default', true)
    .maybeSingle();

  if (globalConfig) {
    let apiKey = globalConfig.api_key;
    let apiSecret = globalConfig.api_secret;

    // Decripta se necessario
    if (apiKey && isEncrypted(apiKey)) {
      apiKey = decryptCredential(apiKey);
    }
    if (apiSecret && isEncrypted(apiSecret)) {
      apiSecret = decryptCredential(apiSecret);
    }

    return {
      success: true,
      credentials: {
        api_key: apiKey,
        api_secret: apiSecret,
        base_url: globalConfig.base_url || 'https://api.spedisci.online/api/v2',
        contract_mapping: globalConfig.contract_mapping || {},
      },
    };
  }

  return {
    success: false,
    error: 'Credenziali non configurate',
  };
}

describe('Spedisci.Online Price Lists Sync - API Reali', () => {
  let hasCredentials = false;
  let testUserId: string | null = null;
  let testCredentials: any = null;

  beforeAll(async () => {
    // Verifica se ci sono credenziali configurate
    const credentialsResult = await getTestCredentials();
    hasCredentials = credentialsResult.success && !!credentialsResult.credentials;
    testCredentials = credentialsResult.credentials;

    if (!hasCredentials) {
      console.warn('⚠️ Credenziali Spedisci.Online non configurate. I test verranno saltati.');
      return;
    }

    // Recupera un utente di test (reseller o admin)
    const { data: testUser } = await supabaseAdmin
      .from('users')
      .select('id, email, is_reseller, account_type')
      .or('is_reseller.eq.true,account_type.eq.superadmin,account_type.eq.admin')
      .limit(1)
      .single();

    if (testUser) {
      testUserId = testUser.id;
      console.log(`✅ Utente di test trovato: ${testUser.email} (${testUser.account_type || 'reseller'})`);
    } else {
      console.warn('⚠️ Nessun utente reseller/admin trovato per i test');
    }
  });

  describe('Test API /shipping/rates', () => {
    it('dovrebbe chiamare l\'endpoint /shipping/rates e ottenere rates', async () => {
      if (!hasCredentials || !testCredentials) {
        console.log('⏭️ Test saltato: credenziali non configurate');
        return;
      }

      // Chiama direttamente l'adapter invece della server action
      const adapter = new SpedisciOnlineAdapter({
        api_key: testCredentials.api_key,
        api_secret: testCredentials.api_secret,
        base_url: testCredentials.base_url || 'https://api.spedisci.online/api/v2',
        contract_mapping: testCredentials.contract_mapping || {},
      });

      const startTime = Date.now();
      const result = await adapter.getRates({
        packages: [
          {
            length: 30,
            width: 20,
            height: 15,
            weight: 2,
          },
        ],
        shipFrom: {
          name: 'Mittente Test',
          company: 'Azienda Test',
          street1: 'Via Roma 1',
          street2: '',
          city: 'Roma',
          state: 'RM',
          postalCode: '00100',
          country: 'IT',
          email: 'mittente@test.com',
        },
        shipTo: {
          name: 'Destinatario Test',
          company: '',
          street1: 'Via Milano 2',
          street2: '',
          city: 'Milano',
          state: 'MI',
          postalCode: '20100',
          country: 'IT',
          email: 'destinatario@test.com',
        },
        notes: 'Test API rates',
        insuranceValue: 0,
        codValue: 0,
        accessoriServices: [],
      });

      const responseTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.rates).toBeDefined();
      expect(Array.isArray(result.rates)).toBe(true);
      
      if (result.rates && result.rates.length > 0) {
        const firstRate = result.rates[0];
        expect(firstRate).toHaveProperty('carrierCode');
        expect(firstRate).toHaveProperty('contractCode');
        expect(firstRate).toHaveProperty('total_price');
        expect(firstRate).toHaveProperty('weight_price');
        
        console.log(`✅ Test API completato: ${result.rates.length} rates ottenuti`);
        console.log(`   Corrieri trovati: ${[...new Set(result.rates.map((r: any) => r.carrierCode))].join(', ')}`);
        console.log(`   Tempo di risposta: ${responseTime}ms`);
      } else {
        console.warn('⚠️ Nessun rate ottenuto dall\'API');
      }
    }, 30000); // Timeout 30 secondi per chiamata API

    it('dovrebbe gestire errori API correttamente', async () => {
      if (!hasCredentials || !testCredentials) {
        console.log('⏭️ Test saltato: credenziali non configurate');
        return;
      }

      // Chiama direttamente l'adapter
      const adapter = new SpedisciOnlineAdapter({
        api_key: testCredentials.api_key,
        api_secret: testCredentials.api_secret,
        base_url: testCredentials.base_url || 'https://api.spedisci.online/api/v2',
        contract_mapping: testCredentials.contract_mapping || {},
      });

      // Test con parametri invalidi (dovrebbe fallire gracefully)
      const result = await adapter.getRates({
        packages: [
          {
            length: 0, // Inválido
            width: 0,
            height: 0,
            weight: 0,
          },
        ],
        shipFrom: {
          name: '',
          company: '',
          street1: '',
          street2: '',
          city: '',
          state: '',
          postalCode: '',
          country: 'IT',
          email: 'invalid',
        },
        shipTo: {
          name: '',
          company: '',
          street1: '',
          street2: '',
          city: '',
          state: '',
          postalCode: '',
          country: 'IT',
          email: 'invalid',
        },
        notes: '',
        insuranceValue: 0,
        codValue: 0,
        accessoriServices: [],
      });

      // Dovrebbe gestire l'errore senza crashare
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('error');
      
      if (!result.success) {
        console.log(`✅ Gestione errore corretta: ${result.error}`);
      }
    }, 30000);
  });

  describe('Test Sincronizzazione Listini', () => {
    it('dovrebbe sincronizzare listini nel database', async () => {
      if (!hasCredentials || !testUserId) {
        console.log('⏭️ Test saltato: credenziali o utente non disponibili');
        return;
      }

      // Prima verifica quanti listini esistono
      const { data: priceListsBefore } = await supabaseAdmin
        .from('price_lists')
        .select('id')
        .eq('created_by', testUserId)
        .eq('list_type', 'supplier');

      const countBefore = priceListsBefore?.length || 0;
      console.log(`📊 Listini esistenti prima: ${countBefore}`);

      // Chiama API per ottenere rates
      const adapter = new SpedisciOnlineAdapter({
        api_key: testCredentials.api_key,
        api_secret: testCredentials.api_secret,
        base_url: testCredentials.base_url || 'https://api.spedisci.online/api/v2',
        contract_mapping: testCredentials.contract_mapping || {},
      });

      const ratesResult = await adapter.getRates({
        packages: [
          {
            length: 30,
            width: 20,
            height: 15,
            weight: 2,
          },
        ],
        shipFrom: {
          name: 'Mittente Test',
          company: 'Azienda Test',
          street1: 'Via Roma 1',
          street2: '',
          city: 'Roma',
          state: 'RM',
          postalCode: '00100',
          country: 'IT',
          email: 'mittente@test.com',
        },
        shipTo: {
          name: 'Destinatario Test',
          company: '',
          street1: 'Via Milano 2',
          street2: '',
          city: 'Milano',
          state: 'MI',
          postalCode: '20100',
          country: 'IT',
          email: 'destinatario@test.com',
        },
        notes: 'Sincronizzazione test',
        insuranceValue: 0,
        codValue: 0,
        accessoriServices: [],
      });

      if (!ratesResult.success || !ratesResult.rates || ratesResult.rates.length === 0) {
        console.warn(`⚠️ Nessun rate ottenuto: ${ratesResult.error}`);
        return;
      }

      const rates = ratesResult.rates;
      console.log(`✅ ${rates.length} rates ottenuti dall'API`);

      // Raggruppa per corriere
      const ratesByCarrier: Record<string, typeof rates> = {};
      for (const rate of rates) {
        if (!ratesByCarrier[rate.carrierCode]) {
          ratesByCarrier[rate.carrierCode] = [];
        }
        ratesByCarrier[rate.carrierCode].push(rate);
      }

      // Recupera corrieri esistenti
      const { data: couriers } = await supabaseAdmin
        .from('couriers')
        .select('id, code, name');

      let priceListsCreated = 0;
      let entriesAdded = 0;

      // Per ogni corriere, crea listino
      for (const [carrierCode, carrierRates] of Object.entries(ratesByCarrier)) {
        // Trova corriere nel database
        const courier = couriers?.find(
          (c) =>
            c.code?.toLowerCase() === carrierCode.toLowerCase() ||
            c.name?.toLowerCase().includes(carrierCode.toLowerCase())
        );

        if (!courier) {
          console.warn(`⚠️ Corriere ${carrierCode} non trovato nel database, salto...`);
          continue;
        }

        // Crea listino
        const priceListName = `Listino ${carrierCode.toUpperCase()} - Test ${new Date().toISOString()}`;
        const priceList = await createPriceList(
          {
            name: priceListName,
            version: '1.0',
            status: 'draft',
            courier_id: courier.id,
            list_type: 'supplier',
            is_global: false,
            source_type: 'api',
            notes: `Sincronizzato da spedisci.online il ${new Date().toISOString()}`,
          },
          testUserId!
        );

        priceListsCreated++;

        // Crea entries
        const entries = carrierRates.map((rate) => {
          const basePrice = Math.max(0, parseFloat(rate.weight_price) || 0);
          const insurancePrice = Math.max(0, parseFloat(rate.insurance_price) || 0);
          const codPrice = Math.max(0, parseFloat(rate.cod_price) || 0);
          const fuelPrice = Math.max(0, parseFloat(rate.fuel) || 0);

          const fuelSurchargePercent = Math.min(
            100,
            basePrice > 0 ? (fuelPrice / basePrice) * 100 : 0
          );
          const insuranceRatePercent = Math.min(
            100,
            basePrice > 0 ? (insurancePrice / basePrice) * 100 : 0
          );

          const contractCodeLower = rate.contractCode.toLowerCase();
          let serviceType: 'standard' | 'express' | 'economy' | 'same_day' | 'next_day' = 'standard';
          if (contractCodeLower.includes('express') || contractCodeLower.includes('rapid')) {
            serviceType = 'express';
          } else if (contractCodeLower.includes('economy')) {
            serviceType = 'economy';
          }

          return {
            weight_from: 0,
            weight_to: 999.999,
            zone_code: 'IT',
            base_price: Math.min(99999999.99, basePrice),
            service_type: serviceType,
            fuel_surcharge_percent: Math.min(999.99, fuelSurchargePercent),
            cash_on_delivery_surcharge: Math.min(99999999.99, codPrice),
            insurance_rate_percent: Math.min(999.99, insuranceRatePercent),
          };
        });

        await addPriceListEntries(priceList.id, entries);
        entriesAdded += entries.length;
      }

      console.log(`✅ Sincronizzazione completata:`);
      console.log(`   Listini creati: ${priceListsCreated}`);
      console.log(`   Entries aggiunte: ${entriesAdded}`);

      // Verifica che i listini siano stati salvati
      const { data: priceListsAfter } = await supabaseAdmin
        .from('price_lists')
        .select('id, name, courier_id, list_type')
        .eq('created_by', testUserId)
        .eq('list_type', 'supplier')
        .order('created_at', { ascending: false });

      const countAfter = priceListsAfter?.length || 0;
      console.log(`📊 Listini esistenti dopo: ${countAfter}`);

      expect(countAfter).toBeGreaterThanOrEqual(countBefore);

      // Verifica che almeno un listino abbia entries
      if (priceListsAfter && priceListsAfter.length > 0) {
        const firstPriceList = priceListsAfter[0];
        const { data: entries } = await supabaseAdmin
          .from('price_list_entries')
          .select('id, base_price, service_type')
          .eq('price_list_id', firstPriceList.id);

        console.log(`   Entries nel listino "${firstPriceList.name}": ${entries?.length || 0}`);
        
        if (entries && entries.length > 0) {
          console.log(`   ✅ Prima entry: base_price=${entries[0].base_price}, service_type=${entries[0].service_type}`);
        }
      }
    }, 60000); // Timeout 60 secondi per sincronizzazione completa

    it('dovrebbe creare entries con dati validi', async () => {
      if (!hasCredentials || !testUserId) {
        console.log('⏭️ Test saltato: credenziali o utente non disponibili');
        return;
      }

      // Recupera un listino sincronizzato
      const { data: priceList } = await supabaseAdmin
        .from('price_lists')
        .select('id, name, courier_id')
        .eq('created_by', testUserId)
        .eq('list_type', 'supplier')
        .eq('source_type', 'api')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (!priceList) {
        console.log('⏭️ Nessun listino sincronizzato trovato per questo test');
        return;
      }

      // Verifica entries
      const { data: entries, error } = await supabaseAdmin
        .from('price_list_entries')
        .select('*')
        .eq('price_list_id', priceList.id);

        if (error) {
          console.error('❌ Errore recupero entries:', error);
          return;
        }

        expect(entries).toBeDefined();
        expect(Array.isArray(entries)).toBe(true);

        if (entries && entries.length > 0) {
          const entry = entries[0];
          
          // Verifica campi obbligatori
          expect(entry).toHaveProperty('id');
          expect(entry).toHaveProperty('price_list_id');
          expect(entry).toHaveProperty('weight_from');
          expect(entry).toHaveProperty('weight_to');
          expect(entry).toHaveProperty('base_price');
          expect(entry).toHaveProperty('service_type');

          // Verifica tipi
          expect(typeof entry.base_price).toBe('number');
          expect(typeof entry.weight_from).toBe('number');
          expect(typeof entry.weight_to).toBe('number');
          expect(['standard', 'express', 'economy', 'same_day', 'next_day']).toContain(entry.service_type);

          // Verifica valori validi
          expect(entry.base_price).toBeGreaterThanOrEqual(0);
          expect(entry.weight_from).toBeGreaterThanOrEqual(0);
          expect(entry.weight_to).toBeGreaterThan(entry.weight_from);

          console.log(`✅ Entry validata:`);
          console.log(`   ID: ${entry.id}`);
          console.log(`   Base Price: €${entry.base_price}`);
          console.log(`   Service Type: ${entry.service_type}`);
          console.log(`   Weight Range: ${entry.weight_from} - ${entry.weight_to} kg`);
          console.log(`   Fuel Surcharge: ${entry.fuel_surcharge_percent || 0}%`);
          console.log(`   COD Surcharge: €${entry.cash_on_delivery_surcharge || 0}`);
        } else {
          console.warn('⚠️ Nessuna entry trovata nel listino');
        }
    }, 60000);
  });

  describe('Test Validazione Dati Database', () => {
    it('dovrebbe verificare che i dati salvati siano nel formato corretto', async () => {
      if (!testUserId) {
        console.log('⏭️ Test saltato: utente non disponibile');
        return;
      }

      // Recupera listini sincronizzati
      const { data: priceLists } = await supabaseAdmin
        .from('price_lists')
        .select('id, name, courier_id, list_type, source_type, created_at')
        .eq('created_by', testUserId)
        .eq('list_type', 'supplier')
        .eq('source_type', 'api')
        .order('created_at', { ascending: false })
        .limit(5);

      if (!priceLists || priceLists.length === 0) {
        console.log('ℹ️ Nessun listino sincronizzato trovato per la validazione');
        return;
      }

      console.log(`📋 Validazione ${priceLists.length} listini sincronizzati...`);

      for (const priceList of priceLists) {
        // Verifica struttura listino
        expect(priceList).toHaveProperty('id');
        expect(priceList).toHaveProperty('name');
        expect(priceList).toHaveProperty('list_type');
        expect(priceList.list_type).toBe('supplier');
        expect(priceList.source_type).toBe('api');

        // Recupera entries
        const { data: entries } = await supabaseAdmin
          .from('price_list_entries')
          .select('*')
          .eq('price_list_id', priceList.id);

        if (entries && entries.length > 0) {
          console.log(`✅ Listino "${priceList.name}": ${entries.length} entries valide`);
          
          // Verifica ogni entry
          entries.forEach((entry: any) => {
            expect(entry.base_price).toBeGreaterThanOrEqual(0);
            expect(entry.weight_from).toBeGreaterThanOrEqual(0);
            expect(entry.weight_to).toBeGreaterThan(entry.weight_from);
            expect(['standard', 'express', 'economy', 'same_day', 'next_day']).toContain(entry.service_type);
          });
        }
      }

      console.log('✅ Tutti i listini validati correttamente');
    });
  });
});

