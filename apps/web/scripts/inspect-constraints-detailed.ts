import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('Inspecting courier_configs constraints and indexes...');

  // We can query pg_indexes and pg_constraints via rpc if allowed, or just try to provoke a unique error to see the name.
  // Since we don't have a handy RPC for schema inspection, we will try the insertion test again.
  // If it works => Constraint is gone.
  // If it fails => The error message will tell us the EXACT name of the constraint/index.

  const { data: users } = await supabase.from('users').select('id, email').limit(1);
  const user = users?.[0];
  if (!user) {
    console.log('No user found.');
    return;
  }

  const baseConfig = {
    name: 'Probe Config',
    provider_id: 'spedisci_online',
    api_key: 'probe_key',
    base_url: 'http://probe.com',
    created_by: user.email,
    owner_user_id: user.id,
  };

  // 1. Insert first
  const { data: c1, error: e1 } = await supabase
    .from('courier_configs')
    .insert(baseConfig)
    .select()
    .single();

  // 2. Insert duplicate
  const { data: c2, error: e2 } = await supabase
    .from('courier_configs')
    .insert(baseConfig)
    .select()
    .single();

  if (e2) {
    console.log('❌ CONFIRMED: Duplicate insertion blocked.');
    console.log('Error details:', e2);
    console.log('Error Message:', e2.message);
    // The details usually contain the constraint name
    // e.g. 'duplicate key value violates unique constraint "courier_configs_owner_provider_key"'
  } else {
    console.log('✅ SUCCESS: Duplicate insertion allowed! The constraint is gone or inactive.');

    // Cleanup
    if (c2) await supabase.from('courier_configs').delete().eq('id', c2.id);
  }

  // Cleanup proper
  if (c1) await supabase.from('courier_configs').delete().eq('id', c1.id);
}

main().catch(console.error);
