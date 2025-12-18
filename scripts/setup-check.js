/**
 * Setup Check Script
 * 
 * Verifica completa del setup locale:
 * 1. Verifica variabili ambiente (.env.local)
 * 2. Verifica errori nel log
 * 3. Verifica Supabase (solo se Docker disponibile)
 * 
 * Utilizzo: npm run setup:check
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Safeguard: Verifica che gli script dipendenti esistano
const requiredScripts = {
  'check:env:simple': path.join(__dirname, 'check-env-simple.js'),
  'check:errors': path.join(__dirname, 'check-errors.js'),
};

for (const [scriptName, scriptPath] of Object.entries(requiredScripts)) {
  if (!fs.existsSync(scriptPath)) {
    console.error(`❌ ERRORE: Script richiesto non trovato: ${scriptPath}`);
    console.error(`   Lo script '${scriptName}' è necessario per setup:check`);
    console.error(`   Verifica che il file esista nella cartella scripts/\n`);
    process.exit(1);
  }
}

console.log('🔍 Setup Check - Verifica Configurazione Locale\n');
console.log('='.repeat(60));
console.log('');

let hasErrors = false;
let warnings = [];

// Helper per eseguire comandi
function runCommand(command, description, optional = false) {
  try {
    console.log(`\n📋 ${description}...`);
    const output = execSync(command, { 
      encoding: 'utf-8',
      stdio: 'pipe',
      cwd: process.cwd()
    });
    console.log(`✅ ${description}: PASS`);
    if (output.trim()) {
      console.log(output.trim());
    }
    return true;
  } catch (error) {
    const errorMsg = error.message || error.toString();
    if (optional) {
      console.log(`⚠️  ${description}: SKIP (${errorMsg.split('\n')[0]})`);
      warnings.push(`${description}: ${errorMsg.split('\n')[0]}`);
      return false;
    } else {
      console.log(`❌ ${description}: FAIL`);
      console.log(errorMsg);
      hasErrors = true;
      return false;
    }
  }
}

// Helper per verificare se Docker è disponibile
function isDockerAvailable() {
  try {
    execSync('docker --version', { 
      encoding: 'utf-8',
      stdio: 'pipe'
    });
    // Verifica anche se Docker daemon è in esecuzione
    try {
      execSync('docker ps', { 
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 3000
      });
      return true;
    } catch {
      return false; // Docker installato ma non in esecuzione
    }
  } catch {
    return false; // Docker non installato
  }
}

// ============================================
// STEP 1: Verifica Variabili Ambiente
// ============================================

console.log('📦 STEP 1: Verifica Variabili Ambiente');
console.log('-'.repeat(60));

const envCheck = runCommand(
  'npm run check:env:simple',
  'Verifica variabili .env.local',
  false
);

if (!envCheck) {
  console.log('\n❌ Setup incompleto: variabili ambiente mancanti o non valide');
  console.log('💡 Esegui: npm run check:env:simple per dettagli\n');
  process.exit(1);
}

// ============================================
// STEP 2: Verifica Errori nel Log
// ============================================

console.log('\n📋 STEP 2: Verifica Errori nel Log');
console.log('-'.repeat(60));

const errorsCheck = runCommand(
  'npm run check:errors',
  'Verifica errori nel log',
  false
);

if (!errorsCheck) {
  console.log('\n⚠️  Trovati errori nel log (non bloccante)');
}

// ============================================
// STEP 3: Verifica Supabase (solo se Docker disponibile)
// ============================================

console.log('\n🗄️  STEP 3: Verifica Supabase');
console.log('-'.repeat(60));

const dockerAvailable = isDockerAvailable();

if (!dockerAvailable) {
  console.log('⚠️  Docker non disponibile o non in esecuzione');
  console.log('   Supabase locale non può essere verificato');
  console.log('   💡 Per sviluppo con Supabase Cloud: questo è OK');
  console.log('   💡 Per sviluppo con Supabase locale: avvia Docker Desktop\n');
  warnings.push('Docker non disponibile - Supabase locale non verificato');
} else {
  console.log('✅ Docker disponibile');
  const supabaseCheck = runCommand(
    'npx supabase status',
    'Verifica Supabase locale',
    true // Opzionale: se fallisce, non blocca
  );
  
  if (!supabaseCheck) {
    warnings.push('Supabase locale non disponibile - usa Supabase Cloud o avvia Supabase locale');
  }
}

// ============================================
// REPORT FINALE
// ============================================

console.log('\n' + '='.repeat(60));
console.log('📊 REPORT FINALE');
console.log('='.repeat(60));
console.log('');

if (hasErrors) {
  console.log('❌ SETUP INCOMPLETO');
  console.log('   Risolvi gli errori sopra prima di continuare\n');
  process.exit(1);
} else if (warnings.length > 0) {
  console.log('⚠️  SETUP PARZIALE');
  console.log('   Setup base OK, ma alcune verifiche opzionali fallite:');
  warnings.forEach(w => console.log(`   - ${w}`));
  console.log('\n💡 Puoi continuare con lo sviluppo, ma alcune funzionalità potrebbero non essere disponibili\n');
  process.exit(0);
} else {
  console.log('✅ SETUP COMPLETO');
  console.log('   Tutte le verifiche sono passate con successo!');
  console.log('   Puoi iniziare lo sviluppo con: npm run dev\n');
  process.exit(0);
}

