/**
 * Cleanup: archivia i vecchi listini InPost separati (S)/(M)/(L) e i tier Base/Sconto 12%
 *
 * Usage: npx tsx scripts/cleanup-old-pricelists.ts
 */

import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function cleanup() {
  const { supabaseAdmin } = await import('@/lib/db/client');

  console.log('═══════════════════════════════════════════════════');
  console.log('  CLEANUP: Archiviazione listini obsoleti');
  console.log('═══════════════════════════════════════════════════\n');

  // Get all active SpediamoPro lists
  const { data: allLists } = await supabaseAdmin
    .from('price_lists')
    .select('id, name, status')
    .eq('status', 'active')
    .ilike('name', 'SpediamoPro%');

  if (!allLists || allLists.length === 0) {
    console.log('Nessun listino SpediamoPro attivo trovato.');
    return;
  }

  console.log(`Trovati ${allLists.length} listini SpediamoPro attivi:\n`);

  let archived = 0;
  for (const pl of allLists) {
    const name = pl.name;

    // Archivia se:
    // 1. Vecchio listino separato S/M/L (contiene "(S)", "(M)", "(L)" nel nome)
    const isOldSml = /\((?:S|M|L)\)/.test(name);

    // 2. Tier Base o Sconto 12% (non contiene "Sconto 22%")
    const isUnusedTier = !name.includes('Sconto 22%');

    if (isOldSml || isUnusedTier) {
      await supabaseAdmin.from('price_lists').update({ status: 'archived' }).eq('id', pl.id);
      const reason = isOldSml ? 'vecchio S/M/L separato' : 'tier non usato';
      console.log(`  ✅ Archiviato (${reason}): ${name}`);
      archived++;
    } else {
      console.log(`  • Mantenuto: ${name}`);
    }
  }

  console.log(`\nArchiviati: ${archived}, Mantenuti: ${allLists.length - archived}`);

  // Show final state
  const { data: remaining } = await supabaseAdmin
    .from('price_lists')
    .select('id, name')
    .eq('status', 'active')
    .ilike('name', 'SpediamoPro%')
    .order('name');

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Listini SpediamoPro ATTIVI finali: ${remaining?.length || 0}`);
  console.log('═══════════════════════════════════════════════════');
  remaining?.forEach((pl) => console.log(`  • ${pl.name}`));
}

cleanup()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('ERRORE:', err);
    process.exit(1);
  });
