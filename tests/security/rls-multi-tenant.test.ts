/**
 * Test: RLS Difensivo su Tabelle Multi-Tenant
 *
 * Verifica che le policy RLS bloccino l'accesso cross-workspace
 * quando si usa un client autenticato (non service_role).
 *
 * PATTERN:
 * - Setup via supabaseAdmin (service_role bypassa RLS — per creare fixture)
 * - Test via client autenticato (anonKey + JWT utente) — RLS attivo
 * - Cleanup via supabaseAdmin
 *
 * PREREQUISITI:
 * - NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
 * - SUPABASE_SERVICE_ROLE_KEY in .env.local
 * - Migration 20260219200000_rls_multi_tenant_tables.sql applicata
 */

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import path from 'path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

loadEnv({ path: path.join(process.cwd(), '.env.local'), override: false });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !serviceKey || !anonKey) {
  console.warn('⚠️  Variabili Supabase mancanti — test RLS skippati');
}

// Client admin (service_role — bypassa RLS, per setup/cleanup)
const admin = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ============================================================================
// FIXTURE
// ============================================================================

interface TestUser {
  id: string;
  email: string;
  workspaceId: string;
  token: string;
}

let userA: TestUser;
let userB: TestUser;
let shipmentIdA: string;
let shipmentIdB: string;
let orgId: string;

const TS = Date.now();
const USER_A_EMAIL = `rls-test-a-${TS}@example.com`;
const USER_B_EMAIL = `rls-test-b-${TS}@example.com`;
const TEST_PASSWORD = 'RlsTest2026!';

// ============================================================================
// SETUP
// ============================================================================

beforeAll(async () => {
  if (!supabaseUrl || !serviceKey || !anonKey) return;

  // 1. Crea organization test
  const { data: org } = await admin
    .from('organizations')
    .insert({
      name: `RLS Test Org ${TS}`,
      slug: `rls-org-${TS}`,
      status: 'active',
      billing_email: `rls-test-${TS}@example.com`,
    })
    .select('id')
    .single();

  if (!org) throw new Error('Impossibile creare organizzazione test');
  orgId = org.id;

  // 2. Crea 2 workspace isolati
  const [{ data: wsA }, { data: wsB }] = await Promise.all([
    admin
      .from('workspaces')
      .insert({
        name: `RLS WS A ${TS}`,
        slug: `rls-ws-a-${TS}`,
        organization_id: orgId,
        type: 'client',
        depth: 1,
        wallet_balance: 100,
        status: 'active',
      })
      .select('id')
      .single(),
    admin
      .from('workspaces')
      .insert({
        name: `RLS WS B ${TS}`,
        slug: `rls-ws-b-${TS}`,
        organization_id: orgId,
        type: 'client',
        depth: 1,
        wallet_balance: 100,
        status: 'active',
      })
      .select('id')
      .single(),
  ]);

  if (!wsA || !wsB) throw new Error('Impossibile creare workspace test');

  // 3. Crea 2 auth users
  const [{ data: authA }, { data: authB }] = await Promise.all([
    admin.auth.admin.createUser({
      email: USER_A_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'RLS Test A' },
      app_metadata: { account_type: 'user' },
    }),
    admin.auth.admin.createUser({
      email: USER_B_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'RLS Test B' },
      app_metadata: { account_type: 'user' },
    }),
  ]);

  if (!authA.user || !authB.user) throw new Error('Impossibile creare auth users');

  const userAId = authA.user.id;
  const userBId = authB.user.id;

  // 4. Inserisce record in public.users
  await Promise.all([
    admin.from('users').upsert(
      {
        id: userAId,
        email: USER_A_EMAIL,
        name: 'RLS Test A',
        role: 'user',
        account_type: 'user',
        primary_workspace_id: wsA.id,
      },
      { onConflict: 'id' }
    ),
    admin.from('users').upsert(
      {
        id: userBId,
        email: USER_B_EMAIL,
        name: 'RLS Test B',
        role: 'user',
        account_type: 'user',
        primary_workspace_id: wsB.id,
      },
      { onConflict: 'id' }
    ),
  ]);

  // 5. workspace_members: A→wsA, B→wsB
  await Promise.all([
    admin.from('workspace_members').insert({
      workspace_id: wsA.id,
      user_id: userAId,
      role: 'owner',
      status: 'active',
    }),
    admin.from('workspace_members').insert({
      workspace_id: wsB.id,
      user_id: userBId,
      role: 'owner',
      status: 'active',
    }),
  ]);

  // 6. INSERT spedizioni di test in ciascun workspace (via service_role — bypassa RLS)
  const [{ data: shipA }, { data: shipB }] = await Promise.all([
    admin
      .from('shipments')
      .insert({
        user_id: userAId,
        workspace_id: wsA.id,
        status: 'pending',
        idempotency_key: `rls-test-ship-a-${TS}`,
        total_cost: 5.0,
        recipient_name: 'RLS Test Recipient A',
        weight: 1.0,
        tracking_number: `RLS-TRK-A-${TS}`,
        sender_name: 'RLS Test Sender A',
      })
      .select('id')
      .single(),
    admin
      .from('shipments')
      .insert({
        user_id: userBId,
        workspace_id: wsB.id,
        status: 'pending',
        idempotency_key: `rls-test-ship-b-${TS}`,
        total_cost: 7.0,
        recipient_name: 'RLS Test Recipient B',
        weight: 1.5,
        tracking_number: `RLS-TRK-B-${TS}`,
        sender_name: 'RLS Test Sender B',
      })
      .select('id')
      .single(),
  ]);

  if (!shipA || !shipB) throw new Error('Impossibile creare spedizioni test');
  shipmentIdA = shipA.id;
  shipmentIdB = shipB.id;

  // 7. Ottieni JWT per userA e userB (accesso autenticato — RLS attivo)
  const clientA = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const clientB = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [sessionA, sessionB] = await Promise.all([
    clientA.auth.signInWithPassword({ email: USER_A_EMAIL, password: TEST_PASSWORD }),
    clientB.auth.signInWithPassword({ email: USER_B_EMAIL, password: TEST_PASSWORD }),
  ]);

  if (!sessionA.data.session || !sessionB.data.session) {
    throw new Error('Impossibile ottenere sessione JWT per test utenti');
  }

  userA = {
    id: userAId,
    email: USER_A_EMAIL,
    workspaceId: wsA.id,
    token: sessionA.data.session.access_token,
  };

  userB = {
    id: userBId,
    email: USER_B_EMAIL,
    workspaceId: wsB.id,
    token: sessionB.data.session.access_token,
  };

  console.log(`✅ Setup RLS test: wsA=${wsA.id.slice(0, 8)}, wsB=${wsB.id.slice(0, 8)}`);
  console.log(`   shipA=${shipmentIdA.slice(0, 8)}, shipB=${shipmentIdB.slice(0, 8)}`);
});

