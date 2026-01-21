import * as dotenv from 'dotenv';
import { resolve } from 'path';

async function run() {
  // Force load envs
  const envPath = resolve(process.cwd(), '.env.local');
  // console.log("Loading env from:", envPath);
  dotenv.config({ path: envPath });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL is missing!');
    return;
  }

  // Dynamic import to avoid hoisting
  const { supabaseAdmin } = await import('@/lib/db/client');

  console.log('Inspecting idempotency_locks schema...');

  // Try to select one row
  const { data, error } = await supabaseAdmin.from('idempotency_locks').select('*').limit(1);

  if (error) {
    console.error('Error asking for idempotency_locks:', error.message);
  } else {
    console.log("✅ Table 'idempotency_locks' EXISTS.");
    if (data && data.length > 0) {
      console.log('Columns:', Object.keys(data[0]).join(', '));
    } else {
      // Try valid insert to check constraints? No, just confirmed existence.
      console.log('Table is empty or has data.');
    }
  }
}

run().catch(console.error);
