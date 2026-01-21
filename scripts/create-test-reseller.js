/**
 * Script Node.js per creare utente reseller di test in Supabase
 *
 * Crea un utente reseller con email test@spediresicuro.it e password test123
 * Questo utente avrà i campi dati cliente opzionali (non obbligatori)
 *
 * Uso:
 *   node scripts/create-test-reseller.js
 */

// Carica variabili d'ambiente da .env.local
require('dotenv').config({ path: '.env.local' });
// Prova anche .env se .env.local non esiste
require('dotenv').config();

const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

// Configurazione Supabase (usa variabili d'ambiente)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    '❌ Errore: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devono essere configurati'
  );
  console.error('');
  console.error('   Variabili trovate:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅ Configurato' : '❌ Mancante');
  console.error(
    '   - SUPABASE_SERVICE_ROLE_KEY:',
    supabaseServiceKey ? '✅ Configurato' : '❌ Mancante'
  );
  console.error('');
  console.error('   Aggiungi queste variabili al tuo .env.local:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL=https://tuo-progetto.supabase.co');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=la-tua-service-role-key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function createTestReseller() {
  const testEmail = 'test@spediresicuro.it';
  const testPassword = 'test123';
  const testName = 'Reseller Test';

  // Genera hash password
  const hashedPassword = await bcrypt.hash(testPassword, 10);

  console.log('🔐 Hash password generato');
  console.log('📧 Email:', testEmail);
  console.log('🔑 Password:', testPassword);
  console.log('👤 Nome:', testName);
  console.log('🏷️  Tipo: Reseller');
  console.log('');

  // Verifica se l'utente esiste già
  const { data: existingUser } = await supabase
    .from('users')
    .select('id, email, is_reseller')
    .eq('email', testEmail)
    .single();

  if (existingUser) {
    console.log('⚠️  Utente test@spediresicuro.it esiste già. Aggiornamento...');

    const { data, error } = await supabase
      .from('users')
      .update({
        password: hashedPassword,
        name: testName,
        role: 'user',
        account_type: 'user',
        is_reseller: true, // Flag reseller attivo
        provider: 'credentials',
        updated_at: new Date().toISOString(),
      })
      .eq('email', testEmail)
      .select()
      .single();

    if (error) {
      console.error('❌ Errore aggiornamento utente:', error);
      process.exit(1);
    }

    console.log('✅ Utente reseller aggiornato con successo!');
    console.log('   ID:', data.id);
    console.log('   Email:', data.email);
    console.log('   Is Reseller:', data.is_reseller);
  } else {
    console.log('➕ Creazione nuovo utente reseller di test...');

    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          email: testEmail,
          password: hashedPassword,
          name: testName,
          role: 'user',
          account_type: 'user',
          is_reseller: true, // Flag reseller attivo
          provider: 'credentials',
          wallet_balance: 0.0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Errore creazione utente:', error);
      process.exit(1);
    }

    console.log('✅ Utente reseller creato con successo!');
    console.log('   ID:', data.id);
    console.log('   Email:', data.email);
    console.log('   Is Reseller:', data.is_reseller);
  }

  console.log('');
  console.log('📋 Credenziali utente reseller di test:');
  console.log('   Email: test@spediresicuro.it');
  console.log('   Password: test123');
  console.log('');
  console.log('ℹ️  NOTA: Questo utente ha i campi dati cliente OPCIONALI');
  console.log('   (non obbligatori durante la registrazione)');
  console.log('');
  console.log('⚠️  IMPORTANTE: Questo utente è solo per test!');
  console.log('   Non usare in produzione.');
}

createTestReseller().catch((error) => {
  console.error('❌ Errore:', error);
  process.exit(1);
});
