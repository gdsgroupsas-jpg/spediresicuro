import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const { supabaseAdmin } = await import('@/lib/db/client');

  const { data: pl } = await supabaseAdmin
    .from('price_lists')
    .select('id, metadata')
    .eq('status', 'active')
    .ilike('name', 'SpediamoPro - InPost Italia (Sconto 22%')
    .single();

  if (!pl) {
    console.log('Not found');
    process.exit(1);
  }

  const meta = (pl.metadata || {}) as any;
  meta.courier_config_id = '9fdfe17c-6915-43b6-be5a-847d7be1bdad';
  meta.config_id = '9fdfe17c-6915-43b6-be5a-847d7be1bdad';

  const { error } = await supabaseAdmin
    .from('price_lists')
    .update({ metadata: meta })
    .eq('id', pl.id);

  if (error) {
    console.log('Error:', error.message);
  } else {
    console.log('Updated config_id for', pl.id);
  }
  process.exit(0);
}

main();
