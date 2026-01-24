import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  // Get GLS master entries with zone_code
  const { data, error } = await supabase
    .from('price_list_entries')
    .select('weight_from, weight_to, base_price, service_type, zone_code')
    .eq('price_list_id', '149ff396-84d6-4bc0-add7-ec04e362c1d8')
    .eq('weight_from', 0)
    .eq('weight_to', 3)
    .eq('service_type', 'standard');

  if (error) {
    console.log('Error:', error.message);
    return;
  }

  console.log('GLS Master entries (0-3kg standard):');
  data?.forEach((e, i) => {
    console.log(`  ${i + 1}. €${e.base_price} - zone: ${e.zone_code || 'NULL'}`);
  });

  // Count by zone_code
  const zones: Record<string, number> = {};
  data?.forEach((e) => {
    const z = e.zone_code || 'NULL';
    zones[z] = (zones[z] || 0) + 1;
  });
  console.log('\nZone distribution:', zones);
}

run();
