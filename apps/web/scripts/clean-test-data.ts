import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function cleanTestData() {
  console.log('🧹 Pulizia dati di test...\n');

  // 1. Count before
  const { count: shipmentCount } = await supabase
    .from('shipments')
    .select('*', { count: 'exact', head: true });

  const { count: costCount } = await supabase
    .from('platform_provider_costs')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 Prima della pulizia:`);
  console.log(`   - shipments: ${shipmentCount || 0}`);
  console.log(`   - platform_provider_costs: ${costCount || 0}`);

  // 2. Pulisci platform_provider_costs
  const { error: del1 } = await supabase
    .from('platform_provider_costs')
    .delete()
    .gte('created_at', '1970-01-01');

  console.log(`\n🗑️  platform_provider_costs:`, del1 ? '❌ ' + del1.message : '✅ eliminati');

  // 3. Pulisci shipments
  const { error: del2 } = await supabase.from('shipments').delete().gte('created_at', '1970-01-01');

  console.log(`🗑️  shipments:`, del2 ? '❌ ' + del2.message : '✅ eliminati');

  // 4. Verify
  const { count: afterShipments } = await supabase
    .from('shipments')
    .select('*', { count: 'exact', head: true });

  const { count: afterCosts } = await supabase
    .from('platform_provider_costs')
    .select('*', { count: 'exact', head: true });

  console.log(`\n📊 Dopo la pulizia:`);
  console.log(`   - shipments: ${afterShipments || 0}`);
  console.log(`   - platform_provider_costs: ${afterCosts || 0}`);

  console.log('\n✅ Database pulito. Pronto per spedizioni reali con margini corretti.');
}

cleanTestData().catch(console.error);
