import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkEndpoints() {
  // Prima mostriamo le colonne
  const { data: sample } = await supabase.from('courier_configs').select('*').limit(1);

  if (sample?.[0]) {
    console.log('\n📋 Colonne della tabella courier_configs:');
    console.log(Object.keys(sample[0]).join(', '));
  }

  // Config del nostro test user
  const { data, error } = await supabase
    .from('courier_configs')
    .select('*')
    .eq('owner_user_id', '904dc243-e9da-408d-8c0b-5dbe2a48b739');

  if (error) {
    console.log('❌ Errore:', error.message);
    return;
  }

  console.log(`\n📋 Config per test user: ${data?.length || 0}`);

  for (const c of data || []) {
    console.log('\n' + '='.repeat(60));
    console.log(`Nome: ${c.name}`);
    console.log(`ID: ${c.id}`);
    console.log('\n📡 Tutti i campi:');
    for (const [key, value] of Object.entries(c)) {
      if (key === 'api_key') {
        const val = value as string;
        console.log(`  ${key}: ${val?.substring(0, 20)}...`);
      } else {
        console.log(`  ${key}: ${JSON.stringify(value)}`);
      }
    }
  }
}

checkEndpoints();
