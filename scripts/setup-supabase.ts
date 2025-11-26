/**
 * Script di Setup Automatico Supabase
 * 
 * Questo script automatizza la configurazione di Supabase:
 * 1. Verifica connessione
 * 2. Esegue lo schema SQL
 * 3. Verifica che tutto sia configurato correttamente
 * 
 * Utilizzo:
 *   npm run setup:supabase
 * 
 * Requisiti:
 *   - Variabili SUPABASE configurate in .env.local
 *   - Account Supabase creato
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

// Carica variabili ambiente
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Legge lo schema SQL dal file
 */
function readSchemaSQL(): string {
  const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
  
  if (!fs.existsSync(schemaPath)) {
    throw new Error(`File schema.sql non trovato in ${schemaPath}`);
  }

  return fs.readFileSync(schemaPath, 'utf-8');
}

/**
 * Esegue query SQL su Supabase
 */
async function executeSQL(supabase: ReturnType<typeof createClient>, sql: string): Promise<void> {
  // Supabase non ha un metodo diretto per eseguire SQL arbitrario
  // Dobbiamo usare l'API REST direttamente
  
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY!,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ sql }),
  });

  if (!response.ok) {
    // Prova metodo alternativo: esegui query per parti
    console.log('⚠️  Metodo RPC non disponibile, provo approccio alternativo...');
    await executeSQLByParts(supabase, sql);
  }
}

/**
 * Esegue SQL dividendolo in parti (per query che non supportano RPC)
 */
async function executeSQLByParts(
  supabase: ReturnType<typeof createClient>,
  sql: string
): Promise<void> {
  // Dividi lo script in singole query
  const queries = sql
    .split(';')
    .map((q) => q.trim())
    .filter((q) => q.length > 0 && !q.startsWith('--'));

  console.log(`\n📝 Eseguo ${queries.length} query SQL...\n`);

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    
    // Salta commenti e istruzioni che non possiamo eseguire via client
    if (
      query.startsWith('COMMENT') ||
      query.startsWith('--') ||
      query.toLowerCase().includes('create extension')
    ) {
      console.log(`⏭️  Query ${i + 1} saltata (non eseguibile via client)`);
      continue;
    }

    try {
      // Per CREATE TABLE, INDEX, etc. dobbiamo usare l'API REST direttamente
      if (
        query.toLowerCase().startsWith('create') ||
        query.toLowerCase().startsWith('alter') ||
        query.toLowerCase().startsWith('drop')
      ) {
        console.log(`🔧 Query ${i + 1}/${queries.length}: ${query.substring(0, 50)}...`);
        
        // Usa l'API REST di Supabase per DDL
        const response = await fetch(`${SUPABASE_URL}/rest/v1/`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_KEY!,
            'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ query }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          // Se è un errore "already exists", va bene
          if (!errorText.includes('already exists') && !errorText.includes('duplicate')) {
            console.warn(`⚠️  Query ${i + 1} ha generato warning: ${errorText.substring(0, 100)}`);
          } else {
            console.log(`✅ Query ${i + 1} completata (già esistente)`);
          }
        } else {
          console.log(`✅ Query ${i + 1} completata`);
        }
      }
    } catch (error) {
      console.warn(`⚠️  Errore query ${i + 1}:`, error instanceof Error ? error.message : error);
    }
  }
}

/**
 * Verifica che la tabella esista e sia configurata correttamente
 */
async function verifyTable(supabase: any): Promise<{
  exists: boolean;
  isConfigured: boolean;
  recordCount: number;
  missingColumns: string[];
}> {
  const requiredColumns = ['id', 'name', 'province', 'region', 'caps', 'search_vector', 'created_at', 'updated_at'];
  
  try {
    // Prova a fare una query sulla tabella
    const { data, error } = await supabase
      .from('geo_locations')
      .select('*')
      .limit(1);

    if (error) {
      if (error.message.includes('does not exist') || error.message.includes('relation')) {
        return {
          exists: false,
          isConfigured: false,
          recordCount: 0,
          missingColumns: requiredColumns,
        };
      }
      throw error;
    }

    // Verifica colonne
    const missingColumns: string[] = [];
    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      requiredColumns.forEach((col) => {
        if (!columns.includes(col)) {
          missingColumns.push(col);
        }
      });
    } else {
      // Tabella vuota, verifica struttura tramite query specifica
      const { error: structureError } = await supabase
        .from('geo_locations')
        .select('id, name, province, region, caps, search_vector, created_at, updated_at')
        .limit(0);
      
      if (structureError) {
        // Se anche questa query fallisce, la struttura è sbagliata
        return {
          exists: true,
          isConfigured: false,
          recordCount: 0,
          missingColumns: requiredColumns,
        };
      }
    }

    // Conta record
    const { count } = await supabase
      .from('geo_locations')
      .select('*', { count: 'exact', head: true });

    return {
      exists: true,
      isConfigured: missingColumns.length === 0,
      recordCount: count || 0,
      missingColumns,
    };
  } catch (error) {
    console.error('❌ Errore verifica:', error);
    return {
      exists: false,
      isConfigured: false,
      recordCount: 0,
      missingColumns: requiredColumns,
    };
  }
}

