/**
 * Script di Seeding per Geo-Locations
 *
 * Scarica i dati dei comuni italiani da GitHub e li popola in Supabase.
 *
 * Utilizzo:
 *   npm run seed:geo
 *
 * Requisiti:
 *   - Variabile SUPABASE_SERVICE_ROLE_KEY configurata in .env.local
 *   - Tabella geo_locations creata in Supabase (eseguire schema.sql prima)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Carica variabili ambiente da .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Configurazione
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GITHUB_JSON_URL =
  'https://raw.githubusercontent.com/matteocontrini/comuni-json/master/comuni.json';

// Interfaccia per i dati dal JSON GitHub
interface ComuneJSON {
  nome: string;
  provincia: {
    nome: string;
    codice: string;
  };
  regione: {
    nome: string;
    codice: string;
  };
  sigla?: string; // Codice provincia abbreviato (es. "PD", "RM")
  cap: string[];
}

// Interfaccia per i dati da inserire in Supabase
interface GeoLocationRow {
  name: string;
  province: string;
  region: string;
  caps: string[];
}

/**
 * Trasforma i dati dal formato JSON GitHub al formato database
 */
function transformComune(comune: ComuneJSON): GeoLocationRow {
  // Controlli di sicurezza per evitare errori con valori undefined/null
  const nome = comune.nome?.trim() || '';
  // Usa la sigla (es. "PD", "RM") se disponibile, altrimenti il codice provincia
  const provinciaCode = (
    comune.sigla?.trim() ||
    comune.provincia?.codice?.trim() ||
    ''
  ).toUpperCase();
  const regione = comune.regione?.nome?.trim() || '';
  const caps = Array.isArray(comune.cap)
    ? comune.cap.map((cap) => String(cap || '').trim()).filter((cap) => cap.length > 0)
    : [];

  return {
    name: nome,
    province: provinciaCode,
    region: regione,
    caps: caps,
  };
}

/**
 * Inserisce i dati in batch per evitare timeout
 */
async function insertBatch(
  supabase: ReturnType<typeof createClient>,
  data: GeoLocationRow[],
  batchSize: number = 1000
): Promise<void> {
  const total = data.length;
  let inserted = 0;
  let errors = 0;

  console.log(`\n📦 Inserimento ${total} comuni in batch da ${batchSize}...\n`);

  for (let i = 0; i < total; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(total / batchSize);

    try {
      // Upsert: inserisce o aggiorna se esiste già (basato su name + province)
      // Nota: upsert con onConflict richiede un unique constraint, usiamo insert con ignoreDuplicates
      const { error } = await supabase.from('geo_locations').insert(batch as any);

      if (error) {
        console.error(`❌ Errore batch ${batchNum}/${totalBatches}:`, error.message);
        errors++;
      } else {
        inserted += batch.length;
        const percent = ((inserted / total) * 100).toFixed(1);
        console.log(
          `✅ Batch ${batchNum}/${totalBatches} completato: ${inserted}/${total} comuni (${percent}%)`
        );
      }
    } catch (err) {
      console.error(`❌ Eccezione batch ${batchNum}/${totalBatches}:`, err);
      errors++;
    }

    // Piccola pausa tra batch per non sovraccaricare il database
    if (i + batchSize < total) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  console.log(`\n📊 Riepilogo:`);
  console.log(`   ✅ Inseriti: ${inserted}`);
  console.log(`   ❌ Errori: ${errors}`);
}

/**
 * Funzione principale
 */
async function main() {
  console.log('🚀 Avvio seeding geo-locations...\n');

  // Verifica configurazione
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ ERRORE: Variabili ambiente mancanti!');
    console.error('   Richiesti:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    console.error('\n   Aggiungili in .env.local e riprova.\n');
    process.exit(1);
  }

  // Crea client Supabase Admin
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }) as any; // Type assertion per evitare errori TypeScript con tipi generici

  try {
    // 1. Scarica dati da GitHub
    console.log('📥 Download dati comuni da GitHub...');
    const response = await fetch(GITHUB_JSON_URL);

    if (!response.ok) {
      throw new Error(`Errore download: ${response.status} ${response.statusText}`);
    }

    const comuniJSON: ComuneJSON[] = await response.json();
    console.log(`✅ Scaricati ${comuniJSON.length} comuni\n`);

    // 2. Filtra e trasforma i dati (esclude comuni con dati incompleti)
    console.log('🔄 Trasformazione dati...');
    const geoLocations = comuniJSON
      .filter((comune) => {
        // Filtra comuni con dati essenziali mancanti
        return (
          comune.nome &&
          comune.provincia &&
          (comune.provincia.codice || comune.sigla) &&
          comune.regione &&
          comune.regione.nome
        );
      })
      .map(transformComune)
      .filter((loc) => loc.name && loc.province && loc.region); // Filtra anche dopo trasformazione per sicurezza

    console.log(
      `✅ Trasformati ${geoLocations.length} comuni (${comuniJSON.length - geoLocations.length} esclusi per dati incompleti)\n`
    );

    // 3. Verifica che la tabella esista
    console.log('🔍 Verifica tabella geo_locations...');
    const { error: tableError } = await supabase.from('geo_locations').select('id').limit(1);

    if (tableError) {
      console.error('❌ ERRORE: Tabella geo_locations non trovata!');
      console.error('   Esegui prima lo schema SQL in supabase/schema.sql\n');
      process.exit(1);
    }
    console.log('✅ Tabella verificata\n');

    // 4. Inserisci i dati in batch
    await insertBatch(supabase, geoLocations, 1000);

    // 5. Verifica finale
    console.log('\n🔍 Verifica finale...');
    const { count, error: countError } = await supabase
      .from('geo_locations')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('❌ Errore verifica:', countError.message);
    } else {
      console.log(`✅ Totale comuni nel database: ${count}\n`);
    }

    console.log('🎉 Seeding completato con successo!\n');
  } catch (error) {
    console.error('\n❌ ERRORE CRITICO:', error);
    if (error instanceof Error) {
      console.error('   Messaggio:', error.message);
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

// Esegui lo script
main().catch((error) => {
  console.error('Errore non gestito:', error);
  process.exit(1);
});
