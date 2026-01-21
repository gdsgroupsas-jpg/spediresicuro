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
  const { data: list } = await supabase
    .from('price_lists')
    .select('id, name')
    .eq('list_type', 'supplier')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!list) return console.log('No list found');

  console.log(`List: ${list.name}`);

  const { data: entries } = await supabase
    .from('price_list_entries')
    .select('zone_code, weight_from, weight_to, base_price')
    .eq('price_list_id', list.id)
    .limit(20)
    .order('weight_from');

  if (entries) {
    console.table(entries);
  }
}

main().catch(console.error);
