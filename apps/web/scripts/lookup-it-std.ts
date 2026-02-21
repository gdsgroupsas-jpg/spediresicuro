import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load Environment Variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  const priceListId = process.argv[2];
  if (!priceListId) {
    console.error('Missing ID');
    return;
  }

  const { data: stdEntries } = await supabase
    .from('price_list_entries')
    .select('weight_from, weight_to, base_price')
    .eq('price_list_id', priceListId)
    .eq('zone_code', 'IT-STD')
    .order('weight_from');

  if (stdEntries) {
    const output = stdEntries
      .map((e) => `${e.weight_from}-${e.weight_to}kg: €${e.base_price}`)
      .join('\n');
    fs.writeFileSync('price_dump.txt', output);
    console.log('Written to price_dump.txt');
  }
}

main().catch(console.error);
