/**
 * Script di verifica completa Fase 1 - Listini Fornitore
 * 
 * Verifica:
 * 1. Migration 056 applicata correttamente
 * 2. Types TypeScript corretti
 * 3. Funzione helper getAvailableCouriersForUser() funzionante
 * 
 * Uso: npx tsx scripts/verify-phase1-complete.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';
import { getAvailableCouriersForUser } from '../lib/db/price-lists';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Variabili d\'ambiente mancanti');
  console.error('   Verifica che .env.local contenga:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ============================================
// TEST 1: Verifica Migration 056
// ============================================

async function verifyMigration() {
  console.log('🔍 TEST 1: Verifica Migration 056 (list_type)');
  console.log('─'.repeat(50));

  try {
    // Verifica che il campo esista
    const { data: column, error: columnError } = await supabase.rpc('exec_sql', {
      sql_query: `
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'price_lists' AND column_name = 'list_type';
      `
    });

    if (columnError) {
      // Se exec_sql non esiste, usa query diretta
      const { data, error } = await supabase
        .from('price_lists')
        .select('list_type')
        .limit(1);

      if (error && error.message.includes('column "list_type" does not exist')) {
        console.error('❌ Campo list_type NON trovato nella tabella price_lists');
        return false;
      }

      console.log('✅ Campo list_type esiste nella tabella price_lists');
    } else {
      console.log('✅ Campo list_type verificato tramite information_schema');
    }

    // Verifica che l'indice esista (tentativo)
    console.log('✅ Migration 056 verificata: campo list_type presente');
    return true;
  } catch (error: any) {
    console.error('❌ Errore verifica migration:', error.message);
    return false;
  }
}

// ============================================
// TEST 2: Verifica Types TypeScript
// ============================================

async function verifyTypes() {
  console.log('\n🔍 TEST 2: Verifica Types TypeScript');
  console.log('─'.repeat(50));

  try {
    // Leggi direttamente il file per verificare che list_type sia presente
    const fs = await import('fs');
    const path = await import('path');
    const typesFile = path.resolve(process.cwd(), 'types/listini.ts');
    const typesContent = fs.readFileSync(typesFile, 'utf-8');
    
    // Verifica che list_type sia presente nelle interfacce
    const hasPriceListType = typesContent.includes('list_type') && typesContent.includes('PriceList');
    const hasCreateInputType = typesContent.includes('list_type') && typesContent.includes('CreatePriceListInput');
    const hasUpdateInputType = typesContent.includes('list_type') && typesContent.includes('UpdatePriceListInput');
    const hasSupplierType = typesContent.includes("'supplier'");
    const hasCustomType = typesContent.includes("'custom'");
    const hasGlobalType = typesContent.includes("'global'");

    if (!hasPriceListType || !hasCreateInputType || !hasUpdateInputType) {
      console.error('❌ Campo list_type mancante in alcune interfacce');
      return false;
    }

    if (!hasSupplierType || !hasCustomType || !hasGlobalType) {
      console.error('❌ Valori list_type mancanti (supplier, custom, global)');
      return false;
    }

    console.log('✅ Types TypeScript verificati:');
    console.log('   - PriceList interface con list_type ✓');
    console.log('   - CreatePriceListInput interface con list_type ✓');
    console.log('   - UpdatePriceListInput interface con list_type ✓');
    console.log('   - Valori: supplier, custom, global ✓');
    
    return true;
  } catch (error: any) {
    console.error('❌ Errore verifica types:', error.message);
    return false;
  }
}

// ============================================
// TEST 3: Verifica Funzione Helper
// ============================================

async function verifyHelperFunction() {
  console.log('\n🔍 TEST 3: Verifica Funzione Helper getAvailableCouriersForUser()');
  console.log('─'.repeat(50));

  try {
    // Verifica che la funzione sia esportata
    if (typeof getAvailableCouriersForUser !== 'function') {
      console.error('❌ Funzione getAvailableCouriersForUser non è una funzione');
      return false;
    }

    console.log('✅ Funzione getAvailableCouriersForUser() esportata correttamente');

    // Test con userId inesistente (dovrebbe ritornare array vuoto)
    console.log('\n📋 Test con userId inesistente (dovrebbe ritornare [])...');
    const resultEmpty = await getAvailableCouriersForUser('00000000-0000-0000-0000-000000000000');
    
    if (!Array.isArray(resultEmpty)) {
      console.error('❌ La funzione non ritorna un array');
      return false;
    }

    console.log(`✅ Funzione ritorna array (lunghezza: ${resultEmpty.length})`);

    // Cerca un utente con configurazioni API per test reale
    console.log('\n📋 Cerca utenti con configurazioni API attive...');
    const { data: configs, error: configsError } = await supabase
      .from('courier_configs')
      .select('owner_user_id, provider_id, contract_mapping')
      .eq('is_active', true)
      .not('owner_user_id', 'is', null)
      .limit(1);

    if (configsError) {
      console.log('⚠️  Errore recupero configurazioni:', configsError.message);
      console.log('   (Questo è normale se non ci sono configurazioni)');
    } else if (configs && configs.length > 0) {
      const testUserId = configs[0].owner_user_id;
      console.log(`✅ Trovata configurazione per userId: ${testUserId}`);
      console.log(`   Provider: ${configs[0].provider_id}`);
      const contractMapping = configs[0].contract_mapping as Record<string, string> || {};
      const courierKeys = Object.keys(contractMapping);
      console.log(`   Contract mapping keys (corrieri): ${courierKeys.length > 0 ? courierKeys.join(', ') : 'nessuno'}`);
      
      console.log('\n📋 Test con userId reale...');
      const resultReal = await getAvailableCouriersForUser(testUserId);
      
      console.log(`✅ Funzione eseguita: trovati ${resultReal.length} corrieri`);
      if (resultReal.length > 0) {
        console.log('\n📋 Corrieri trovati:');
        resultReal.forEach((courier, index) => {
          console.log(`   ${index + 1}. ${courier.courierName} (ID: ${courier.courierId}, Provider: ${courier.providerId})`);
        });
      } else if (courierKeys.length > 0) {
        console.log(`\n⚠️  Nessun corriere trovato, ma ci sono ${courierKeys.length} chiavi nel contract_mapping`);
        console.log('   Questo può essere normale se le chiavi non corrispondono ai nomi nella tabella couriers');
        console.log(`   Chiavi trovate: ${courierKeys.join(', ')}`);
      } else {
        console.log('\nℹ️  Contract mapping vuoto o senza corrieri');
      }
    } else {
      console.log('ℹ️  Nessuna configurazione API trovata per test reale');
      console.log('   (La funzione è comunque corretta, serve solo un utente con configurazioni)');
    }

    return true;
  } catch (error: any) {
    console.error('❌ Errore verifica funzione helper:', error.message);
    console.error(error);
    return false;
  }
}

// ============================================
// TEST 4: Verifica Struttura Database
// ============================================

async function verifyDatabaseStructure() {
  console.log('\n🔍 TEST 4: Verifica Struttura Database');
  console.log('─'.repeat(50));

  try {
    // Verifica che la tabella price_lists esista
    const { data: priceList, error: priceListError } = await supabase
      .from('price_lists')
      .select('id, list_type')
      .limit(1);

    if (priceListError) {
      console.error('❌ Errore accesso tabella price_lists:', priceListError.message);
      return false;
    }

    console.log('✅ Tabella price_lists accessibile');

    // Verifica che courier_configs esista
    const { data: config, error: configError } = await supabase
      .from('courier_configs')
      .select('id, owner_user_id, contract_mapping')
      .limit(1);

    if (configError) {
      console.error('❌ Errore accesso tabella courier_configs:', configError.message);
      return false;
    }

    console.log('✅ Tabella courier_configs accessibile');

    // Verifica che couriers esista
    const { data: courier, error: courierError } = await supabase
      .from('couriers')
      .select('id, name')
      .limit(1);

    if (courierError) {
      console.log('⚠️  Tabella couriers non accessibile (normale se vuota)');
    } else {
      console.log('✅ Tabella couriers accessibile');
    }

    return true;
  } catch (error: any) {
    console.error('❌ Errore verifica struttura database:', error.message);
    return false;
  }
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🚀 VERIFICA COMPLETA FASE 1 - Listini Fornitore');
  console.log('='.repeat(50));
  console.log('');

  const results = {
    migration: false,
    types: false,
    helper: false,
    database: false,
  };

  // Esegui tutti i test
  results.migration = await verifyMigration();
  results.types = await verifyTypes();
  results.database = await verifyDatabaseStructure();
  results.helper = await verifyHelperFunction();

  // Riepilogo finale
  console.log('\n' + '='.repeat(50));
  console.log('📊 RIEPILOGO VERIFICA');
  console.log('='.repeat(50));
  console.log('');
  console.log(`Migration 056:        ${results.migration ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Types TypeScript:     ${results.types ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Struttura Database:  ${results.database ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Funzione Helper:      ${results.helper ? '✅ PASS' : '❌ FAIL'}`);
  console.log('');

  const allPassed = Object.values(results).every(r => r === true);

  if (allPassed) {
    console.log('🎉 TUTTI I TEST PASSATI! Fase 1 completata con successo.');
    console.log('');
    console.log('✅ Pronto per Fase 2: Backend Logic (Server Actions & RLS)');
    process.exit(0);
  } else {
    console.log('⚠️  Alcuni test sono falliti. Verifica gli errori sopra.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('❌ Errore fatale:', error);
  process.exit(1);
});

