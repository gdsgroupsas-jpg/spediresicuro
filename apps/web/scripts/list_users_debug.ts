import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) (console.error('Missing env'), process.exit(1));

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function listUsers() {
  const { data: users, error } = await supabaseAdmin
    .from('users')
    .select('id, email, account_type, is_reseller, role, name')
    .limit(20);

  if (error) console.error(error);
  else console.table(users);
}

listUsers();
