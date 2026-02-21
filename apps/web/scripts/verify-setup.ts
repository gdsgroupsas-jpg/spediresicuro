/**
 * Script di verifica setup completo progetto SpedireSicuro.it
 *
 * Verifica:
 * - Dipendenze installate
 * - Variabili ambiente configurate
 * - Database locale/remoto
 * - Configurazione Supabase (opzionale)
 */

import * as fs from 'fs';
import * as path from 'path';

interface CheckResult {
  name: string;
  status: 'success' | 'warning' | 'error';
  message: string;
}

const checks: CheckResult[] = [];

// Colori per output console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Verifica 1: Node.js e npm
 */
function checkNodeVersion(): CheckResult {
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

  if (majorVersion >= 18) {
    return {
      name: 'Node.js Version',
      status: 'success',
      message: `✅ Node.js ${nodeVersion} (richiesto: >= 18)`,
    };
  } else {
    return {
      name: 'Node.js Version',
      status: 'error',
      message: `❌ Node.js ${nodeVersion} (richiesto: >= 18)`,
    };
  }
}

/**
 * Verifica 2: Dipendenze installate
 */
function checkDependencies(): CheckResult {
  const nodeModulesPath = path.join(process.cwd(), 'node_modules');
  const packageJsonPath = path.join(process.cwd(), 'package.json');

  if (!fs.existsSync(nodeModulesPath)) {
    return {
      name: 'Dipendenze',
      status: 'error',
      message: '❌ node_modules non trovato. Esegui: npm install',
    };
  }

  if (!fs.existsSync(packageJsonPath)) {
    return {
      name: 'Dipendenze',
      status: 'error',
      message: '❌ package.json non trovato',
    };
  }

  // Verifica alcune dipendenze chiave
  const requiredDeps = ['next', 'react', 'typescript', '@supabase/supabase-js'];
  const missingDeps: string[] = [];

  for (const dep of requiredDeps) {
    const depPath = path.join(nodeModulesPath, dep);
    if (!fs.existsSync(depPath)) {
      missingDeps.push(dep);
    }
  }

  if (missingDeps.length > 0) {
    return {
      name: 'Dipendenze',
      status: 'error',
      message: `❌ Dipendenze mancanti: ${missingDeps.join(', ')}. Esegui: npm install`,
    };
  }

  return {
    name: 'Dipendenze',
    status: 'success',
    message: '✅ Tutte le dipendenze installate',
  };
}

/**
 * Verifica 3: File .env.local
 */
