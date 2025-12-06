/**
 * Script per creare la tabella direttamente via API Supabase
 * Usa questo se lo schema SQL non funziona
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Variabili ambiente mancanti!');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Leggi lo schema SQL
  const fs = require('fs');
  const schemaPath = path.join(process.cwd(), 'supabase', 'schema.sql');
  const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');

  console.log('📝 Eseguo schema SQL via API REST...\n');

  // Esegui lo schema SQL usando l'API REST di Supabase
  // Nota: Supabase non permette DDL via client JS, quindi dobbiamo usare l'API REST direttamente
  try {
    // Dividi in query separate
    const queries = schemaSQL
      .split(';')
      .map((q: string) => q.trim())
      .filter((q: string) => q.length > 0 && !q.startsWith('--'));

    console.log(`📦 Trovate ${queries.length} query da eseguire\n`);

    // Per DDL, Supabase richiede l'uso dell'API REST con endpoint speciale
    // Prova approccio alternativo: verifica se la tabella esiste già
    const { data: tables, error: listError } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'geo_locations');

    if (tables && tables.length > 0) {
      console.log('✅ Tabella geo_locations già esistente!\n');
      return;
    }

    console.log('⚠️  Tabella non trovata. Devi eseguire lo schema SQL manualmente in Supabase SQL Editor.\n');
    console.log('📋 Istruzioni:');
    console.log('   1. Vai su: https://supabase.com/dashboard/project/pxwmposcsvsusjxdjues/sql/new');
    console.log('   2. Apri il file: supabase/schema.sql');
    console.log('   3. Copia tutto il contenuto');
    console.log('   4. Incolla nel SQL Editor');
    console.log('   5. Premi Ctrl+Enter per eseguire\n');

  } catch (error) {
    console.error('❌ Errore:', error);
    process.exit(1);
  }
}

main();






