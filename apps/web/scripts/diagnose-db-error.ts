import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('=== DIAGNOSING DB INSERT ERROR ===');

  const { data: users } = await supabase.from('users').select('id, email').limit(1);
  const user = users?.[0];

  if (!user) {
    console.log('No user found.');
    return;
  }

  const timestamp = Date.now();

  const baseConfig = {
    name: `Probe ${timestamp}`,
    provider_id: 'spedisci_online',
    api_key: `key_${timestamp}`,
    base_url: 'http://probe.com',
    created_by: user.email,
    owner_user_id: user.id,
  };

  // 1. Insert first
  console.log('Attempting Insert 1...');
  const { data: c1, error: e1 } = await supabase
    .from('courier_configs')
    .insert(baseConfig)
    .select()
    .single();

  if (e1) {
    console.log('Insert 1 Failed:', JSON.stringify(e1, null, 2));
    if (c1)
      await supabase
        .from('courier_configs')
        .delete()
        .eq('id', (c1 as any).id);
    return;
  }
  console.log('Insert 1 Success:', (c1 as any).id);

  // 2. Insert duplicate
  console.log('Attempting Insert 2 (Duplicate)...');
  const { data: c2, error: e2 } = await supabase
    .from('courier_configs')
    .insert(baseConfig)
    .select()
    .single();

  if (e2) {
    console.log('Insert 2 Failed (EXPECTED if constraint exists):');
    console.log(JSON.stringify(e2, null, 2));
  } else {
    console.log('✅ Insert 2 Success! Constraint is GONE.');
    if (c2)
      await supabase
        .from('courier_configs')
        .delete()
        .eq('id', (c2 as any).id);
  }

  // Cleanup
  if (c1)
    await supabase
      .from('courier_configs')
      .delete()
      .eq('id', (c1 as any).id);
}

main().catch(console.error);
