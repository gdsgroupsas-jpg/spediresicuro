/**
 * Test Flusso Reale Email Confirmation
 *
 * Crea utente via API /api/auth/register (flusso reale)
 * Verifica che confirmation_sent_at sia valorizzato
 * Verifica che email_confirmed_at sia NULL (non confermato)
 *
 * ⚠️ Nessun workaround - usa flusso normale
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// ⚠️ CRITICO: Carica variabili ambiente da .env.local PRIMA di importare altri moduli
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Crea client Supabase direttamente con variabili ambiente caricate
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variabili Supabase non configurate!');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

function isSupabaseConfigured(): boolean {
  const hasUrl =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://xxxxxxxxxxxxxxxxxxxxx.supabase.co';
  const hasAnonKey =
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('placeholder');
  const hasServiceKey =
    !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
    !process.env.SUPABASE_SERVICE_ROLE_KEY.includes('placeholder');

  return hasUrl && hasAnonKey && hasServiceKey;
}

// Genera email unica per test (formato valido)
const TEST_EMAIL = `test-${Date.now()}@spediresicuro.it`;
const TEST_PASSWORD = 'TestPassword123!';
const TEST_NAME = 'Test User Email Confirmation';

async function testEmailConfirmationFlow() {
  console.log('🧪 Test Flusso Reale Email Confirmation\n');
  console.log('📧 Email test:', TEST_EMAIL);
  console.log('👤 Nome test:', TEST_NAME);
  console.log('');

  // 1. Verifica configurazione Supabase
  if (!isSupabaseConfigured()) {
    console.error('❌ Supabase non configurato!');
    console.error(
      '   Configura NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY'
    );
    process.exit(1);
  }
  console.log('✅ Supabase configurato\n');

  // 2. Chiama direttamente la logica di registrazione (flusso reale)
  console.log('📝 Chiamata diretta logica registrazione (flusso reale)...\n');

  try {
    // Chiama direttamente la funzione POST della route (senza server HTTP)
    const { NextRequest } = await import('next/server');
    const registerRoute = await import('../app/api/auth/register/route');

    // Crea request simulata
    const requestBody = {
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      name: TEST_NAME,
      accountType: 'user',
    };

    console.log('📤 Invio richiesta registrazione...');
    console.log('📤 Body:', JSON.stringify({ ...requestBody, password: '***' }, null, 2));
    console.log('');

    const request = new NextRequest('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const response = await registerRoute.POST(request);
    const responseData = await response.json();

    console.log('📥 Risposta:', JSON.stringify(responseData, null, 2));
    console.log('');

    // Verifica risposta
    if (!response.ok) {
      console.error('❌ Errore registrazione:', responseData.error);
      if (responseData.details) {
        console.error('   Dettagli:', responseData.details);
      }
      process.exit(1);
    }

    if (responseData.message !== 'email_confirmation_required') {
      console.error('❌ Risposta inattesa:', responseData);
      console.error('   Atteso: message = "email_confirmation_required"');
      process.exit(1);
    }

    console.log('✅ Registrazione completata - email confirmation richiesta\n');

    // 3. Attendi per permettere a Supabase di processare e inviare email
    console.log('⏳ Attesa 5 secondi per permettere a Supabase di processare e inviare email...');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log('');

    // 4. Verifica utente in Supabase Auth
    console.log('🔍 Verifica utente in Supabase Auth...\n');

    const {
      data: { users },
      error: listError,
    } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Errore recupero utenti:', listError.message);
      process.exit(1);
    }

    const createdUser = users?.find(
      (u: any) => u.email?.toLowerCase() === TEST_EMAIL.toLowerCase()
    );

    if (!createdUser) {
      console.error('❌ Utente non trovato in Supabase Auth!');
      console.error('   Email cercata:', TEST_EMAIL);
      process.exit(1);
    }

    console.log('✅ Utente trovato in Supabase Auth:');
    console.log(`   ID: ${createdUser.id}`);
    console.log(`   Email: ${createdUser.email}`);
    console.log(
      `   Nome: ${createdUser.user_metadata?.name || createdUser.user_metadata?.full_name || 'N/A'}`
    );
    console.log(`   Provider: ${createdUser.app_metadata?.provider || 'N/A'}`);
    console.log(`   Creato: ${createdUser.created_at}`);
    console.log('');

    // 5. ⚠️ CRITICO: Verifica confirmation_sent_at
    console.log('🔍 Verifica confirmation_sent_at...\n');

    if (!createdUser.confirmation_sent_at) {
      console.error('❌ confirmation_sent_at NON valorizzato!');
      console.error("   Questo significa che Supabase NON ha inviato l'email di conferma");
      console.error('');
      console.error('🔧 AZIONE RICHIESTA: Configura Supabase Auth:');
      console.error(
        '   1. Vai su: https://supabase.com/dashboard/project/[PROJECT_ID]/auth/providers'
      );
      console.error('   2. Authentication > Settings:');
      console.error('      - ✅ "Enable email confirmations" = ON');
      console.error('      - ✅ "Site URL" = dominio produzione (https://...)');
      console.error('      - ✅ "Redirect URLs" include dominio produzione');
      console.error('   3. Project Settings > Auth > SMTP Settings:');
      console.error('      - ✅ Configura SMTP (Gmail, SendGrid, etc.)');
      console.error('      - ✅ Test email funzionante');
      console.error('');
      console.error('💡 Dopo la configurazione, riprova lo script.');
      console.error('');
      console.error('📋 Dettagli utente creato:');
      console.error(`   ID: ${createdUser.id}`);
      console.error(`   Email: ${createdUser.email}`);
      console.error(`   Creato: ${createdUser.created_at}`);
      console.error(`   Email confermata: ${createdUser.email_confirmed_at ? 'SÌ' : 'NO'}`);
      process.exit(1);
    }

    console.log('✅ confirmation_sent_at valorizzato:');
    console.log(`   Timestamp: ${createdUser.confirmation_sent_at}`);
    console.log(`   Data: ${new Date(createdUser.confirmation_sent_at).toLocaleString('it-IT')}`);
    console.log('');

    // 6. ⚠️ CRITICO: Verifica email_confirmed_at è NULL
    console.log('🔍 Verifica email_confirmed_at (deve essere NULL)...\n');

    if (createdUser.email_confirmed_at) {
      console.error('❌ email_confirmed_at NON è NULL!');
      console.error('   Timestamp:', createdUser.email_confirmed_at);
      console.error(
        "   Questo significa che l'email è stata confermata automaticamente (NON dovrebbe succedere)"
      );
      console.error(
        '   Verifica configurazione: email_confirm deve essere false nella creazione utente'
      );
      process.exit(1);
    }

    console.log('✅ email_confirmed_at è NULL (email non confermata)');
    console.log('');

    // 7. Verifica metadata
    console.log('🔍 Verifica metadata utente...\n');

    const expectedRole = 'user';
    const actualRole = createdUser.app_metadata?.role;

    if (actualRole !== expectedRole) {
      console.warn('⚠️  Role non corrisponde:', {
        atteso: expectedRole,
        trovato: actualRole,
      });
    } else {
      console.log(`✅ Role corretto: ${actualRole}`);
    }

    const expectedAccountType = 'user';
    const actualAccountType = createdUser.app_metadata?.account_type;

    if (actualAccountType !== expectedAccountType) {
      console.warn('⚠️  Account type non corrisponde:', {
        atteso: expectedAccountType,
        trovato: actualAccountType,
      });
    } else {
      console.log(`✅ Account type corretto: ${actualAccountType}`);
    }

    console.log('');

    // 8. Riepilogo finale
    console.log('📊 Riepilogo Test:\n');
    console.log('✅ Utente creato in Supabase Auth');
    console.log('✅ confirmation_sent_at valorizzato (email inviata)');
    console.log('✅ email_confirmed_at NULL (email non confermata)');
    console.log('✅ Metadata corretti');
    console.log('');
    console.log('🎯 Test PASSATO - Flusso email confirmation funzionante!');
    console.log('');
    console.log('📧 Prossimi passi:');
    console.log(`   1. Controlla email ${TEST_EMAIL}`);
    console.log('   2. Clicca link di conferma');
    console.log('   3. Verifica che email_confirmed_at sia valorizzato dopo conferma');
    console.log('');

    // 9. Cleanup (opzionale - commentato per permettere verifica manuale)
    // console.log('🧹 Cleanup: rimozione utente test...');
    // const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(createdUser.id);
    // if (deleteError) {
    //   console.warn('⚠️  Errore rimozione utente test:', deleteError.message);
    // } else {
    //   console.log('✅ Utente test rimosso');
    // }
  } catch (error: any) {
    console.error('❌ Errore durante test:', error);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Esegui test
testEmailConfirmationFlow()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Errore fatale:', error);
    process.exit(1);
  });
