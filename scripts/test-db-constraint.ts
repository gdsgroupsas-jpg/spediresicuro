import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Testing DB Constraint...');

  // 1. Get a user
  const { data: users } = await supabase.from('users').select('id, email').limit(1);
  if (!users || users.length === 0) {
    console.log('No users found to test.');
    return;
  }
  const user = users[0];
  console.log('Testing with user:', user.email);

  // 2. Create config 1
  const config1 = {
    name: 'Test Config 1',
    provider_id: 'spedisci_online',
    api_key: 'key1',
    base_url: 'http://test1.com',
    created_by: user.email,
    owner_user_id: user.id,
  };

  const { data: c1, error: e1 } = await supabase
    .from('courier_configs')
    .insert(config1)
    .select()
    .single();
  if (e1) {
    console.log('Error inserting config 1 (might already exist):', e1.message);
    // Try to fetch existing to confirm we have one
  } else {
    console.log('Inserted Config 1:', c1.id);
  }

  // 3. Create config 2 (SAME provider, SAME user)
  const config2 = {
    name: 'Test Config 2',
    provider_id: 'spedisci_online',
    api_key: 'key2',
    base_url: 'http://test2.com',
    created_by: user.email,
    owner_user_id: user.id,
  };

  const { data: c2, error: e2 } = await supabase
    .from('courier_configs')
    .insert(config2)
    .select()
    .single();

  if (e2) {
    console.log('❌ Insert Config 2 FAILED:', e2.message);
    console.log('Constraint exists!');
  } else {
    console.log('✅ Insert Config 2 SUCCESS:', c2.id);
    console.log('No unique constraint on (owner_user_id, provider_id)!');

    // Cleanup
    await supabase.from('courier_configs').delete().eq('id', c2.id);
    if (c1) await supabase.from('courier_configs').delete().eq('id', c1.id);
  }
}

main().catch(console.error);
