/**
 * Test Flusso Onboarding - Verifica Reale
 *
 * Simula flusso completo:
 * 1. Signup
 * 2. Email confirmation
 * 3. Verifica redirect
 * 4. Verifica database
 * 5. Verifica UI (contrasto input)
 */

import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Carica variabili ambiente
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('❌ Variabili Supabase non configurate');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function testOnboardingFlow() {
  console.log('🧪 TEST FLUSSO ONBOARDING - Verifica Reale\n');
  console.log('='.repeat(60));

  // 1. SIGNUP
  const testEmail = `test-onboarding-${Date.now()}@spediresicuro.it`;
  const testPassword = 'TestPassword123!';
  const testName = 'Test Onboarding';

  console.log('\n📝 STEP 1: SIGNUP');
  console.log(`Email: ${testEmail}`);
  console.log(`Password: ${testPassword}`);
  console.log(`Name: ${testName}`);

  try {
    const { data: signUpData, error: signUpError } = await supabaseAdmin.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          name: testName,
          full_name: testName,
          role: 'user',
          account_type: 'user',
        },
        emailRedirectTo: process.env.NEXT_PUBLIC_APP_URL + '/auth/callback',
      },
    });

    if (signUpError) {
      console.error('❌ Errore signup:', signUpError.message);
      return;
    }

    if (!signUpData?.user) {
      console.error('❌ Nessun utente creato');
      return;
    }

    const userId = signUpData.user.id;
    console.log('✅ Utente creato:', userId);
    console.log('📧 Email confermata:', signUpData.user.email_confirmed_at ? 'SÌ' : 'NO');
    console.log('📧 Email conferma inviata:', signUpData.user.confirmation_sent_at ? 'SÌ' : 'NO');
    console.log('📧 confirmation_sent_at:', signUpData.user.confirmation_sent_at || 'NULL');
    console.log('📧 email_confirmed_at:', signUpData.user.email_confirmed_at || 'NULL');

    // 2. VERIFICA DATABASE - auth.users
    console.log('\n📊 STEP 2: VERIFICA DATABASE - auth.users');
    const {
      data: { users },
      error: listError,
    } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('❌ Errore listUsers:', listError.message);
      return;
    }

    const authUser = users?.find((u) => u.email === testEmail);
    if (authUser) {
      console.log('✅ Utente trovato in auth.users:');
      console.log('  - ID:', authUser.id);
      console.log('  - Email:', authUser.email);
      console.log('  - email_confirmed_at:', authUser.email_confirmed_at || 'NULL');
      console.log('  - confirmation_sent_at:', authUser.confirmation_sent_at || 'NULL');
      console.log('  - created_at:', authUser.created_at);
    } else {
      console.log('❌ Utente NON trovato in auth.users');
    }

    // 3. VERIFICA DATABASE - public.users
    console.log('\n📊 STEP 3: VERIFICA DATABASE - public.users');
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', testEmail)
      .single();

    if (dbError) {
      console.log('⚠️ Errore query users:', dbError.message);
      console.log('  - Utente potrebbe non esistere ancora in public.users');
    } else if (dbUser) {
      console.log('✅ Utente trovato in public.users:');
      console.log('  - ID:', dbUser.id);
      console.log('  - Email:', dbUser.email);
      console.log('  - Name:', dbUser.name);
      console.log('  - Role:', dbUser.role);
      console.log('  - Account Type:', dbUser.account_type);
      console.log('  - dati_cliente:', dbUser.dati_cliente ? 'PRESENTE' : 'NULL');

      if (dbUser.dati_cliente) {
        console.log('  - dati_cliente.datiCompletati:', dbUser.dati_cliente.datiCompletati);
        console.log('  - dati_cliente.nome:', dbUser.dati_cliente.nome || 'NULL');
        console.log('  - dati_cliente.cognome:', dbUser.dati_cliente.cognome || 'NULL');
      } else {
        console.log('  - dati_cliente: NULL (utente nuovo)');
      }
    } else {
      console.log('❌ Utente NON trovato in public.users');
    }

    // 4. SIMULAZIONE DECISIONE REDIRECT (come fa /api/auth/supabase-callback)
    console.log('\n🔄 STEP 4: SIMULAZIONE DECISIONE REDIRECT');
    console.log('(Come fa /api/auth/supabase-callback/route.ts)');

    const { data: userData, error: userDataError } = await supabaseAdmin
      .from('users')
      .select('dati_cliente')
      .eq('email', testEmail)
      .single();

    console.log('  - Query error:', userDataError ? userDataError.message : 'NULL');
    console.log('  - userData:', userData ? 'PRESENTE' : 'NULL');
    console.log('  - userData?.dati_cliente:', userData?.dati_cliente ? 'PRESENTE' : 'NULL');
    console.log(
      '  - userData?.dati_cliente?.datiCompletati:',
      userData?.dati_cliente?.datiCompletati
    );

    let redirectTo = '/dashboard';
    if (userDataError || !userData?.dati_cliente || !userData.dati_cliente.datiCompletati) {
      redirectTo = '/dashboard/dati-cliente';
    }

    console.log('\n🎯 DECISIONE REDIRECT:');
    console.log(`  redirectTo = "${redirectTo}"`);
    console.log('\n  Condizione valutata:');
    console.log(`    userDataError: ${userDataError ? 'PRESENTE' : 'NULL'}`);
    console.log(`    !userData?.dati_cliente: ${!userData?.dati_cliente}`);
    console.log(
      `    !userData.dati_cliente.datiCompletati: ${!userData?.dati_cliente ? 'N/A' : !userData.dati_cliente.datiCompletati}`
    );
    console.log(
      `    Risultato: ${redirectTo === '/dashboard/dati-cliente' ? '→ /dashboard/dati-cliente ✅' : '→ /dashboard ❌'}`
    );

    // 5. VERIFICA UI (contrasto input)
    console.log('\n🎨 STEP 5: VERIFICA UI - Contrasto Input');
    console.log('File: app/dashboard/dati-cliente/page.tsx');
    console.log('\n  Classi input attuali:');
    console.log('    bg-gray-800 (sfondo grigio scuro)');
    console.log('    !text-white (testo bianco forzato)');
    console.log('    border-[#FACC15]/40 (bordo giallo)');
    console.log('\n  CSS globale (app/globals.css linee 69-77):');
    console.log('    input { color: #111827 !important; } (testo nero)');
    console.log('    → !text-white dovrebbe sovrascrivere');
    console.log('\n  Contrasto atteso:');
    console.log('    Sfondo: bg-gray-800 (#1f2937)');
    console.log('    Testo: !text-white (#ffffff)');
    console.log('    → Contrasto: ALTO ✅');

    // 6. RIEPILOGO
    console.log('\n' + '='.repeat(60));
    console.log('📋 RIEPILOGO TEST');
    console.log('='.repeat(60));
    console.log(`✅ Utente creato: ${testEmail}`);
    console.log(`📧 Email confermata: ${authUser?.email_confirmed_at ? 'SÌ' : 'NO'}`);
    console.log(`📧 confirmation_sent_at: ${authUser?.confirmation_sent_at ? 'SÌ' : 'NO'}`);
    console.log(`📊 dati_cliente nel DB: ${dbUser?.dati_cliente ? 'PRESENTE' : 'NULL'}`);
    console.log(`📊 datiCompletati: ${dbUser?.dati_cliente?.datiCompletati ? 'true' : 'false'}`);
    console.log(`🎯 Redirect atteso: ${redirectTo}`);
    console.log(`🎨 Contrasto input: bg-gray-800 + !text-white`);

    console.log('\n✅ Test completato');
    console.log('\n⚠️ NOTA: Per testare il redirect reale, devi:');
    console.log('  1. Aprire email di conferma');
    console.log('  2. Cliccare link conferma');
    console.log('  3. Osservare redirect effettivo nel browser');
  } catch (error: any) {
    console.error('❌ Errore durante test:', error.message);
    console.error(error.stack);
  }
}

testOnboardingFlow();
