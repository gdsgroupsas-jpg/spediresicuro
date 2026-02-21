/**
 * Simula esattamente cosa vede la dashboard admin
 * Uso: npx tsx scripts/check-admin-visibility.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const TEST_EMAIL_PATTERNS = [
  /^test@/i,
  /test-.*@spediresicuro\.it$/i,
  /@test\./i,
  /test.*@.*test/i,
  /^e2e-/i,
  /^smoke-test-/i,
  /^integration-test-/i,
];

const TEST_NAME_PATTERNS = [
  /^test\s+/i,
  /test\s+user/i,
  /e2e\s+test/i,
  /smoke\s+test/i,
  /integration\s+test/i,
  /^test\s*$/i,
];

function isTestUser(user: any): boolean {
  const emailMatch = user.email && TEST_EMAIL_PATTERNS.some((p: RegExp) => p.test(user.email));
  const nameMatch = user.name && TEST_NAME_PATTERNS.some((p: RegExp) => p.test(user.name));
  return emailMatch || nameMatch;
}

async function check() {
  const { data: users } = await supabase
    .from('users')
    .select('id, email, name, role, account_type, is_reseller')
    .order('created_at', { ascending: false });

  if (!users) {
    console.log('Nessun utente trovato');
    return;
  }

  console.log(`\nTotale utenti in public.users: ${users.length}\n`);

  const production = users.filter((u) => !isTestUser(u));
  const test = users.filter((u) => isTestUser(u));

  console.log('=== UTENTI VISIBILI (showTestData=false) ===');
  for (const u of production) {
    console.log(
      `  ✅ ${(u.email || 'N/A').padEnd(45)} | ${(u.account_type || 'N/A').padEnd(12)} | ${u.name || 'N/A'}`
    );
  }

  console.log(`\n=== UTENTI NASCOSTI (test) ===`);
  for (const u of test) {
    console.log(
      `  🧪 ${(u.email || 'N/A').padEnd(45)} | ${(u.account_type || 'N/A').padEnd(12)} | ${u.name || 'N/A'}`
    );
  }

  // Verifica specifica
  const target = users.find((u) => u.email === 'janossystems0@gmail.com');
  console.log(`\n=== VERIFICA janossystems0@gmail.com ===`);
  if (target) {
    console.log(`  Trovato: SI`);
    console.log(`  isTestUser: ${isTestUser(target)}`);
    console.log(`  Visibile in produzione: ${!isTestUser(target)}`);
    console.log(`  Dati:`, JSON.stringify(target, null, 2));
  } else {
    console.log(`  ❌ NON TROVATO in public.users`);
  }
}

check().catch(console.error);