function checkEnvFile(): CheckResult {
  const envPath = path.join(process.cwd(), '.env.local');

  if (!fs.existsSync(envPath)) {
    return {
      name: 'File Ambiente',
      status: 'warning',
      message: '⚠️  .env.local non trovato. Copia da env.example.txt',
    };
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');

  // Verifica variabili essenziali
  const requiredVars = ['NEXT_PUBLIC_APP_URL', 'NEXTAUTH_SECRET'];

  const missingVars: string[] = [];
  for (const varName of requiredVars) {
    if (!envContent.includes(varName) || envContent.includes(`${varName}=`)) {
      const regex = new RegExp(`${varName}=(.+)`, 'g');
      const match = regex.exec(envContent);
      if (
        !match ||
        match[1].trim() === '' ||
        match[1].includes('your-') ||
        match[1].includes('TODO')
      ) {
        missingVars.push(varName);
      }
    }
  }

  if (missingVars.length > 0) {
    return {
      name: 'File Ambiente',
      status: 'warning',
      message: `⚠️  Variabili non configurate: ${missingVars.join(', ')}`,
    };
  }

  return {
    name: 'File Ambiente',
    status: 'success',
    message: '✅ File .env.local configurato',
  };
}

/**
 * Verifica 4: Configurazione Supabase (opzionale)
 */
function checkSupabaseConfig(): CheckResult {
  const envPath = path.join(process.cwd(), '.env.local');

  if (!fs.existsSync(envPath)) {
    return {
      name: 'Supabase',
      status: 'warning',
      message: '⚠️  .env.local non trovato - configurazione Supabase non verificabile',
    };
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');

  const supabaseVars = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'];

  const missingVars: string[] = [];
  const configuredVars: string[] = [];

  for (const varName of supabaseVars) {
    if (!envContent.includes(varName)) {
      missingVars.push(varName);
    } else {
      const regex = new RegExp(`${varName}=(.+)`, 'g');
      const match = regex.exec(envContent);
      if (
        match &&
        match[1].trim() !== '' &&
        !match[1].includes('your-') &&
        !match[1].includes('TODO')
      ) {
        configuredVars.push(varName);
      } else {
        missingVars.push(varName);
      }
    }
  }

  if (missingVars.length === supabaseVars.length) {
    return {
      name: 'Supabase',
      status: 'warning',
      message: '⚠️  Supabase non configurato (opzionale per sviluppo locale)',
    };
  } else if (missingVars.length > 0) {
    return {
      name: 'Supabase',
      status: 'warning',
      message: `⚠️  Variabili Supabase incomplete: ${missingVars.join(', ')}`,
    };
  }

  return {
    name: 'Supabase',
    status: 'success',
    message: '✅ Supabase configurato correttamente',
  };
}

/**
 * Verifica 5: Database locale
 */
function checkLocalDatabase(): CheckResult {
  const dbPath = path.join(process.cwd(), 'data', 'database.json');

  if (!fs.existsSync(dbPath)) {
    // Crea database vuoto se non esiste
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const defaultDb = {
      spedizioni: [],
      preventivi: [],
      configurazioni: {
        margine: 15,
      },
    };

    fs.writeFileSync(dbPath, JSON.stringify(defaultDb, null, 2));

    return {
      name: 'Database Locale',
      status: 'success',
      message: '✅ Database locale creato',
    };
  }

  try {
    const dbContent = fs.readFileSync(dbPath, 'utf-8');
    JSON.parse(dbContent);

    return {
      name: 'Database Locale',
      status: 'success',
      message: '✅ Database locale valido',
    };
  } catch (error) {
    return {
      name: 'Database Locale',
      status: 'error',
      message: '❌ Database locale corrotto o non valido',
    };
  }
}

/**
 * Verifica 6: File di configurazione
 */
function checkConfigFiles(): CheckResult {
  const requiredFiles = ['next.config.js', 'tsconfig.json', 'tailwind.config.js', 'package.json'];

  const missingFiles: string[] = [];

  for (const file of requiredFiles) {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
    }
  }

  if (missingFiles.length > 0) {
    return {
      name: 'File Configurazione',
      status: 'error',
      message: `❌ File mancanti: ${missingFiles.join(', ')}`,
    };
  }

  return {
    name: 'File Configurazione',
    status: 'success',
    message: '✅ Tutti i file di configurazione presenti',
  };
}

/**
 * Funzione principale
 */
async function main() {
  log('\n🚀 Verifica Setup SpedireSicuro.it\n', 'cyan');
  log('='.repeat(50), 'blue');
  log('');

  // Esegui tutti i controlli
  checks.push(checkNodeVersion());
  checks.push(checkDependencies());
  checks.push(checkConfigFiles());
  checks.push(checkEnvFile());
  checks.push(checkLocalDatabase());
  checks.push(checkSupabaseConfig());

  // Mostra risultati
  let successCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  for (const check of checks) {
    switch (check.status) {
      case 'success':
        log(check.message, 'green');
        successCount++;
        break;
      case 'warning':
        log(check.message, 'yellow');
        warningCount++;
        break;
      case 'error':
        log(check.message, 'red');
        errorCount++;
        break;
    }
  }

  log('');
  log('='.repeat(50), 'blue');
  log('');

  // Riepilogo
  log('📊 Riepilogo:', 'cyan');
  log(`   ✅ Successi: ${successCount}`, 'green');
  log(`   ⚠️  Avvisi: ${warningCount}`, 'yellow');
  log(`   ❌ Errori: ${errorCount}`, errorCount > 0 ? 'red' : 'reset');
  log('');

  // Raccomandazioni
  if (errorCount > 0) {
    log('🔧 Azioni richieste:', 'yellow');
    log('   1. Risolvi gli errori indicati sopra');
    log('   2. Esegui: npm install (se necessario)');
    log('   3. Configura .env.local da env.example.txt');
    log('');
    process.exit(1);
  } else if (warningCount > 0) {
    log('💡 Raccomandazioni:', 'yellow');
    log('   - Configura Supabase per funzionalità complete (vedi SETUP_RAPIDO.md)');
    log('   - Verifica le variabili in .env.local');
    log('');
    log('✅ Setup base completato! Puoi avviare il progetto con:', 'green');
    log('   npm run dev', 'cyan');
    log('');
  } else {
    log('🎉 Setup completo! Tutto configurato correttamente.', 'green');
    log('');
    log('Per avviare il progetto:', 'cyan');
    log('   npm run dev', 'cyan');
    log('');
  }
}

// Esegui verifica
main().catch((error) => {
  log(`\n❌ Errore durante la verifica: ${error.message}`, 'red');
  process.exit(1);
});
