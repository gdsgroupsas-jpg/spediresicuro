/**
 * CI Gate Script per Smoke Test Supabase
 * 
 * Esegue lo smoke test solo se SUPABASE_SMOKE=1
 * Utile per pipeline CI/CD
 * 
 * Utilizzo:
 *   SUPABASE_SMOKE=1 npm run test:supabase:smoke:ci
 */

const { execSync } = require('child_process');

const shouldRun = process.env.SUPABASE_SMOKE === '1';

if (shouldRun) {
  console.log('🧪 Esecuzione smoke test Supabase (SUPABASE_SMOKE=1)...\n');
  try {
    execSync('npm run test:supabase:smoke', { 
      stdio: 'inherit',
      cwd: process.cwd()
    });
    console.log('\n✅ Smoke test completato con successo');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Smoke test fallito');
    process.exit(1);
  }
} else {
  console.log('⏭️  SUPABASE_SMOKE non settato, skip smoke test');
  console.log('   Per eseguire: SUPABASE_SMOKE=1 npm run test:supabase:smoke:ci');
  process.exit(0);
}

