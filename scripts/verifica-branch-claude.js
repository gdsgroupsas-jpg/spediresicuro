/**
 * Script per verificare branch e modifiche di Claude
 */

const { execSync } = require('child_process');

console.log('🔍 Verifica Branch e Modifiche Claude\n');
console.log('='.repeat(50));
console.log('');

try {
  // Lista branch locali
  console.log('📋 Branch Locali:');
  const localBranches = execSync('git branch', { encoding: 'utf-8' });
  console.log(localBranches);
  console.log('');

  // Lista branch remoti
  console.log('📋 Branch Remoti:');
  const remoteBranches = execSync('git branch -r', { encoding: 'utf-8' });
  console.log(remoteBranches);
  console.log('');

  // Branch attuale
  console.log('📍 Branch Attuale:');
  const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  console.log(currentBranch);
  console.log('');

  // Commit di Claude
  console.log('👤 Commit di Claude:');
  try {
    const claudeCommits = execSync('git log --all --oneline --author="Claude" -10', { encoding: 'utf-8' });
    console.log(claudeCommits);
  } catch (e) {
    console.log('Nessun commit trovato con autore "Claude"');
  }
  console.log('');

  // Branch che contengono "claude"
  console.log('🌿 Branch con "claude" nel nome:');
  try {
    const claudeBranches = execSync('git branch -a | grep -i claude', { encoding: 'utf-8' });
    console.log(claudeBranches);
  } catch (e) {
    console.log('Nessun branch trovato con "claude" nel nome');
  }
  console.log('');

  // Ultimi commit
  console.log('📝 Ultimi 5 Commit:');
  const lastCommits = execSync('git log --oneline -5', { encoding: 'utf-8' });
  console.log(lastCommits);

} catch (error) {
  console.error('Errore:', error.message);
}







