/**
 * Script di Verifica Sicurezza - Controlla Dati Sensibili
 * 
 * Verifica se ci sono dati sensibili esposti nei file tracciati da Git
 * che potrebbero essere committati per errore.
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

console.log('🔒 Verifica Sicurezza - Controllo Dati Sensibili\n');
console.log('='.repeat(60));
console.log('');

// Pattern da cercare (dati sensibili)
const patternSensibili = [
  // JWT tokens (iniziano con eyJ)
  { pattern: /eyJ[A-Za-z0-9_-]{20,}/g, nome: 'JWT Token (possibile chiave API)' },
  // Supabase URLs reali (non di esempio)
  { pattern: /https:\/\/[a-z0-9]+\.supabase\.co/g, nome: 'URL Supabase reale' },
  // Google OAuth
  { pattern: /GOCSPX-[A-Za-z0-9_-]{20,}/g, nome: 'Google OAuth Secret' },
  // GitHub tokens
  { pattern: /ghp_[A-Za-z0-9]{36,}/g, nome: 'GitHub Personal Access Token' },
  // Chiavi lunghe che sembrano reali (non placeholder)
  { pattern: /[A-Za-z0-9]{50,}/g, nome: 'Chiave lunga (possibile secret)' },
  // Password in chiaro
  { pattern: /password\s*=\s*['"](?!your-|xxxxx|placeholder|TODO)[^'"]{8,}['"]/gi, nome: 'Password in chiaro' },
  // API keys comuni
  { pattern: /(api[_-]?key|apikey)\s*=\s*['"](?!your-|xxxxx|placeholder|TODO)[^'"]{20,}['"]/gi, nome: 'API Key' },
];

// File da escludere (sono file di esempio o documentazione)
const fileEsclusi = [
  'ESEMPIO_ENV_LOCALE.txt',
  'ESEMPIO_ENV.txt',
  'automation-service/ESEMPIO_ENV.txt',
  '.gitignore',
  'package-lock.json',
  'node_modules',
  '.next',
  'dist',
  'build',
];

// Estensioni da controllare
const estensioniControllate = ['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.txt', '.ps1', '.bat', '.sh'];

let problemiTrovati: Array<{ file: string; tipo: string; riga?: number }> = [];

console.log('📋 File tracciati da Git:\n');

try {
  // Ottieni lista file tracciati da Git
  const gitFiles = execSync('git ls-files', { encoding: 'utf-8' })
    .split('\n')
    .filter(line => line.trim() !== '');

  console.log(`   Trovati ${gitFiles.length} file tracciati\n`);

  // Filtra file da controllare
  const fileDaControllare = gitFiles.filter(file => {
    // Escludi file nella lista esclusi
    if (fileEsclusi.some(escluso => file.includes(escluso))) {
      return false;
    }

    // Controlla solo estensioni specificate
    const ext = path.extname(file);
    return estensioniControllate.includes(ext) || !ext;
  });

  console.log(`   File da controllare: ${fileDaControllare.length}\n`);
  console.log('🔍 Scansione in corso...\n');

  // Controlla ogni file
  for (const file of fileDaControllare) {
    const filePath = path.join(process.cwd(), file);

    if (!fs.existsSync(filePath)) {
      continue;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      // Controlla ogni pattern
      for (const { pattern, nome } of patternSensibili) {
        const matches = content.match(pattern);
        
        if (matches) {
          // Verifica se non sono placeholder
          const matchValidi = matches.filter(match => {
            const lower = match.toLowerCase();
            return !lower.includes('your-') &&
                   !lower.includes('xxxxx') &&
                   !lower.includes('placeholder') &&
                   !lower.includes('example') &&
                   !lower.includes('todo') &&
                   match.length > 10; // Ignora match troppo corti
          });

          if (matchValidi.length > 0) {
            // Trova la riga
            for (let i = 0; i < lines.length; i++) {
              if (lines[i].match(pattern)) {
                problemiTrovati.push({
                  file,
                  tipo: nome,
                  riga: i + 1,
                });
                break;
              }
            }
          }
        }
      }
    } catch (err) {
      // Ignora errori di lettura (file binari, ecc.)
    }
  }

  // Mostra risultati
  console.log('='.repeat(60));
  console.log('📊 RISULTATI:\n');

  if (problemiTrovati.length === 0) {
    console.log('✅ Nessun dato sensibile trovato nei file tracciati!\n');
    console.log('💡 I file .env.local e automation-service/.env sono protetti da .gitignore\n');
  } else {
    console.log(`⚠️  Trovati ${problemiTrovati.length} possibile/i problema/i:\n`);

    // Raggruppa per file
    const perFile: Record<string, Array<{ tipo: string; riga?: number }>> = {};
    for (const problema of problemiTrovati) {
      if (!perFile[problema.file]) {
        perFile[problema.file] = [];
      }
      perFile[problema.file].push({ tipo: problema.tipo, riga: problema.riga });
    }

    for (const [file, problemi] of Object.entries(perFile)) {
      console.log(`📄 ${file}:`);
      for (const problema of problemi) {
        console.log(`   ⚠️  ${problema.tipo}${problema.riga ? ` (riga ${problema.riga})` : ''}`);
      }
      console.log('');
    }

    console.log('💡 RACCOMANDAZIONI:\n');
    console.log('   1. Verifica se questi sono dati reali o solo esempi');
    console.log('   2. Se sono reali, rimuovili o sostituiscili con placeholder');
    console.log('   3. Assicurati che .env.local e automation-service/.env siano in .gitignore');
    console.log('   4. Se hai già committato dati sensibili, rigenera le chiavi!\n');
  }

  // Verifica .gitignore
  console.log('='.repeat(60));
  console.log('🔐 Verifica .gitignore:\n');

  const gitignorePath = path.join(process.cwd(), '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    
    const protezioniNecessarie = [
      '.env*.local',
      '.env',
      'automation-service/.env',
    ];

    let tutteProtezioni = true;
    for (const protezione of protezioniNecessarie) {
      if (gitignoreContent.includes(protezione)) {
        console.log(`   ✅ ${protezione} protetto`);
      } else {
        console.log(`   ❌ ${protezione} NON protetto!`);
        tutteProtezioni = false;
      }
    }

    if (tutteProtezioni) {
      console.log('\n   ✅ Tutte le protezioni necessarie sono presenti\n');
    } else {
      console.log('\n   ⚠️  Aggiungi le protezioni mancanti a .gitignore!\n');
    }
  } else {
    console.log('   ❌ File .gitignore non trovato!\n');
  }

  console.log('='.repeat(60));
  console.log('\n✅ Verifica completata\n');

  process.exit(problemiTrovati.length > 0 ? 1 : 0);

} catch (error) {
  console.error('❌ Errore durante la verifica:', error);
  process.exit(1);
}

