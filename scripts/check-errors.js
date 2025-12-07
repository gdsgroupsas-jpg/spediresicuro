/**
 * Check Errors Script
 * 
 * Verifica ERROR_LOG.md e mostra ultimi errori
 * Utilizzo: node scripts/check-errors.js
 */

const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(process.cwd(), 'ERROR_LOG.md');

if (!fs.existsSync(LOG_FILE)) {
  console.log('✅ Nessun file di log errori trovato. Tutto ok!');
  process.exit(0);
}

const content = fs.readFileSync(LOG_FILE, 'utf-8');
const errors = content.split('---').filter(entry => entry.trim().length > 0);

if (errors.length <= 1) {
  console.log('✅ Nessun errore registrato nel log.');
  process.exit(0);
}

console.log(`\n📋 Trovati ${errors.length - 1} errori nel log:\n`);
console.log('='.repeat(60));
console.log(content.substring(0, 2000)); // Prime 2000 caratteri
console.log('='.repeat(60));
console.log(`\n📄 Log completo: ${LOG_FILE}\n`);








