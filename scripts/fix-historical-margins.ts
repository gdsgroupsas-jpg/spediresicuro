/**
 * Script per correggere i margini storici delle spedizioni
 *
 * Le spedizioni create PRIMA del fix hanno base_price errato.
 * Questo script:
 * 1. Identifica spedizioni con margine potenzialmente errato
 * 2. Ricalcola il costo fornitore dal master list
 * 3. Aggiorna base_price e platform_provider_costs
 *
 * Eseguire con: npx tsx scripts/fix-historical-margins.ts
 * Aggiungere --dry-run per vedere cosa verrebbe modificato senza applicare
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DRY_RUN = process.argv.includes('--dry-run');

async function fixHistoricalMargins() {
  console.log('🔧 ════════════════════════════════════════════════════════════');
  console.log('🔧 FIX MARGINI STORICI SPEDIZIONI');
  console.log(
    `🔧 Modalità: ${DRY_RUN ? 'DRY RUN (nessuna modifica)' : '⚠️ APPLICAZIONE MODIFICHE'}`
  );
  console.log('🔧 ════════════════════════════════════════════════════════════\n');

  // 1. Recupera tutte le spedizioni con i loro costi
  const { data: shipments, error: shipError } = await supabase
    .from('shipments')
    .select(
      `
      id,
      tracking_number,
      carrier,
      total_cost,
      final_price,
      base_price,
      margin_percent,
      created_at,
      user_id,
      recipient_zip,
      recipient_province,
      packages
    `
    )
    .eq('deleted', false)
    .order('created_at', { ascending: false })
    .limit(100); // Limita per sicurezza

  if (shipError) {
    console.error('❌ Errore recupero spedizioni:', shipError.message);
    return;
  }

  if (!shipments || shipments.length === 0) {
    console.log('✅ Nessuna spedizione trovata');
    return;
  }

  console.log(`📋 Trovate ${shipments.length} spedizioni da analizzare\n`);

  // 2. Recupera platform_provider_costs
  const shipmentIds = shipments.map((s) => s.id);
  const { data: providerCosts } = await supabase
    .from('platform_provider_costs')
    .select('shipment_id, provider_cost, price_list_id, master_price_list_id')
    .in('shipment_id', shipmentIds);

  const providerCostMap = new Map<string, any>();
  if (providerCosts) {
    for (const pc of providerCosts) {
      providerCostMap.set(pc.shipment_id, pc);
    }
  }

  // 3. Recupera listini custom con master_list_id
  const { data: customLists } = await supabase
    .from('price_lists')
    .select('id, name, master_list_id, metadata, source_metadata, vat_mode, vat_rate')
    .eq('list_type', 'custom')
    .eq('status', 'active')
    .not('master_list_id', 'is', null);

  // Mappa contract_code -> price_list
  const contractToList = new Map<string, any>();
  if (customLists) {
    for (const pl of customLists) {
      const metadata = pl.metadata || pl.source_metadata || {};
      const contractCode = (metadata as any).contract_code;
      const carrierCode = (metadata as any).carrier_code;
      if (contractCode) contractToList.set(contractCode.toLowerCase(), pl);
      if (carrierCode) contractToList.set(carrierCode.toLowerCase(), pl);
    }
  }

  // Import calculator
  const { calculatePriceFromList } = await import('../lib/pricing/calculator');

  // 4. Analizza ogni spedizione
  let fixCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const shipment of shipments) {
    const finalPrice = parseFloat(shipment.final_price || shipment.total_cost || '0');
    const currentBasePrice = parseFloat(shipment.base_price || '0');
    const providerCost = providerCostMap.get(shipment.id);

    console.log(`\n─────────────────────────────────────────────`);
    console.log(`📦 ${shipment.tracking_number || shipment.id}`);
    console.log(`   Corriere: ${shipment.carrier}`);
    console.log(`   Data: ${new Date(shipment.created_at).toLocaleDateString('it-IT')}`);
    console.log(`   Final Price: €${finalPrice.toFixed(2)}`);
    console.log(`   Base Price (attuale): €${currentBasePrice.toFixed(2)}`);

    // Calcola margine attuale
    const currentMargin = finalPrice - currentBasePrice;
    const currentMarginPercent = finalPrice > 0 ? (currentMargin / finalPrice) * 100 : 0;
    console.log(
      `   Margine attuale: €${currentMargin.toFixed(2)} (${currentMarginPercent.toFixed(1)}%)`
    );

    // Trova listino per corriere
    const carrierKey = shipment.carrier?.toLowerCase() || '';
    let priceList = contractToList.get(carrierKey);

    // Prova anche con prefisso comune
    if (!priceList) {
      for (const [key, pl] of contractToList.entries()) {
        if (key.includes(carrierKey) || carrierKey.includes(key.split('-')[0])) {
          priceList = pl;
          break;
        }
      }
    }

    if (!priceList) {
      console.log(`   ⚠️ Nessun listino custom trovato per corriere "${shipment.carrier}"`);
      skipCount++;
      continue;
    }

    console.log(`   📋 Listino: ${priceList.name} (master: ${priceList.master_list_id})`);

    // Recupera master list con entries
    const { data: masterList } = await supabase
      .from('price_lists')
      .select('*, entries:price_list_entries(*)')
      .eq('id', priceList.master_list_id)
      .single();

    if (!masterList || !masterList.entries || masterList.entries.length === 0) {
      console.log(`   ⚠️ Master list non trovato o senza entries`);
      skipCount++;
      continue;
    }

    // Calcola peso dalla spedizione
    let weight = 1;
    try {
      const packages =
        typeof shipment.packages === 'string' ? JSON.parse(shipment.packages) : shipment.packages;
      if (packages && Array.isArray(packages)) {
        weight = packages.reduce((sum: number, p: any) => sum + (parseFloat(p.weight) || 0), 0);
      }
    } catch (e) {
      // Usa peso default
    }

    // Calcola prezzo fornitore dal master
    const masterResult = calculatePriceFromList(
      masterList as any,
      weight,
      shipment.recipient_zip || '',
      'standard',
      undefined,
      shipment.recipient_province,
      undefined
    );

    if (!masterResult) {
      console.log(`   ⚠️ Impossibile calcolare prezzo dal master list`);
      skipCount++;
      continue;
    }

    const correctBasePrice = masterResult.basePrice + (masterResult.surcharges || 0);
    console.log(`   ✅ Costo fornitore corretto: €${correctBasePrice.toFixed(2)}`);

    // Calcola nuovo margine
    const newMargin = finalPrice - correctBasePrice;
    const newMarginPercent = finalPrice > 0 ? (newMargin / finalPrice) * 100 : 0;
    console.log(`   📊 Nuovo margine: €${newMargin.toFixed(2)} (${newMarginPercent.toFixed(1)}%)`);

    // Verifica se c'è differenza significativa
    const diff = Math.abs(currentBasePrice - correctBasePrice);
    if (diff < 0.01) {
      console.log(`   ✅ Base price già corretto`);
      skipCount++;
      continue;
    }

    console.log(`   🔄 Differenza: €${diff.toFixed(2)} - DA CORREGGERE`);
    fixCount++;

    if (!DRY_RUN) {
      // Aggiorna base_price nella spedizione
      const { error: updateShipmentError } = await supabase
        .from('shipments')
        .update({ base_price: correctBasePrice })
        .eq('id', shipment.id);

      if (updateShipmentError) {
        console.log(`   ❌ Errore aggiornamento shipment: ${updateShipmentError.message}`);
        errorCount++;
        continue;
      }

      // Aggiorna platform_provider_costs se esiste
      if (providerCost) {
        const { error: updateCostError } = await supabase
          .from('platform_provider_costs')
          .update({ provider_cost: correctBasePrice })
          .eq('shipment_id', shipment.id);

        if (updateCostError) {
          console.log(`   ⚠️ Errore aggiornamento provider_cost: ${updateCostError.message}`);
        }
      }

      console.log(`   ✅ Aggiornato!`);
    }
  }

  // Riepilogo
  console.log('\n' + '═'.repeat(60));
  console.log('📊 RIEPILOGO:');
  console.log(`   Spedizioni analizzate: ${shipments.length}`);
  console.log(`   Da correggere: ${fixCount}`);
  console.log(`   Già corrette/skip: ${skipCount}`);
  console.log(`   Errori: ${errorCount}`);

  if (DRY_RUN && fixCount > 0) {
    console.log('\n⚠️ DRY RUN - Nessuna modifica applicata');
    console.log('   Per applicare le correzioni, eseguire senza --dry-run');
  }

  console.log('═'.repeat(60) + '\n');
}

fixHistoricalMargins().catch(console.error);
