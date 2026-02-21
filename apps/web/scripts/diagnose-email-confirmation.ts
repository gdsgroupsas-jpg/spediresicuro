/**
 * Diagnostica Email Confirmation
 *
 * Verifica:
 * 1. Configurazione Supabase Auth (Enable email confirmations ON/OFF)
 * 2. admin.createUser(email_confirm: false) -> confirmation_sent_at
 * 3. auth.signUp (flusso reale) -> confirmation_sent_at
 *
 * Output binario: ON/OFF, NULL/non-NULL per entrambi i metodi
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// ⚠️ CRITICO: Carica variabili ambiente da .env.local PRIMA di importare altri moduli
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

// Crea client Supabase direttamente con variabili ambiente caricate
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('❌ Variabili Supabase non configurate!');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

// Genera email uniche per test (formato valido)
const timestamp = Date.now();
const testEmail1 = `test-admin-${timestamp}@spediresicuro.it`;
const testEmail2 = `test-signup-${timestamp}@spediresicuro.it`;
const testPassword = 'TestPassword123!';
const testName = 'Test User';

interface TestResult {
  method: string;
  email: string;
  userId: string | null;
  confirmation_sent_at: string | null;
  email_confirmed_at: string | null;
  success: boolean;
  error?: string;
}

async function diagnoseEmailConfirmation() {
  console.log('🔍 Diagnostica Email Confirmation\n');
  console.log('='.repeat(60));
  console.log('');

  // 1. Verifica configurazione Auth (se possibile via API)
  console.log('1️⃣  Verifica configurazione Supabase Auth...\n');

  // Nota: Non c'è API diretta per verificare "Enable email confirmations"
  // Dobbiamo inferirlo dal comportamento
  console.log('⚠️  Nota: Non esiste API per verificare "Enable email confirmations"');
  console.log('   Verifica manuale richiesta nel Dashboard Supabase');
  console.log('   URL: https://supabase.com/dashboard/project/[PROJECT_ID]/auth/providers');
  console.log('   Path: Authentication > Settings > Enable email confirmations');
  console.log('');

  // 2. Test admin.createUser(email_confirm: false)
  console.log('2️⃣  Test admin.createUser(email_confirm: false)...\n');
  console.log(`📧 Email test: ${testEmail1}`);
  console.log('');

  let result1: TestResult = {
    method: 'admin.createUser',
    email: testEmail1,
    userId: null,
    confirmation_sent_at: null,
    email_confirmed_at: null,
    success: false,
  };

  try {
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: testEmail1.toLowerCase().trim(),
      password: testPassword,
      email_confirm: false, // ⚠️ CRITICO: false = richiede conferma
      user_metadata: {
        name: testName,
        full_name: testName,
      },
      app_metadata: {
        provider: 'email',
        role: 'user',
      },
    });

    if (authError) {
      result1.error = authError.message;
      console.error('❌ Errore creazione utente:', authError.message);
    } else if (authUser?.user) {
      result1.userId = authUser.user.id;
      result1.confirmation_sent_at = authUser.user.confirmation_sent_at || null;
      result1.email_confirmed_at = authUser.user.email_confirmed_at || null;
      result1.success = true;

      console.log('✅ Utente creato con admin.createUser');
      console.log(`   ID: ${result1.userId}`);
      console.log(`   confirmation_sent_at: ${result1.confirmation_sent_at || 'NULL'}`);
      console.log(`   email_confirmed_at: ${result1.email_confirmed_at || 'NULL'}`);
    }
  } catch (error: any) {
    result1.error = error.message;
    console.error('❌ Errore:', error.message);
  }

  console.log('');

  // Attendi breve momento
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Verifica stato dopo attesa (potrebbe essere aggiornato)
  if (result1.userId) {
    try {
      const {
        data: { users },
        error: listError,
      } = await supabaseAdmin.auth.admin.listUsers();
      if (!listError && users) {
        const user = users.find((u: any) => u.id === result1.userId);
        if (user) {
          // Aggiorna con valori più recenti
          result1.confirmation_sent_at = user.confirmation_sent_at || null;
          result1.email_confirmed_at = user.email_confirmed_at || null;

          if (user.confirmation_sent_at && !result1.confirmation_sent_at) {
            console.log(
              'ℹ️  confirmation_sent_at aggiornato dopo attesa:',
              user.confirmation_sent_at
            );
          }
        }
      }
    } catch (error: any) {
      console.warn('⚠️  Errore verifica stato utente:', error.message);
    }
  }

  console.log('');

  // 3. Test auth.signUp (flusso reale)
  console.log('3️⃣  Test auth.signUp (flusso reale)...\n');
  console.log(`📧 Email test: ${testEmail2}`);
  console.log('');

  let result2: TestResult = {
    method: 'auth.signUp',
    email: testEmail2,
    userId: null,
    confirmation_sent_at: null,
    email_confirmed_at: null,
    success: false,
  };

  try {
    const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
      email: testEmail2.toLowerCase().trim(),
      password: testPassword,
      options: {
        data: {
          name: testName,
          full_name: testName,
        },
      },
    });

    if (signUpError) {
      result2.error = signUpError.message;
      console.error('❌ Errore signUp:', signUpError.message);
    } else if (signUpData?.user) {
      result2.userId = signUpData.user.id;
      result2.confirmation_sent_at = signUpData.user.confirmation_sent_at || null;
      result2.email_confirmed_at = signUpData.user.email_confirmed_at || null;
      result2.success = true;

      console.log('✅ Utente creato con auth.signUp');
      console.log(`   ID: ${result2.userId}`);
      console.log(`   confirmation_sent_at: ${result2.confirmation_sent_at || 'NULL'}`);
      console.log(`   email_confirmed_at: ${result2.email_confirmed_at || 'NULL'}`);
    }
  } catch (error: any) {
    result2.error = error.message;
    console.error('❌ Errore:', error.message);
  }

  console.log('');

  // Attendi breve momento
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Verifica stato dopo attesa
  if (result2.userId) {
    try {
      const {
        data: { users },
        error: listError,
      } = await supabaseAdmin.auth.admin.listUsers();
      if (!listError && users) {
        const user = users.find((u: any) => u.id === result2.userId);
        if (user) {
          result2.confirmation_sent_at = user.confirmation_sent_at || null;
          result2.email_confirmed_at = user.email_confirmed_at || null;

          if (user.confirmation_sent_at && !result2.confirmation_sent_at) {
            console.log(
              'ℹ️  confirmation_sent_at aggiornato dopo attesa:',
              user.confirmation_sent_at
            );
          }
        }
      }
    } catch (error: any) {
      console.warn('⚠️  Errore verifica stato utente:', error.message);
    }
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('📊 RISULTATI DIAGNOSTICA');
  console.log('='.repeat(60));
  console.log('');

  // Output binario
  console.log('🔧 Configurazione:');
  console.log('   Enable email confirmations: [VERIFICA MANUALE NEL DASHBOARD]');
  console.log('   URL: https://supabase.com/dashboard/project/[PROJECT_ID]/auth/providers');
  console.log('');

  console.log('📋 admin.createUser(email_confirm: false):');
  console.log(`   Email: ${result1.email}`);
  console.log(`   Success: ${result1.success ? '✅' : '❌'}`);
  if (result1.success) {
    console.log(
      `   confirmation_sent_at: ${result1.confirmation_sent_at ? '✅ NON-NULL' : '❌ NULL'}`
    );
    if (result1.confirmation_sent_at) {
      console.log(`   Timestamp: ${result1.confirmation_sent_at}`);
    }
    console.log(
      `   email_confirmed_at: ${result1.email_confirmed_at ? '✅ NON-NULL' : '✅ NULL (atteso)'}`
    );
  } else {
    console.log(`   Error: ${result1.error}`);
  }
  console.log('');

  console.log('📋 auth.signUp (flusso reale):');
  console.log(`   Email: ${result2.email}`);
  console.log(`   Success: ${result2.success ? '✅' : '❌'}`);
  if (result2.success) {
    console.log(
      `   confirmation_sent_at: ${result2.confirmation_sent_at ? '✅ NON-NULL' : '❌ NULL'}`
    );
    if (result2.confirmation_sent_at) {
      console.log(`   Timestamp: ${result2.confirmation_sent_at}`);
    }
    console.log(
      `   email_confirmed_at: ${result2.email_confirmed_at ? '✅ NON-NULL' : '✅ NULL (atteso)'}`
    );
  } else {
    console.log(`   Error: ${result2.error}`);
  }
  console.log('');

  // Analisi
  console.log('='.repeat(60));
  console.log('🔍 ANALISI');
  console.log('='.repeat(60));
  console.log('');

  if (!result1.success && !result2.success) {
    console.log('❌ Entrambi i metodi hanno fallito');
    console.log('   Verifica configurazione Supabase e credenziali');
  } else {
    const adminHasConfirmation = result1.success && result1.confirmation_sent_at !== null;
    const signUpHasConfirmation = result2.success && result2.confirmation_sent_at !== null;

    if (adminHasConfirmation && signUpHasConfirmation) {
      console.log('✅ Entrambi i metodi inviano email di conferma');
      console.log('   → Email confirmations è ON e funzionante');
    } else if (!adminHasConfirmation && !signUpHasConfirmation) {
      console.log('❌ Nessuno dei due metodi invia email di conferma');
      console.log('   → Email confirmations probabilmente OFF o SMTP non configurato');
    } else if (adminHasConfirmation && !signUpHasConfirmation) {
      console.log('⚠️  Solo admin.createUser invia email');
      console.log('   → Comportamento inatteso');
    } else if (!adminHasConfirmation && signUpHasConfirmation) {
      console.log('⚠️  Solo auth.signUp invia email');
      console.log('   → admin.createUser potrebbe non triggerare email automaticamente');
    }
  }

  console.log('');

  // Cleanup (opzionale)
  console.log('🧹 Cleanup utenti test...');
  if (result1.userId) {
    try {
      await supabaseAdmin.auth.admin.deleteUser(result1.userId);
      console.log(`   ✅ Utente ${result1.email} rimosso`);
    } catch (error: any) {
      console.warn(`   ⚠️  Errore rimozione ${result1.email}:`, error.message);
    }
  }
  if (result2.userId) {
    try {
      await supabaseAdmin.auth.admin.deleteUser(result2.userId);
      console.log(`   ✅ Utente ${result2.email} rimosso`);
    } catch (error: any) {
      console.warn(`   ⚠️  Errore rimozione ${result2.email}:`, error.message);
    }
  }
  console.log('');
}

// Esegui diagnostica
diagnoseEmailConfirmation()
  .then(() => {
    console.log('✅ Diagnostica completata');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Errore fatale:', error);
    process.exit(1);
  });
