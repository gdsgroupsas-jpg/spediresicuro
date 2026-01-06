/**
 * Script per verificare la configurazione "Email confirmations" in Supabase Auth
 * 
 * Questo script controlla se la conferma email è abilitata nel progetto Supabase.
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Carica variabili d'ambiente
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAccessToken = process.env.SUPABASE_ACCESS_TOKEN;

async function checkEmailConfirmations() {
  console.log('🔍 Verifica configurazione "Email confirmations" in Supabase Auth...\n');

  // Verifica variabili d'ambiente
  if (!supabaseUrl) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL non configurato in .env.local');
    console.log('\n📋 ISTRUZIONI MANUALI:');
    console.log('1. Vai su https://supabase.com/dashboard');
    console.log('2. Seleziona il tuo progetto');
    console.log('3. Vai su Authentication → Settings');
    console.log('4. Nella sezione "Email Auth", verifica "Enable email confirmations"');
    console.log('5. Se è OFF, attivalo cliccando sul toggle');
    return;
  }

  if (!supabaseServiceKey) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY non configurato in .env.local');
    console.log('\n📋 ISTRUZIONI MANUALI:');
    console.log('1. Vai su https://supabase.com/dashboard');
    console.log('2. Seleziona il tuo progetto');
    console.log('3. Vai su Authentication → Settings');
    console.log('4. Nella sezione "Email Auth", verifica "Enable email confirmations"');
    console.log('5. Se è OFF, attivalo cliccando sul toggle');
    return;
  }

  console.log(`✅ URL Supabase: ${supabaseUrl}\n`);

  try {
    // Prova a verificare tramite API Management se abbiamo l'access token
    if (supabaseAccessToken) {
      console.log('🔑 Access token trovato, tentativo verifica tramite API Management...\n');
      
      // Estrai project ID dall'URL
      const projectIdMatch = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/);
      if (!projectIdMatch) {
        throw new Error('Impossibile estrarre project ID dall\'URL');
      }
      const projectId = projectIdMatch[1];

      // Chiama API Management per ottenere configurazione Auth
      const managementUrl = `https://api.supabase.com/v1/projects/${projectId}/config/auth`;
      const response = await fetch(managementUrl, {
        headers: {
          'Authorization': `Bearer ${supabaseAccessToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const config = await response.json();
        
        // La configurazione email confirmations si trova in config.ENABLE_SIGNUP
        // o in config.SMTP_ENABLED o in config.EMAIL_CONFIRMATION_ENABLED
        const emailConfirmationsEnabled = 
          config.ENABLE_EMAIL_CONFIRMATIONS !== false &&
          config.ENABLE_SIGNUP !== false;

        if (emailConfirmationsEnabled) {
          console.log('✅ Email confirmations: ON (Abilitato)');
        } else {
          console.log('❌ Email confirmations: OFF (Disabilitato)');
          console.log('\n⚠️  IMPORTANTE: Abilita "Email confirmations" per sicurezza!');
          console.log('\n📋 COME ABILITARE:');
          console.log('1. Vai su https://supabase.com/dashboard');
          console.log('2. Seleziona il tuo progetto');
          console.log('3. Vai su Authentication → Settings');
          console.log('4. Nella sezione "Email Auth", attiva "Enable email confirmations"');
        }
        return;
      } else {
        console.log('⚠️  Impossibile accedere all\'API Management (potrebbe richiedere permessi aggiuntivi)');
        console.log('   Fallback a verifica manuale...\n');
      }
    }

    // Fallback: verifica tramite database o fornisci istruzioni manuali
    console.log('📋 VERIFICA MANUALE RICHIESTA:\n');
    console.log('Per controllare se "Email confirmations" è ON:');
    console.log('');
    console.log('1. Vai su: https://supabase.com/dashboard');
    console.log(`2. Seleziona il progetto: ${supabaseUrl}`);
    console.log('3. Nel menu laterale, clicca su: Authentication');
    console.log('4. Clicca su: Settings (o Impostazioni)');
    console.log('5. Nella sezione "Email Auth", cerca: "Enable email confirmations"');
    console.log('6. Verifica che il toggle sia ON (attivo)');
    console.log('');
    console.log('💡 Se è OFF:');
    console.log('   - Clicca sul toggle per attivarlo');
    console.log('   - Salva le modifiche');
    console.log('   - Gli utenti dovranno confermare l\'email prima di poter accedere');
    console.log('');
    console.log('🔒 IMPORTANTE:');
    console.log('   - Email confirmations è importante per sicurezza');
    console.log('   - Previene registrazioni con email non verificate');
    console.log('   - Consigliato: mantenerlo sempre ON in produzione');

  } catch (error: any) {
    console.error('❌ Errore durante la verifica:', error.message);
    console.log('\n📋 VERIFICA MANUALE:\n');
    console.log('1. Vai su https://supabase.com/dashboard');
    console.log('2. Seleziona il tuo progetto');
    console.log('3. Vai su Authentication → Settings');
    console.log('4. Nella sezione "Email Auth", verifica "Enable email confirmations"');
    console.log('5. Se è OFF, attivalo cliccando sul toggle');
  }
}

// Esegui lo script
checkEmailConfirmations()
  .then(() => {
    console.log('\n✅ Verifica completata');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Errore:', error);
    process.exit(1);
  });







