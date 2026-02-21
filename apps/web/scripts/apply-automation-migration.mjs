import https from 'https';
import fs from 'fs';
import path from 'path';
import { config } from 'dotenv';

// Carica .env.local per SUPABASE_ACCESS_TOKEN e SUPABASE_PROJECT_REF
config({ path: '.env.local' });

const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || 'pxwmposcsvsusjxdjues';

if (!ACCESS_TOKEN) {
  console.error('❌ SUPABASE_ACCESS_TOKEN non impostato in .env.local');
  process.exit(1);
}

function query(sql) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query: sql });
    const options = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${PROJECT_REF}/database/query`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode >= 400) {
          const parsed = JSON.parse(data);
          reject(new Error(`HTTP ${res.statusCode}: ${parsed.message || data}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const MIGRATIONS_DIR = path.join(process.cwd(), 'supabase', 'migrations');
const FILES_TO_APPLY = [
  '20260219100000_automation_engine.sql',
  '20260219110000_seed_automations.sql',
  '20260219120000_users_wallet_balance_check.sql',
];

for (const file of FILES_TO_APPLY) {
  const filePath = path.join(MIGRATIONS_DIR, file);
  const sql = fs.readFileSync(filePath, 'utf8');

  console.log(`\n🚀 Applying ${file}...`);
  try {
    await query(sql);
    console.log(`✅ ${file} — applicata con successo`);
  } catch (err) {
    if (err.message.includes('already exists') || err.message.includes('already enabled')) {
      console.log(`ℹ️  ${file} — già applicata (idempotente)`);
    } else {
      console.error(`❌ ${file} — ERRORE: ${err.message}`);
      process.exit(1);
    }
  }
}

console.log('\n✅ Tutte le migration automation applicate!');
