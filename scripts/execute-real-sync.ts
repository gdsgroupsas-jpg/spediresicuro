/**
 * ESEGUI SYNC REALE dei listini
 *
 * Questo script esegue la sincronizzazione vera usando l'action server
 */

import { SpedisciOnlineAdapter } from '@/lib/adapters/couriers/spedisci-online';
import { decryptCredential, isEncrypted } from '@/lib/security/encryption';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEST_USER_ID = '904dc243-e9da-408d-8c0b-5dbe2a48b739';
const TEST_EMAIL = 'testspediresicuro+postaexpress@gmail.com';

// Zone di test (subset per velocità)
const TEST_ZONES = [
  {
    code: 'IT-STD',
    city: 'Milano',
    state: 'MI',
    postalCode: '20100',
    country: 'IT',
  },
  {
    code: 'IT-CAL',
    city: 'Reggio Calabria',
    state: 'RC',
    postalCode: '89100',
    country: 'IT',
  },
];

// Pesi di test
const TEST_WEIGHTS = [1, 5, 10, 20, 30];

async function executeSyncForConfig(cfg: any, apiKey: string) {
  console.log(`\n📡 Sync per: ${cfg.name}`);

  const adapter = new SpedisciOnlineAdapter({
    api_key: apiKey,
    api_secret: cfg.api_secret || '',
    base_url: cfg.base_url || 'https://infinity.spedisci.online/api/v2',
    contract_mapping: cfg.contract_mapping || {},
  });

  const allRates: any[] = [];

  // Raccogli rates per diverse zone e pesi
  for (const zone of TEST_ZONES) {
    for (const weight of TEST_WEIGHTS) {
      try {
        const result = await adapter.getRates({
          packages: [{ length: 30, width: 20, height: 15, weight }],
          shipFrom: {
            name: 'Mittente',
            street1: 'Via Roma 1',
            city: 'Roma',
            state: 'RM',
            postalCode: '00100',
            country: 'IT',
          },
          shipTo: {
            name: 'Destinatario',
            street1: 'Via Test 1',
            city: zone.city,
            state: zone.state,
            postalCode: zone.postalCode,
            country: zone.country,
          },
          notes: 'Sync test',
        });

        if (result.success && result.rates) {
          for (const rate of result.rates) {
            allRates.push({
              ...rate,
              _zone: zone.code,
              _weight: weight,
            });
          }
        }
      } catch (e) {
        // Ignora errori singoli
      }

      // Piccola pausa
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  console.log(`   Raccolti ${allRates.length} rates totali`);

  if (allRates.length === 0) {
    console.log(`   ⚠️ Nessun rate - skip`);
    return { created: 0, updated: 0 };
  }

  // Raggruppa per corriere
  const carrierRates = new Map<string, any[]>();
  for (const rate of allRates) {
    const carrier = rate.carrier_code || rate.carrierCode;
    if (!carrierRates.has(carrier)) {
      carrierRates.set(carrier, []);
    }
    carrierRates.get(carrier)!.push(rate);
  }

  console.log(`   🚚 Corrieri trovati: ${[...carrierRates.keys()].join(', ')}`);

  let created = 0;
  let updated = 0;

  // Crea/aggiorna listino per ogni corriere
  for (const [carrierCode, rates] of carrierRates) {
    const listName = `Listino ${carrierCode.toUpperCase()} - ${cfg.name}`;

    // Cerca listino esistente
    const { data: existing } = await supabase
      .from('price_lists')
      .select('id')
      .eq('created_by', TEST_USER_ID)
      .eq('list_type', 'supplier')
      .contains('metadata', {
        carrier_code: carrierCode,
        courier_config_id: cfg.id,
      })
      .maybeSingle();

    let priceListId: string;

    if (existing) {
      // Aggiorna
      priceListId = existing.id;
      await supabase
        .from('price_lists')
        .update({
          name: listName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', priceListId);
      updated++;
      console.log(`   📝 Aggiornato: ${listName}`);
    } else {
      // Crea nuovo
      const { data: newList, error } = await supabase
        .from('price_lists')
        .insert({
          name: listName,
          version: '1.0', // Required field - NOT NULL in DB
          list_type: 'supplier',
          status: 'active',
          created_by: TEST_USER_ID,
          metadata: {
            carrier_code: carrierCode,
            courier_config_id: cfg.id,
            source: 'spedisci_online',
            synced_at: new Date().toISOString(),
          },
        })
        .select('id')
        .single();

      if (error) {
        console.log(`   ❌ Errore creazione listino: ${error.message}`);
        continue;
      }

      priceListId = newList.id;
      created++;
      console.log(`   ✅ Creato: ${listName}`);
    }

    // Elimina entries vecchie e inserisci nuove
    await supabase.from('price_list_entries').delete().eq('price_list_id', priceListId);

    // Prepara entries
    const entries = rates.map((rate: any) => ({
      price_list_id: priceListId,
      zone_code: rate._zone,
      weight_from: rate._weight,
      weight_to: rate._weight,
      base_price: parseFloat(rate.total_price) || 0,
      fuel_surcharge_percent: parseFloat(rate.fuel) || 0,
      service_type: 'standard' as const,
    }));

    const { error: insertError } = await supabase.from('price_list_entries').insert(entries);

    if (insertError) {
      console.log(`   ⚠️ Errore inserimento entries: ${insertError.message}`);
    } else {
      console.log(`   📊 Inserite ${entries.length} entries`);
    }
  }

  return { created, updated };
}

async function main() {
  console.log('\n' + '═'.repeat(70));
  console.log('🚀 ESECUZIONE SYNC REALE LISTINI');
  console.log('═'.repeat(70));

  // Recupera config
  const { data: configs } = await supabase
    .from('courier_configs')
    .select('*')
    .eq('owner_user_id', TEST_USER_ID)
    .eq('provider_id', 'spedisci_online')
    .eq('is_active', true);

  if (!configs || configs.length === 0) {
    console.log('❌ Nessuna configurazione trovata');
    return;
  }

  console.log(`\n📋 ${configs.length} configurazioni da sincronizzare`);

  let totalCreated = 0;
  let totalUpdated = 0;

  for (const cfg of configs) {
    // Decripta API key
    let apiKey = cfg.api_key;
    if (apiKey && isEncrypted(apiKey)) {
      apiKey = decryptCredential(apiKey);
    }

    const result = await executeSyncForConfig(cfg, apiKey);
    totalCreated += result.created;
    totalUpdated += result.updated;
  }

  // Verifica risultato
  console.log('\n' + '═'.repeat(70));
  console.log('📊 VERIFICA FINALE');
  console.log('═'.repeat(70));

  const { data: lists } = await supabase
    .from('price_lists')
    .select('id, name, metadata')
    .eq('created_by', TEST_USER_ID)
    .eq('list_type', 'supplier');

  console.log(`\n📦 Listini nel DB: ${lists?.length || 0}`);

  for (const list of lists || []) {
    const meta = (list.metadata as any) || {};

    const { count } = await supabase
      .from('price_list_entries')
      .select('*', { count: 'exact', head: true })
      .eq('price_list_id', list.id);

    console.log(`   - ${list.name}: ${count} entries`);
  }

  console.log('\n' + '═'.repeat(70));
  console.log(`✅ SYNC COMPLETATA: ${totalCreated} creati, ${totalUpdated} aggiornati`);
  console.log('═'.repeat(70));
}

main().catch(console.error);