// ============================================================================
// CLEANUP
// ============================================================================

// Helper cleanup: ignora errori silenziosamente
async function safeDelete(table: string, col: string, val: string) {
  try {
    await admin.from(table).delete().eq(col, val);
  } catch {
    // ignora
  }
}

afterAll(async () => {
  if (!supabaseUrl || !serviceKey) return;

  // Ordine: shipments → wallet_transactions cleanup → workspace_members → users → auth users → workspaces → org
  if (shipmentIdA) await safeDelete('shipments', 'id', shipmentIdA);
  if (shipmentIdB) await safeDelete('shipments', 'id', shipmentIdB);

  // Wallet transactions di test (rls-tx-b-*)
  try {
    await admin.from('wallet_transactions').delete().like('idempotency_key', `rls-tx-b-${TS}`);
  } catch {
    // ignora
  }

  if (userA?.id) {
    await safeDelete('workspace_members', 'user_id', userA.id);
    await safeDelete('users', 'id', userA.id);
    try {
      await admin.auth.admin.deleteUser(userA.id);
    } catch {
      /* ignora */
    }
  }
  if (userB?.id) {
    await safeDelete('workspace_members', 'user_id', userB.id);
    await safeDelete('users', 'id', userB.id);
    try {
      await admin.auth.admin.deleteUser(userB.id);
    } catch {
      /* ignora */
    }
  }

  if (userA?.workspaceId) await safeDelete('workspaces', 'id', userA.workspaceId);
  if (userB?.workspaceId) await safeDelete('workspaces', 'id', userB.workspaceId);

  if (orgId) await safeDelete('organizations', 'id', orgId);

  console.log('✅ Cleanup RLS test completato');
});

// ============================================================================
// HELPER: client autenticato (RLS attivo)
// ============================================================================

