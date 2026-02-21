/**
 * Lista TUTTI gli utenti nel sistema
 * Uso: npx tsx scripts/list-all-users.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listAll() {
  console.log('\n📋 TUTTI GLI UTENTI NEL SISTEMA\n');

  // 1. auth.users
  console.log('=== AUTH.USERS ===');
  const { data: authData } = await supabase.auth.admin.listUsers({ perPage: 100 });
  if (authData?.users) {
    console.log(`Totale: ${authData.users.length}\n`);
    for (const u of authData.users) {
      const confirmed = u.email_confirmed_at ? '✅' : '❌';
      const lastLogin = u.last_sign_in_at
        ? new Date(u.last_sign_in_at).toLocaleString('it-IT')
        : 'mai';
      console.log(
        `  ${confirmed} ${u.email?.padEnd(40)} | ${u.app_metadata?.account_type || 'user'} | ultimo login: ${lastLogin}`
      );
    }
  }

  // 2. public.users
  console.log('\n=== PUBLIC.USERS ===');
  const { data: dbUsers } = await supabase
    .from('users')
    .select('id, email, name, role, account_type, is_reseller, primary_workspace_id, created_at')
    .order('created_at', { ascending: false });

  if (dbUsers) {
    console.log(`Totale: ${dbUsers.length}\n`);
    for (const u of dbUsers) {
      const ws = u.primary_workspace_id ? '🏢' : '  ';
      const reseller = u.is_reseller ? '🔄' : '  ';
      console.log(
        `  ${ws}${reseller} ${(u.email || 'N/A').padEnd(40)} | ${(u.account_type || 'user').padEnd(10)} | ${u.name || 'N/A'}`
      );
    }
  }

  // 3. Cerca varianti dell'email
  console.log('\n=== RICERCA FUZZY "janos" ===');
  const { data: fuzzy } = await supabase
    .from('users')
    .select('email, name, account_type, is_reseller')
    .ilike('email', '%janos%');

  if (fuzzy && fuzzy.length > 0) {
    for (const u of fuzzy) {
      console.log(`  📧 ${u.email} | ${u.name} | ${u.account_type} | reseller: ${u.is_reseller}`);
    }
  } else {
    console.log('  Nessun match per "janos" in public.users');
  }

  // Cerca anche in auth
  if (authData?.users) {
    const authFuzzy = authData.users.filter((u) => u.email?.toLowerCase().includes('janos'));
    if (authFuzzy.length > 0) {
      console.log('\n  Match in auth.users:');
      for (const u of authFuzzy) {
        console.log(
          `  📧 ${u.email} | provider: ${u.app_metadata?.provider} | confirmed: ${!!u.email_confirmed_at}`
        );
      }
    } else {
      console.log('  Nessun match per "janos" in auth.users');
    }
  }

  console.log('');
}

listAll().catch(console.error);
