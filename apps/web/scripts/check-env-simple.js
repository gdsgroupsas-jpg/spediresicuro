/**
 * Script semplice per verificare .env.local
 * Eseguire con: node scripts/check-env-simple.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifica File .env.local\n');
console.log('='.repeat(50));
console.log('');

const envPath = path.join(process.cwd(), '.env.local');

// Verifica se esiste
if (!fs.existsSync(envPath)) {
  console.log('❌ File .env.local NON ESISTE\n');
  console.log('💡 Per crearlo:');
  console.log('   1. Copia env.example.txt');
  console.log('   2. Rinomina in .env.local');
  console.log('   3. Compila le variabili\n');
  process.exit(1);
}

console.log('✅ File .env.local ESISTE\n');

// Leggi file
const envContent = fs.readFileSync(envPath, 'utf-8');
const lines = envContent.split('\n');

// Variabili da verificare
const variabili = {
  NEXT_PUBLIC_SUPABASE_URL: 'Supabase URL (per autocomplete città)',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'Supabase Anon Key (per autocomplete città)',
  SUPABASE_SERVICE_ROLE_KEY: 'Supabase Service Role Key (opzionale)',
  NEXTAUTH_URL: 'NextAuth URL (per autenticazione)',
  NEXTAUTH_SECRET: 'NextAuth Secret (per autenticazione)',
  GOOGLE_CLIENT_ID: 'Google Client ID (per login Google)',
  GOOGLE_CLIENT_SECRET: 'Google Client Secret (per login Google)',
  NEXT_PUBLIC_APP_URL: 'App URL',
};

console.log('📋 Verifica Variabili:\n');

let errori = 0;
let warning = 0;
let ok = 0;
const mancanti = [];
const placeholder = [];
const configurate = [];

for (const [varName, descrizione] of Object.entries(variabili)) {
  const regex = new RegExp(`^${varName}=(.+)$`, 'm');
  const match = envContent.match(regex);

  if (!match) {
    // Variabile non trovata
    if (varName.includes('SERVICE_ROLE')) {
      console.log(`⚠️  ${varName}: Non configurato (opzionale)`);
      warning++;
    } else {
      console.log(`❌ ${varName}: NON CONFIGURATO`);
      mancanti.push(varName);
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
      placeholder.push(varName);
      if (!varName.includes('SERVICE_ROLE')) {
        errori++;
      } else {
        warning++;
      }
    } else {
      // Valore valido
      const masked =
        valore.length > 20
          ? `${valore.substring(0, 8)}...${valore.substring(valore.length - 8)}`
          : '*'.repeat(Math.min(valore.length, 12));
      console.log(`✅ ${varName}: Configurato (${valore.length} caratteri)`);
      configurate.push(varName);
      ok++;
    }
  }
}

console.log('\n' + '='.repeat(50));
console.log('📊 RIEPILOGO:\n');

if (errori === 0 && warning === 0) {
  console.log('✅ Tutto configurato correttamente!');
  console.log('\n💡 Se ancora non funziona, verifica:');
  console.log('   1. Server riavviato dopo modifiche .env.local');
  console.log('   2. Credenziali corrette (URL Supabase, chiavi OAuth)');
  console.log('   3. Tabella geo_locations esiste in Supabase');
} else {
  if (errori > 0) {
    console.log(`❌ ${errori} variabile/i OBBLIGATORIA/E mancante/i o non valida/e\n`);

    if (mancanti.length > 0) {
      console.log('Variabili MANCANTI:');
      mancanti.forEach((v) => console.log(`   - ${v}`));
      console.log('');
    }

    if (placeholder.length > 0) {
      console.log('Variabili con PLACEHOLDER (da sostituire):');
      placeholder.forEach((v) => console.log(`   - ${v}`));
      console.log('');
    }
  }

  if (warning > 0) {
    console.log(`⚠️  ${warning} variabile/i opzionale/i non configurate\n`);
  }

  console.log('💡 PROSSIMI PASSI:');
  console.log('   1. Apri .env.local');
  console.log('   2. Sostituisci i valori placeholder con valori reali');
  console.log('   3. Aggiungi le variabili mancanti');
  console.log('   4. Riavvia il server: npm run dev\n');

  console.log('📚 Guide disponibili:');
  console.log('   - GUIDA_RAPIDA_FIX_LOCALE.md');
  console.log('   - FIX_CONFIGURAZIONE_LOCALE.md\n');
}

console.log('='.repeat(50));
console.log('\n✅ Verifica completata\n');

process.exit(errori > 0 ? 1 : 0);
