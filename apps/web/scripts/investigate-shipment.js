const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function investigate() {
  // 1. Trova spedizioni recenti
  const { data: shipments, error } = await supabase
    .from('shipments')
    .select(
      'id, created_at, tracking_number, final_price, total_cost, base_price, margin_percent, api_source, carrier, user_id, status'
    )
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('Errore query shipments:', error);
    return;
  }

  console.log('=== ULTIME 5 SPEDIZIONI ===\n');
  for (const s of shipments) {
    console.log('ID:', s.id);
    console.log('Tracking:', s.tracking_number || 'N/A');
    console.log('Created:', s.created_at);
    console.log('Status:', s.status);
    console.log('Carrier:', s.carrier);
    console.log('api_source:', s.api_source || 'NULL');
    console.log('final_price:', s.final_price);
    console.log('total_cost:', s.total_cost);
    console.log('base_price:', s.base_price || 'NULL');
    console.log('margin_percent:', s.margin_percent || 'NULL');

    // 2. Verifica se esiste record in platform_provider_costs
    const { data: providerCost } = await supabase
      .from('platform_provider_costs')
      .select('*')
      .eq('shipment_id', s.id)
      .maybeSingle();

    if (providerCost) {
      console.log('platform_provider_costs: OK - provider_cost =', providerCost.provider_cost);
    } else {
      console.log('platform_provider_costs: MISSING');
    }
    console.log('---\n');
  }
}

investigate();
