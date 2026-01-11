import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

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
  const migrationFile = path.resolve(__dirname, '../supabase/migrations/101_reseller_clone_supplier_price_lists.sql');
  console.log(`📂 Leggo migrazione: ${migrationFile}`);
  
  try {
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    console.log('🔄 Eseguo migration via RPC exec_sql...');
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
       console.error('❌ Errore esecuzione RPC exec_sql:', error);
       console.error('⚠️ La funzione exec_sql potrebbe non essere abilitata in questo ambiente.');
       console.log('\n--- CONTENUTO SQL DA ESEGUIRE MANUALMENTE SU SUPABASE STUDIO ---\n');
       console.log(sql);
       console.log('\n--------------------------------------------------------------\n');
       console.log('📋 Apri Supabase Studio → SQL Editor → Incolla e Esegui il SQL sopra\n');
    } else {
       console.log('✅ Migration 098 eseguita con successo!');
       console.log('📋 Funzioni create:');
       console.log('  - reseller_clone_supplier_price_list()');
       console.log('  - reseller_assign_price_list()');
       console.log('  - reseller_validate_assignment() trigger');
       console.log('📋 RLS Policies aggiornate:');
       console.log('  - price_lists_insert (fix P1)');
       console.log('  - price_lists_update (fix P2)');
    }

  } catch (err: any) {
    console.error('❌ Errore lettura file:', err.message);
  }
}

runMigration();
