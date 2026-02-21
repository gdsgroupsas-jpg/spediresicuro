/**
 * Script per applicare migration 056_add_list_type.sql
 *
 * Uso: node scripts/apply-migration-056.js
 */

const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

// Carica environment
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Manca NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
  console.error('   Verifica che .env.local contenga queste variabili');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  const migrationFile = path.resolve(__dirname, '../supabase/migrations/056_add_list_type.sql');
  console.log(`📂 Leggo migrazione: ${migrationFile}`);

  if (!fs.existsSync(migrationFile)) {
    console.error(`❌ File migration non trovato: ${migrationFile}`);
    process.exit(1);
  }

  try {
    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('🚀 Esecuzione Migration 056 via RPC (exec_sql)...');
    console.log('   Se la funzione exec_sql non esiste, esegui manualmente su Supabase Dashboard');

    // Tenta esecuzione via RPC
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
      console.error('❌ Errore RPC exec_sql:', error.message);
      console.log('\n⚠️  La funzione exec_sql potrebbe non esistere.');
      console.log("📋 Esegui manualmente l'SQL su Supabase Dashboard > SQL Editor");
      console.log(`📄 File: ${migrationFile}`);
      process.exit(1);
    } else {
      console.log('✅ Migrazione 056 eseguita con successo!');
      console.log('✅ Campo list_type aggiunto a price_lists');
    }
  } catch (err) {
    console.error('❌ Errore generale:', err.message);
    console.log("\n📋 Esegui manualmente l'SQL su Supabase Dashboard > SQL Editor");
    process.exit(1);
  }
}

runMigration();
