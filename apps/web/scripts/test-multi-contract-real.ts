/**
 * TEST REALE: Sincronizzazione Multi-Contratto
 * Verifica che i due contratti creino listini SEPARATI
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("❌ Variabili d'ambiente mancanti");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const TEST_EMAIL = 'testspediresicuro+postaexpress@gmail.com';

async function main() {
  console.log('🚀 TEST MULTI-CONTRATTO SYNC - REAL API CALLS');
  console.log('═'.repeat(80));

  // 1. Recupera utente
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, account_type, is_reseller')
    .eq('email', TEST_EMAIL)
    .single();

  if (userError || !user) {
    console.error('❌ Utente non trovato:', userError?.message);
    return;
  }

  console.log(`\n✅ Utente: ${user.email}`);
  console.log(`   Account Type: ${user.account_type}`);
  console.log(`   Is Reseller: ${user.is_reseller}`);

  // 2. Recupera tutte le configurazioni Spedisci.Online
  const { data: configs, error: configError } = await supabase
    .from('courier_configs')
    .select('id, name, provider_id, is_active, created_at')
    .eq('owner_user_id', user.id)
    .eq('provider_id', 'spedisci_online')
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  if (configError) {
    console.error('❌ Errore recupero config:', configError.message);
    return;
  }

  const configCount = configs?.length || 0;
  console.log(`\n📋 Configurazioni Spedisci.Online trovate: ${configCount}`);
  if (configs) {
    configs.forEach((c, i) => {
      console.log(`   ${i + 1}. ${c.name || 'Unnamed'}`);
      console.log(`      ID: ${c.id}`);
      console.log(`      Created: ${new Date(c.created_at).toLocaleString('it-IT')}`);
    });
  }

  if (configCount < 2) {
    console.log('\n⚠️ ATTENZIONE: Servono almeno 2 configurazioni per testare multi-contratto');
    console.log(`   Trovate: ${configCount}`);
    if (configCount === 1) {
      console.log('\n   Procedo comunque con test singolo contratto...');
    } else {
      console.log('\n   ❌ Nessuna configurazione trovata. Uscita.');
      return;
    }
  }

  // 3. Verifica listini PRIMA della sync
  console.log('\n' + '═'.repeat(80));
  console.log('📊 STATO PRIMA DELLA SYNC');
  console.log('═'.repeat(80));

  const { data: existingLists } = await supabase
    .from('price_lists')
    .select('id, name, metadata, source_metadata, created_at')
    .eq('created_by', user.id)
    .eq('list_type', 'supplier')
    .order('created_at', { ascending: false });

  const existingCount = existingLists?.length || 0;
  console.log(`\nListini fornitore esistenti: ${existingCount}`);
  if (existingLists && existingCount > 0) {
    existingLists.forEach((list, i) => {
      const metadata = list.metadata || list.source_metadata || {};
      console.log(`   ${i + 1}. ${list.name}`);
      console.log(`      ID: ${list.id.substring(0, 8)}...`);
      console.log(`      Carrier: ${metadata.carrier_code || 'N/A'}`);
      const configIdStr = metadata.courier_config_id || 'N/A';
      console.log(
        `      ConfigID: ${configIdStr === 'N/A' ? configIdStr : configIdStr.substring(0, 8) + '...'}`
      );
    });
  }

  // 4. Test sync di ciascun contratto
  console.log('\n' + '═'.repeat(80));
  console.log('🧪 TEST SYNC CONTRATTI (CHIAMATE API REALI)');
  console.log('═'.repeat(80));

  if (!configs || configCount === 0) {
    console.log('\n❌ Nessuna configurazione da testare');
    return;
  }

  for (const currentConfig of configs) {
    console.log(`\n📡 Sync contratto: ${currentConfig.name || 'Unnamed'}`);
    console.log(`   ConfigID: ${currentConfig.id.substring(0, 8)}...`);

    // Import della funzione sync (dynamic import per evitare problemi)
    const syncModule = await import('../actions/spedisci-online-rates');
    const { syncPriceListsFromSpedisciOnline } = syncModule;

    try {
      const result = await syncPriceListsFromSpedisciOnline({
        configId: currentConfig.id,
        mode: 'fast', // Fast per velocità test
      });

      if (result.success) {
        console.log(`   ✅ Sync completata!`);
        console.log(`      Listini creati: ${result.priceListsCreated || 0}`);
        console.log(`      Listini aggiornati: ${result.priceListsUpdated || 0}`);
        console.log(`      Entries aggiunte: ${result.entriesAdded || 0}`);
        const carriers = result.details?.carriersProcessed || [];
        console.log(`      Corrieri: ${carriers.join(', ') || 'N/A'}`);
      } else {
        console.log(`   ❌ Sync fallita: ${result.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      console.error(`   ❌ Errore durante sync: ${err.message}`);
      console.error(`      Stack: ${err.stack?.substring(0, 200)}`);
    }

    // Pausa tra sync per evitare rate limiting
    console.log(`   ⏸️  Pausa 3 secondi...`);
    await new Promise((r) => setTimeout(r, 3000));
  }

  // 5. Verifica listini DOPO la sync
  console.log('\n' + '═'.repeat(80));
  console.log('📊 STATO DOPO LA SYNC');
  console.log('═'.repeat(80));

  const { data: finalLists } = await supabase
    .from('price_lists')
    .select('id, name, metadata, source_metadata, created_at, updated_at')
    .eq('created_by', user.id)
    .eq('list_type', 'supplier')
    .order('updated_at', { ascending: false });

  const finalCount = finalLists?.length || 0;
  console.log(`\nListini fornitore totali: ${finalCount}`);

  // Raggruppa per configId
  const byConfig = new Map<string, any[]>();
  if (finalLists) {
    finalLists.forEach((list) => {
      const metadata = list.metadata || list.source_metadata || {};
      const configId = metadata.courier_config_id || 'unknown';
      if (!byConfig.has(configId)) {
        byConfig.set(configId, []);
      }
      const configLists = byConfig.get(configId);
      if (configLists) {
        configLists.push(list);
      }
    });
  }

  console.log('\n📋 Listini per Contratto:');
  byConfig.forEach((lists, configId) => {
    const configIdShort = configId === 'unknown' ? 'unknown' : configId.substring(0, 8) + '...';
    console.log(`\n   ConfigID: ${configIdShort}`);
    lists.forEach((list) => {
      const metadata = list.metadata || list.source_metadata || {};
      console.log(`      • ${list.name}`);
      console.log(`        Carrier: ${metadata.carrier_code || 'N/A'}`);
      console.log(`        Updated: ${new Date(list.updated_at).toLocaleString('it-IT')}`);
    });
  });

  // 6. VALIDAZIONE RISULTATI
  console.log('\n' + '═'.repeat(80));
  console.log('✅ VALIDAZIONE');
  console.log('═'.repeat(80));

  const expectedContracts = configCount;
  const actualContracts = byConfig.size;

  console.log(`\n📊 Contratti configurati: ${expectedContracts}`);
  console.log(`📦 Contratti con listini: ${actualContracts}`);

  if (actualContracts >= expectedContracts) {
    console.log(`\n✅ SUCCESS! Ogni contratto ha i propri listini separati`);
  } else {
    console.log(`\n❌ FAIL! Alcuni contratti non hanno listini separati`);
    console.log(`   Expected: ${expectedContracts}, Got: ${actualContracts}`);
  }

  // Verifica che ogni contratto abbia almeno 1 corriere
  let allOk = true;
  byConfig.forEach((lists, configId) => {
    const carriers = new Set(
      lists
        .map((l) => {
          const m = l.metadata || l.source_metadata || {};
          return m.carrier_code;
        })
        .filter(Boolean)
    );
    const configIdShort = configId === 'unknown' ? 'unknown' : configId.substring(0, 8);
    if (carriers.size === 0) {
      console.log(`   ❌ ConfigID ${configIdShort} non ha corrieri`);
      allOk = false;
    } else {
      const carrierList = Array.from(carriers).join(', ');
      console.log(`   ✅ ConfigID ${configIdShort} → ${carriers.size} corriere/i: ${carrierList}`);
    }
  });

  console.log('\n' + '═'.repeat(80));
  if (allOk && actualContracts >= expectedContracts) {
    console.log('🎉 TEST PASSED - Multi-contratto funziona correttamente!');
  } else {
    console.log('❌ TEST FAILED - Controllare i listini manualmente');
  }
  console.log('═'.repeat(80));
}

main().catch(console.error);
