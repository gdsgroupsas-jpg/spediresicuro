import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const TEST_EMAIL = 'testspediresicuro+postaexpress@gmail.com';

const supabase = createClient(supabaseUrl, supabaseServiceRole);

// ⚠️ SECURITY: API keys devono essere fornite via variabili d'ambiente
// Non committare mai API key nel codice!
const CONFIGS_TO_RESTORE = [
  {
    name: 'spedizioni prime',
    provider_id: 'spedisci_online',
    api_key: process.env.TEST_API_KEY_PRIME || process.env.SPEDISCI_ONLINE_API_KEY_PRIME || '',
    base_url: process.env.TEST_BASE_URL_PRIME || 'https://ecommerceitalia.spedisci.online/api/v2',
    is_active: true,
  },
  {
    name: 'speed go',
    provider_id: 'spedisci_online',
    api_key: process.env.TEST_API_KEY_SPEED || process.env.SPEDISCI_ONLINE_API_KEY_SPEED || '',
    base_url: process.env.TEST_BASE_URL_SPEED || 'https://infinity.spedisci.online/api/v2',
    is_active: true,
  },
].filter((cfg) => cfg.api_key); // Filtra config senza API key

async function main() {
  console.log(`🔧 Restoring configs for: ${TEST_EMAIL}`);

  // Verifica che ci siano API key configurate
  if (CONFIGS_TO_RESTORE.length === 0) {
    console.error('❌ Nessuna API key configurata!');
    console.error("\n💡 Imposta le variabili d'ambiente:");
    console.error('   TEST_API_KEY_PRIME=xxx TEST_BASE_URL_PRIME=xxx');
    console.error('   TEST_API_KEY_SPEED=xxx TEST_BASE_URL_SPEED=xxx');
    process.exit(1);
  }

  // 1. Get User
  const { data: user } = await supabase.from('users').select('id').eq('email', TEST_EMAIL).single();
  if (!user) {
    console.log('❌ User not found!');
    return;
  }

  // 2. Restore
  for (const cfg of CONFIGS_TO_RESTORE) {
    const { error } = await supabase.from('courier_configs').insert({
      ...cfg,
      owner_user_id: user.id,
      created_by: TEST_EMAIL,
    });

    if (error) {
      console.log(`❌ Error restoring ${cfg.name}: ${error.message}`);
    } else {
      console.log(`✅ Restored: ${cfg.name}`);
    }
  }
}

main().catch(console.error);
