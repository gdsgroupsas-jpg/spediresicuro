/**
 * Script: Crea Sub-Client per il Reseller di Test E2E
 *
 * Crea un sub-client linkato al reseller testspediresicuro+postaexpress@gmail.com.
 * Il sub-client viene usato per i test E2E del flusso reseller→switch→spedizione.
 *
 * Uso:
 *   npx tsx scripts/create-reseller-subclient.ts
 *
 * Idempotente: se il sub-client esiste già, skip.
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

const RESELLER_EMAIL = process.env.E2E_RESELLER_EMAIL || 'testspediresicuro+postaexpress@gmail.com';
const SUBCLIENT_EMAIL = 'testspediresicuro+e2e.subclient@gmail.com';
const SUBCLIENT_PASSWORD = 'E2eSubclient2026!';
const SUBCLIENT_NAME = 'E2E SubClient Test';
const WALLET_CREDIT = 50;

async function main() {
  console.log('🚀 Creazione sub-client per reseller di test E2E...');
  console.log('   Reseller:', RESELLER_EMAIL);
  console.log('   Sub-client:', SUBCLIENT_EMAIL);
  console.log('');

  // 1. Trova il reseller nel DB
  const { data: resellerUser, error: resellerErr } = await supabase
    .from('users')
    .select('id, email, primary_workspace_id, is_reseller, account_type')
    .eq('email', RESELLER_EMAIL)
    .single();

  if (resellerErr || !resellerUser) {
    console.error('❌ Reseller non trovato nel DB:', resellerErr?.message);
    console.error('   Verifica che E2E_RESELLER_EMAIL sia corretto:', RESELLER_EMAIL);
    process.exit(1);
  }

  const resellerId = resellerUser.id;
  const resellerWorkspaceId = resellerUser.primary_workspace_id;

  console.log(`✅ Reseller trovato: ${resellerId}`);
  console.log(`   Workspace reseller: ${resellerWorkspaceId}`);
  console.log(
    `   Is reseller: ${resellerUser.is_reseller}, account_type: ${resellerUser.account_type}`
  );

  if (!resellerWorkspaceId) {
    console.error('❌ Reseller senza primary_workspace_id — impossibile creare sub-client');
    process.exit(1);
  }

  // 2. Verifica se il sub-client esiste già
  const { data: existingSubclient } = await supabase
    .from('users')
    .select('id, email, primary_workspace_id')
    .eq('email', SUBCLIENT_EMAIL)
    .maybeSingle();

  if (existingSubclient) {
    console.log(`\n✅ Sub-client già esistente: ${existingSubclient.id}`);
    console.log(`   Workspace: ${existingSubclient.primary_workspace_id}`);
    console.log('\n📋 Nessuna azione necessaria — sub-client pronto!');
    console.log('   Aggiungi a .env.local se non presenti:');
    console.log(`   E2E_SUBCLIENT_EMAIL=${SUBCLIENT_EMAIL}`);
    console.log(`   E2E_SUBCLIENT_PASSWORD=${SUBCLIENT_PASSWORD}`);
    return;
  }

  // 3. Trova il workspace reseller per ottenere organization_id
  const { data: resellerWs, error: resellerWsErr } = await supabase
    .from('workspaces')
    .select('id, organization_id, name, type, depth')
    .eq('id', resellerWorkspaceId)
    .single();

  if (resellerWsErr || !resellerWs) {
    console.error('❌ Workspace reseller non trovato:', resellerWsErr?.message);
    process.exit(1);
  }

  console.log(
    `✅ Workspace reseller: ${resellerWs.name} (${resellerWs.type}, depth=${resellerWs.depth})`
  );
  const organizationId = resellerWs.organization_id;

  // 4. Crea auth user per il sub-client
  const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
    email: SUBCLIENT_EMAIL,
    password: SUBCLIENT_PASSWORD,
    email_confirm: true,
    user_metadata: { name: SUBCLIENT_NAME },
    app_metadata: {
      role: 'user',
      account_type: 'user',
      provider: 'credentials',
    },
  });

  if (authError || !newAuthUser.user) {
    console.error('❌ Errore creazione auth user:', authError?.message);
    process.exit(1);
  }

  const subclientAuthId = newAuthUser.user.id;
  console.log(`\n✅ Auth user creato: ${subclientAuthId}`);

  // 5. Crea workspace sub-client (depth=2, parent=reseller workspace)
  const slug = `e2e-subclient-${Date.now()}`;
  const { data: subclientWs, error: wsError } = await supabase
    .from('workspaces')
    .insert({
      name: `Workspace ${SUBCLIENT_NAME}`,
      slug,
      organization_id: organizationId,
      type: 'client',
      depth: 2,
      parent_workspace_id: resellerWorkspaceId,
      wallet_balance: WALLET_CREDIT,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (wsError || !subclientWs) {
    console.error('❌ Errore creazione workspace sub-client:', wsError?.message);
    // Cleanup auth user
    await supabase.auth.admin.deleteUser(subclientAuthId);
    process.exit(1);
  }

  const subclientWsId = subclientWs.id;
  console.log(`✅ Workspace sub-client creato: ${subclientWsId}`);

  // 6. Crea record in public.users
  const { error: dbError } = await supabase.from('users').upsert(
    {
      id: subclientAuthId,
      email: SUBCLIENT_EMAIL,
      name: SUBCLIENT_NAME,
      password: null,
      role: 'user',
      account_type: 'user',
      is_reseller: false,
      reseller_role: null,
      admin_level: 0,
      provider: 'credentials',
      wallet_balance: WALLET_CREDIT,
      parent_id: resellerId,
      parent_reseller_id: resellerId,
      primary_workspace_id: subclientWsId,
      dati_cliente: {
        datiCompletati: true,
        dataCompletamento: new Date().toISOString(),
        nome: 'E2E',
        cognome: 'SubClient',
        tipoCliente: 'persona',
        telefono: '0212345678',
        indirizzo: 'Via SubClient 1',
        citta: 'Roma',
        provincia: 'RM',
        cap: '00100',
        nazione: 'Italia',
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (dbError) {
    console.error('❌ Errore upsert public.users:', dbError.message);
    process.exit(1);
  }
  console.log(`✅ public.users creato per sub-client`);

  // 7. workspace_members: sub-client = owner nel suo workspace
  await supabase.from('workspace_members').insert({
    workspace_id: subclientWsId,
    user_id: subclientAuthId,
    role: 'owner',
    status: 'active',
    created_at: new Date().toISOString(),
  });
  console.log(`✅ workspace_members: sub-client = owner nel proprio workspace`);

  // 8. workspace_members: reseller = admin nel workspace del sub-client
  // (necessario per POST /api/workspaces/switch fallback path)
  await supabase.from('workspace_members').insert({
    workspace_id: subclientWsId,
    user_id: resellerId,
    role: 'admin',
    status: 'active',
    created_at: new Date().toISOString(),
  });
  console.log(`✅ workspace_members: reseller = admin nel workspace sub-client`);

  // 9. Credito wallet sub-client via wallet_transactions
  await supabase.from('wallet_transactions').insert({
    user_id: subclientAuthId,
    workspace_id: subclientWsId,
    amount: WALLET_CREDIT,
    type: 'admin_gift',
    description: `Credito iniziale E2E sub-client test`,
    created_by: resellerId,
    idempotency_key: `e2e-subclient-init-credit-${subclientAuthId}`,
  });
  console.log(`✅ Wallet: +€${WALLET_CREDIT} aggiunto al sub-client`);

  console.log('\n🎉 Sub-client E2E creato con successo!');
  console.log('');
  console.log('📋 Aggiungi a .env.local (NON committare):');
  console.log(`   E2E_SUBCLIENT_EMAIL=${SUBCLIENT_EMAIL}`);
  console.log(`   E2E_SUBCLIENT_PASSWORD=${SUBCLIENT_PASSWORD}`);
  console.log('');
  console.log('📊 Riepilogo:');
  console.log(`   Sub-client ID: ${subclientAuthId}`);
  console.log(`   Workspace ID: ${subclientWsId}`);
  console.log(`   Parent reseller workspace: ${resellerWorkspaceId}`);
}

main().catch((err) => {
  console.error('❌ Errore fatale:', err);
  process.exit(1);
});
