
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
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  const migrationFile = path.resolve(__dirname, '../supabase/migrations/025_add_invoices_system.sql');
  console.log(`📂 Leggo migrazione: ${migrationFile}`);
  
  try {
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('🚀 Esecuzione Migration via RPC (exec_sql)...');
    
    // Tenta esecuzione via RPC
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
       console.error('❌ Errore RPC exec_sql:', error.message);
       console.log('⚠️  Se fallisce perché la funzione non esiste, esegui manualmente l\'SQL su Supabase Studio.');
    } else {
       console.log('✅ Migrazione eseguita con successo!');
    }

  } catch (err) {
    console.error('❌ Errore generale:', err.message);
  }
}

runMigration();
