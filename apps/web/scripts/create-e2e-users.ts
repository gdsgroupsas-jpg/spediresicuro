/**
 * Script: Crea Account Test E2E
 *
 * Crea 2 account di test per i test E2E reali (senza mock):
 * - User normale: testspediresicuro+e2e.user@gmail.com
 * - Admin:        testspediresicuro+e2e.admin@gmail.com
 *
 * Il reseller esiste già: testspediresicuro+postaexpress@gmail.com
 *
 * Uso:
 *   npx tsx scripts/create-e2e-users.ts
 *
 * Idempotente: se l'utente esiste già, aggiorna solo i campi necessari.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variabili ambiente mancanti:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✅' : '❌');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', supabaseServiceKey ? '✅' : '❌');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

interface E2EUserConfig {
  email: string;
  password: string;
  name: string;
  accountType: 'user' | 'admin';
  walletCredit: number;
  defaultSender?: Record<string, string>;
}

const E2E_USERS: E2EUserConfig[] = [
  {
    email: 'testspediresicuro+e2e.user@gmail.com',
    password: 'E2eUser2026!',
    name: 'E2E Test User',
    accountType: 'user',
    walletCredit: 50,
    defaultSender: {
      nome: 'Test Mittente E2E',
      indirizzo: 'Via Test 1',
      citta: 'Milano',
      provincia: 'MI',
      cap: '20100',
      telefono: '+39 02 1234567',
      email: 'test@spediresicuro.it',
    },
  },
  {
    email: 'testspediresicuro+e2e.admin@gmail.com',
    password: 'E2eAdmin2026!',
    name: 'E2E Test Admin',
    accountType: 'admin',
    walletCredit: 50,
  },
];

async function upsertE2EUser(cfg: E2EUserConfig): Promise<void> {
  const emailLower = cfg.email.toLowerCase().trim();
  console.log(`\n👤 Elaborazione: ${emailLower} (${cfg.accountType})`);

  // 1. Verifica se esiste già in Supabase Auth
  const { data: existingUsers } = await supabase.auth.admin.listUsers();
  const existingAuthUser = existingUsers?.users?.find((u) => u.email === emailLower);

  let authUserId: string;

  if (existingAuthUser) {
    authUserId = existingAuthUser.id;
    console.log(`   ✅ Auth user esistente: ${authUserId}`);

    // Aggiorna password e app_metadata
    await supabase.auth.admin.updateUserById(authUserId, {
      password: cfg.password,
      app_metadata: {
        role: cfg.accountType === 'admin' ? 'admin' : 'user',
        account_type: cfg.accountType,
        provider: 'credentials',
      },
    });
    console.log(`   ✅ Auth user aggiornato`);
  } else {
    // Crea nuovo auth user (email_confirm=true, no email verification)
    const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
      email: emailLower,
      password: cfg.password,
      email_confirm: true,
      user_metadata: { name: cfg.name },
      app_metadata: {
        role: cfg.accountType === 'admin' ? 'admin' : 'user',
        account_type: cfg.accountType,
        provider: 'credentials',
      },
    });

    if (authError || !newAuthUser.user) {
      console.error(`   ❌ Errore creazione auth user:`, authError?.message);
      throw authError;
    }

    authUserId = newAuthUser.user.id;
    console.log(`   ✅ Auth user creato: ${authUserId}`);
  }

  // 2. Upsert in public.users
  const { error: dbError } = await supabase.from('users').upsert(
    {
      id: authUserId,
      email: emailLower,
      name: cfg.name,
      password: null,
      role: cfg.accountType === 'admin' ? 'admin' : 'user',
      account_type: cfg.accountType,
      is_reseller: false,
      reseller_role: null,
      admin_level: cfg.accountType === 'admin' ? 1 : 0,
      provider: 'credentials',
      wallet_balance: cfg.walletCredit,
      dati_cliente: {
        datiCompletati: true,
        dataCompletamento: new Date().toISOString(),
        nome: cfg.name.split(' ')[0] || cfg.name,
        cognome: cfg.name.split(' ').slice(1).join(' ') || 'Test',
        codiceFiscale: 'TSTMTT80A01H501J',
        tipoCliente: 'persona',
        telefono: '0212345678',
        cellulare: '3391234567',
        indirizzo: 'Via Test 1',
        citta: 'Milano',
        provincia: 'MI',
        cap: '20100',
        nazione: 'Italia',
      },
      default_sender: cfg.defaultSender || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (dbError) {
    console.error(`   ❌ Errore upsert public.users:`, dbError.message);
    throw dbError;
  }
  console.log(`   ✅ public.users aggiornato`);

  // 3. Verifica/crea workspace per l'utente
  const { data: existingMemberships } = await supabase
    .from('workspace_members')
    .select('workspace_id, workspaces(id, name, wallet_balance)')
    .eq('user_id', authUserId)
    .limit(1);

  // Organization ID della piattaforma principale (costante per tutti i workspace)
  const PLATFORM_ORG_ID = '1cc28268-1f88-442b-8638-c3dbc7faabdc';

  if (!existingMemberships || existingMemberships.length === 0) {
    // Crea workspace dedicato
    const slug = `e2e-${cfg.accountType}-${Date.now()}`;
    const { data: newWorkspace, error: wsError } = await supabase
      .from('workspaces')
      .insert({
        name: `Workspace ${cfg.name}`,
        slug,
        organization_id: PLATFORM_ORG_ID,
        type: 'client',
        depth: 2,
        wallet_balance: cfg.walletCredit,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (wsError || !newWorkspace) {
      console.warn(`   ⚠️ Impossibile creare workspace:`, wsError?.message);
    } else {
      // Collega utente al workspace come owner
      await supabase.from('workspace_members').insert({
        workspace_id: newWorkspace.id,
        user_id: authUserId,
        role: 'owner',
        status: 'active',
        created_at: new Date().toISOString(),
      });

      // Aggiorna primary_workspace_id
      await supabase
        .from('users')
        .update({ primary_workspace_id: newWorkspace.id })
        .eq('id', authUserId);

      console.log(`   ✅ Workspace creato: ${newWorkspace.id}`);

      // Aggiungi credito wallet via transazione
      if (cfg.walletCredit > 0) {
        await supabase.from('wallet_transactions').insert({
          user_id: authUserId,
          workspace_id: newWorkspace.id,
          amount: cfg.walletCredit,
          type: 'admin_gift',
          description: `Credito iniziale E2E test (${cfg.accountType})`,
          created_by: authUserId,
          idempotency_key: `e2e-init-credit-${authUserId}`,
        });
        console.log(`   ✅ Wallet: +€${cfg.walletCredit} aggiunto`);
      }
    }
  } else {
    console.log(`   ✅ Workspace già esistente`);
  }

  console.log(`   🎉 Account pronto: ${emailLower} / ${cfg.password}`);
}

async function main() {
  console.log('🚀 Creazione account E2E test...');
  console.log('   Ambiente:', supabaseUrl);
  console.log('');

  for (const userCfg of E2E_USERS) {
    await upsertE2EUser(userCfg);
  }

  console.log('\n✅ Tutti gli account E2E sono pronti!');
  console.log('');
  console.log('📋 Aggiungi a .env.local (NON committare):');
  console.log('   E2E_USER_EMAIL=testspediresicuro+e2e.user@gmail.com');
  console.log('   E2E_USER_PASSWORD=E2eUser2026!');
  console.log('   E2E_ADMIN_EMAIL=testspediresicuro+e2e.admin@gmail.com');
  console.log('   E2E_ADMIN_PASSWORD=E2eAdmin2026!');
  console.log('');
  console.log('📋 Account esistente (reseller):');
  console.log('   E2E_RESELLER_EMAIL=testspediresicuro+postaexpress@gmail.com');
  console.log('   E2E_RESELLER_PASSWORD=<già in .env.local>');
}

main().catch((err) => {
  console.error('❌ Errore fatale:', err);
  process.exit(1);
});
