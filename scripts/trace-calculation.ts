/**
 * Script per tracciare il calcolo prezzo passo-passo
 *
 * Simula esattamente cosa succede quando si richiede un preventivo
 * per verificare dove fallisce il recupero del supplierPrice.
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { calculatePriceFromList } from '../lib/pricing/calculator';
import type { PriceList } from '../types/listini';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function trace() {
  console.log('🔍 TRACCIAMENTO CALCOLO PREZZO');
  console.log('═'.repeat(60));

  // Dati test - simulano una spedizione reale
  const testParams = {
    weight: 1.5, // kg
    destination: {
      zip: '20100', // Milano
      province: 'MI',
      region: 'Lombardia',
      country: 'IT',
    },
    serviceType: 'standard' as const,
  };

  console.log('\n📦 PARAMETRI TEST:');
  console.log(`   Peso: ${testParams.weight}kg`);
  console.log(`   CAP: ${testParams.destination.zip}`);
  console.log(`   Provincia: ${testParams.destination.province}`);
  console.log(`   Service Type: ${testParams.serviceType}`);

  // 1. Recupera listino custom GLS
  const customListId = '8315b222-9e00-4131-bc36-66b76f56c6b0'; // gls 5000 rivendita

  const { data: customList, error: customError } = await supabase
    .from('price_lists')
    .select('*, entries:price_list_entries(*)')
    .eq('id', customListId)
    .single();

  if (customError || !customList) {
    console.log('❌ Errore recupero listino custom:', customError?.message);
    return;
  }

  console.log(`\n🎨 LISTINO CUSTOM: ${customList.name}`);
  console.log(`   master_list_id: ${customList.master_list_id}`);
  console.log(`   entries: ${customList.entries?.length || 0}`);

  // 2. Calcola prezzo dal listino CUSTOM
  console.log('\n📊 CALCOLO DA LISTINO CUSTOM:');
  const customResult = calculatePriceFromList(
    customList as PriceList,
    testParams.weight,
    testParams.destination.zip,
    testParams.serviceType,
    undefined,
    testParams.destination.province,
    testParams.destination.region
  );

  if (customResult) {
    console.log(`   ✅ basePrice: €${customResult.basePrice.toFixed(2)}`);
    console.log(`   ✅ surcharges: €${customResult.surcharges.toFixed(2)}`);
    console.log(`   ✅ totalCost: €${customResult.totalCost.toFixed(2)}`);
  } else {
    console.log('   ❌ Nessuna entry trovata!');
  }

  // 3. Recupera listino MASTER
  if (!customList.master_list_id) {
    console.log('\n❌ PROBLEMA: master_list_id è NULL!');
    return;
  }

  const { data: masterList, error: masterError } = await supabase
    .from('price_lists')
    .select('*, entries:price_list_entries(*)')
    .eq('id', customList.master_list_id)
    .single();

  if (masterError || !masterList) {
    console.log('❌ Errore recupero listino master:', masterError?.message);
    return;
  }

  console.log(`\n📦 LISTINO MASTER: ${masterList.name}`);
  console.log(`   ID: ${masterList.id}`);
  console.log(`   entries: ${masterList.entries?.length || 0}`);

  // 4. Calcola prezzo dal listino MASTER
  console.log('\n📊 CALCOLO DA LISTINO MASTER:');
  const masterResult = calculatePriceFromList(
    masterList as PriceList,
    testParams.weight,
    testParams.destination.zip,
    testParams.serviceType,
    undefined,
    testParams.destination.province,
    testParams.destination.region
  );

  if (masterResult) {
    console.log(`   ✅ basePrice (supplierPrice): €${masterResult.basePrice.toFixed(2)}`);
    console.log(`   ✅ surcharges: €${masterResult.surcharges.toFixed(2)}`);
    console.log(`   ✅ totalCost: €${masterResult.totalCost.toFixed(2)}`);
  } else {
    console.log('   ❌ Nessuna entry trovata nel master!');

    // Debug: mostra le prime entries del master
    console.log('\n🔍 DEBUG: Prime entries del master:');
    const entries = (masterList.entries as any[]) || [];
    entries.slice(0, 5).forEach((e, i) => {
      console.log(
        `   ${i + 1}. Peso ${e.weight_from}-${e.weight_to}kg, zone: ${e.zone_code || 'NULL'}, service: ${e.service_type || 'NULL'}, €${e.base_price}`
      );
    });

    // Verifica matching manuale
    console.log('\n🔍 DEBUG: Verifica matching manuale:');
    const matchingEntries = entries.filter((e: any) => {
      const weightMatch = testParams.weight >= e.weight_from && testParams.weight <= e.weight_to;
      const serviceMatch = e.service_type === testParams.serviceType;
      return weightMatch && serviceMatch;
    });
    console.log(`   Entries che matchano peso e service: ${matchingEntries.length}`);
    matchingEntries.slice(0, 5).forEach((e: any, i: number) => {
      console.log(`   ${i + 1}. zone: ${e.zone_code || 'NULL'}, €${e.base_price}`);
    });
  }

  // 5. Confronto finale
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RIEPILOGO:');
  if (customResult && masterResult) {
    const margin = customResult.basePrice - masterResult.basePrice;
    const marginPercent = ((margin / masterResult.basePrice) * 100).toFixed(2);
    console.log(`   Prezzo vendita (custom): €${customResult.basePrice.toFixed(2)}`);
    console.log(`   Costo fornitore (master): €${masterResult.basePrice.toFixed(2)}`);
    console.log(`   Margine: €${margin.toFixed(2)} (${marginPercent}%)`);
    console.log('   ✅ CORRETTO: supplierPrice verrebbe restituito!');
  } else if (customResult && !masterResult) {
    console.log(`   Prezzo vendita (custom): €${customResult.basePrice.toFixed(2)}`);
    console.log('   Costo fornitore (master): ❌ NON TROVATO');
    console.log('   ⚠️ PROBLEMA: supplierPrice sarà undefined!');
  } else {
    console.log('   ❌ Entrambi i calcoli falliti');
  }
}

trace().catch(console.error);
