/**
 * Crea utente di test dedicato per smoke test
 * 
 * Crea un utente "smoke-test@..." con ruolo standard (user)
 * Nessun privilegio extra, solo per validare policy "authenticated"
 * 
 * Utilizzo:
 *   npm run create:smoke-test-user
 * 
 * ⚠️ IMPORTANTE: Non stampa password in chiaro nei log
 */

import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Email e password per utente smoke test
const SMOKE_TEST_EMAIL = 'smoke-test@spediresicuro.it';
const SMOKE_TEST_PASSWORD = `smoke-test-${Date.now()}`; // Password unica basata su timestamp

async function main() {
  console.log('\n🔧 Creazione utente smoke test\n');
  console.log('='.repeat(60));
  console.log('');

  // Verifica configurazione
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ ERRORE: Variabili ambiente mancanti');
    console.error('   Richieste: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Genera hash password per tabella users (bcrypt)
  const hashedPassword = await bcrypt.hash(SMOKE_TEST_PASSWORD, 10);
  console.log('🔐 Hash password generato');
  
  // Crea/aggiorna utente in auth.users (Supabase Auth) usando Admin API
  console.log('🔐 Creazione/aggiornamento utente in Supabase Auth...');
  
  // Prima cerca se esiste già
  const { data: existingAuthUsers } = await supabase.auth.admin.listUsers();
  const existingAuthUser = existingAuthUsers?.users?.find(u => u.email === SMOKE_TEST_EMAIL);
  
  let authUserId: string | null = null;
  
  if (existingAuthUser) {
    // Aggiorna password esistente
    console.log('⚠️  Utente esiste già in auth.users, aggiornamento password...');
    const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
      existingAuthUser.id,
      { password: SMOKE_TEST_PASSWORD }
    );
    
    if (updateError) {
      console.error('❌ Errore aggiornamento password in auth.users:', updateError.message);
      process.exit(1);
    }
    
    authUserId = updatedUser?.user?.id || existingAuthUser.id;
    console.log(`✅ Password aggiornata in auth.users: ${authUserId}`);
  } else {
    // Crea nuovo utente
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: SMOKE_TEST_EMAIL,
      password: SMOKE_TEST_PASSWORD,
      email_confirm: true, // Conferma email automaticamente
    });

    if (authError) {
      console.error('❌ Errore creazione utente in auth.users:', authError.message);
      process.exit(1);
    }
    
    authUserId = authUser?.user?.id || null;
    if (authUserId) {
      console.log(`✅ Utente creato in auth.users: ${authUserId}`);
    }
  }

  // Verifica se l'utente esiste già
  const { data: existingUser, error: checkError } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('email', SMOKE_TEST_EMAIL)
    .single();

  if (existingUser && !checkError) {
    console.log(`⚠️  Utente ${SMOKE_TEST_EMAIL} esiste già. Aggiornamento...`);
    
    const { data, error } = await supabase
      .from('users')
      .update({
        password: hashedPassword,
        name: 'Smoke Test User',
        role: 'user', // Ruolo standard, nessun privilegio extra
        account_type: 'user',
        provider: 'credentials',
        updated_at: new Date().toISOString(),
      })
      .eq('email', SMOKE_TEST_EMAIL)
      .select('id, email, name, role')
      .single();
    
    if (error) {
      console.error('❌ Errore aggiornamento utente:', error.message);
      process.exit(1);
    }
    
    console.log('✅ Utente aggiornato con successo!');
    console.log(`   ID: ${data?.id}`);
    console.log(`   Email: ${data?.email}`);
    console.log(`   Ruolo: ${data?.role}`);
  } else {
    console.log('➕ Creazione nuovo utente smoke test...');
    
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          email: SMOKE_TEST_EMAIL,
          password: hashedPassword,
          name: 'Smoke Test User',
          role: 'user', // Ruolo standard, nessun privilegio extra
          account_type: 'user',
          provider: 'credentials',
        },
      ])
      .select('id, email, name, role')
      .single();
    
    if (error) {
      console.error('❌ Errore creazione utente:', error.message);
      process.exit(1);
    }
    
    console.log('✅ Utente creato con successo!');
    console.log(`   ID: ${data?.id}`);
    console.log(`   Email: ${data?.email}`);
    console.log(`   Ruolo: ${data?.role}`);
  }
  
  console.log('');
  console.log('='.repeat(60));
  console.log('\n📋 Credenziali utente smoke test:');
  console.log(`   Email: ${SMOKE_TEST_EMAIL}`);
  console.log(`   Password: ${SMOKE_TEST_PASSWORD}`);
  console.log('');
  console.log('⚠️  IMPORTANTE: Aggiungi queste credenziali in .env.local:');
  console.log(`   SUPABASE_TEST_EMAIL=${SMOKE_TEST_EMAIL}`);
  console.log(`   SUPABASE_TEST_PASSWORD='${SMOKE_TEST_PASSWORD}'`);
  console.log('');
  console.log('✅ Utente pronto per smoke test!\n');
}

main().catch(err => {
  console.error('\n❌ Errore fatale:', err);
  process.exit(1);
});

