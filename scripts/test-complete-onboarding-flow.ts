/**
 * Test Completo Flusso Onboarding - End-to-End
 * 
 * Simula flusso completo post-signup → email confirmation → primo accesso
 * Verifica tutti i punti di controllo e redirect
 */

import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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

async function testCompleteFlow() {
  console.log('🧪 TEST COMPLETO FLUSSO ONBOARDING - End-to-End\n');
  console.log('='.repeat(70));

  const testEmail = `test-flow-${Date.now()}@spediresicuro.it`;
  const testPassword = 'TestPassword123!';
  const testName = 'Test Flow';

  // ============================================
  // STEP 1: SIGNUP
  // ============================================
  console.log('\n📝 STEP 1: SIGNUP');
  console.log(`Email: ${testEmail}`);

  let userId: string;
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

    if (signUpError || !signUpData?.user) {
      console.error('❌ Errore signup:', signUpError?.message);
      return;
    }

    userId = signUpData.user.id;
    console.log('✅ Utente creato:', userId);
    console.log('📧 confirmation_sent_at:', signUpData.user.confirmation_sent_at || 'NULL');
    console.log('📧 email_confirmed_at:', signUpData.user.email_confirmed_at || 'NULL');

    // Verifica record public.users dopo signup
    const { data: dbUserAfterSignup, error: dbErrorAfterSignup } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', testEmail)
      .maybeSingle();

    console.log('\n📊 Verifica public.users dopo signup:');
    if (dbErrorAfterSignup) {
      console.log('  ⚠️ Errore query:', dbErrorAfterSignup.message);
    } else if (dbUserAfterSignup) {
      console.log('  ✅ Record esiste');
      console.log('  - dati_cliente:', dbUserAfterSignup.dati_cliente ? 'PRESENTE' : 'NULL');
    } else {
      console.log('  ❌ Record NON esiste');
    }

  } catch (error: any) {
    console.error('❌ Errore durante signup:', error.message);
    return;
  }

  // ============================================
  // STEP 2: SIMULAZIONE EMAIL CONFIRMATION
  // ============================================
  console.log('\n📧 STEP 2: SIMULAZIONE EMAIL CONFIRMATION');
  console.log('(Simula click link email → conferma email)');

  try {
    // Simula conferma email: aggiorna email_confirmed_at
    const { data: { user: confirmedUser }, error: confirmError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        email_confirm: true, // Conferma email
      }
    );

    if (confirmError) {
      console.error('❌ Errore conferma email:', confirmError.message);
      return;
    }

    console.log('✅ Email confermata (simulata)');
    console.log('📧 email_confirmed_at:', confirmedUser?.email_confirmed_at || 'NULL');

    // Verifica stato dopo conferma
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    const authUser = users?.find(u => u.id === userId);
    if (authUser) {
      console.log('📧 email_confirmed_at (verificato):', authUser.email_confirmed_at || 'NULL');
    }

  } catch (error: any) {
    console.error('❌ Errore durante conferma email:', error.message);
    return;
  }

  // ============================================
  // STEP 3: SIMULAZIONE /api/auth/supabase-callback
  // ============================================
  console.log('\n🔄 STEP 3: SIMULAZIONE /api/auth/supabase-callback');
  console.log('(Simula auto-login post conferma email)');

  try {
    // Simula creazione record come fa /api/auth/supabase-callback (linee 77-107)
    console.log('\n📊 Simulazione creazione record (come /api/auth/supabase-callback linee 77-107):');
    
    // Verifica se record esiste
    const { data: existingUser, error: existingError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', testEmail)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.log('  ⚠️ Errore query:', existingError.message);
    } else if (!existingUser) {
      console.log('  ⚠️ Record non esiste, creo record (come fa callback)...');
      
      // Ottieni dati utente da auth.users
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
      const authUser = users?.find(u => u.id === userId);
      
      if (authUser) {
        // Crea record come fa /api/auth/supabase-callback
        const { data: newDbUser, error: createError } = await supabaseAdmin
          .from('users')
          .upsert({
            id: authUser.id,
            email: authUser.email,
            password: null,
            name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || testEmail.split('@')[0],
            role: authUser.app_metadata?.role || 'user',
            account_type: authUser.app_metadata?.account_type || 'user',
            provider: 'email',
            provider_id: null,
            image: null,
            admin_level: authUser.app_metadata?.account_type === 'admin' ? 1 : 0,
          }, { onConflict: 'id' })
          .select()
          .maybeSingle();

        if (createError) {
          console.log('  ❌ Errore creazione record:', createError.message);
        } else if (newDbUser) {
          console.log('  ✅ Record creato durante callback');
        }
      }
    } else {
      console.log('  ✅ Record già esiste');
    }

    // Simula query come fa /api/auth/supabase-callback (linee 125-134)
    console.log('\n📊 Query dati_cliente (come /api/auth/supabase-callback):');
    const { data: userData, error: userDataError } = await supabaseAdmin
      .from('users')
      .select('dati_cliente')
      .eq('email', testEmail)
      .maybeSingle(); // Usa maybeSingle invece di single per evitare errore se non esiste

    console.log('  - Query error:', userDataError ? userDataError.message : 'NULL');
    console.log('  - userData:', userData ? 'PRESENTE' : 'NULL');
    console.log('  - userData?.dati_cliente:', userData?.dati_cliente ? 'PRESENTE' : 'NULL');
    console.log('  - userData?.dati_cliente?.datiCompletati:', userData?.dati_cliente?.datiCompletati);

    // Simula decisione redirect (linee 131-134)
    let redirectTo = '/dashboard';
    if (userDataError || !userData?.dati_cliente || !userData.dati_cliente.datiCompletati) {
      redirectTo = '/dashboard/dati-cliente';
    }

    console.log('\n🎯 DECISIONE REDIRECT:');
    console.log(`  redirectTo = "${redirectTo}"`);
    console.log('\n  Condizione valutata:');
    console.log(`    userDataError: ${userDataError ? 'PRESENTE' : 'NULL'}`);
    console.log(`    !userData?.dati_cliente: ${!userData?.dati_cliente}`);
    console.log(`    !userData.dati_cliente.datiCompletati: ${!userData?.dati_cliente ? 'N/A' : !userData.dati_cliente.datiCompletati}`);
    console.log(`    Risultato: ${redirectTo === '/dashboard/dati-cliente' ? '→ /dashboard/dati-cliente ✅' : '→ /dashboard ❌'}`);

    // Verifica se record viene creato durante callback (linee 77-107)
    console.log('\n📊 Verifica se record viene creato durante callback:');
    const { data: dbUserAfterCallback, error: dbErrorAfterCallback } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', testEmail)
      .maybeSingle();

    if (dbErrorAfterCallback) {
      console.log('  ⚠️ Errore query:', dbErrorAfterCallback.message);
    } else if (dbUserAfterCallback) {
      console.log('  ✅ Record esiste dopo callback');
      console.log('  - dati_cliente:', dbUserAfterCallback.dati_cliente ? 'PRESENTE' : 'NULL');
      console.log('  - dati_cliente.datiCompletati:', dbUserAfterCallback.dati_cliente?.datiCompletati);
    } else {
      console.log('  ❌ Record NON esiste dopo callback');
      console.log('  ⚠️ ATTENZIONE: Record dovrebbe essere creato durante /api/auth/supabase-callback');
    }

  } catch (error: any) {
    console.error('❌ Errore durante simulazione callback:', error.message);
    return;
  }

  // ============================================
  // STEP 4: VERIFICA PUNTI DI ROTTURA
  // ============================================
  console.log('\n🔍 STEP 4: VERIFICA PUNTI DI ROTTURA');

  // Punto 1: Record public.users
  const { data: finalDbUser, error: finalDbError } = await supabaseAdmin
    .from('users')
    .select('*')
    .eq('email', testEmail)
    .maybeSingle();

  console.log('\n📊 Stato finale public.users:');
  if (finalDbError) {
    console.log('  ❌ Errore query:', finalDbError.message);
  } else if (finalDbUser) {
    console.log('  ✅ Record esiste');
    console.log('  - dati_cliente:', finalDbUser.dati_cliente ? 'PRESENTE' : 'NULL');
    console.log('  - datiCompletati:', finalDbUser.dati_cliente?.datiCompletati);
  } else {
    console.log('  ❌ Record NON esiste');
    console.log('  ⚠️ PUNTO DI ROTTURA: Record non creato durante signup o callback');
  }

  // Punto 2: Logica redirect
  const { data: redirectCheck, error: redirectCheckError } = await supabaseAdmin
    .from('users')
    .select('dati_cliente')
    .eq('email', testEmail)
    .maybeSingle();

  const redirectDecision = redirectCheckError || !redirectCheck?.dati_cliente || !redirectCheck.dati_cliente.datiCompletati
    ? '/dashboard/dati-cliente'
    : '/dashboard';

  console.log('\n🎯 Logica redirect finale:');
  console.log(`  redirectTo = "${redirectDecision}"`);
  if (redirectDecision === '/dashboard') {
    console.log('  ⚠️ PUNTO DI ROTTURA: Redirect a /dashboard invece di /dashboard/dati-cliente');
  } else {
    console.log('  ✅ Redirect corretto: /dashboard/dati-cliente');
  }

  // ============================================
  // RIEPILOGO
  // ============================================
  console.log('\n' + '='.repeat(70));
  console.log('📋 RIEPILOGO TEST');
  console.log('='.repeat(70));
  
  // Verifica stato finale auth.users
  const { data: { users: finalUsers }, error: finalListError } = await supabaseAdmin.auth.admin.listUsers();
  const finalAuthUser = finalUsers?.find(u => u.id === userId);
  
  console.log(`✅ Utente: ${testEmail}`);
  console.log(`📧 Email confermata: ${finalAuthUser?.email_confirmed_at ? 'SÌ' : 'NO'}`);
  console.log(`📊 Record public.users: ${finalDbUser ? 'ESISTE' : 'NON ESISTE'}`);
  console.log(`📊 dati_cliente: ${finalDbUser?.dati_cliente ? 'PRESENTE' : 'NULL'}`);
  console.log(`📊 datiCompletati: ${finalDbUser?.dati_cliente?.datiCompletati ? 'true' : 'false'}`);
  console.log(`🎯 Redirect finale: ${redirectDecision}`);
  
  // Punti di rottura identificati
  console.log('\n🔍 PUNTI DI ROTTURA IDENTIFICATI:');
  if (!finalDbUser) {
    console.log('  ❌ Record public.users non esiste dopo callback');
  } else if (!finalDbUser.dati_cliente) {
    console.log('  ✅ Record esiste, dati_cliente NULL (atteso per utente nuovo)');
  } else if (finalDbUser.dati_cliente.datiCompletati) {
    console.log('  ⚠️ datiCompletati = true (non atteso per utente nuovo)');
  }
  
  if (redirectDecision === '/dashboard') {
    console.log('  ❌ Redirect a /dashboard invece di /dashboard/dati-cliente');
  } else {
    console.log('  ✅ Redirect corretto: /dashboard/dati-cliente');
  }
  
  console.log('\n✅ Test completato');
}

testCompleteFlow();

