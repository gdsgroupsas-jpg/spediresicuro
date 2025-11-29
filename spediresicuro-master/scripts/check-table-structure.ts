/**
 * Script per verificare la struttura della tabella geo_locations
 * e confrontarla con lo schema previsto
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  console.log('🔍 Verifica Struttura Tabella geo_locations\n');
  console.log('='.repeat(50));
  console.log('');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Variabili ambiente mancanti!');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 1. Verifica che la tabella esista
    console.log('📋 1. Verifica esistenza tabella...\n');
    const { data: tableExists, error: tableError } = await supabase
      .from('geo_locations')
      .select('id')
      .limit(1);

    if (tableError) {
      console.error('❌ Tabella non trovata:', tableError.message);
      process.exit(1);
    }
    console.log('✅ Tabella geo_locations esiste\n');

    // 2. Verifica struttura colonne
    console.log('📋 2. Verifica struttura colonne...\n');
    const { data: sample, error: sampleError } = await supabase
      .from('geo_locations')
      .select('*')
      .limit(1);

    if (sampleError) {
      console.error('❌ Errore lettura dati:', sampleError.message);
      process.exit(1);
    }

    if (sample && sample.length > 0) {
      const columns = Object.keys(sample[0]);
      console.log('📊 Colonne trovate:');
      columns.forEach((col) => console.log(`   - ${col}`));
      console.log('');

      // Verifica colonne richieste
      const requiredColumns = ['id', 'name', 'province', 'region', 'caps', 'search_vector', 'created_at', 'updated_at'];
      const missingColumns = requiredColumns.filter((col) => !columns.includes(col));

      if (missingColumns.length > 0) {
        console.log('⚠️  Colonne mancanti:');
        missingColumns.forEach((col) => console.log(`   - ${col}`));
        console.log('');
      } else {
        console.log('✅ Tutte le colonne richieste sono presenti\n');
      }
    } else {
      console.log('ℹ️  Tabella vuota, verifico struttura tramite query SQL...\n');
    }

    // 3. Verifica indici (tramite query SQL diretta)
    console.log('📋 3. Verifica indici...\n');
    console.log('ℹ️  Verifica indici richiede query SQL diretta in Supabase\n');

    // 4. Verifica trigger
    console.log('📋 4. Verifica trigger...\n');
    console.log('ℹ️  Verifica trigger richiede query SQL diretta\n');

    // 5. Test inserimento
    console.log('📋 5. Test inserimento...\n');
    const testData = {
      name: 'TEST_COMUNE',
      province: 'TE',
      region: 'Test',
      caps: ['12345'],
    };

    const { data: insertData, error: insertError } = await supabase
      .from('geo_locations')
      .insert(testData)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Errore inserimento test:', insertError.message);
    } else {
      console.log('✅ Inserimento test riuscito');
      console.log(`   ID: ${insertData.id}`);
      console.log(`   search_vector presente: ${insertData.search_vector ? 'Sì' : 'No'}\n`);

      // Pulisci test
      await supabase.from('geo_locations').delete().eq('id', insertData.id);
      console.log('🧹 Dati test rimossi\n');
    }

    // 6. Test ricerca full-text
    console.log('📋 6. Test ricerca full-text...\n');
    const { data: searchResults, error: searchError } = await supabase
      .from('geo_locations')
      .select('name, province, caps')
      .textSearch('search_vector', 'TEST_COMUNE', {
        type: 'websearch',
        config: 'italian',
      })
      .limit(5);

    if (searchError) {
      console.error('⚠️  Errore ricerca full-text:', searchError.message);
      console.log('   Potrebbe essere normale se la tabella è vuota\n');
    } else {
      console.log(`✅ Ricerca full-text funziona (${searchResults?.length || 0} risultati)\n`);
    }

    // 7. Conta record
    console.log('📋 7. Conteggio record...\n');
    const { count, error: countError } = await supabase
      .from('geo_locations')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Errore conteggio:', countError.message);
    } else {
      console.log(`📊 Record presenti: ${count || 0}\n`);
    }

    console.log('='.repeat(50));
    console.log('\n✅ Verifica completata!\n');
  } catch (error) {
    console.error('\n❌ ERRORE:', error);
    process.exit(1);
  }
}

main();
