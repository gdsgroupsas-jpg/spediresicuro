/**
 * Script di Verifica Configurazione Locale
 * 
 * Verifica che tutte le variabili ambiente necessarie siano configurate
 * per lo sviluppo locale.
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Carica variabili ambiente da .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

console.log('🔍 Verifica Configurazione Locale - SpedireSicuro.it\n');

// Tipo per le variabili di configurazione
interface ConfigVar {
  nome: string;
  descrizione: string;
  esempio: string;
  opzionale?: boolean;
}

// Lista variabili obbligatorie
const variabiliObbligatorie: Record<string, ConfigVar> = {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: {
    nome: 'Supabase URL',
    descrizione: 'URL del progetto Supabase',
    esempio: 'https://xxxxx.supabase.co',
  },
  NEXT_PUBLIC_SUPABASE_ANON_KEY: {
    nome: 'Supabase Anon Key',
    descrizione: 'Chiave pubblica anonima Supabase',
    esempio: 'eyJhbGc...',
  },
  SUPABASE_SERVICE_ROLE_KEY: {
    nome: 'Supabase Service Role Key',
    descrizione: 'Chiave service role (opzionale per sviluppo)',
    esempio: 'eyJhbGc...',
    opzionale: true,
  },
  
  // NextAuth
  NEXTAUTH_URL: {
    nome: 'NextAuth URL',
    descrizione: 'URL base per NextAuth (localhost:3000 per sviluppo)',
    esempio: 'http://localhost:3000',
  },
  NEXTAUTH_SECRET: {
    nome: 'NextAuth Secret',
    descrizione: 'Chiave segreta per NextAuth (genera con: openssl rand -base64 32)',
    esempio: 'chiave-segreta-32-caratteri',
  },
  
  // OAuth Google
  GOOGLE_CLIENT_ID: {
    nome: 'Google Client ID',
    descrizione: 'Client ID da Google Cloud Console',
    esempio: 'xxxxx.apps.googleusercontent.com',
    opzionale: true,
  },
  GOOGLE_CLIENT_SECRET: {
    nome: 'Google Client Secret',
    descrizione: 'Client Secret da Google Cloud Console',
    esempio: 'GOCSPX-xxxxx',
    opzionale: true,
  },
  
  // OAuth GitHub
  GITHUB_CLIENT_ID: {
    nome: 'GitHub Client ID',
    descrizione: 'Client ID da GitHub OAuth App',
    esempio: 'Ov23lisdrBDDJzmdeShy',
    opzionale: true,
  },
  GITHUB_CLIENT_SECRET: {
    nome: 'GitHub Client Secret',
    descrizione: 'Client Secret da GitHub OAuth App',
    esempio: 'xxxxx',
    opzionale: true,
  },
  
  // App
  NEXT_PUBLIC_APP_URL: {
    nome: 'App URL',
    descrizione: 'URL base applicazione',
    esempio: 'http://localhost:3000',
  },
};

// Verifica variabili
let errori = 0;
let warning = 0;

console.log('📋 Verifica Variabili Ambiente:\n');

for (const [key, info] of Object.entries(variabiliObbligatorie)) {
  const valore = process.env[key];
  const presente = !!valore;
  const valido = presente && valore !== '' && !valore.includes('your-') && !valore.includes('xxxxx');
  
  if (!presente || !valido) {
    if (info.opzionale) {
      console.log(`⚠️  ${info.nome} (OPZIONALE): ${presente ? '⚠️ Valore non valido' : '⚠️ Non configurato'}`);
      warning++;
    } else {
      console.log(`❌ ${info.nome}: ${presente ? '❌ Valore non valido' : '❌ NON CONFIGURATO'}`);
      errori++;
    }
    console.log(`   Descrizione: ${info.descrizione}`);
    console.log(`   Esempio: ${info.esempio}`);
    console.log(`   Aggiungi in .env.local: ${key}=${info.esempio}\n`);
  } else {
    // Mostra solo i primi e ultimi caratteri per sicurezza
    const valoreMasked = valore.length > 20 
      ? `${valore.substring(0, 10)}...${valore.substring(valore.length - 10)}`
      : valore;
    console.log(`✅ ${info.nome}: ${valoreMasked}\n`);
  }
}

// Verifica specifiche
console.log('\n📊 Verifica Specifiche:\n');

// Verifica Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (supabaseUrl && supabaseKey) {
  console.log('✅ Supabase: Variabili configurate');
  if (!supabaseUrl.includes('supabase.co')) {
    console.log('⚠️  Supabase URL potrebbe non essere valido');
    warning++;
  }
} else {
  console.log('❌ Supabase: Variabili mancanti - Autocomplete città NON funzionerà');
  errori++;
}

// Verifica NextAuth
const nextAuthUrl = process.env.NEXTAUTH_URL;
const nextAuthSecret = process.env.NEXTAUTH_SECRET;

if (nextAuthUrl && nextAuthSecret) {
  console.log('✅ NextAuth: Configurato');
  if (!nextAuthUrl.includes('localhost') && process.env.NODE_ENV === 'development') {
    console.log('⚠️  NEXTAUTH_URL dovrebbe essere http://localhost:3000 per sviluppo');
    warning++;
  }
} else {
  console.log('❌ NextAuth: Configurazione incompleta - Autenticazione NON funzionerà');
  errori++;
}

// Verifica OAuth Google
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (googleClientId && googleClientSecret) {
  console.log('✅ Google OAuth: Configurato');
} else {
  console.log('⚠️  Google OAuth: Non configurato - Login Google NON disponibile');
  warning++;
}

// Verifica OAuth GitHub
const githubClientId = process.env.GITHUB_CLIENT_ID;
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;

if (githubClientId && githubClientSecret) {
  console.log('✅ GitHub OAuth: Configurato');
} else {
  console.log('⚠️  GitHub OAuth: Non configurato - Login GitHub NON disponibile');
  warning++;
}

// Riepilogo
console.log('\n' + '='.repeat(50));
console.log('📊 RIEPILOGO:\n');

if (errori === 0 && warning === 0) {
  console.log('✅ Tutto configurato correttamente!');
  process.exit(0);
} else {
  if (errori > 0) {
    console.log(`❌ ${errori} errore/i critico/i trovato/i`);
    console.log('   ⚠️  L\'applicazione NON funzionerà correttamente senza queste variabili!\n');
  }
  if (warning > 0) {
    console.log(`⚠️  ${warning} avviso/i (funzionalità opzionali non configurate)\n`);
  }
  
  console.log('📝 PROSSIMI PASSI:');
  console.log('1. Apri il file .env.local nella root del progetto');
  console.log('2. Aggiungi le variabili mancanti (vedi esempi sopra)');
  console.log('3. Riavvia il server di sviluppo: npm run dev');
  console.log('\n💡 Guida completa: vedi env.example.txt o DOCUMENTAZIONE_OAUTH_COMPLETA.md\n');
  
  process.exit(errori > 0 ? 1 : 0);
}

