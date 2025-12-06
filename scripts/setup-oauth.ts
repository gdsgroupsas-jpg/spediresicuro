/**
 * Script di Setup OAuth
 * 
 * Guida interattiva per configurare Google e GitHub OAuth
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

const ENV_PATH = path.join(process.cwd(), '.env.local');

async function main() {
  console.log('\n🔐 Setup OAuth - SpedireSicuro.it\n');
  console.log('='.repeat(50));
  console.log('');

  // Leggi il file .env.local
  let envContent = '';
  if (fs.existsSync(ENV_PATH)) {
    envContent = fs.readFileSync(ENV_PATH, 'utf-8');
  } else {
    console.error('❌ File .env.local non trovato!');
    process.exit(1);
  }

  console.log('📋 Configurazione OAuth Providers\n');
  console.log('Le credenziali OAuth sono OPCZIONALI.');
  console.log('L\'app funziona anche senza OAuth (login email/password).\n');

  // Google OAuth
  console.log('🔵 Google OAuth');
  console.log('─'.repeat(50));
  const setupGoogle = await question('Vuoi configurare Google OAuth? (s/n): ');
  
  if (setupGoogle.toLowerCase() === 's' || setupGoogle.toLowerCase() === 'si') {
    console.log('\n📝 Istruzioni:');
    console.log('1. Vai su: https://console.cloud.google.com/');
    console.log('2. Crea OAuth 2.0 Client ID (tipo Web application)');
    console.log('3. Callback URL: http://localhost:3001/api/auth/callback/google');
    console.log('4. Copia Client ID e Client Secret\n');
    
    const googleClientId = await question('Inserisci GOOGLE_CLIENT_ID: ');
    const googleClientSecret = await question('Inserisci GOOGLE_CLIENT_SECRET: ');
    
    if (googleClientId && googleClientSecret) {
      envContent = envContent.replace(
        /GOOGLE_CLIENT_ID=.*/g,
        `GOOGLE_CLIENT_ID=${googleClientId.trim()}`
      );
      envContent = envContent.replace(
        /GOOGLE_CLIENT_SECRET=.*/g,
        `GOOGLE_CLIENT_SECRET=${googleClientSecret.trim()}`
      );
      console.log('✅ Google OAuth configurato!\n');
    }
  }

  // GitHub OAuth
  console.log('🐙 GitHub OAuth');
  console.log('─'.repeat(50));
  const setupGitHub = await question('Vuoi configurare GitHub OAuth? (s/n): ');
  
  if (setupGitHub.toLowerCase() === 's' || setupGitHub.toLowerCase() === 'si') {
    console.log('\n📝 Istruzioni:');
    console.log('1. Vai su: https://github.com/settings/developers');
    console.log('2. Crea nuova OAuth App');
    console.log('3. Callback URL: http://localhost:3001/api/auth/callback/github');
    console.log('4. Copia Client ID e Client Secret\n');
    
    const githubClientId = await question('Inserisci GITHUB_CLIENT_ID: ');
    const githubClientSecret = await question('Inserisci GITHUB_CLIENT_SECRET: ');
    
    if (githubClientId && githubClientSecret) {
      envContent = envContent.replace(
        /GITHUB_CLIENT_ID=.*/g,
        `GITHUB_CLIENT_ID=${githubClientId.trim()}`
      );
      envContent = envContent.replace(
        /GITHUB_CLIENT_SECRET=.*/g,
        `GITHUB_CLIENT_SECRET=${githubClientSecret.trim()}`
      );
      console.log('✅ GitHub OAuth configurato!\n');
    }
  }

  // Salva il file
  fs.writeFileSync(ENV_PATH, envContent, 'utf-8');
  console.log('✅ File .env.local aggiornato!');
  console.log('\n📋 Prossimi passi:');
  console.log('1. Riavvia il server: npm run dev');
  console.log('2. Testa i provider OAuth su http://localhost:3001/login');
  console.log('');

  rl.close();
}

main().catch((error) => {
  console.error('\n❌ Errore:', error.message);
  process.exit(1);
});









