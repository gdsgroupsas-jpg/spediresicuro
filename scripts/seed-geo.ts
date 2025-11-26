import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Variabili ambiente mancanti:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// Dati comuni italiani (campione per test)
const comuni = [
  { name: 'Roma', province: 'RM', caps: ['00100', '00118', '00119'], region: 'Lazio' },
  { name: 'Milano', province: 'MI', caps: ['20100', '20121', '20122'], region: 'Lombardia' },
  { name: 'Napoli', province: 'NA', caps: ['80100', '80121', '80122'], region: 'Campania' },
  { name: 'Torino', province: 'TO', caps: ['10100', '10121', '10122'], region: 'Piemonte' },
  { name: 'Palermo', province: 'PA', caps: ['90100', '90121', '90122'], region: 'Sicilia' },
  { name: 'Genova', province: 'GE', caps: ['16100', '16121', '16122'], region: 'Liguria' },
  { name: 'Bologna', province: 'BO', caps: ['40100', '40121', '40122'], region: 'Emilia-Romagna' },
  { name: 'Firenze', province: 'FI', caps: ['50100', '50121', '50122'], region: 'Toscana' },
  { name: 'Bari', province: 'BA', caps: ['70100', '70121', '70122'], region: 'Puglia' },
  { name: 'Catania', province: 'CT', caps: ['95100', '95121', '95122'], region: 'Sicilia' },
];

async function seedGeolocation() {
  console.log('🌍 Avvio seeding geo_locations...\n');

  try {
    // Pulisci tabella (opzionale)
    console.log('🧹 Pulizia tabella geo_locations...');
    const { error: deleteError } = await supabase
      .from('geo_locations')
      .delete()
      .neq('id', 0);

    if (deleteError && deleteError.code !== 'PGRST116') {
      console.warn('⚠️  Avviso durante pulizia:', deleteError.message);
    }

    // Inserisci dati
    console.log(`📝 Inserimento ${comuni.length} comuni...`);
    const { data, error } = await supabase
      .from('geo_locations')
      .insert(comuni)
      .select();

    if (error) {
      console.error('❌ Errore durante inserimento:', error);
      console.error('   Codice:', error.code);
      console.error('   Messaggio:', error.message);
      process.exit(1);
    }

    console.log(`✅ Inseriti ${data?.length || comuni.length} comuni`);

    // Verifica
    const { count, error: countError } = await supabase
      .from('geo_locations')
      .select('id', { count: 'exact' });

    if (countError) {
      console.error('❌ Errore durante verifica:', countError);
      process.exit(1);
    }

    console.log(`\n✅ SUCCESSO! Database contiene ora ${count} comuni italiani`);
    console.log('🎉 Seeding completato!');

  } catch (err) {
    console.error('❌ Errore durante seeding:', err);
    process.exit(1);
  }
}

seedGeolocation();
