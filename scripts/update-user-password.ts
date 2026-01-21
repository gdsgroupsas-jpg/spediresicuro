/**
 * Script: Aggiorna Password Utente
 *
 * Aggiorna la password di un utente esistente in Supabase Auth
 *
 * Uso:
 *   npx tsx scripts/update-user-password.ts <email> <password>
 *
 * Esempio:
 *   npx tsx scripts/update-user-password.ts testspediresicuro+e2e@gmail.com Striano1382-
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

// Carica variabili ambiente
config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variabili ambiente mancanti:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function updateUserPassword(email: string, newPassword: string) {
  console.log('🔐 Aggiornamento password utente...');
  console.log('   Email:', email);
  console.log('');

  // 1. Trova utente in public.users per ottenere ID
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, email, name')
    .eq('email', email.toLowerCase().trim())
    .single();

  if (userError || !user) {
    console.error('❌ Utente non trovato in public.users:', userError?.message);
    process.exit(1);
  }

  console.log('✅ Utente trovato:');
  console.log('   ID:', user.id);
  console.log('   Nome:', user.name);
  console.log('');

  // 2. Aggiorna password in Supabase Auth
  console.log('🔄 Aggiornamento password in Supabase Auth...');
  const { data: updatedUser, error: updateError } = await supabase.auth.admin.updateUserById(
    user.id,
    { password: newPassword }
  );

  if (updateError) {
    console.error('❌ Errore aggiornamento password:', updateError.message);
    process.exit(1);
  }

  console.log('✅ Password aggiornata con successo!');
  console.log('');
  console.log('📋 Credenziali aggiornate:');
  console.log('   Email:', email);
  console.log('   Password:', newPassword);
  console.log('');
  console.log("✅ L'utente può ora fare login con queste credenziali");
}

// Main
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('❌ Uso: npx tsx scripts/update-user-password.ts <email> <password>');
  console.error('');
  console.error('Esempio:');
  console.error(
    '   npx tsx scripts/update-user-password.ts testspediresicuro+e2e@gmail.com Striano1382-'
  );
  process.exit(1);
}

if (password.length < 8) {
  console.error('❌ Password troppo corta (minimo 8 caratteri)');
  process.exit(1);
}

updateUserPassword(email, password)
  .then(() => {
    console.log('✅ Script completato');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Errore:', error.message);
    process.exit(1);
  });
