/**
 * Script di verifica installazione Playwright
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Verifica installazione Playwright...\n');

// Verifica package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

if (packageJson.devDependencies && packageJson.devDependencies['@playwright/test']) {
  console.log('✅ @playwright/test trovato in package.json');
  console.log(`   Versione: ${packageJson.devDependencies['@playwright/test']}`);
} else {
  console.log('❌ @playwright/test NON trovato in package.json');
  process.exit(1);
}

// Verifica node_modules
const playwrightPath = path.join(__dirname, '..', 'node_modules', '@playwright', 'test');
if (fs.existsSync(playwrightPath)) {
  console.log('✅ @playwright/test trovato in node_modules');

  // Verifica package.json del modulo
  const playwrightPackageJson = path.join(playwrightPath, 'package.json');
  if (fs.existsSync(playwrightPackageJson)) {
    const pwPackage = JSON.parse(fs.readFileSync(playwrightPackageJson, 'utf8'));
    console.log(`   Versione installata: ${pwPackage.version}`);
  }
} else {
  console.log('❌ @playwright/test NON trovato in node_modules');
  console.log('   Esegui: npm install');
  process.exit(1);
}

// Verifica playwright.config.ts
const configPath = path.join(__dirname, '..', 'playwright.config.ts');
if (fs.existsSync(configPath)) {
  console.log('✅ playwright.config.ts trovato');
} else {
  console.log('❌ playwright.config.ts NON trovato');
  process.exit(1);
}

// Verifica test file
const testPath = path.join(__dirname, '..', 'e2e', 'happy-path.spec.ts');
if (fs.existsSync(testPath)) {
  console.log('✅ Test file trovato: e2e/happy-path.spec.ts');
} else {
  console.log('❌ Test file NON trovato');
  process.exit(1);
}

console.log('\n✅ Tutte le verifiche superate!');
console.log('\nPer eseguire i test:');
console.log('  npm run test:e2e');
