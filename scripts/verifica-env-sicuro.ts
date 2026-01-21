/**
 * Verifica Sicura File .env.local
 *
 * Verifica se .env.local esiste e quali variabili sono configurate
 * SENZA mostrare i valori sensibili e SENZA sovrascrivere nulla
 */

import * as fs from 'fs';
import * as path from 'path';

console.log('🔍 Verifica File .env.local\n');
console.log('='.repeat(50));
console.log('');

const envPath = path.join(process.cwd(), '.env.local');

// Verifica se esiste
if (!fs.existsSync(envPath)) {
  console.log('❌ File .env.local NON ESISTE\n');
  console.log('💡 Per crearlo (SENZA sovrascrivere se esiste già):');
  console.log('   Se non esiste: copia env.example.txt in .env.local');
  console.log('   Se esiste già: non fare nulla, è già configurato\n');
  process.exit(1);
}

console.log('✅ File .env.local ESISTE\n');

// Leggi file
const envContent = fs.readFileSync(envPath, 'utf-8');

// Variabili da verificare
const variabiliObbligatorie = {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: 'Supabase URL',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'Supabase Anon Key',
  SUPABASE_SERVICE_ROLE_KEY: 'Supabase Service Role Key (opzionale)',

  // NextAuth
  NEXTAUTH_URL: 'NextAuth URL',
  NEXTAUTH_SECRET: 'NextAuth Secret',

  // Google OAuth
  GOOGLE_CLIENT_ID: 'Google Client ID',
  GOOGLE_CLIENT_SECRET: 'Google Client Secret',

  // App
  NEXT_PUBLIC_APP_URL: 'App URL',
};

console.log('📋 Verifica Variabili:\n');

let errori = 0;
let warning = 0;
let ok = 0;

for (const [varName, descrizione] of Object.entries(variabiliObbligatorie)) {
  const regex = new RegExp(`^${varName}=(.+)$`, 'm');
  const match = envContent.match(regex);

  if (!match) {
    // Variabile non trovata
    if (
      varName.includes('SERVICE_ROLE') ||
      varName.includes('GOOGLE') ||
      varName.includes('GITHUB')
    ) {
      console.log(`⚠️  ${varName}: Non configurato (opzionale)`);
      warning++;
    } else {
      console.log(`❌ ${varName}: NON CONFIGURATO`);
      errori++;
    }
  } else {
    const valore = match[1].trim();

    // Verifica se è un placeholder
    if (
      valore === '' ||
      valore.includes('your-') ||
      valore.includes('xxxxx') ||
      valore.includes('placeholder') ||
      valore.includes('TODO') ||
      valore === 'your-secret-key-here-change-in-production'
    ) {
      console.log(`⚠️  ${varName}: Valore placeholder (non valido)`);
      if (!varName.includes('SERVICE_ROLE')) {
        errori++;
      } else {
        warning++;
      }
    } else {
      // Valore valido (mostra solo lunghezza per sicurezza)
      const masked =
        valore.length > 20
          ? `${valore.substring(0, 8)}...${valore.substring(valore.length - 8)} (${valore.length} caratteri)`
          : `${'*'.repeat(Math.min(valore.length, 12))} (${valore.length} caratteri)`;
      console.log(`✅ ${varName}: Configurato ${masked}`);
      ok++;
    }
  }
}

console.log('\n' + '='.repeat(50));
console.log('📊 RIEPILOGO:\n');

if (errori === 0 && warning === 0) {
  console.log('✅ Tutto configurato correttamente!');
  console.log('💡 Se ancora non funziona, verifica:');
  console.log('   1. Server riavviato dopo modifiche .env.local');
  console.log('   2. Credenziali corrette (URL Supabase, chiavi OAuth)');
  console.log('   3. Tabella geo_locations esiste in Supabase');
} else {
  if (errori > 0) {
    console.log(`❌ ${errori} variabile/i OBBLIGATORIA/E mancante/i o non valida/e`);
    console.log("   ⚠️  L'applicazione NON funzionerà senza queste!\n");
  }
  if (warning > 0) {
    console.log(`⚠️  ${warning} variabile/i opzionale/i non configurate\n`);
  }

  console.log('💡 PROSSIMI PASSI:');
  console.log('   1. Apri .env.local');
  console.log('   2. Sostituisci i valori placeholder con valori reali');
  console.log('   3. Riavvia il server: npm run dev\n');

  console.log('📚 Guide disponibili:');
  console.log('   - GUIDA_RAPIDA_FIX_LOCALE.md');
  console.log('   - FIX_CONFIGURAZIONE_LOCALE.md\n');
}

console.log('='.repeat(50));
console.log('\n✅ Verifica completata - File .env.local NON è stato modificato\n');

process.exit(errori > 0 ? 1 : 0);
