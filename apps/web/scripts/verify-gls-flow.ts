/**
 * Script per verificare il flusso GLS specificamente
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyGLSFlow() {
  console.log('🔍 VERIFICA FLUSSO GLS\n');

  // GLS custom list ID (from diagnostic)
  const glsCustomListId = '8315b222-9e00-4131-bc36-66b76f56c6b0';

  const { data: customList } = await supabase
    .from('price_lists')
    .select('id, name, master_list_id, list_type, vat_mode, vat_rate, created_by')
    .eq('id', glsCustomListId)
    .single();

  if (!customList) {
    console.log('❌ Listino GLS non trovato');
    return;
  }

  console.log('📋 LISTINO GLS CUSTOM:');
  console.log(`   Nome: ${customList.name}`);
  console.log(`   ID: ${customList.id}`);
  console.log(`   master_list_id: ${customList.master_list_id}`);
  console.log(`   vat_mode: ${customList.vat_mode}`);
  console.log(`   vat_rate: ${customList.vat_rate}`);

  const { calculatePriceWithRules } = await import('../lib/db/price-lists-advanced');

  const testParams = {
    weight: 1.5,
    destination: {
      zip: '20100',
      province: 'MI',
      region: 'Lombardia',
      country: 'IT',
    },
    serviceType: 'standard' as const,
    options: {},
  };

  console.log('\n📦 Parametri test: 1.5kg, Milano (20100, MI)\n');

  const result = await calculatePriceWithRules(customList.created_by!, testParams, glsCustomListId);

  console.log('\n' + '═'.repeat(60));
  console.log('📊 RISULTATO GLS:');
  if (!result) {
    console.log('   ❌ Nessun risultato!');
  } else {
    console.log(`   finalPrice: €${result.finalPrice?.toFixed(2) || 'N/A'}`);
    console.log(`   supplierPrice: €${result.supplierPrice?.toFixed(2) || 'undefined ⚠️'}`);
    console.log(
      `   supplierPriceOriginal: €${(result as any).supplierPriceOriginal?.toFixed(2) || 'undefined'}`
    );

    if (result.supplierPrice !== undefined) {
      const margin = result.finalPrice - result.supplierPrice;
      const marginPercent = (margin / result.finalPrice) * 100;
      console.log(`\n   ✅ Margine: €${margin.toFixed(2)} (${marginPercent.toFixed(2)}%)`);
    } else {
      console.log('\n   ⚠️ supplierPrice è undefined!');
    }
  }
  console.log('═'.repeat(60));
}

verifyGLSFlow().catch(console.error);
