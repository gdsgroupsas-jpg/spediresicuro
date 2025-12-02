/**
 * Script per Verificare e Creare Utenti Demo in Supabase
 * 
 * Questo script verifica se gli utenti demo esistono in Supabase
 * e li crea se mancano.
 */

import { isSupabaseConfigured, supabaseAdmin } from '../lib/supabase';
import { findUserByEmail, createUser } from '../lib/database';

const DEMO_USERS = [
  {
    email: 'admin@spediresicuro.it',
    password: 'admin123',
    name: 'Admin',
    role: 'admin' as const,
  },
  {
    email: 'demo@spediresicuro.it',
    password: 'demo123',
    name: 'Demo User',
    role: 'user' as const,
  },
];

async function main() {
  console.log('🔍 Verifica Utenti Demo in Supabase\n');
  console.log('='.repeat(60));

  // Verifica configurazione Supabase
  if (!isSupabaseConfigured()) {
    console.error('❌ Supabase non è configurato!');
    console.error('   Verifica che queste variabili siano configurate:');
    console.error('   - NEXT_PUBLIC_SUPABASE_URL');
    console.error('   - NEXT_PUBLIC_SUPABASE_ANON_KEY');
    console.error('   - SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log('✅ Supabase configurato correttamente\n');

  // Verifica connessione a Supabase
  try {
    const { data, error } = await supabaseAdmin.from('users').select('count').limit(1);
    
    if (error) {
      console.error('❌ Errore connessione a Supabase:');
      console.error(`   ${error.message}`);
      console.error('\n⚠️  Possibili cause:');
      console.error('   - La tabella "users" non esiste in Supabase');
      console.error('   - La Service Role Key non ha i permessi corretti');
      console.error('   - Problema di connessione a Supabase');
      process.exit(1);
    }

    console.log('✅ Connessione a Supabase riuscita\n');
  } catch (error: any) {
    console.error('❌ Errore imprevisto:', error.message);
    process.exit(1);
  }

  // Verifica e crea utenti demo
  console.log('📋 Verifica utenti demo:\n');

  let created = 0;
  let existing = 0;
  let errors = 0;

  for (const userData of DEMO_USERS) {
    try {
      console.log(`🔍 Verifica: ${userData.email}...`);
      
      // Verifica se l'utente esiste
      const existingUser = await findUserByEmail(userData.email);
      
      if (existingUser) {
        console.log(`   ✅ Esiste già (ID: ${existingUser.id}, Ruolo: ${existingUser.role})`);
        existing++;
      } else {
        console.log(`   ⚠️  Non trovato, creazione in corso...`);
        
        try {
          const newUser = await createUser(userData);
          console.log(`   ✅ Creato con successo! (ID: ${newUser.id})`);
          created++;
        } catch (createError: any) {
          if (createError.message === 'Email già registrata') {
            console.log(`   ℹ️  Già esistente (conflitto durante creazione)`);
            existing++;
          } else {
            console.error(`   ❌ Errore creazione: ${createError.message}`);
            errors++;
          }
        }
      }
      
      console.log('');
    } catch (error: any) {
      console.error(`   ❌ Errore verifica: ${error.message}`);
      errors++;
      console.log('');
    }
  }

  // Riepilogo
  console.log('='.repeat(60));
  console.log('📊 Riepilogo:');
  console.log(`   ✅ Esistenti: ${existing}`);
  console.log(`   ➕ Creati: ${created}`);
  console.log(`   ❌ Errori: ${errors}`);
  console.log('='.repeat(60));

  if (errors > 0) {
    console.error('\n❌ Ci sono stati errori durante la verifica/creazione.');
    console.error('   Controlla i messaggi sopra per i dettagli.');
    process.exit(1);
  } else if (created > 0) {
    console.log('\n✅ Tutti gli utenti demo sono stati verificati/creati con successo!');
    console.log('\n📝 Credenziali utenti demo:');
    console.log('   Admin:');
    console.log('     Email: admin@spediresicuro.it');
    console.log('     Password: admin123');
    console.log('   Demo:');
    console.log('     Email: demo@spediresicuro.it');
    console.log('     Password: demo123');
    process.exit(0);
  } else {
    console.log('\n✅ Tutti gli utenti demo esistono già in Supabase!');
    process.exit(0);
  }
}

// Esegui lo script
main().catch((error) => {
  console.error('❌ Errore fatale:', error);
  process.exit(1);
});

