/**
 * Test flusso Anne – Creazione spedizione
 *
 * Chiama POST /api/ai/agent-chat con messaggi di creazione spedizione e scrive
 * l'output su un file TXT per debug.
 *
 * Prerequisiti:
 * - App in esecuzione (npm run dev)
 * - Autenticazione: imposta AUTH_COOKIE con il valore del cookie di sessione
 *   (es. copia da DevTools > Application > Cookies dopo login su dashboard)
 *
 * Uso (dalla root del progetto):
 *   node scripts/test-anne-shipment-flow.js [baseUrl]
 *   baseUrl default: http://localhost:3000
 *
 * Esempio con cookie:
 *   set AUTH_COOKIE=sb-...=eyJ...
 *   node scripts/test-anne-shipment-flow.js
 *
 * Output: scripts/anne-shipment-test-output.txt
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.argv[2] || process.env.TEST_ANNE_BASE_URL || 'http://localhost:3000';
const OUTPUT_FILE = path.resolve(process.cwd(), 'scripts', 'anne-shipment-test-output.txt');
const AUTH_COOKIE = process.env.AUTH_COOKIE || '';

const PROMPTS = [
  'Voglio fare una spedizione',
  'Mittente: Mario Rossi, telefono 3331234567. Destinatario: Luigi Verdi, Via Roma 1, 00100 Roma RM, telefono 3339876543. Pacco 2 kg.',
  'Luigi Verdi',
];

async function postAgentChat(message, headers = {}) {
  const url = `${BASE_URL.replace(/\/$/, '')}/api/ai/agent-chat`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(AUTH_COOKIE ? { Cookie: AUTH_COOKIE } : {}),
      ...headers,
    },
    body: JSON.stringify({ message }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

async function main() {
  console.log('Test Anne – Creazione spedizione via /api/ai/agent-chat');
  console.log('Base URL:', BASE_URL);
  if (!AUTH_COOKIE) {
    console.warn('AUTH_COOKIE non impostato: le richieste potrebbero restituire 401.');
  }
  console.log('');

  const lines = [];

  for (let i = 0; i < PROMPTS.length; i++) {
    const msg = PROMPTS[i];
    console.log(`Round ${i + 1}:`, msg);
    const { ok, status, data } = await postAgentChat(msg);
    const reply = data?.message ?? data?.error ?? JSON.stringify(data);
    lines.push(`--- Round ${i + 1}: ${msg}`);
    lines.push(`HTTP ${status} ${ok ? 'OK' : 'ERR'}`);
    lines.push(reply);
    lines.push('');
    if (!ok) {
      console.error('Errore HTTP', status, data?.error || '');
      break;
    }
  }

  const out = lines.join('\n');
  const dir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, out, 'utf8');
  console.log('Output scritto in:', OUTPUT_FILE);
  process.exit(0);
}

main().catch((err) => {
  console.error('Errore:', err.message);
  process.exit(1);
});
