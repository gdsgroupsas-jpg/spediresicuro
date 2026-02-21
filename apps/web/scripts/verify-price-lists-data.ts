import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Carica variabili d'ambiente
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRole) {
  console.error('❌ Manca .env.local con NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRole);

const TEST_EMAIL = 'testspediresicuro+postaexpress@gmail.com';

async function main() {
  console.log('🔍 Verifica Dati Listini per:', TEST_EMAIL);

  // 1. Recupera User ID
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', TEST_EMAIL)
    .single();

  if (userError || !user) {
    console.error('❌ Utente test non trovato:', userError?.message);
    return;
  }

  const userId = user.id;
  console.log('✅ User ID trovato:', userId);

  // 2. Recupera Listini
  const { data: priceLists, error: plError } = await supabase
    .from('price_lists')
    .select('id, name, status, courier_id, created_at, updated_at')
    .eq('created_by', userId)
    .eq('list_type', 'supplier')
    .order('created_at', { ascending: false });

  if (plError) {
    console.error('❌ Errore recupero listini:', plError.message);
    return;
  }

  console.log(`\n📊 Trovati ${priceLists.length} listini fornitore:`);

  if (priceLists.length === 0) {
    console.log('⚠️ Nessun listino trovato. Assicurati di aver eseguito la sincronizzazione.');
    // Verifica se ci sono listini di altri tipi per debug
    const { data: allLists } = await supabase
      .from('price_lists')
      .select('id, name, list_type, created_by, created_at')
      .eq('created_by', userId)
      .order('created_at', { ascending: false })
      .limit(5);
    if (allLists && allLists.length > 0) {
      console.log('\n🔍 Listini trovati (tutti i tipi):');
      allLists.forEach((l) => {
        console.log(
          `   - ${l.name} (${l.list_type || 'null'}) creato: ${new Date(l.created_at).toLocaleString('it-IT')}`
        );
      });
    }
    return;
  }

  for (const list of priceLists) {
    console.log(`\n📦 Listino: ${list.name} (${list.status})`);
    console.log(`   ID: ${list.id}`);
    console.log(`   Corriere ID: ${list.courier_id}`);
    console.log(`   Ultimo aggiornamento: ${new Date(list.updated_at).toLocaleString('it-IT')}`);

    // 3. Conta Entry per questo listino
    const { count, error: countError } = await supabase
      .from('price_list_entries')
      .select('*', { count: 'exact', head: true })
      .eq('price_list_id', list.id);

    if (countError) {
      console.error('   ❌ Errore conteggio entries:', countError.message);
    } else {
      console.log(`   🔢 Tariffe (Entries): ${count}`);
    }

    // 4. Mostra un campione di 3 entries
    if (count && count > 0) {
      const { data: entries } = await supabase
        .from('price_list_entries')
        .select('weight_from, weight_to, base_price, zone_code')
        .eq('price_list_id', list.id)
        .limit(3);

      console.log('   🔎 Esempi tariffe:');
      entries?.forEach((e) => {
        console.log(
          `      - Zone ${e.zone_code}: ${e.weight_from}-${e.weight_to}kg -> €${e.base_price}`
        );
      });
    }
  }
}

main().catch(console.error);
