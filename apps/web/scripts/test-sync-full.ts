/**
 * TEST: Simula il loop completo di sincronizzazione
 * per identificare dove si interrompe il secondo corriere
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TEST_EMAIL = 'testspediresicuro+postaexpress@gmail.com';
const CONFIG_ID = 'a456fbdd-3263-43f1-9f67-6ba9eedcb293'; // Dalla diagnosi precedente

async function main() {
  console.log('🚀 TEST SYNC COMPLETA - Simula il loop');
  console.log('═'.repeat(60));

  // 1. Recupera utente
  const { data: user } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', TEST_EMAIL)
    .single();

  if (!user) {
    console.error('❌ Utente non trovato');
    return;
  }

  console.log(`✅ Utente: ${user.email}`);

  // 2. Recupera config e decripta
  const { data: cfgData } = await supabase
    .from('courier_configs')
    .select('*')
    .eq('id', CONFIG_ID)
    .single();

  if (!cfgData) {
    console.error('❌ Config non trovata');
    return;
  }

  const { decryptCredential, isEncrypted } = await import('../lib/security/encryption');

  let apiKey = (cfgData as any).api_key;
  if (isEncrypted(apiKey)) {
    apiKey = decryptCredential(apiKey);
  }

  // 3. Ottieni rates
  const { SpedisciOnlineAdapter } = await import('../lib/adapters/couriers/spedisci-online');

  const adapter = new SpedisciOnlineAdapter({
    api_key: apiKey,
    base_url: 'https://infinity.spedisci.online/api/v2/',
  });

  // Simula un probe minimo (1 zona, 1 peso)
  const result = await adapter.getRates({
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

  if (!result.success || !result.rates) {
    console.error('❌ API fallita:', result.error);
    return;
  }

  console.log(`\n✅ Rates ottenuti: ${result.rates.length}`);

  // 4. Raggruppa per corriere
  const ratesByCarrier: Record<string, any[]> = {};
  for (const rate of result.rates) {
    if (!ratesByCarrier[rate.carrierCode]) {
      ratesByCarrier[rate.carrierCode] = [];
    }
    ratesByCarrier[rate.carrierCode].push({
      ...rate,
      _probe_weight: 1,
      _probe_zone: 'IT-STD',
    });
  }

  console.log(`\n📊 Corrieri trovati: ${Object.keys(ratesByCarrier).join(', ')}`);

  // 5. Simula il loop di creazione
  console.log('\n' + '═'.repeat(60));
  console.log('📋 SIMULA LOOP CREAZIONE LISTINI');
  console.log('═'.repeat(60));

  const { createPriceList, addPriceListEntries } = await import('../lib/db/price-lists');

  let carrierIndex = 0;
  const totalCarriers = Object.keys(ratesByCarrier).length;
  let priceListsCreated = 0;
  let priceListsUpdated = 0;
  let entriesAdded = 0;
  const actuallyProcessed: string[] = [];

  for (const [carrierCode, carrierRates] of Object.entries(ratesByCarrier)) {
    carrierIndex++;
    console.log(
      `\n🔄 [${carrierIndex}/${totalCarriers}] Processando: ${carrierCode.toUpperCase()}`
    );

    try {
      // Cerca listino esistente - NUOVA LOGICA: filtra per carrier_code nei metadata O nome
      const { data: existingLists } = await supabase
        .from('price_lists')
        .select('id, name, metadata, source_metadata')
        .eq('created_by', user.id)
        .eq('list_type', 'supplier')
        .order('created_at', { ascending: false })
        .limit(20);

      // Filtra in memoria per carrier_code
      const matchingList = existingLists?.find((pl: any) => {
        const metadata = pl.metadata || pl.source_metadata || {};
        const matchesCarrierCode =
          metadata.carrier_code?.toLowerCase() === carrierCode.toLowerCase() ||
          pl.name?.toLowerCase().startsWith(carrierCode.toLowerCase());
        const matchesConfigId = metadata.courier_config_id === CONFIG_ID;
        return matchesCarrierCode && matchesConfigId;
      });

      const existingPriceList = matchingList || null;
      console.log(
        `   🔍 Ricerca listino: carrier_code=${carrierCode}, configId=${CONFIG_ID.substring(0, 8)}`
      );
      console.log(`   🔍 Trovato: ${existingPriceList ? existingPriceList.name : 'NO'}`);

      const priceListName = `${carrierCode.toUpperCase()}_TestSync_${Date.now()}`;

      let priceListId: string;

      if (existingPriceList) {
        console.log(
          `   📦 Listino esistente: ${existingPriceList.name} (${existingPriceList.id.substring(0, 8)}...)`
        );
        priceListId = existingPriceList.id;
        priceListsUpdated++;

        // Cancella entries esistenti
        const { error: deleteError } = await supabase
          .from('price_list_entries')
          .delete()
          .eq('price_list_id', priceListId);

        if (deleteError) {
          console.log(`   ⚠️ Errore cancellazione entries: ${deleteError.message}`);
        } else {
          console.log(`   🗑️ Entries esistenti cancellate`);
        }
      } else {
        console.log(`   📝 Creo nuovo listino: ${priceListName}`);

        // Crea nuovo listino
        const priceListData = {
          name: priceListName,
          version: '1.0',
          status: 'draft' as const,
          courier_id: null,
          list_type: 'supplier' as const,
          is_global: false,
          source_type: 'api' as const,
          notes: `Corriere: ${carrierCode.toUpperCase()} | Test sync ${new Date().toISOString()}`,
          source_metadata: {
            synced_from: 'spedisci.online',
            carrier_code: carrierCode,
            courier_config_id: CONFIG_ID,
          },
        };

        try {
          const newPriceList = await createPriceList(priceListData, user.id);
          priceListId = newPriceList.id;
          priceListsCreated++;
          console.log(`   ✅ Listino creato: ${priceListId.substring(0, 8)}...`);
        } catch (createError: any) {
          console.error(`   ❌ ERRORE CREAZIONE LISTINO:`, createError.message);
          console.error(`   Stack:`, createError.stack);
          continue; // Passa al prossimo corriere
        }
      }

      // Crea entries
      const entries = carrierRates.map((rate) => ({
        weight_from: 0,
        weight_to: 1,
        zone_code: (rate as any)._probe_zone || 'IT',
        base_price: parseFloat(rate.total_price) || 0,
        service_type: 'standard' as const,
        fuel_surcharge_percent: 0,
        insurance_rate_percent: 0,
      }));

      console.log(`   📝 Aggiungo ${entries.length} entries...`);

      try {
        await addPriceListEntries(priceListId, entries);
        entriesAdded += entries.length;
        console.log(`   ✅ Entries aggiunte con successo`);
      } catch (entryError: any) {
        console.error(`   ❌ ERRORE ENTRIES:`, entryError.message);
      }

      actuallyProcessed.push(carrierCode);
      console.log(`   ✅ Corriere ${carrierCode} processato con successo`);
    } catch (loopError: any) {
      console.error(`   ❌ ERRORE NEL LOOP:`, loopError.message);
      console.error(`   Stack:`, loopError.stack);
    }
  }

  // 6. Riepilogo
  console.log('\n' + '═'.repeat(60));
  console.log('📋 RIEPILOGO FINALE');
  console.log('═'.repeat(60));
  console.log(`   Corrieri trovati: ${totalCarriers}`);
  console.log(`   Corrieri processati: ${actuallyProcessed.length}`);
  console.log(`   Corrieri processati: ${actuallyProcessed.join(', ')}`);
  console.log(`   Listini creati: ${priceListsCreated}`);
  console.log(`   Listini aggiornati: ${priceListsUpdated}`);
  console.log(`   Entries aggiunte: ${entriesAdded}`);

  if (actuallyProcessed.length !== totalCarriers) {
    console.log(`\n❌ PROBLEMA: Non tutti i corrieri sono stati processati!`);
    const missing = Object.keys(ratesByCarrier).filter((c) => !actuallyProcessed.includes(c));
    console.log(`   Mancanti: ${missing.join(', ')}`);
  } else {
    console.log(`\n✅ SUCCESSO: Tutti i corrieri sono stati processati!`);
  }

  // 7. Verifica nel DB
  console.log('\n' + '═'.repeat(60));
  console.log('📋 VERIFICA NEL DB');
  console.log('═'.repeat(60));

  const { data: finalLists } = await supabase
    .from('price_lists')
    .select('id, name, created_at')
    .eq('created_by', user.id)
    .eq('list_type', 'supplier')
    .order('created_at', { ascending: false })
    .limit(10);

  console.log(`\nListini fornitore attuali (${finalLists?.length || 0}):`);
  finalLists?.forEach((l, i) => {
    console.log(`   ${i + 1}. ${l.name}`);
  });
}

main().catch(console.error);
