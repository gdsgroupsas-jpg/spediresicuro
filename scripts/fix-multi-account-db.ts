import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  console.log('🔧 === FIX MULTI-ACCOUNT CONSTRAINT ===\n');

  // Step 1: Drop the unique index if it exists
  console.log('⏳ Dropping idx_courier_configs_unique_owner_provider...');
  const { error: dropIndexError } = await supabase.rpc('exec_sql', {
    sql_query: 'DROP INDEX IF EXISTS idx_courier_configs_unique_owner_provider;',
  });

  if (dropIndexError) {
    console.log('⚠️  exec_sql RPC might not exist. Trying raw query approach...');
    // If exec_sql RPC doesn't exist, we'll need to do this via dashboard.
    // Let's check if the index/constraint exists first using pg_indexes
    const { data: indexes, error: indexCheckError } = await supabase
      .from('pg_indexes')
      .select('*')
      .eq('tablename', 'courier_configs')
      .ilike('indexname', '%owner%provider%');

    if (indexCheckError) {
      console.log('Cannot query pg_indexes directly. Providing SQL to run manually.\n');
      console.log('===========================================');
      console.log('ESEGUI QUESTO SQL NELLA SUPABASE DASHBOARD:');
      console.log('===========================================\n');
      console.log('DROP INDEX IF EXISTS idx_courier_configs_unique_owner_provider;');
      console.log(
        'ALTER TABLE courier_configs DROP CONSTRAINT IF EXISTS uq_courier_configs_owner_provider;\n'
      );
      console.log('===========================================\n');
      console.log('URL: https://supabase.com/dashboard/project/_/sql\n');
      return;
    }

    if (indexes && indexes.length > 0) {
      console.log(
        'Found indexes:',
        indexes.map((i: any) => i.indexname)
      );
    }
  } else {
    console.log('✅ Index dropped (or did not exist).');
  }

  // Step 2: Drop the constraint if it exists
  console.log('⏳ Dropping uq_courier_configs_owner_provider constraint...');
  const { error: dropConstraintError } = await supabase.rpc('exec_sql', {
    sql_query:
      'ALTER TABLE courier_configs DROP CONSTRAINT IF EXISTS uq_courier_configs_owner_provider;',
  });

  if (dropConstraintError) {
    console.log('⚠️  Could not drop constraint via RPC.');
  } else {
    console.log('✅ Constraint dropped (or did not exist).');
  }

  // Step 3: Verification - Try to insert two configs
  console.log('\n🧪 Verifying fix by attempting duplicate insert...');

  const { data: users } = await supabase.from('users').select('id, email').limit(1);
  const user = users?.[0];

  if (!user) {
    console.log('❌ No user found for test.');
    return;
  }

  const timestamp = Date.now();
  const baseConfig = {
    name: `Test Multi ${timestamp}`,
    provider_id: 'spedisci_online',
    api_key: `key_${timestamp}`,
    base_url: 'http://test.com',
    created_by: user.email,
    owner_user_id: user.id,
  };

  // Insert first
  const { data: c1, error: e1 } = await supabase
    .from('courier_configs')
    .insert(baseConfig)
    .select()
    .single();

  if (e1) {
    console.log('❌ Insert 1 failed:', e1.message);
    return;
  }
  console.log('✅ Insert 1 success.');

  // Insert second with different name
  const { data: c2, error: e2 } = await supabase
    .from('courier_configs')
    .insert({ ...baseConfig, name: `Test Multi 2 ${timestamp}` })
    .select()
    .single();

  if (e2) {
    console.log('❌ Insert 2 failed:', e2.message);
    console.log('   -> Constraint still exists or other error.');
    // Cleanup
    if (c1)
      await supabase
        .from('courier_configs')
        .delete()
        .eq('id', (c1 as any).id);
    return;
  }

  console.log('✅ Insert 2 success! CONSTRAINT IS GONE!');

  // Cleanup
  if (c1)
    await supabase
      .from('courier_configs')
      .delete()
      .eq('id', (c1 as any).id);
  if (c2)
    await supabase
      .from('courier_configs')
      .delete()
      .eq('id', (c2 as any).id);

  console.log('\n🎉 FIX VERIFIED: Multi-account support is now working!');
}

main().catch(console.error);
