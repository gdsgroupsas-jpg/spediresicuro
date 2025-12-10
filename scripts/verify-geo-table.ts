
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Force load .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase URL or Anon Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkGeoTable() {
  console.log('🌍 Verifying table: geo_locations');
  console.log(`📡 URL: ${supabaseUrl}`);
  // Do NOT log the full key, just length
  console.log(`🔑 Key Length: ${supabaseKey!.length}`);

  try {
    // 1. Check if we can select 1 row
    const { data, error, count } = await supabase
      .from('geo_locations')
      .select('name', { count: 'exact', head: true });

    if (error) {
      console.error('❌ Error querying geo_locations (HEAD):');
      console.error('❌ Error querying geo_locations (HEAD):', error);
      return;
    }
    
    console.log(`✅ Connection OK. Total rows: ${count}`);

    // 2. Try the Search query (Sarno)
    const searchTerm = 'sarno:*';
    console.log(`🔍 Testing search for: "${searchTerm}"...`);
    
    const { data: searchData, error: searchError } = await supabase
      .from('geo_locations')
      .select('name, province, region, caps')
      .textSearch('search_vector', searchTerm, {
        type: 'websearch', 
        config: 'italian',
      })
      .limit(5);

     if (searchError) {
      console.error('❌ Error executing textSearch:');
      console.error(JSON.stringify(searchError, null, 2));
      
      if (searchError.message.includes('does not exist') || searchError.code === '42703') {
           console.log('💡 HINT: Does the column "search_vector" exist? Is it generated?');
      }
      return;
    }
    
    console.log(`✅ Search result count: ${searchData?.length}`);
    if (searchData?.length > 0) {
        console.log('📝 Sample:', JSON.stringify(searchData[0]));
    }

  } catch (e: any) {
    console.error('❌ Unexpected error:', e.message);
  }
}

checkGeoTable();
