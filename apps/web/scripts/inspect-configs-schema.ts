import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load Environment Variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // We can't query information_schema directly with the JS client usually,
  // but we can insert a dummy row to see if constraints fail,
  // or just check if we can select multiple rows for the same user/provider.

  // Let's first check if there are any unique constraints on (created_by, provider_id)

  console.log('Checking courier_configs structure...');

  // Fetch existing configs to see structure
  const { data: configs, error } = await supabase.from('courier_configs').select('*').limit(1);

  if (error) {
    console.error('Error fetching configs:', error);
  } else {
    console.log('Sample Config Row:', configs?.[0]);
  }
}

main().catch(console.error);
