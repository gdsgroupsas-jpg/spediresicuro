import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function findAnne() {
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('id, email, account_type, is_reseller, role')
    .ilike('email', '%anne%');

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Found users:', JSON.stringify(users, null, 2));
  }
}

findAnne();