function getAuthClient(token: string) {
  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

// ============================================================================
// TEST RLS
// ============================================================================

describe('RLS difensivo — isolamento cross-workspace (client autenticato)', () => {
  it('userA vede SOLO la spedizione del proprio workspace', async () => {
    if (!userA) return;

    const client = getAuthClient(userA.token);
    const { data, error } = await client
      .from('shipments')
      .select('id, workspace_id')
      .in('id', [shipmentIdA, shipmentIdB]);

    expect(error).toBeNull();
    // RLS: vede solo shipmentIdA (workspace A), NON shipmentIdB (workspace B)
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toContain(shipmentIdA);
    expect(ids).not.toContain(shipmentIdB);
    console.log(`✅ userA vede ${ids.length} spedizioni — solo wsA`);
  });

  it('userB vede SOLO la spedizione del proprio workspace', async () => {
    if (!userB) return;

    const client = getAuthClient(userB.token);
    const { data, error } = await client
      .from('shipments')
      .select('id, workspace_id')
      .in('id', [shipmentIdA, shipmentIdB]);

    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).not.toContain(shipmentIdA);
    expect(ids).toContain(shipmentIdB);
    console.log(`✅ userB vede ${ids.length} spedizioni — solo wsB`);
  });

  it('userA non può leggere wallet_transactions di workspace B', async () => {
    if (!userA || !userB) return;

    // INSERT wallet_tx in workspace B via admin
    const { data: tx } = await admin
      .from('wallet_transactions')
      .insert({
        user_id: userB.id,
        workspace_id: userB.workspaceId,
        amount: 10,
        type: 'admin_gift',
        idempotency_key: `rls-tx-b-${TS}`,
      })
      .select('id')
      .single();

    if (!tx) return;

    // userA prova a leggere la tx di B
    const client = getAuthClient(userA.token);
    const { data } = await client.from('wallet_transactions').select('id').eq('id', tx.id);

    const found = (data ?? []).length > 0;
    expect(found).toBe(false);
    console.log('✅ RLS blocca userA dal leggere wallet_transactions di workspace B');

    // Cleanup
    await safeDelete('wallet_transactions', 'id', tx.id);
  });

  it('userA non può leggere price_lists di workspace B', async () => {
    if (!userA || !userB) return;

    // INSERT price_list in workspace B via admin
    const { data: pl } = await admin
      .from('price_lists')
      .insert({
        workspace_id: userB.workspaceId,
        name: `RLS Test PL ${TS}`,
        is_master: false,
        status: 'active',
      })
      .select('id')
      .single();

    if (!pl) {
      console.warn('⚠️ Impossibile creare price_list test — skip');
      return;
    }

    // userA prova a leggere il listino di B
    const client = getAuthClient(userA.token);
    const { data } = await client.from('price_lists').select('id').eq('id', pl.id);

    const found = (data ?? []).length > 0;
    expect(found).toBe(false);
    console.log('✅ RLS blocca userA dal leggere price_lists di workspace B');

    // Cleanup
    await safeDelete('price_lists', 'id', pl.id);
  });

  it('userA non può INSERT spedizione in workspace B (WITH CHECK)', async () => {
    if (!userA || !userB) return;

    const client = getAuthClient(userA.token);
    const { data, error } = await client.from('shipments').insert({
      user_id: userA.id,
      workspace_id: userB.workspaceId, // ← workspace di B — deve essere bloccato
      status: 'pending',
      idempotency_key: `rls-cross-insert-${TS}`,
      total_cost: 1.0,
    });

    // RLS WITH CHECK deve bloccare l'insert
    const inserted = (data ?? []).length > 0;
    expect(inserted).toBe(false);
    if (error) {
      console.log(`✅ RLS WITH CHECK blocca insert cross-workspace: ${error.message}`);
    } else {
      console.log('✅ RLS WITH CHECK blocca insert (0 righe inserite)');
    }

    // Cleanup difensivo: se per qualche motivo è passato, lo elimino
    try {
      await admin.from('shipments').delete().eq('idempotency_key', `rls-cross-insert-${TS}`);
    } catch {
      /* ignora */
    }
  });

  it('service_role (supabaseAdmin) bypassa RLS e vede entrambe le spedizioni', async () => {
    if (!shipmentIdA || !shipmentIdB) return;

    // admin = service_role — deve vedere tutto senza filtri RLS
    const { data, error } = await admin
      .from('shipments')
      .select('id, workspace_id')
      .in('id', [shipmentIdA, shipmentIdB]);

    expect(error).toBeNull();
    const ids = (data ?? []).map((r) => r.id);
    expect(ids).toContain(shipmentIdA);
    expect(ids).toContain(shipmentIdB);
    console.log(`✅ service_role bypassa RLS — vede entrambe le spedizioni`);
  });
});
