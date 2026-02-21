/**
 * Script: Verifica risultato sync listini
 *
 * Esegui dopo la sync in produzione per verificare che entrambi i corrieri siano stati sincronizzati
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TEST_EMAIL = 'testspediresicuro+postaexpress@gmail.com';

async function main() {
  console.log('🔍 VERIFICA RISULTATO SYNC LISTINI');
  console.log('═'.repeat(60));

  const { data: user } = await supabase.from('users').select('id').eq('email', TEST_EMAIL).single();

  if (!user) {
    console.error('❌ Utente non trovato');
    return;
  }

  // Recupera tutti i listini fornitore
  const { data: priceLists } = await supabase
    .from('price_lists')
    .select(
      `
      id,
      name,
      status,
      courier_id,
      metadata,
      source_metadata,
      notes,
      created_at,
      updated_at
    `
    )
    .eq('created_by', user.id)
    .eq('list_type', 'supplier')
    .order('updated_at', { ascending: false });

  console.log(`\n📊 Listini fornitore trovati: ${priceLists?.length || 0}`);

  if (!priceLists || priceLists.length === 0) {
    console.log('⚠️ Nessun listino trovato! Esegui prima la sync.');
    return;
  }

  // Verifica che ci siano ENTRAMBI i corrieri
  const expectedCarriers = ['gls', 'postedeliverybusiness'];
  const foundCarriers: string[] = [];

  console.log('\n' + '─'.repeat(60));

  for (const list of priceLists) {
    // Estrai carrierCode
    const metadata = list.metadata || list.source_metadata || {};
    const carrierCodeFromMetadata = (metadata as any).carrier_code?.toLowerCase();
    const carrierCodeFromName = list.name.split('_')[0]?.toLowerCase();
    const carrierCode = carrierCodeFromMetadata || carrierCodeFromName || 'unknown';

    foundCarriers.push(carrierCode);

    console.log(`\n📦 ${list.name}`);
    console.log(`   ID: ${list.id.substring(0, 8)}...`);
    console.log(`   Status: ${list.status}`);
    console.log(`   CarrierCode: ${carrierCode}`);
    console.log(`   Aggiornato: ${new Date(list.updated_at).toLocaleString('it-IT')}`);

    // Conta entries
    const { count } = await supabase
      .from('price_list_entries')
      .select('*', { count: 'exact', head: true })
      .eq('price_list_id', list.id);

    console.log(`   Entries: ${count || 0}`);

    // Mostra sample entries
    if (count && count > 0) {
      const { data: sampleEntries } = await supabase
        .from('price_list_entries')
        .select('zone_code, weight_from, weight_to, base_price')
        .eq('price_list_id', list.id)
        .limit(3);

      console.log(`   Sample entries:`);
      sampleEntries?.forEach((e) => {
        console.log(`      - ${e.zone_code}: ${e.weight_from}-${e.weight_to}kg → €${e.base_price}`);
      });
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('📋 RIEPILOGO:');
  console.log('═'.repeat(60));

  console.log(`\nCorrieri attesi: ${expectedCarriers.join(', ')}`);
  console.log(`Corrieri trovati: ${[...new Set(foundCarriers)].join(', ')}`);

  const missingCarriers = expectedCarriers.filter((c) => !foundCarriers.includes(c));

  if (missingCarriers.length === 0) {
    console.log(`\n✅ SUCCESSO: Tutti i corrieri sono stati sincronizzati!`);
  } else {
    console.log(`\n❌ PROBLEMA: Mancano i seguenti corrieri: ${missingCarriers.join(', ')}`);
  }
}

main().catch(console.error);
