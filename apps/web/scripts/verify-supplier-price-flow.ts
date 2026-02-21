/**
 * Script per verificare il flusso completo del supplierPrice
 *
 * Questo script testa l'intero flusso di calcolo del costo fornitore:
 * 1. calculatePriceWithRules (singolo listino)
 * 2. calculateBestPriceForReseller (selezione migliore)
 * 3. Verifica che supplierPrice sia restituito correttamente
 *
 * Eseguire con: npx tsx scripts/verify-supplier-price-flow.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifySupplierPriceFlow() {
  console.log('🔍 ════════════════════════════════════════════════════════════');
  console.log('🔍 VERIFICA FLUSSO COMPLETO SUPPLIER PRICE');
  console.log('🔍 ════════════════════════════════════════════════════════════\n');

  // 1. Trova un listino custom con master_list_id
  const { data: customLists, error: listError } = await supabase
    .from('price_lists')
    .select(
      'id, name, master_list_id, list_type, default_margin_percent, default_margin_fixed, vat_mode, vat_rate'
    )
    .eq('list_type', 'custom')
    .eq('status', 'active')
    .not('master_list_id', 'is', null)
    .limit(1);

  if (listError || !customLists || customLists.length === 0) {
    console.log('❌ Nessun listino custom con master_list_id trovato');
    console.log('   Errore:', listError?.message);
    return;
  }

  const customList = customLists[0];
  console.log('📋 LISTINO CUSTOM TROVATO:');
  console.log(`   Nome: ${customList.name}`);
  console.log(`   ID: ${customList.id}`);
  console.log(`   master_list_id: ${customList.master_list_id}`);
  console.log(`   list_type: ${customList.list_type}`);
  console.log(`   default_margin_percent: ${customList.default_margin_percent || 'NULL'}`);
  console.log(`   default_margin_fixed: ${customList.default_margin_fixed || 'NULL'}`);
  console.log(`   vat_mode: ${customList.vat_mode || 'NULL'}`);
  console.log(`   vat_rate: ${customList.vat_rate || 'NULL'}`);

  // 2. Recupera il master list
  const { data: masterList, error: masterError } = await supabase
    .from('price_lists')
    .select('id, name, list_type, vat_mode, vat_rate')
    .eq('id', customList.master_list_id)
    .single();

  if (masterError || !masterList) {
    console.log('❌ Master list non trovato');
    console.log('   Errore:', masterError?.message);
    return;
  }

  console.log('\n📦 MASTER LIST TROVATO:');
  console.log(`   Nome: ${masterList.name}`);
  console.log(`   ID: ${masterList.id}`);
  console.log(`   list_type: ${masterList.list_type}`);
  console.log(`   vat_mode: ${masterList.vat_mode || 'NULL'}`);
  console.log(`   vat_rate: ${masterList.vat_rate || 'NULL'}`);

  // 3. Conta entries per entrambi
  const { count: customCount } = await supabase
    .from('price_list_entries')
    .select('*', { count: 'exact', head: true })
    .eq('price_list_id', customList.id);

  const { count: masterCount } = await supabase
    .from('price_list_entries')
    .select('*', { count: 'exact', head: true })
    .eq('price_list_id', masterList.id);

  console.log('\n📊 ENTRIES:');
  console.log(`   Custom list: ${customCount || 0} entries`);
  console.log(`   Master list: ${masterCount || 0} entries`);

  if (!masterCount || masterCount === 0) {
    console.log('   ⚠️ PROBLEMA: Master list non ha entries!');
    console.log('      Il calcolo del supplierPrice fallirà.');
    return;
  }

  // 4. Trova utente proprietario del listino
  const { data: assignments } = await supabase
    .from('price_list_assignments')
    .select('user_id')
    .eq('price_list_id', customList.id)
    .is('revoked_at', null)
    .limit(1);

  // Fallback: usa created_by se non ci sono assignments
  const { data: listDetails } = await supabase
    .from('price_lists')
    .select('created_by')
    .eq('id', customList.id)
    .single();

  const userId = assignments?.[0]?.user_id || listDetails?.created_by;

  if (!userId) {
    console.log('❌ Nessun utente associato al listino');
    return;
  }

  const { data: user } = await supabase
    .from('users')
    .select('id, email, is_reseller, account_type')
    .eq('id', userId)
    .single();

  console.log('\n👤 UTENTE:');
  console.log(`   ID: ${user?.id}`);
  console.log(`   Email: ${user?.email}`);
  console.log(`   is_reseller: ${user?.is_reseller}`);
  console.log(`   account_type: ${user?.account_type}`);

  // 5. Test calcolo prezzo diretto con calculatePriceWithRules
  console.log('\n' + '─'.repeat(60));
  console.log('🧪 TEST: calculatePriceWithRules\n');

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

  console.log('📦 Parametri test:');
  console.log(`   peso: ${testParams.weight}kg`);
  console.log(`   CAP: ${testParams.destination.zip}`);
  console.log(`   Provincia: ${testParams.destination.province}`);
  console.log(`   service_type: ${testParams.serviceType}`);

  const result = await calculatePriceWithRules(userId!, testParams, customList.id);

  console.log('\n📊 RISULTATO calculatePriceWithRules:');
  if (!result) {
    console.log('   ❌ Nessun risultato!');
  } else {
    console.log(`   basePrice: €${result.basePrice?.toFixed(2) || 'N/A'}`);
    console.log(`   surcharges: €${result.surcharges?.toFixed(2) || 'N/A'}`);
    console.log(`   margin: €${result.margin?.toFixed(2) || 'N/A'}`);
    console.log(`   totalCost: €${result.totalCost?.toFixed(2) || 'N/A'}`);
    console.log(`   finalPrice: €${result.finalPrice?.toFixed(2) || 'N/A'}`);
    console.log(`   supplierPrice: €${result.supplierPrice?.toFixed(2) || 'undefined ⚠️'}`);
    console.log(
      `   supplierPriceOriginal: €${(result as any).supplierPriceOriginal?.toFixed(2) || 'undefined'}`
    );
    console.log(`   priceListId: ${result.priceListId}`);
    console.log(`   appliedPriceList.name: ${(result.appliedPriceList as any)?.name || 'N/A'}`);

    // Verifica supplierPrice
    if (result.supplierPrice === undefined) {
      console.log('\n   ⚠️ PROBLEMA RILEVATO:');
      console.log('      supplierPrice è undefined!');
      console.log('      Questo significa che il calcolo dal master list è fallito.');
      console.log('      Controlla i log sopra per vedere cosa è andato storto.');
    } else if (result.supplierPrice === result.totalCost) {
      console.log('\n   ⚠️ ATTENZIONE:');
      console.log('      supplierPrice === totalCost');
      console.log("      Questo potrebbe indicare che non c'è margine applicato.");
    } else {
      console.log('\n   ✅ supplierPrice è correttamente diverso da totalCost');
      const margin = result.finalPrice - result.supplierPrice;
      const marginPercent = (margin / result.finalPrice) * 100;
      console.log(`      Margine calcolato: €${margin.toFixed(2)} (${marginPercent.toFixed(2)}%)`);
    }
  }

  // 6. Simula come l'API formatta il risultato
  console.log('\n' + '─'.repeat(60));
  console.log('📤 SIMULAZIONE RISPOSTA API:\n');

  if (result) {
    const supplierPrice =
      (result as any).supplierPriceOriginal ??
      result.supplierPrice ??
      result.totalCost ??
      result.basePrice ??
      0;

    const rate = {
      total_price: result.finalPrice.toString(),
      weight_price: supplierPrice.toString(),
      margin: result.margin?.toString() || '0',
    };

    console.log('   Rate che verrebbe inviato al frontend:');
    console.log(`     total_price: ${rate.total_price} (prezzo vendita)`);
    console.log(`     weight_price: ${rate.weight_price} (costo fornitore)`);
    console.log(`     margin: ${rate.margin}`);

    const frontendMargin = parseFloat(rate.total_price) - parseFloat(rate.weight_price);
    const frontendMarginPercent = (frontendMargin / parseFloat(rate.total_price)) * 100;

    console.log('\n   📊 Margine che vedrebbe il frontend:');
    console.log(`     €${frontendMargin.toFixed(2)} (${frontendMarginPercent.toFixed(2)}%)`);

    if (result.supplierPrice === undefined) {
      console.log('\n   ⚠️ PROBLEMA:');
      console.log(
        '      Poiché supplierPrice è undefined, weight_price usa totalCost come fallback.'
      );
      console.log(
        '      Questo potrebbe dare un margine ERRATO se totalCost non è il costo fornitore reale.'
      );
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log('🔍 FINE VERIFICA');
  console.log('═'.repeat(60) + '\n');
}

verifySupplierPriceFlow().catch(console.error);
