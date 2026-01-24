/**
 * Script di diagnostica per verificare le entries dei listini
 *
 * Verifica:
 * 1. service_type nelle entries (match vs mismatch)
 * 2. Confronto entries tra master e custom
 * 3. Fasce di peso coperte
 *
 * Eseguire con: npx tsx scripts/diagnose-entries.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Mancano variabili ambiente');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnoseEntries() {
  console.log('🔍 ========================================');
  console.log('🔍 DIAGNOSTICA ENTRIES LISTINI');
  console.log('🔍 ========================================\n');

  // 1. Recupera listini custom attivi con master_list_id
  const { data: customLists, error: customError } = await supabase
    .from('price_lists')
    .select('id, name, master_list_id, list_type, status')
    .eq('list_type', 'custom')
    .eq('status', 'active')
    .not('master_list_id', 'is', null);

  if (customError) {
    console.error('❌ Errore recupero listini custom:', customError.message);
    process.exit(1);
  }

  if (!customLists || customLists.length === 0) {
    console.log('⚠️ Nessun listino custom con master_list_id trovato');
    return;
  }

  console.log(`📋 Trovati ${customLists.length} listini custom con master_list_id\n`);

  for (const customList of customLists) {
    console.log(`\n🎨 LISTINO CUSTOM: ${customList.name}`);
    console.log('─'.repeat(60));
    console.log(`   ID: ${customList.id}`);
    console.log(`   master_list_id: ${customList.master_list_id}`);

    // Recupera entries custom
    const { data: customEntries } = await supabase
      .from('price_list_entries')
      .select('id, weight_from, weight_to, base_price, service_type, zone_code')
      .eq('price_list_id', customList.id)
      .order('weight_from', { ascending: true })
      .limit(10);

    // Recupera master list
    const { data: masterList } = await supabase
      .from('price_lists')
      .select('id, name, list_type, status')
      .eq('id', customList.master_list_id)
      .single();

    if (!masterList) {
      console.log(`   ❌ Master list NON TROVATO!`);
      continue;
    }

    console.log(`\n📦 MASTER LIST: ${masterList.name}`);
    console.log(`   ID: ${masterList.id}`);
    console.log(`   Tipo: ${masterList.list_type}`);
    console.log(`   Status: ${masterList.status}`);

    // Recupera entries master
    const { data: masterEntries } = await supabase
      .from('price_list_entries')
      .select('id, weight_from, weight_to, base_price, service_type, zone_code')
      .eq('price_list_id', masterList.id)
      .order('weight_from', { ascending: true })
      .limit(10);

    // Analisi service_type
    const { data: customServiceTypes } = await supabase
      .from('price_list_entries')
      .select('service_type')
      .eq('price_list_id', customList.id);

    const { data: masterServiceTypes } = await supabase
      .from('price_list_entries')
      .select('service_type')
      .eq('price_list_id', masterList.id);

    const customTypes = [...new Set((customServiceTypes || []).map((e) => e.service_type))];
    const masterTypes = [...new Set((masterServiceTypes || []).map((e) => e.service_type))];

    console.log(`\n📊 SERVICE_TYPE ANALYSIS:`);
    console.log(
      `   Custom service_types: ${customTypes.length > 0 ? customTypes.join(', ') : '(nessuno)'}`
    );
    console.log(
      `   Master service_types: ${masterTypes.length > 0 ? masterTypes.join(', ') : '(nessuno)'}`
    );

    // Verifica match
    const hasMatchingTypes = customTypes.some((ct) => masterTypes.includes(ct));
    if (!hasMatchingTypes) {
      console.log(`   ⚠️ PROBLEMA: service_type NON COINCIDONO!`);
      console.log(`   → Custom ha: [${customTypes.join(', ')}]`);
      console.log(`   → Master ha: [${masterTypes.join(', ')}]`);
      console.log(`   → calculatePriceFromList() sul master non troverà entries!`);
    } else {
      console.log(`   ✅ service_type compatibili`);
    }

    // Mostra prime entries per confronto
    console.log(`\n📝 PRIME ENTRIES CUSTOM (max 5):`);
    if (customEntries && customEntries.length > 0) {
      customEntries.slice(0, 5).forEach((e, i) => {
        console.log(
          `   ${i + 1}. Peso ${e.weight_from}-${e.weight_to}kg → €${e.base_price} (service: ${e.service_type || 'NULL'})`
        );
      });
    } else {
      console.log(`   ⚠️ Nessuna entry!`);
    }

    console.log(`\n📝 PRIME ENTRIES MASTER (max 5):`);
    if (masterEntries && masterEntries.length > 0) {
      masterEntries.slice(0, 5).forEach((e, i) => {
        console.log(
          `   ${i + 1}. Peso ${e.weight_from}-${e.weight_to}kg → €${e.base_price} (service: ${e.service_type || 'NULL'})`
        );
      });
    } else {
      console.log(`   ⚠️ Nessuna entry!`);
    }

    // Confronto prezzi per fascia 0-1kg (se esiste)
    console.log(`\n💰 CONFRONTO PREZZI (fascia 0-1kg, service=standard):`);

    const customEntry01 = customEntries?.find(
      (e) =>
        e.weight_from === 0 &&
        e.weight_to === 1 &&
        (e.service_type === 'standard' || e.service_type === null)
    );
    const masterEntry01 = masterEntries?.find(
      (e) =>
        e.weight_from === 0 &&
        e.weight_to === 1 &&
        (e.service_type === 'standard' || e.service_type === null)
    );

    if (customEntry01 && masterEntry01) {
      const diff =
        parseFloat(customEntry01.base_price as any) - parseFloat(masterEntry01.base_price as any);
      const marginPercent =
        diff > 0 ? ((diff / parseFloat(masterEntry01.base_price as any)) * 100).toFixed(2) : '0';
      console.log(`   Custom: €${customEntry01.base_price}`);
      console.log(`   Master: €${masterEntry01.base_price}`);
      console.log(`   Differenza: €${diff.toFixed(2)} (${marginPercent}% margine)`);

      if (Math.abs(diff) < 0.01) {
        console.log(`   ⚠️ ATTENZIONE: Prezzi identici! isManuallyModified sarà FALSE`);
      }
    } else {
      console.log(`   ⚠️ Entry 0-1kg standard non trovata in uno dei listini`);
      if (!customEntry01) console.log(`      → Custom: mancante`);
      if (!masterEntry01) console.log(`      → Master: mancante`);
    }
  }

  // 2. Verifica listini supplier senza entries
  console.log('\n\n🔍 ========================================');
  console.log('🔍 LISTINI SUPPLIER SENZA ENTRIES');
  console.log('🔍 ========================================\n');

  const { data: supplierLists } = await supabase
    .from('price_lists')
    .select(
      `
      id,
      name,
      list_type,
      status,
      entries:price_list_entries(count)
    `
    )
    .eq('list_type', 'supplier')
    .eq('status', 'active');

  if (supplierLists) {
    const emptySuppliers = supplierLists.filter((pl) => {
      const count = (pl.entries as any)?.[0]?.count || 0;
      return count === 0;
    });

    if (emptySuppliers.length > 0) {
      console.log(`⚠️ ${emptySuppliers.length} listini supplier SENZA entries:`);
      emptySuppliers.forEach((s) => {
        console.log(`   - ${s.name} (ID: ${s.id})`);
      });
    } else {
      console.log('✅ Tutti i listini supplier hanno entries');
    }
  }

  console.log('\n🔍 ========================================');
  console.log('🔍 FINE DIAGNOSTICA ENTRIES');
  console.log('🔍 ========================================\n');
}

diagnoseEntries().catch(console.error);
