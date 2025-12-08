/**
 * Error Monitor Script
 * 
 * Monitora errori durante build/dev e crea ERROR_LOG.md
 * Utilizzo: node scripts/error-monitor.js [dev|build]
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const LOG_FILE = path.join(process.cwd(), 'ERROR_LOG.md');
const command = process.argv[2] || 'dev';
const npmCommand = command === 'build' ? 'build' : 'dev';

// Crea/aggiorna log file
function writeLog(entry) {
  const timestamp = new Date().toISOString();
  const logEntry = `## ${timestamp}\n\n${entry}\n\n---\n\n`;
  
  let existingContent = '';
  if (fs.existsSync(LOG_FILE)) {
    existingContent = fs.readFileSync(LOG_FILE, 'utf-8');
  }
  
  const newContent = `# Error Log - SpedireSicuro\n\n> Ultimo aggiornamento: ${timestamp}\n\n---\n\n${logEntry}${existingContent}`;
  fs.writeFileSync(LOG_FILE, newContent, 'utf-8');
  console.log(`\n📝 Errore salvato in ${LOG_FILE}\n`);
}

// Esegui npm command e monitora output
const npm = spawn('npm', ['run', npmCommand], {
  shell: true,
  stdio: ['inherit', 'pipe', 'pipe'],
});

let output = '';
let errorOutput = '';

npm.stdout.on('data', (data) => {
  const text = data.toString();
  output += text;
  process.stdout.write(text);
  
  // Cattura errori comuni
  if (text.includes('error') || text.includes('Error') || text.includes('Failed')) {
    writeLog(`### Errore Rilevato\n\n\`\`\`\n${text}\n\`\`\``);
  }
});

npm.stderr.on('data', (data) => {
  const text = data.toString();
  errorOutput += text;
  process.stderr.write(text);
  
  // Cattura errori stderr
  if (text.includes('error') || text.includes('Error') || text.includes('Failed')) {
    writeLog(`### Errore Stderr\n\n\`\`\`\n${text}\n\`\`\``);
  }
});

npm.on('close', (code) => {
  if (code !== 0) {
    const errorSummary = `### Build/Dev Fallito\n\n**Exit Code:** ${code}\n\n**Output completo:**\n\`\`\`\n${output}\n\`\`\`\n\n**Error Output:**\n\`\`\`\n${errorOutput}\n\`\`\``;
    writeLog(errorSummary);
    console.log(`\n❌ Processo terminato con codice ${code}`);
    console.log(`📝 Log completo salvato in ${LOG_FILE}\n`);
  } else {
    console.log(`\n✅ Processo completato con successo\n`);
  }
  process.exit(code);
});











