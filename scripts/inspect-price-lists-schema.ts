import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectSchema() {
  console.log("Inspecting 'price_lists' table schema...");

  // Try to insert a dummy record to see column errors or just get one record to see keys
  // Better yet, query information_schema if possible, but RLS/permissions often block it.
  // We'll just fetch a single row and print its keys.

  const { data, error } = await supabase.from('price_lists').select('*').limit(1);

  if (error) {
    console.error('Error fetching price_lists:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Found columns:', Object.keys(data[0]));
  } else {
    console.log('No data found in price_lists. Cannot infer columns from data.');
    console.log(
      'Attempting to insert dummy to fail and list columns in error (sometimes works)...'
    );
  }
}

inspectSchema();
