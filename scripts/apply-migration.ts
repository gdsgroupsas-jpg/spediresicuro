
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
  const migrationFile = path.resolve(__dirname, '../supabase/migrations/025_add_invoices_system.sql');
  console.log(`📂 Leggo migrazione: ${migrationFile}`);
  
  try {
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    // NOTA: Supabase JS client non ha un metodo .sql() diretto esposto pubblicamente in tutte le versioni,
    // MA spesso si usa rpc() se c'è una funzione 'exec_sql' o simile.
    // Se non c'è, bisogna usare il query editor o un tool esterno.
    // TENTATIVO: Splitto e provo a usare postgrest o un workaround, ma la cosa migliore qui 
    // visto che sono l'AI è chiedere all'utente di eseguirlo o sperare che ci sia una funzione 'exec' nel DB.
    
    // In alternativa, creo una funzione RPC 'exec' al volo se non esiste? No, rischio.
    // Controllo se esiste già un meccanismo di migrazione nello script.
    
    console.log('⚠️ ATTENZIONE: Esecuzione SQL diretta via client JS non è standard senza RPC.');
    
    // Fallback: Provo a usare una funzione RPC 'exec_sql' se esiste (comune in setup dev).
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
       // Se fallisce RPC, stampo l'errore e suggerisco esecuzione manuale
       console.error('❌ Errore esecuzione RPC exec_sql. Potrebbe non essere abilitata la funzione exec_sql.');
       console.error(error);
       console.log('\n--- CONTENUTO SQL DA ESEGUIRE MANUALMENTE SU SUPABASE STUDIO ---\n');
       console.log(sql);
       console.log('\n--------------------------------------------------------------\n');
    } else {
       console.log('✅ Migrazione eseguita con successo via RPC!');
    }

  } catch (err: any) {
    console.error('❌ Errore lettura file:', err.message);
  }
}

runMigration();
