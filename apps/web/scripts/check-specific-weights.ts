import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load Environment Variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkPrice(weight: number) {
  // Find the latest supplier price list
  const { data: list } = await supabase
    .from('price_lists')
    .select('id, name')
    .eq('list_type', 'supplier')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (!list) {
    console.log('❌ No price list found');
    return;
  }

  console.log(`📋 Checking List: ${list.name} for Weight: ${weight}kg`);

  // Find the matching entry for IT-STD (Standard Zone)
  // Logic: weight > weight_from AND weight <= weight_to
  const { data: entry, error } = await supabase
    .from('price_list_entries')
    .select('*')
    .eq('price_list_id', list.id)
    .eq('zone_code', 'IT-STD') // Check standard zone first
    .lte('weight_from', weight) // weight_from <= weight
    .gte('weight_to', weight) // weight_to >= weight
    .maybeSingle();

  // If strict range check fails (due to float precision or gaps), try finding the bucket that "contains" it
  // Usually: find first entry where weight_to >= weight
  if (!entry) {
    const { data: fallbackEntry } = await supabase
      .from('price_list_entries')
      .select('*')
      .eq('price_list_id', list.id)
      .eq('zone_code', 'IT-STD')
      .gte('weight_to', weight)
      .order('weight_to', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fallbackEntry) {
      console.log(
        `✅ Found Entry (Bucket strategy): ${fallbackEntry.weight_from}kg - ${fallbackEntry.weight_to}kg`
      );
      console.log(`💰 Price: €${fallbackEntry.base_price}`);
      return;
    }
    console.log('❌ No entry found for this weight.');
  } else {
    console.log(`✅ Found Exact Entry: ${entry.weight_from}kg - ${entry.weight_to}kg`);
    console.log(`💰 Price: €${entry.base_price}`);
  }
}

async function main() {
  await checkPrice(1.8);
  console.log('---');
  await checkPrice(2.6);
}

main();
