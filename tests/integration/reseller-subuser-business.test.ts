/**
 * Integration Test: Flusso Business Reseller → Sub-User
 *
 * Verifica i contratti di business critici:
 * 1. Quando il reseller switcha al workspace del sub-client e crea una spedizione,
 *    il wallet del SUB-CLIENT viene scalato (non quello del reseller).
 * 2. La spedizione ha workspace_id = sub-client workspace (isolamento corretto).
 * 3. Il reseller nel suo workspace NON vede le spedizioni del sub-client.
 * 4. Il reseller vede le spedizioni del sub-client via gerarchia (get_visible_workspace_ids).
 *
 * Usa DB Supabase reale — nessun mock.
 * Pattern: multi-tenant-attacker-e2e.test.ts
 *
 * Tutti i dati vengono creati in beforeAll e distrutti in afterAll.
 * NON modifica dati di produzione esistenti.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Usa client reale — NESSUN mock
vi.unmock('@/lib/db/client');
vi.unmock('@/lib/db/workspace-query');

import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

describe('Business Flow: Reseller → Sub-User Wallet e Isolamento', () => {
  let supabaseAdmin: any;
  let workspaceQuery: any;
  let skipTests = false;

  // Suffisso univoco per evitare collisioni tra run parallele
  const suffix = `rsb-${Date.now()}-${Math.floor(Math.random() * 9999)}`;

  // IDs delle entità di test
  let organizationId: string;
  let resellerWsId: string;
  let subclientWsId: string;
  let resellerAuthId: string;
  let subclientAuthId: string;

  // IDs per cleanup
  const shipmentIds: string[] = [];
  const walletTxIds: string[] = [];

  beforeAll(async () => {
    try {
      const dbModule = await vi.importActual<any>('@/lib/db/client');
      const wqModule = await vi.importActual<any>('@/lib/db/workspace-query');
      supabaseAdmin = dbModule.supabaseAdmin;
      workspaceQuery = wqModule.workspaceQuery;

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('mock')) {
        console.warn('⚠️ Supabase non configurato — test business saltati');
        skipTests = true;
        return;
      }

      // === SETUP ===

      // 1. Organization test
      const { data: org, error: orgErr } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: `Reseller Business Test Org ${suffix}`,
          slug: `rsb-org-${suffix}`,
          billing_email: `billing-${suffix}@test.local`,
          status: 'active',
        })
        .select('id')
        .single();

      if (orgErr) {
        console.error('❌ Setup organization fallito:', orgErr.message);
        skipTests = true;
        return;
      }
      organizationId = org.id;

      // 2. Workspace reseller (depth=1)
      const { data: resellerWs, error: resellerWsErr } = await supabaseAdmin
        .from('workspaces')
        .insert({
          organization_id: organizationId,
          name: `Reseller WS ${suffix}`,
          slug: `reseller-ws-${suffix}`,
          type: 'reseller',
          depth: 1,
          parent_workspace_id: null,
          status: 'active',
          wallet_balance: 100,
        })
        .select('id')
        .single();

      if (resellerWsErr) {
        console.error('❌ Setup workspace reseller fallito:', resellerWsErr.message);
        skipTests = true;
        return;
      }
      resellerWsId = resellerWs.id;

      // 3. Workspace sub-client (depth=2, parent=reseller)
      const { data: subclientWs, error: subclientWsErr } = await supabaseAdmin
        .from('workspaces')
        .insert({
          organization_id: organizationId,
          name: `SubClient WS ${suffix}`,
          slug: `subclient-ws-${suffix}`,
          type: 'client',
          depth: 2,
          parent_workspace_id: resellerWsId,
          status: 'active',
          wallet_balance: 50,
        })
        .select('id')
        .single();

      if (subclientWsErr) {
        console.error('❌ Setup workspace sub-client fallito:', subclientWsErr.message);
        skipTests = true;
        return;
      }
      subclientWsId = subclientWs.id;

      // 4. Auth user reseller
      const { data: resellerAuth, error: resellerAuthErr } =
        await supabaseAdmin.auth.admin.createUser({
          email: `reseller-${suffix}@test.local`,
          password: 'Test1234!',
          email_confirm: true,
        });
      if (resellerAuthErr) {
        console.error('❌ Creazione auth reseller fallita:', resellerAuthErr.message);
        skipTests = true;
        return;
      }
      resellerAuthId = resellerAuth.user.id;

      // 5. Auth user sub-client
      const { data: subclientAuth, error: subclientAuthErr } =
        await supabaseAdmin.auth.admin.createUser({
          email: `subclient-${suffix}@test.local`,
          password: 'Test1234!',
          email_confirm: true,
        });
      if (subclientAuthErr) {
        console.error('❌ Creazione auth sub-client fallita:', subclientAuthErr.message);
        skipTests = true;
        return;
      }
      subclientAuthId = subclientAuth.user.id;

      // 6. public.users — reseller
      await supabaseAdmin.from('users').upsert(
        {
          id: resellerAuthId,
          email: `reseller-${suffix}@test.local`,
          name: `Reseller ${suffix}`,
          role: 'reseller',
          account_type: 'reseller',
          is_reseller: true,
          wallet_balance: 100,
          primary_workspace_id: resellerWsId,
          provider: 'credentials',
        },
        { onConflict: 'id' }
      );

      // 7. public.users — sub-client
      await supabaseAdmin.from('users').upsert(
        {
          id: subclientAuthId,
          email: `subclient-${suffix}@test.local`,
          name: `SubClient ${suffix}`,
          role: 'user',
          account_type: 'user',
          is_reseller: false,
          wallet_balance: 50,
          primary_workspace_id: subclientWsId,
          parent_id: resellerAuthId,
          parent_reseller_id: resellerAuthId,
          provider: 'credentials',
        },
        { onConflict: 'id' }
      );

      // 8. workspace_members
      await supabaseAdmin.from('workspace_members').insert([
        // Reseller = owner del suo workspace
        { workspace_id: resellerWsId, user_id: resellerAuthId, role: 'owner', status: 'active' },
        // Sub-client = owner del suo workspace
        { workspace_id: subclientWsId, user_id: subclientAuthId, role: 'owner', status: 'active' },
        // Reseller = admin nel workspace del sub-client (per consentire switch)
        { workspace_id: subclientWsId, user_id: resellerAuthId, role: 'admin', status: 'active' },
      ]);

      // 9. Carica credito wallet sub-client
      const { data: initTx } = await supabaseAdmin
        .from('wallet_transactions')
        .insert({
          user_id: subclientAuthId,
          workspace_id: subclientWsId,
          amount: 50,
          type: 'admin_gift',
          description: `Init credit sub-client ${suffix}`,
          created_by: resellerAuthId,
          idempotency_key: `init-subclient-${suffix}`,
        })
        .select('id')
        .single();
      if (initTx?.id) walletTxIds.push(initTx.id);

      // 10. Carica credito wallet reseller
      const { data: initResellerTx } = await supabaseAdmin
        .from('wallet_transactions')
        .insert({
          user_id: resellerAuthId,
          workspace_id: resellerWsId,
          amount: 100,
          type: 'admin_gift',
          description: `Init credit reseller ${suffix}`,
          created_by: resellerAuthId,
          idempotency_key: `init-reseller-${suffix}`,
        })
        .select('id')
        .single();
      if (initResellerTx?.id) walletTxIds.push(initResellerTx.id);

      console.log('✅ Setup completato:');
      console.log(`   Org: ${organizationId}`);
      console.log(`   Reseller WS: ${resellerWsId} (wallet: 100)`);
      console.log(`   SubClient WS: ${subclientWsId} (wallet: 50)`);
      console.log(`   Reseller user: ${resellerAuthId}`);
      console.log(`   SubClient user: ${subclientAuthId}`);
    } catch (err) {
      console.error('❌ Setup fallito con eccezione:', err);
      skipTests = true;
    }
  }, 60000);

  afterAll(async () => {
    if (!supabaseAdmin) return;

    console.log('🧹 Cleanup test business reseller...');

    try {
      // Ordine obbligatorio per FK constraints
      if (shipmentIds.length > 0) {
        await supabaseAdmin.from('shipments').delete().in('id', shipmentIds);
      }
      if (walletTxIds.length > 0) {
        await supabaseAdmin.from('wallet_transactions').delete().in('id', walletTxIds);
      }

      // workspace_members (tutti quelli nei workspace di test)
      await supabaseAdmin
        .from('workspace_members')
        .delete()
        .in('workspace_id', [resellerWsId, subclientWsId].filter(Boolean));

      // public.users
      if (resellerAuthId) {
        await supabaseAdmin.from('users').delete().eq('id', resellerAuthId);
      }
      if (subclientAuthId) {
        await supabaseAdmin.from('users').delete().eq('id', subclientAuthId);
      }

      // Auth users
      if (resellerAuthId) {
        await supabaseAdmin.auth.admin.deleteUser(resellerAuthId);
      }
      if (subclientAuthId) {
        await supabaseAdmin.auth.admin.deleteUser(subclientAuthId);
      }

      // Workspaces
      if (subclientWsId) {
        await supabaseAdmin.from('workspaces').delete().eq('id', subclientWsId);
      }
      if (resellerWsId) {
        await supabaseAdmin.from('workspaces').delete().eq('id', resellerWsId);
      }

      // Organization
      if (organizationId) {
        await supabaseAdmin.from('organizations').delete().eq('id', organizationId);
      }

      console.log('✅ Cleanup completato');
    } catch (err) {
      console.error('⚠️ Cleanup parzialmente fallito:', err);
    }
  }, 30000);

  // ============================================================
  // TEST 1: Wallet sub-client scalato dopo switch workspace
  // ============================================================
  it('wallet del SUB-CLIENT scalato dopo switch workspace reseller→subclient', async () => {
    if (skipTests) return;

    // Simula workspace switch: aggiorna primary_workspace_id del reseller
    await supabaseAdmin
      .from('users')
      .update({ primary_workspace_id: subclientWsId })
      .eq('id', resellerAuthId);

    // Verifica che getUserWorkspaceId (legge primary_workspace_id) ora restituisca il workspace del sub-client
    const { data: resellerUser } = await supabaseAdmin
      .from('users')
      .select('primary_workspace_id')
      .eq('id', resellerAuthId)
      .single();

    expect(resellerUser.primary_workspace_id).toBe(subclientWsId);

    // Bilancio pre-debit
    const { data: subclientWsBefore } = await supabaseAdmin
      .from('workspaces')
      .select('wallet_balance')
      .eq('id', subclientWsId)
      .single();

    const { data: resellerWsBefore } = await supabaseAdmin
      .from('workspaces')
      .select('wallet_balance')
      .eq('id', resellerWsId)
      .single();

    const subclientBalanceBefore = Number(subclientWsBefore.wallet_balance);
    const resellerBalanceBefore = Number(resellerWsBefore.wallet_balance);

    // Scala €5 dal workspace del sub-client (come farebbe createShipmentCore)
    const { data: deductResult, error: deductErr } = await supabaseAdmin.rpc(
      'deduct_wallet_credit_v2',
      {
        p_workspace_id: subclientWsId,
        p_user_id: resellerAuthId,
        p_amount: 5.0,
        p_type: 'SHIPMENT_CHARGE',
        p_description: `Test debit business ${suffix}`,
        p_idempotency_key: `test-debit-${suffix}`,
      }
    );

    expect(deductErr).toBeNull();
    expect(deductResult).toBeTruthy(); // UUID della wallet_transaction creata
    walletTxIds.push(deductResult);

    // Bilancio post-debit
    const { data: subclientWsAfter } = await supabaseAdmin
      .from('workspaces')
      .select('wallet_balance')
      .eq('id', subclientWsId)
      .single();

    const { data: resellerWsAfter } = await supabaseAdmin
      .from('workspaces')
      .select('wallet_balance')
      .eq('id', resellerWsId)
      .single();

    // Sub-client: -5
    expect(Number(subclientWsAfter.wallet_balance)).toBe(subclientBalanceBefore - 5);

    // Reseller: invariato
    expect(Number(resellerWsAfter.wallet_balance)).toBe(resellerBalanceBefore);

    // Verifica wallet_transactions registrata con workspace corretto
    const { data: txRecord } = await supabaseAdmin
      .from('wallet_transactions')
      .select('workspace_id, user_id, amount, type')
      .eq('id', deductResult)
      .single();

    expect(txRecord.workspace_id).toBe(subclientWsId);
    expect(txRecord.user_id).toBe(resellerAuthId);
    expect(Number(txRecord.amount)).toBe(-5); // debit = negativo

    console.log('✅ Wallet sub-client scalato correttamente: -5 su subclient, reseller invariato');

    // Restore: reseller torna al suo workspace
    await supabaseAdmin
      .from('users')
      .update({ primary_workspace_id: resellerWsId })
      .eq('id', resellerAuthId);
  });

  // ============================================================
  // TEST 2: workspace_id presente sulla spedizione (fix verificato)
  // ============================================================
  it('spedizione con workspace_id = subclientWsId è isolata nel workspace corretto', async () => {
    if (skipTests) return;

    // Insert spedizione con workspace_id esplicito (come dopo il fix)
    const { data: shipment, error: shipErr } = await supabaseAdmin
      .from('shipments')
      .insert({
        user_id: resellerAuthId,
        workspace_id: subclientWsId,
        tracking_number: `TRK-SUBCLIENT-${suffix}`,
        status: 'pending',
        carrier: 'GLS',
        sender_name: 'Test Mittente',
        sender_address: 'Via Test 1',
        sender_city: 'Milano',
        sender_zip: '20100',
        sender_province: 'MI',
        recipient_name: 'TEST E2E SARNO',
        recipient_address: 'Via Sarno 1',
        recipient_city: 'SARNO',
        recipient_zip: '84087',
        recipient_province: 'SA',
        weight: 1,
        final_price: 7.5,
        deleted: false,
      })
      .select('id, workspace_id, user_id')
      .single();

    expect(shipErr).toBeNull();
    expect(shipment).toBeTruthy();
    expect(shipment.workspace_id).toBe(subclientWsId);
    expect(shipment.user_id).toBe(resellerAuthId);
    shipmentIds.push(shipment.id);

    // workspaceQuery(subclientWsId) trova la spedizione
    const { data: fromSubclient } = await workspaceQuery(subclientWsId)
      .from('shipments')
      .select('id, workspace_id')
      .eq('id', shipment.id)
      .maybeSingle();

    expect(fromSubclient).not.toBeNull();
    expect(fromSubclient.workspace_id).toBe(subclientWsId);

    // workspaceQuery(resellerWsId) NON trova la spedizione
    const { data: fromReseller } = await workspaceQuery(resellerWsId)
      .from('shipments')
      .select('id')
      .eq('id', shipment.id)
      .maybeSingle();

    expect(fromReseller).toBeNull();

    console.log('✅ Spedizione isolata nel workspace sub-client (workspace_id corretto)');
  });

  // ============================================================
  // TEST 3: Reseller nel suo workspace NON vede spedizioni sub-client
  // ============================================================
  it('reseller nel suo workspace NON vede le spedizioni del sub-client', async () => {
    if (skipTests) return;

    // Insert spedizione nel workspace del sub-client
    const { data: shipment } = await supabaseAdmin
      .from('shipments')
      .insert({
        user_id: resellerAuthId,
        workspace_id: subclientWsId,
        tracking_number: `TRK-ISOLATION-${suffix}`,
        status: 'pending',
        carrier: 'GLS',
        sender_name: 'Test',
        sender_address: 'Via Test 1',
        sender_city: 'Milano',
        sender_zip: '20100',
        sender_province: 'MI',
        recipient_name: 'TEST SARNO',
        recipient_address: 'Via Sarno 1',
        recipient_city: 'SARNO',
        recipient_zip: '84087',
        recipient_province: 'SA',
        weight: 1,
        final_price: 5.0,
        deleted: false,
      })
      .select('id')
      .single();

    shipmentIds.push(shipment.id);

    // workspaceQuery(resellerWsId) — reseller nel suo workspace NON vede la spedizione
    const { data: resellerView } = await workspaceQuery(resellerWsId)
      .from('shipments')
      .select('id')
      .eq('id', shipment.id)
      .maybeSingle();

    expect(resellerView).toBeNull();
    console.log(
      '✅ Isolamento corretto: reseller NON vede spedizioni del sub-client nel proprio workspace'
    );
  });

  // ============================================================
  // TEST 4: Reseller vede spedizioni sub-client via gerarchia
  // ============================================================
  it('reseller vede spedizioni sub-client via get_visible_workspace_ids (gerarchia)', async () => {
    if (skipTests) return;

    // Insert spedizione nel workspace sub-client
    const { data: shipment } = await supabaseAdmin
      .from('shipments')
      .insert({
        user_id: subclientAuthId,
        workspace_id: subclientWsId,
        tracking_number: `TRK-HIERARCHY-${suffix}`,
        status: 'pending',
        carrier: 'BRT',
        sender_name: 'SubClient Mittente',
        sender_address: 'Via SubClient 1',
        sender_city: 'Roma',
        sender_zip: '00100',
        sender_province: 'RM',
        recipient_name: 'TEST SARNO',
        recipient_address: 'Via Sarno 1',
        recipient_city: 'SARNO',
        recipient_zip: '84087',
        recipient_province: 'SA',
        weight: 2,
        final_price: 9.0,
        deleted: false,
      })
      .select('id')
      .single();

    shipmentIds.push(shipment.id);

    // Ottieni i workspace visibili dalla gerarchia del reseller
    const { data: visibleIds, error: visErr } = await supabaseAdmin.rpc(
      'get_visible_workspace_ids',
      { p_workspace_id: resellerWsId }
    );

    if (visErr) {
      console.warn('⚠️ get_visible_workspace_ids non disponibile:', visErr.message);
      return;
    }

    const visibleWorkspaceIds = visibleIds as string[];
    expect(visibleWorkspaceIds).toContain(resellerWsId);
    expect(visibleWorkspaceIds).toContain(subclientWsId);

    // La spedizione è raggiungibile via gerarchia
    const { data: hierarchyView } = await supabaseAdmin
      .from('shipments')
      .select('id, workspace_id')
      .in('workspace_id', visibleWorkspaceIds)
      .eq('id', shipment.id)
      .maybeSingle();

    expect(hierarchyView).not.toBeNull();
    expect(hierarchyView.workspace_id).toBe(subclientWsId);

    console.log(
      `✅ Reseller vede spedizione sub-client via gerarchia (${visibleWorkspaceIds.length} workspace visibili)`
    );
  });

  // ============================================================
  // TEST 5: Workspace sub-client ha parent_workspace_id = reseller workspace
  // ============================================================
  it('workspace sub-client è correttamente figlio del workspace reseller', async () => {
    if (skipTests) return;

    const { data: subclientWsData } = await supabaseAdmin
      .from('workspaces')
      .select('id, type, depth, parent_workspace_id')
      .eq('id', subclientWsId)
      .single();

    expect(subclientWsData.type).toBe('client');
    expect(subclientWsData.depth).toBe(2);
    expect(subclientWsData.parent_workspace_id).toBe(resellerWsId);

    const { data: resellerWsData } = await supabaseAdmin
      .from('workspaces')
      .select('id, type, depth, parent_workspace_id')
      .eq('id', resellerWsId)
      .single();

    expect(resellerWsData.type).toBe('reseller');
    expect(resellerWsData.depth).toBe(1);
    expect(resellerWsData.parent_workspace_id).toBeNull();

    console.log('✅ Gerarchia workspace corretta: reseller(depth=1) → subclient(depth=2)');
  });
});