/**
 * Funzione principale
 */
async function main() {
  console.log('🚀 Setup Automatico Supabase\n');
  console.log('=' .repeat(50));
  console.log('');

  // 1. Verifica configurazione
  console.log('📋 Passo 1: Verifica configurazione...\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ ERRORE: Variabili ambiente mancanti!\n');
    console.error('   Richiesti in .env.local:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY\n');
    console.error('   Ottieni questi valori da:');
    console.error('   https://app.supabase.com → Settings → API\n');
    process.exit(1);
  }

  console.log('✅ Variabili ambiente configurate');
  console.log(`   URL: ${SUPABASE_URL}\n`);

  // 2. Crea client Supabase
  console.log('📋 Passo 2: Connessione a Supabase...\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Test connessione
  try {
    const { data, error } = await supabase.from('geo_locations').select('id').limit(0);
    
    if (error && !error.message.includes('does not exist')) {
      // Se l'errore non è "tabella non esiste", c'è un problema di connessione
      throw error;
    }

    console.log('✅ Connessione a Supabase riuscita\n');
  } catch (error) {
    console.error('❌ ERRORE: Impossibile connettersi a Supabase\n');
    console.error('   Verifica:');
    console.error('   1. URL Supabase corretto');
    console.error('   2. Service Role Key corretta');
    console.error('   3. Progetto Supabase attivo\n');
    process.exit(1);
  }

  // 3. Verifica se la tabella esiste già
  console.log('📋 Passo 3: Verifica tabella geo_locations...\n');

  const tableStatus = await verifyTable(supabase);

  if (tableStatus.exists && tableStatus.isConfigured) {
    // Tabella esiste e è configurata correttamente
    console.log('✅ Tabella geo_locations già configurata!');
    console.log(`   Record presenti: ${tableStatus.recordCount}\n`);

    if (tableStatus.recordCount === 0) {
      console.log('💡 La tabella è vuota. Per popolarla, esegui:');
      console.log('   npm run seed:geo\n');
    } else {
      console.log('🎉 Setup completo! La tabella è configurata e contiene dati.\n');
      console.log('💡 Per verificare tutto, esegui:');
      console.log('   npm run verify:supabase\n');
    }
    return; // Esci, tutto è già configurato
  }

  // 4. Leggi schema SQL
  console.log('📋 Passo 4: Lettura schema SQL...\n');

  let schemaSQL: string;
  try {
    schemaSQL = readSchemaSQL();
    console.log('✅ Schema SQL letto\n');
  } catch (error) {
    console.error('❌ ERRORE:', error instanceof Error ? error.message : error);
    process.exit(1);
  }

  // 5. Istruzioni per creare la tabella
  if (!tableStatus.exists) {
    console.log('📋 Passo 5: Creazione tabella\n');
    console.log('❌ Tabella geo_locations non trovata!\n');
    console.log('⚠️  IMPORTANTE: Supabase richiede esecuzione manuale dello schema SQL\n');
    console.log('   Segui questi passi:\n');
    console.log('   1. Vai su: https://app.supabase.com');
    console.log('   2. Seleziona il tuo progetto');
    console.log('   3. Vai su "SQL Editor" (menu laterale)');
    console.log('   4. Clicca "New query"');
    console.log('   5. Copia e incolla il contenuto di: supabase/schema.sql');
    console.log('   6. Clicca "Run" (o premi Ctrl+Enter)\n');
    console.log('   File schema: supabase/schema.sql\n');
  } else if (!tableStatus.isConfigured) {
    console.log('📋 Passo 5: Correzione struttura tabella\n');
    console.log('⚠️  Tabella esiste ma mancano alcune colonne!\n');
    console.log(`   Colonne mancanti: ${tableStatus.missingColumns.join(', ')}\n`);
    console.log('   Devi eseguire lo schema SQL per aggiungere le colonne mancanti:\n');
    console.log('   1. Vai su: https://app.supabase.com');
    console.log('   2. Seleziona il tuo progetto');
    console.log('   3. Vai su "SQL Editor"');
    console.log('   4. Esegui il contenuto di: supabase/schema.sql\n');
  }

  // 6. Mostra anteprima schema SQL
  console.log('📄 Anteprima schema SQL (prime 500 caratteri):\n');
  console.log('─'.repeat(50));
  console.log(schemaSQL.substring(0, 500) + '...\n');
  console.log('─'.repeat(50));
  console.log('\n   (File completo: supabase/schema.sql)\n');

  // 7. Istruzioni post-setup
  console.log('💡 Dopo aver eseguito lo schema SQL:\n');
  console.log('   1. Verifica la configurazione:');
  console.log('      npm run verify:supabase\n');
  console.log('   2. Popola il database con i comuni:');
  console.log('      npm run seed:geo\n');
}

// Esegui
main().catch((error) => {
  console.error('\n❌ ERRORE CRITICO:', error);
  if (error instanceof Error) {
    console.error('   Messaggio:', error.message);
    console.error('   Stack:', error.stack);
  }
  process.exit(1);
});

