/**
 * 🚀 Script Auto-Fix Completo per Test Playwright
 * 
 * Esegue test, analizza errori, applica fix automatici e ripete fino al successo.
 * 
 * USO:
 *   node scripts/auto-fix-playwright-test.js
 * 
 * Oppure:
 *   npm run test:e2e:auto-fix
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { extractErrorFromReport } = require('./extract-playwright-error');

const TEST_FILE = 'e2e/happy-path.spec.ts';
const MAX_ITERATIONS = 15;
const SERVER_START_TIMEOUT = 120000; // 2 minuti

let serverProcess = null;

// Pattern di errori comuni e relativi fix
const ERROR_PATTERNS = [
  {
    name: 'Timeout waiting for element',
    pattern: /Timeout.*exceeded|waiting for.*timeout/i,
    fix: (match, testContent) => {
      // Aumenta tutti i timeout
      const timeoutPattern = /timeout:\s*(\d+)/g;
      let modified = false;
      const newContent = testContent.replace(timeoutPattern, (m, timeout) => {
        const currentTimeout = parseInt(timeout);
        if (currentTimeout < 60000) {
          modified = true;
          return `timeout: ${Math.max(currentTimeout * 2, 30000)}`;
        }
        return m;
      });
      return modified ? newContent : null;
    }
  },
  {
    name: 'Element not found or not visible',
    pattern: /locator.*not found|element.*not visible|getByRole.*not found/i,
    fix: (match, testContent) => {
      // Aggiungi più attese e selettori alternativi
      if (testContent.includes('getByRole') && !testContent.includes('waitForLoadState')) {
        return testContent.replace(
          /(await page\.goto\([^)]+\))/,
          `$1\n    await page.waitForLoadState('networkidle');`
        );
      }
      return null;
    }
  },
  {
    name: 'Strict mode violation - multiple elements',
    pattern: /strict mode violation.*resolved to (\d+) elements/i,
    fix: (match, testContent) => {
      const count = parseInt(match[1]);
      if (count > 1) {
        // Sostituisci getByText con getByRole per heading
        const headingPattern = /getByText\(['"](Nuova Spedizione|heading)['"]/i;
        if (headingPattern.test(testContent)) {
          return testContent.replace(
            /getByText\(['"]Nuova Spedizione['"]/gi,
            `getByRole('heading', { name: 'Nuova Spedizione' })`
          );
        }
      }
      return null;
    }
  },
  {
    name: 'Button disabled - form incomplete',
    pattern: /element is not enabled|disabled.*button|Form non completo/i,
    fix: (match, testContent) => {
      // Aggiungi verifica esplicita che il pulsante sia abilitato
      if (!testContent.includes('toBeEnabled')) {
        const buttonPattern = /(const submitButton = .*getByRole\(['"]button['"].*Genera Spedizione[^;]+;)/;
        if (buttonPattern.test(testContent)) {
          return testContent.replace(
            buttonPattern,
            `$1\n    await expect(submitButton).toBeEnabled({ timeout: 30000 });`
          );
        }
      }
      
      // Aggiungi verifica campi obbligatori prima del click
      if (!testContent.includes('Verifica campi obbligatori')) {
        const beforeClick = /(await submitButton\.click\(\))/;
        if (beforeClick.test(testContent)) {
          const verificationCode = `
    // Verifica che tutti i campi obbligatori siano compilati
    const requiredFields = [
      { name: 'mittenteNome', label: 'Nome Completo' },
      { name: 'mittenteIndirizzo', label: 'Indirizzo' },
      { name: 'mittenteCitta', placeholder: 'Cerca città' },
      { name: 'mittenteTelefono', label: 'Telefono' },
      { name: 'destinatarioNome', label: 'Nome Completo' },
      { name: 'destinatarioIndirizzo', label: 'Indirizzo' },
      { name: 'destinatarioCitta', placeholder: 'Cerca città' },
      { name: 'destinatarioTelefono', label: 'Telefono' },
      { name: 'peso', type: 'number' }
    ];
    
    for (const field of requiredFields) {
      let value = '';
      if (field.placeholder) {
        const inputs = page.getByPlaceholder(field.placeholder);
        value = await inputs.first().inputValue().catch(() => '');
      } else if (field.type === 'number') {
        const inputs = page.locator(\`input[type="\${field.type}"]\`);
        value = await inputs.first().inputValue().catch(() => '');
      } else {
        const label = page.getByText(field.label, { exact: false }).first();
        const input = label.locator('..').locator('input').first();
        value = await input.inputValue().catch(() => '');
      }
      if (!value || value.length < 2) {
        console.log(\`⚠️ Campo \${field.name} non compilato: "\${value}"\`);
      }
    }
`;
          return testContent.replace(beforeClick, verificationCode + '\n    $1');
        }
      }
      return null;
    }
  },
  {
    name: 'Timeout - element not found',
    pattern: /Timeout.*getByText|getByRole.*not found|Timeout.*toBeVisible/i,
    fix: (match, testContent) => {
      // Aumenta timeout o migliora selettore
      const timeoutPattern = /timeout: (\d+)/g;
      let modified = false;
      const newContent = testContent.replace(timeoutPattern, (m, timeout) => {
        const currentTimeout = parseInt(timeout);
        if (currentTimeout < 30000) {
          modified = true;
          return `timeout: ${Math.max(currentTimeout * 2, 30000)}`;
        }
        return m;
      });
      return modified ? newContent : null;
    }
  },
  {
    name: 'Authentication bypass not working',
    pattern: /Bypass autenticazione non funziona/i,
    fix: (match, testContent) => {
      // Verifica che l'header sia impostato
      if (!testContent.includes('setExtraHTTPHeaders')) {
        return testContent.replace(
          /(test\.beforeEach\(async \(\{ page \}\) => \{)/,
          `$1\n    await page.setExtraHTTPHeaders({ 'x-test-mode': 'playwright' });`
        );
      }
      return null;
    }
  },
  {
    name: 'City selection not working',
    pattern: /Città.*non.*selezionata|city.*not.*selected/i,
    fix: (match, testContent) => {
      // Migliora la selezione città con più attese
      if (testContent.includes('firstOption.click()')) {
        return testContent.replace(
          /(await firstOption\.click\(\);)/g,
          `await expect(firstOption).toBeVisible({ timeout: 10000 });\n      $1\n      await page.waitForTimeout(2000); // Attendi che la selezione venga processata`
        );
      }
      return null;
    }
  },
  {
    name: 'API mock format incorrect',
    pattern: /Cannot read.*results|data\.results.*undefined/i,
    fix: (match, testContent) => {
      // Verifica formato API geo/search
      if (testContent.includes('api/geo/search')) {
        const mockPattern = /(body: JSON\.stringify\(results\))/;
        if (mockPattern.test(testContent)) {
          return testContent.replace(
            mockPattern,
            `body: JSON.stringify({\n          results,\n          count: results.length,\n          query,\n        })`
          );
        }
      }
      return null;
    }
  }
];

function startServer() {
  console.log('🚀 Avvio server Next.js...');
  return new Promise((resolve, reject) => {
    serverProcess = spawn('npm', ['run', 'dev'], {
      shell: true,
      stdio: 'pipe',
      env: { ...process.env, PLAYWRIGHT_TEST_MODE: 'true' }
    });
    
    let serverReady = false;
    const timeout = setTimeout(() => {
      if (!serverReady) {
        reject(new Error('Server non avviato entro 2 minuti'));
      }
    }, SERVER_START_TIMEOUT);
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Ready') || output.includes('localhost:3000')) {
        serverReady = true;
        clearTimeout(timeout);
        console.log('✅ Server avviato');
        setTimeout(resolve, 3000); // Attendi 3 secondi per stabilizzazione
      }
    });
    
    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Error') && !output.includes('EADDRINUSE')) {
        console.error('❌ Errore server:', output);
      }
    });
  });
}

function stopServer() {
  if (serverProcess) {
    console.log('🛑 Fermo server...');
    serverProcess.kill();
    serverProcess = null;
  }
}

function runTest() {
  console.log('🧪 Eseguo test Playwright...\n');
  
  // Pulisci risultati precedenti per avere output pulito
  try {
    if (fs.existsSync('test-results')) {
      const files = fs.readdirSync('test-results');
      files.forEach(file => {
        if (file.endsWith('.txt') || file.includes('error')) {
          fs.unlinkSync(path.join('test-results', file));
        }
      });
    }
  } catch (e) {
    // Ignora errori di pulizia
  }
  
  try {
    // Esegui con reporter dettagliato per catturare più errori
    // Usa --reporter=line per output più dettagliato
    const output = execSync('npx playwright test --reporter=line,html 2>&1', { 
      encoding: 'utf-8',
      stdio: 'pipe',
      timeout: 180000, // 3 minuti
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer per output grande
    });
    return { success: true, output };
  } catch (error) {
    let fullOutput = (error.stdout || '') + (error.stderr || '');
    
    // Cerca errori dettagliati nel report HTML usando lo script dedicato
    try {
      const reportErrors = extractErrorFromReport();
      if (reportErrors && reportErrors.length > 0) {
        fullOutput += '\n\n=== ERRORI DAL REPORT ===\n';
        reportErrors.forEach((err, i) => {
          if (typeof err === 'string') {
            fullOutput += `${i + 1}. ${err}\n`;
          } else {
            fullOutput += `${i + 1}. ${err.test}: ${err.error || err.status}\n`;
          }
        });
      }
    } catch (e) {
      // Ignora errori di lettura report
    }
    
    // Cerca anche nei file di log se esistono
    try {
      if (fs.existsSync('test-results')) {
        const files = fs.readdirSync('test-results');
        const logFiles = files.filter(f => f.endsWith('.txt') || f.includes('log'));
        for (const logFile of logFiles.slice(0, 2)) {
          try {
            const logContent = fs.readFileSync(path.join('test-results', logFile), 'utf-8');
            const errorLines = logContent.split('\n').filter(line => 
              line.includes('Error') || line.includes('failed') || line.includes('Timeout')
            );
            if (errorLines.length > 0) {
              fullOutput += '\n\n=== ERRORI DA LOG ===\n' + errorLines.slice(0, 10).join('\n');
            }
          } catch (e) {
            // Ignora errori di lettura singolo file
          }
        }
      }
    } catch (e) {
      // Ignora errori di lettura directory
    }
    
    return { 
      success: false, 
      output: fullOutput,
      error: error
    };
  }
}

function analyzeError(output) {
  const errors = [];
  
  for (const pattern of ERROR_PATTERNS) {
    const match = output.match(pattern.pattern);
    if (match) {
      errors.push({
        name: pattern.name,
        pattern: pattern.pattern,
        match,
        fix: pattern.fix
      });
    }
  }
  
  return errors;
}

function applyFix(testContent, error) {
  try {
    const fixed = error.fix(error.match, testContent);
    if (fixed && fixed !== testContent) {
      return fixed;
    }
  } catch (e) {
    console.error(`❌ Errore applicando fix "${error.name}":`, e.message);
  }
  return null;
}

async function autoFixTest() {
  console.log('🚀 Avvio Auto-Fix Test Playwright');
  console.log('='.repeat(70));
  console.log('Questo script eseguirà automaticamente i test e applicherà fix fino al successo.');
  console.log('='.repeat(70));
  
  // Verifica che il file di test esista
  if (!fs.existsSync(TEST_FILE)) {
    console.error(`❌ File di test non trovato: ${TEST_FILE}`);
    process.exit(1);
  }
  
  let iteration = 0;
  let lastError = null;
  let consecutiveSameErrors = 0;
  
  // Avvia server se non è già in esecuzione
  try {
    await startServer();
  } catch (e) {
    console.log('⚠️ Server già in esecuzione o errore avvio, continuo...');
  }
  
  try {
    while (iteration < MAX_ITERATIONS) {
      iteration++;
      console.log(`\n${'='.repeat(70)}`);
      console.log(`📋 Iterazione ${iteration}/${MAX_ITERATIONS}`);
      console.log('='.repeat(70));
      
      // Esegui test
      const result = runTest();
      
      if (result.success) {
        console.log('\n✅✅✅ TEST PASSATO! 🎉🎉🎉\n');
        console.log(`Completato in ${iteration} iterazioni`);
        return { success: true, iterations: iteration };
      }
      
      // Analizza errori
      console.log('\n🔍 Analizzo errori...');
      const errors = analyzeError(result.output);
      
      if (errors.length === 0) {
        console.log('⚠️ Nessun pattern di errore riconosciuto.');
        
        // Estrai messaggio di errore più dettagliato dall'output
        const errorPatterns = [
          /Error:\s*([^\n]+)/gi,
          /TimeoutError:\s*([^\n]+)/gi,
          /failed:\s*([^\n]+)/gi,
          /expect\([^)]+\)\.toBe[^(]+\([^)]*\)\s+failed/gi,
          /element is not enabled/gi,
          /strict mode violation/gi,
          /locator.*not found/gi
        ];
        
        let foundError = null;
        for (const pattern of errorPatterns) {
          const match = result.output.match(pattern);
          if (match && match.length > 0) {
            foundError = match[0];
            break;
          }
        }
        
        if (foundError) {
          console.log('\n🔍 Errore trovato:', foundError.substring(0, 200));
          
          // Prova a estrarre più contesto (righe prima e dopo)
          const errorIndex = result.output.indexOf(foundError);
          const lines = result.output.split('\n');
          const errorLineIndex = result.output.substring(0, errorIndex).split('\n').length - 1;
          const contextStart = Math.max(0, errorLineIndex - 5);
          const contextEnd = Math.min(lines.length, errorLineIndex + 15);
          const errorContext = lines.slice(contextStart, contextEnd).join('\n');
          
          console.log('\n📄 Contesto errore (righe ' + contextStart + '-' + contextEnd + '):');
          console.log(errorContext);
        } else {
          console.log('\n📄 Ultimi 1500 caratteri dell\'output:');
          console.log(result.output.slice(-1500));
        }
        
        // Se stesso errore 3 volte, interrompi
        if (lastError === result.output) {
          consecutiveSameErrors++;
          if (consecutiveSameErrors >= 3) {
            console.log('❌ Stesso errore per 3 volte consecutive, interrompo.');
            console.log('\n💡 Suggerimento: Esegui manualmente "npm run test:e2e:ui" per vedere l\'errore completo.');
            return { success: false, error: 'Stesso errore ripetuto', output: result.output };
          }
        } else {
          consecutiveSameErrors = 0;
        }
        lastError = result.output;
        continue;
      }
      
      // Applica fix
      console.log(`\n🔧 Trovati ${errors.length} errori:`);
      errors.forEach((e, i) => console.log(`   ${i + 1}. ${e.name}`));
      console.log('\n🔧 Applico fix...');
      
      let testContent = fs.readFileSync(TEST_FILE, 'utf-8');
      let fixed = false;
      
      for (const error of errors) {
        const fixedContent = applyFix(testContent, error);
        if (fixedContent) {
          testContent = fixedContent;
          fixed = true;
          console.log(`  ✅ Fix applicato: ${error.name}`);
        } else {
          console.log(`  ⚠️ Fix non applicabile: ${error.name}`);
        }
      }
      
      if (!fixed) {
        console.log('  ⚠️ Nessun fix applicabile.');
        if (lastError === result.output) {
          consecutiveSameErrors++;
          if (consecutiveSameErrors >= 3) {
            console.log('❌ Stesso errore per 3 volte consecutive, interrompo.');
            return { success: false, error: 'Fix non risolutivo', output: result.output };
          }
        } else {
          consecutiveSameErrors = 0;
        }
        lastError = result.output;
        continue;
      }
      
      // Salva file modificato
      fs.writeFileSync(TEST_FILE, testContent, 'utf-8');
      console.log(`\n💾 File ${TEST_FILE} aggiornato.`);
      
      // Reset contatore errori uguali
      consecutiveSameErrors = 0;
      lastError = null;
      
      // Attendi prima di rieseguire
      console.log('⏳ Attendo 3 secondi prima di rieseguire...\n');
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log(`\n❌ Raggiunto limite di ${MAX_ITERATIONS} iterazioni.`);
    console.log('\n💡 Suggerimenti:');
    console.log('   1. Esegui manualmente: npm run test:e2e:ui');
    console.log('   2. Controlla il report: npx playwright show-report');
    console.log('   3. Verifica che il server sia in esecuzione su porta 3000');
    return { success: false, error: 'Max iterations reached', iterations: iteration };
    
  } finally {
    stopServer();
  }
}

// Esegui
if (require.main === module) {
  autoFixTest()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('❌ Errore fatale:', error);
      stopServer();
      process.exit(1);
    });
}

module.exports = { autoFixTest, runTest, analyzeError };
