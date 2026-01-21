/**
 * Script per verificare configurazione Supabase Auth
 *
 * Verifica:
 * - Email confirmation attiva
 * - Template email configurati
 * - Redirect URLs configurate
 * - Stato utenti (email_confirmed_at, confirmation_sent_at)
 */

import { supabaseAdmin, isSupabaseConfigured } from '../lib/supabase';

async function verifyAuthConfig() {
  console.log('🔍 Verifica configurazione Supabase Auth...\n');

  // 1. Verifica che Supabase sia configurato
  if (!isSupabaseConfigured()) {
    console.error('❌ Supabase non configurato!');
    console.error(
      '   Configura NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY'
    );
    process.exit(1);
  }
  console.log('✅ Supabase configurato\n');

  // 2. Verifica configurazione Auth (non disponibile via Admin API)
  // Nota: La configurazione Auth deve essere verificata manualmente nel dashboard Supabase
  console.log('📋 Configurazione Auth (verifica manuale nel dashboard Supabase):');
  console.log('   1. Vai su: https://supabase.com/dashboard/project/[PROJECT_ID]/auth/providers');
  console.log('   2. Verifica che "Enable email confirmations" sia ON');
  console.log('   3. Verifica che "Confirm email" template includa {{ .ConfirmationURL }}');
  console.log('   4. Verifica Redirect URLs includano il dominio di produzione (https://...)\n');

  // 3. Verifica utenti di test
  console.log('👤 Verifica stato utenti (ultimi 5):\n');

  try {
    const {
      data: { users },
      error,
    } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      console.error('❌ Errore recupero utenti:', error.message);
      process.exit(1);
    }

    if (!users || users.length === 0) {
      console.log('⚠️  Nessun utente trovato in Supabase Auth');
      return;
    }

    // Mostra ultimi 5 utenti
    const recentUsers = users.slice(0, 5);

    for (const user of recentUsers) {
      console.log(`📧 ${user.email}:`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Email confermata: ${user.email_confirmed_at ? '✅ SÌ' : '❌ NO'}`);
      console.log(`   Email confermata il: ${user.email_confirmed_at || 'N/A'}`);
      console.log(`   Email inviata il: ${user.confirmation_sent_at || 'N/A'}`);
      console.log(`   Provider: ${user.app_metadata?.provider || 'email'}`);
      console.log(`   Creato: ${user.created_at}`);
      console.log('');
    }

    // Statistiche
    const confirmedCount = users.filter((u) => u.email_confirmed_at).length;
    const unconfirmedCount = users.filter((u) => !u.email_confirmed_at).length;

    console.log('📊 Statistiche:');
    console.log(`   Totale utenti: ${users.length}`);
    console.log(`   Email confermate: ${confirmedCount} ✅`);
    console.log(
      `   Email NON confermate: ${unconfirmedCount} ${unconfirmedCount > 0 ? '⚠️' : '✅'}`
    );
    console.log('');

    // 4. Verifica utenti non confermati
    if (unconfirmedCount > 0) {
      console.log('⚠️  Utenti con email NON confermata:');
      const unconfirmed = users.filter((u) => !u.email_confirmed_at);
      for (const user of unconfirmed.slice(0, 10)) {
        console.log(`   - ${user.email} (creato: ${user.created_at})`);
        if (user.confirmation_sent_at) {
          console.log(`     Email inviata: ${user.confirmation_sent_at}`);
        } else {
          console.log(`     ⚠️  Email NON inviata!`);
        }
      }
      console.log('');
    }
  } catch (error: any) {
    console.error('❌ Errore:', error.message);
    process.exit(1);
  }

  // 5. Checklist finale
  console.log('✅ Checklist configurazione:');
  console.log('   [ ] Email confirmation attiva nel dashboard Supabase');
  console.log('   [ ] Template "Confirm signup" include {{ .ConfirmationURL }}');
  console.log('   [ ] Redirect URLs includono dominio produzione (https://...)');
  console.log('   [ ] SMTP configurato e funzionante');
  console.log('');
  console.log('📖 Per verificare manualmente:');
  console.log('   1. Dashboard Supabase > Authentication > Settings');
  console.log('   2. Verifica "Enable email confirmations" = ON');
  console.log('   3. Verifica "Site URL" e "Redirect URLs"');
  console.log('   4. Verifica template email in Authentication > Email Templates');
  console.log('   5. Verifica SMTP in Project Settings > Auth > SMTP Settings');
}

// Esegui verifica
verifyAuthConfig()
  .then(() => {
    console.log('✅ Verifica completata');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Errore durante verifica:', error);
    process.exit(1);
  });
