/**
 * Git Pre-Commit Hook
 * 
 * Esegue controlli prima del commit e crea ERROR_LOG.md se ci sono errori
 * Utilizzo: Aggiungi a .git/hooks/pre-commit
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(process.cwd(), 'ERROR_LOG.md');

function writeLog(entry) {
  const timestamp = new Date().toISOString();
  const logEntry = `## Pre-Commit Check - ${timestamp}\n\n${entry}\n\n---\n\n`;
  
  let existingContent = '';
  if (fs.existsSync(LOG_FILE)) {
    existingContent = fs.readFileSync(LOG_FILE, 'utf-8');
  }
  
  const newContent = `# Error Log - SpedireSicuro\n\n> Ultimo aggiornamento: ${timestamp}\n\n---\n\n${logEntry}${existingContent}`;
  fs.writeFileSync(LOG_FILE, newContent, 'utf-8');
}

console.log('🔍 Eseguo controlli pre-commit...\n');

try {
  // 1. Type check
  console.log('📝 Type check...');
  execSync('npm run type-check', { stdio: 'inherit' });
  console.log('✅ Type check OK\n');
} catch (error) {
  writeLog(`### Errore Type Check\n\n\`\`\`\n${error.message}\n\`\`\``);
  console.error('❌ Type check fallito');
  process.exit(1);
}

try {
  // 2. Lint check
  console.log('📝 Lint check...');
  execSync('npm run lint', { stdio: 'inherit' });
  console.log('✅ Lint check OK\n');
} catch (error) {
  writeLog(`### Errore Lint\n\n\`\`\`\n${error.message}\n\`\`\``);
  console.error('❌ Lint check fallito');
  process.exit(1);
}

console.log('✅ Tutti i controlli superati!\n');











