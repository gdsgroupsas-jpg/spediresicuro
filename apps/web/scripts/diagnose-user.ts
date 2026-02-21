/**
 * Script diagnostico: trova utente e mostra stato completo
 * Uso: npx tsx scripts/diagnose-user.ts janossystem0@gmail.com
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env.local' });

const email = process.argv[2];
if (!email) {
  console.error('Uso: npx tsx scripts/diagnose-user.ts <email>');
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Mancano NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function diagnose() {
  console.log(`\n🔍 DIAGNOSI UTENTE: ${email}\n${'='.repeat(60)}\n`);

  // 1. Cerca in auth.users (Supabase Auth)
  console.log('1️⃣  AUTH.USERS (Supabase Auth)');
  const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers();

  if (authError) {
    console.error('   ❌ Errore listUsers:', authError.message);
  } else {
    const authUser = authUsers.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (authUser) {
      console.log('   ✅ TROVATO in auth.users');
      console.log('   ID:', authUser.id);
      console.log('   Email:', authUser.email);
      console.log(
        '   Email confermata:',
        authUser.email_confirmed_at ? `✅ ${authUser.email_confirmed_at}` : '❌ NO'
      );
      console.log('   Creato:', authUser.created_at);
      console.log('   Ultimo login:', authUser.last_sign_in_at || 'MAI');
      console.log('   Provider:', authUser.app_metadata?.provider || 'N/A');
      console.log('   app_metadata:', JSON.stringify(authUser.app_metadata, null, 2));
      console.log('   user_metadata:', JSON.stringify(authUser.user_metadata, null, 2));
    } else {
      console.log('   ❌ NON TROVATO in auth.users');
    }
  }

  // 2. Cerca in public.users
  console.log('\n2️⃣  PUBLIC.USERS (tabella app)');
  const { data: dbUser, error: dbError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.toLowerCase())
    .maybeSingle();

  if (dbError) {
    console.error('   ❌ Errore query:', dbError.message);
  } else if (dbUser) {
    console.log('   ✅ TROVATO in public.users');
    console.log('   ID:', dbUser.id);
    console.log('   Nome:', dbUser.name);
    console.log('   Role:', dbUser.role);
    console.log('   Account type:', dbUser.account_type);
    console.log('   Is reseller:', dbUser.is_reseller);
    console.log('   Reseller role:', dbUser.reseller_role);
    console.log('   Admin level:', dbUser.admin_level);
    console.log('   Primary workspace:', dbUser.primary_workspace_id || '❌ NESSUNO');
    console.log('   Provider:', dbUser.provider);
    console.log('   Wallet:', dbUser.wallet_balance);
    console.log('   Dati cliente:', dbUser.dati_cliente ? '✅ presente' : '❌ vuoto');
    if (dbUser.dati_cliente) {
      console.log('   Dati completati:', dbUser.dati_cliente.datiCompletati ? '✅' : '❌');
    }
    console.log('   Creato:', dbUser.created_at);
  } else {
    console.log('   ❌ NON TROVATO in public.users');
  }

  // 3. Cerca workspace_members
  console.log('\n3️⃣  WORKSPACE_MEMBERS');
  if (dbUser) {
    const { data: memberships, error: memError } = await supabase
      .from('workspace_members')
      .select('*, workspaces(id, name, type, depth, status, organization_id)')
      .eq('user_id', dbUser.id);

    if (memError) {
      console.error('   ❌ Errore query:', memError.message);
    } else if (memberships && memberships.length > 0) {
      console.log(`   ✅ ${memberships.length} membership trovate:`);
      for (const m of memberships) {
        const ws = m.workspaces as any;
        console.log(`   - Workspace: ${ws?.name || 'N/A'} (${ws?.type}, depth=${ws?.depth})`);
        console.log(`     Ruolo: ${m.role}, Status: ${m.status}`);
        console.log(`     Workspace ID: ${m.workspace_id}`);
        console.log(`     Workspace status: ${ws?.status}`);
      }
    } else {
      console.log('   ❌ NESSUNA membership trovata');
    }
  } else {
    console.log('   ⏭️  Skipped (utente non in public.users)');
  }

  // 4. Cerca workspace di proprietà
  console.log('\n4️⃣  WORKSPACES DI PROPRIETÀ');
  if (dbUser?.primary_workspace_id) {
    const { data: ws, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .eq('id', dbUser.primary_workspace_id)
      .maybeSingle();

    if (wsError) {
      console.error('   ❌ Errore query:', wsError.message);
    } else if (ws) {
      console.log('   ✅ Primary workspace trovato:');
      console.log('   Nome:', ws.name);
      console.log('   Tipo:', ws.type);
      console.log('   Depth:', ws.depth);
      console.log('   Status:', ws.status);
      console.log('   Parent:', ws.parent_workspace_id || 'NESSUNO (root)');
      console.log('   Org ID:', ws.organization_id);
    } else {
      console.log('   ❌ Primary workspace ID presente ma workspace NON trovato nel DB!');
    }
  } else {
    console.log('   ❌ Nessun primary_workspace_id impostato');
  }

  // 5. Diagnosi
  console.log(`\n${'='.repeat(60)}`);
  console.log('📋 DIAGNOSI:\n');

  const authUser = authUsers?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!authUser && !dbUser) {
    console.log('🔴 Utente NON ESISTE da nessuna parte.');
    console.log('   → La registrazione non è mai partita o è fallita completamente.');
  } else if (authUser && !dbUser) {
    console.log('🟡 Utente esiste in auth.users ma NON in public.users.');
    console.log('   → La sync durante registrazione è fallita.');
    console.log('   → Fix: sync manuale o re-trigger callback.');
  } else if (authUser && !authUser.email_confirmed_at) {
    console.log('🟡 Utente registrato ma EMAIL NON CONFERMATA.');
    console.log('   → Non può fare login finché non conferma.');
    console.log('   → Fix: conferma email o conferma manuale da Supabase Dashboard.');
  } else if (dbUser && !dbUser.primary_workspace_id && dbUser.is_reseller) {
    console.log('🟡 Reseller senza workspace!');
    console.log('   → Il provisioning automatico nel callback è fallito.');
    console.log('   → Fix: eseguire provisioning manuale.');
  } else if (dbUser && dbUser.primary_workspace_id) {
    console.log('🟢 Utente sembra OK. Ha workspace e tutto configurato.');
    console.log('   → Se non lo trovi, controlla la pagina da cui stai cercando.');
  }

  console.log('');
}

diagnose().catch(console.error);
