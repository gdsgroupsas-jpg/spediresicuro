/**
 * Test flusso Anne – Creazione spedizione con prompt generico
 *
 * Chiama l'API di test (solo dev) che esegue il supervisor con un prompt generico
 * e scrive tutto l'output su un file TXT per debug.
 *
 * Prerequisito: app in esecuzione in dev (npm run dev).
 *
 * Uso (dalla root del progetto):
 *   node scripts/test-anne-shipment-flow.js [baseUrl]
 *   baseUrl default: http://localhost:3000
 *
 * Output: scripts/anne-shipment-test-output.txt
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.argv[2] || process.env.TEST_ANNE_BASE_URL || 'http://localhost:3000';
const OUTPUT_FILE = path.resolve(process.cwd(), 'scripts', 'anne-shipment-test-output.txt');

const PROMPT1 = 'Voglio fare una spedizione';
const PROMPT2 =
  'Mittente: Mario Rossi, telefono 3331234567. Destinatario: Luigi Verdi, Via Roma 1, 00100 Roma RM, telefono 3339876543. Pacco 2 kg.';

async function main() {
  console.log('Test Anne – Flusso creazione spedizione');
  console.log('Base URL:', BASE_URL);
  console.log('Prompt 1:', PROMPT1);
  console.log('Prompt 2 (se serve integrazione):', PROMPT2);
  console.log('');

  const url = `${BASE_URL.replace(/\/$/, '')}/api/dev/test-anne-shipment`;
  const body = {
    message: PROMPT1,
    secondMessage: PROMPT2,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('Errore HTTP', res.status, data.error || res.statusText);
      if (data.outputForFile) {
        fs.writeFileSync(OUTPUT_FILE, data.outputForFile, 'utf8');
        console.log('Output parziale scritto in:', OUTPUT_FILE);
      }
      process.exit(1);
    }

    if (data.outputForFile) {
      const dir = path.dirname(OUTPUT_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(OUTPUT_FILE, data.outputForFile, 'utf8');
      console.log('Output scritto in:', OUTPUT_FILE);
    }

    console.log('Risposta:', data.success ? 'OK' : 'Errore');
    if (data.error) console.error(data.error);
    process.exit(data.success ? 0 : 1);
  } catch (err) {
    console.error('Errore di connessione:', err.message);
    console.error(
      "Assicurati che l'app sia in esecuzione (npm run dev) e che BASE_URL sia corretto."
    );
    process.exit(1);
  }
}

main();
