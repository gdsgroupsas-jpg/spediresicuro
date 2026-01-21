/**
 * Script per creare automation-service/.env da .env.local
 */

const fs = require('fs');
const path = require('path');

console.log('Creazione automation-service/.env...\n');

// Leggi .env.local
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (!fs.existsSync(envLocalPath)) {
  console.error('ERRORE: File .env.local non trovato!');
  process.exit(1);
}

const envLocal = fs.readFileSync(envLocalPath, 'utf-8');

// Funzione per estrarre variabile
function getVar(name) {
  const regex = new RegExp('^' + name + '=(.+)$', 'm');
  const match = envLocal.match(regex);
  return match ? match[1].trim() : null;
}

// Estrai variabili
const supabaseUrl = getVar('NEXT_PUBLIC_SUPABASE_URL');
const serviceRole = getVar('SUPABASE_SERVICE_ROLE_KEY');
const diagnosticsToken = getVar('DIAGNOSTICS_TOKEN');
const automationToken = getVar('AUTOMATION_SERVICE_TOKEN');
const encryptionKey = getVar('ENCRYPTION_KEY');

// Verifica che tutte le variabili siano presenti
const missing = [];
if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
if (!serviceRole) missing.push('SUPABASE_SERVICE_ROLE_KEY');
if (!diagnosticsToken) missing.push('DIAGNOSTICS_TOKEN');
if (!automationToken) missing.push('AUTOMATION_SERVICE_TOKEN');
if (!encryptionKey) missing.push('ENCRYPTION_KEY');

if (missing.length > 0) {
  console.error('ERRORE: Variabili mancanti in .env.local:');
  missing.forEach((v) => console.error('  - ' + v));
  process.exit(1);
}

// Crea contenuto .env
const automationEnv = `# ============================================
# FILE .env per Automation Service
# ============================================
# Generato automaticamente da crea-automation-env.js
# 

# ============================================
# SUPABASE - Database
# ============================================
SUPABASE_URL=${supabaseUrl}
SUPABASE_SERVICE_ROLE_KEY=${serviceRole}

# ============================================
# DIAGNOSTICS
# ============================================
DIAGNOSTICS_TOKEN=${diagnosticsToken}

# ============================================
# AUTOMATION SERVICE
# ============================================
AUTOMATION_SERVICE_TOKEN=${automationToken}

# ============================================
# ENCRYPTION
# ============================================
ENCRYPTION_KEY=${encryptionKey}

# ============================================
# SERVER
# ============================================
PORT=3001
NODE_ENV=development
`;

// Salva file
const automationPath = path.join(__dirname, '..', 'automation-service', '.env');
fs.writeFileSync(automationPath, automationEnv);

console.log('OK: File automation-service/.env creato con successo!');
console.log('\nVariabili copiate da .env.local:');
console.log('  - SUPABASE_URL');
console.log('  - SUPABASE_SERVICE_ROLE_KEY');
console.log('  - DIAGNOSTICS_TOKEN');
console.log('  - AUTOMATION_SERVICE_TOKEN');
console.log('  - ENCRYPTION_KEY');
console.log('\nIMPORTANTE: ENCRYPTION_KEY e AUTOMATION_SERVICE_TOKEN');
console.log('sono identici a quelli in .env.local (come richiesto)');
