import https from 'https';
import fs from 'fs';
import path from 'path';

const ACCESS_TOKEN = 'sbp_b5a23c86eb994249771f74152a68490a10670675';
const PROJECT_REF = 'pxwmposcsvsusjxdjues';

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
  '20260219200000_rls_multi_tenant_tables.sql',
  '20260219200100_rls_fix_tables_without_workspace_id.sql',
  '20260219200200_rls_security_definer_helper.sql',
  '20260219200300_rls_fix_recursion.sql',
  '20260219200400_rls_fix_legacy_policies.sql',
  '20260219200500_rls_fix_users_permission.sql',
  '20260219200600_rls_fix_legacy_public_policies.sql',
  '20260219200700_rls_drop_legacy_public_policies.sql',
];

for (const file of FILES_TO_APPLY) {
  const filePath = path.join(MIGRATIONS_DIR, file);
  const sql = fs.readFileSync(filePath, 'utf8');

  console.log(`\n🚀 Applying ${file}...`);
  try {
    await query(sql);
    console.log(`✅ ${file} — applicata con successo`);
  } catch (err) {
    // Se RLS è già abilitato o policy già esistente, non è un errore critico
    if (err.message.includes('already exists') || err.message.includes('already enabled')) {
      console.log(`ℹ️  ${file} — già applicata (idempotente)`);
    } else {
      console.error(`❌ ${file} — ERRORE: ${err.message}`);
      process.exit(1);
    }
  }
}

console.log('\n✅ Tutte le migration RLS applicate!');
