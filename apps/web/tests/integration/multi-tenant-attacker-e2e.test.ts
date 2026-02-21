/**
 * Test E2E Multi-Tenant Isolation — Attacker Scenario con DB Reale
 *
 * Verifica che workspaceQuery() isoli davvero i dati nel DB reale (Supabase produzione).
 * NON usa mock — usa il DB effettivo.
 *
 * Scenario:
 * - Crea Organization + 2 workspace indipendenti (WS-A e WS-B)
 * - Crea utenti, spedizioni, price_lists in ciascun workspace
 * - Verifica che workspaceQuery(wsA) NON veda dati di WS-B e viceversa
 * - Verifica scenari attacker: WS-A non può leggere/scrivere su WS-B
 *
 * Cleanup: tutti i dati vengono rimossi in afterAll
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Usa client reale — NESSUN mock per questo test
vi.unmock('@/lib/db/client');
vi.unmock('@/lib/db/workspace-query');

import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

describe('Multi-Tenant Isolation E2E — Attacker Scenario', () => {
  let supabaseAdmin: any;
  let workspaceQuery: any;
  let skipTests = false;

  // IDs delle entità di test — suffisso univoco per evitare collisioni
  const suffix = `mt-e2e-${Date.now()}-${Math.floor(Math.random() * 9999)}`;
  let organizationId: string;
  let wsAId: string; // Workspace A (vittima)
  let wsBId: string; // Workspace B (attacker)
  let userAId: string;
  let userBId: string;
  let shipmentAId: string; // Spedizione di WS-A
  let shipmentBId: string; // Spedizione di WS-B
  let priceListAId: string;
  let priceListBId: string;
  let walletTxAId: string;

  beforeAll(async () => {
    try {
      const dbModule = await vi.importActual<any>('@/lib/db/client');
      const wqModule = await vi.importActual<any>('@/lib/db/workspace-query');
      supabaseAdmin = dbModule.supabaseAdmin;
      workspaceQuery = wqModule.workspaceQuery;

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('mock')) {
        console.warn('⚠️ Supabase non configurato — test E2E saltati');
        skipTests = true;
        return;
      }

      // === SETUP: Crea struttura multi-tenant di test ===

      // 1. Organization
      const { data: org, error: orgErr } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: `MT E2E Org ${suffix}`,
          slug: `mt-e2e-org-${suffix}`,
          billing_email: `billing-${suffix}@test.local`,
          status: 'active',
        })
        .select('id')
        .single();

      if (orgErr) {
        console.error('❌ Setup org fallito:', orgErr.message);
        skipTests = true;
        return;
      }
      organizationId = org.id;

      // 2. Workspace A
      const { data: wsA, error: wsAErr } = await supabaseAdmin
        .from('workspaces')
        .insert({
          organization_id: organizationId,
          name: `WS-A ${suffix}`,
          slug: `ws-a-${suffix}`,
          type: 'reseller',
          depth: 1,
          parent_workspace_id: null,
          status: 'active',
          wallet_balance: 100,
        })
        .select('id')
        .single();

      if (wsAErr) {
        console.error('❌ Setup WS-A fallito:', wsAErr.message);
        skipTests = true;
        return;
      }
      wsAId = wsA.id;

      // 3. Workspace B (workspace completamente separato)
      const { data: wsB, error: wsBErr } = await supabaseAdmin
        .from('workspaces')
        .insert({
          organization_id: organizationId,
          name: `WS-B ${suffix}`,
          slug: `ws-b-${suffix}`,
          type: 'reseller',
          depth: 1,
          parent_workspace_id: null,
          status: 'active',
          wallet_balance: 200,
        })
        .select('id')
        .single();

      if (wsBErr) {
        console.error('❌ Setup WS-B fallito:', wsBErr.message);
        skipTests = true;
        return;
      }
      wsBId = wsB.id;

      // 4. Utente A
      const { data: authA } = await supabaseAdmin.auth.admin.createUser({
        email: `user-a-${suffix}@test.local`,
        password: 'TestPass123!',
        email_confirm: true,
      });
      userAId = authA?.user?.id;
      if (userAId) {
        await supabaseAdmin.from('users').upsert({
          id: userAId,
          email: `user-a-${suffix}@test.local`,
          name: `User A ${suffix}`,
          role: 'user',
          account_type: 'user',
          primary_workspace_id: wsAId,
        });
        await supabaseAdmin.from('workspace_members').insert({
          workspace_id: wsAId,
          user_id: userAId,
          role: 'owner',
          status: 'active',
          accepted_at: new Date().toISOString(),
        });
      }

      // 5. Utente B
      const { data: authB } = await supabaseAdmin.auth.admin.createUser({
        email: `user-b-${suffix}@test.local`,
        password: 'TestPass123!',
        email_confirm: true,
      });
      userBId = authB?.user?.id;
      if (userBId) {
        await supabaseAdmin.from('users').upsert({
          id: userBId,
          email: `user-b-${suffix}@test.local`,
          name: `User B ${suffix}`,
          role: 'user',
          account_type: 'user',
          primary_workspace_id: wsBId,
        });
        await supabaseAdmin.from('workspace_members').insert({
          workspace_id: wsBId,
          user_id: userBId,
          role: 'owner',
          status: 'active',
          accepted_at: new Date().toISOString(),
        });
      }

      // 6. Spedizione in WS-A
      const { data: shipA, error: shipAErr } = await supabaseAdmin
        .from('shipments')
        .insert({
          workspace_id: wsAId,
          user_id: userAId || '00000000-0000-0000-0000-000000000001',
          tracking_number: `TRK-A-${suffix}`,
          status: 'pending',
          sender_name: 'Sender A',
          sender_address: 'Via A 1',
          sender_city: 'Milano',
          sender_zip: '20100',
          sender_province: 'MI',
          recipient_name: 'Recipient A',
          recipient_address: 'Via A 2',
          recipient_city: 'Roma',
          recipient_zip: '00100',
          recipient_province: 'RM',
          weight: 1,
          final_price: 10.5,
          deleted: false,
        })
        .select('id')
        .single();

      if (shipAErr) {
        console.error('❌ Setup shipment WS-A fallito:', shipAErr.message);
        skipTests = true;
        return;
      }
      shipmentAId = shipA.id;

      // 7. Spedizione in WS-B
      const { data: shipB, error: shipBErr } = await supabaseAdmin
        .from('shipments')
        .insert({
          workspace_id: wsBId,
          user_id: userBId || '00000000-0000-0000-0000-000000000002',
          tracking_number: `TRK-B-${suffix}`,
          status: 'pending',
          sender_name: 'Sender B',
          sender_address: 'Via B 1',
          sender_city: 'Torino',
          sender_zip: '10100',
          sender_province: 'TO',
          recipient_name: 'Recipient B',
          recipient_address: 'Via B 2',
          recipient_city: 'Napoli',
          recipient_zip: '80100',
          recipient_province: 'NA',
          weight: 2,
          final_price: 15.0,
          deleted: false,
        })
        .select('id')
        .single();

      if (shipBErr) {
        console.error('❌ Setup shipment WS-B fallito:', shipBErr.message);
        skipTests = true;
        return;
      }
      shipmentBId = shipB.id;

      // 8. Price list in WS-A
      const { data: plA, error: plAErr } = await supabaseAdmin
        .from('price_lists')
        .insert({
          workspace_id: wsAId,
          name: `Listino A ${suffix}`,
          list_type: 'custom',
          version: 1,
          status: 'active',
          default_margin_percent: 10,
          created_by: userAId || '00000000-0000-0000-0000-000000000001',
        })
        .select('id')
        .single();

      if (plAErr) {
        console.error('❌ Setup price_list WS-A fallito:', plAErr.message);
        // Non bloccante
      } else {
        priceListAId = plA.id;
      }

      // 9. Price list in WS-B
      const { data: plB, error: plBErr } = await supabaseAdmin
        .from('price_lists')
        .insert({
          workspace_id: wsBId,
          name: `Listino B ${suffix}`,
          list_type: 'custom',
          version: 1,
          status: 'active',
          default_margin_percent: 15,
          created_by: userBId || '00000000-0000-0000-0000-000000000002',
        })
        .select('id')
        .single();

      if (plBErr) {
        console.error('❌ Setup price_list WS-B fallito:', plBErr.message);
        // Non bloccante
      } else {
        priceListBId = plB.id;
      }

      // 10. Wallet transaction in WS-A
      const { data: wt, error: wtErr } = await supabaseAdmin
        .from('wallet_transactions')
        .insert({
          workspace_id: wsAId,
          user_id: userAId || '00000000-0000-0000-0000-000000000001',
          type: 'CREDIT',
          amount: 50,
          balance_after: 150,
          description: `Test credit ${suffix}`,
          idempotency_key: `test-${suffix}-credit`,
        })
        .select('id')
        .single();

      if (!wtErr && wt) {
        walletTxAId = wt.id;
      }

      console.log('✅ Setup E2E multi-tenant completato:', {
        organizationId,
        wsAId,
        wsBId,
        shipmentAId,
        shipmentBId,
        priceListAId,
        priceListBId,
      });
    } catch (err: any) {
      console.error('❌ Setup E2E fallito:', err.message);
      skipTests = true;
    }
  });

  afterAll(async () => {
    if (!supabaseAdmin) return;

    console.log('🧹 Cleanup E2E multi-tenant...');

    try {
      // Cleanup in ordine corretto (dipendenze)
      if (walletTxAId) {
        await supabaseAdmin.from('wallet_transactions').delete().eq('id', walletTxAId);
      }
      if (priceListAId) {
        await supabaseAdmin.from('price_list_entries').delete().eq('price_list_id', priceListAId);
        await supabaseAdmin.from('price_lists').delete().eq('id', priceListAId);
      }
      if (priceListBId) {
        await supabaseAdmin.from('price_list_entries').delete().eq('price_list_id', priceListBId);
        await supabaseAdmin.from('price_lists').delete().eq('id', priceListBId);
      }
      if (shipmentAId) {
        await supabaseAdmin.from('shipments').delete().eq('id', shipmentAId);
      }
      if (shipmentBId) {
        await supabaseAdmin.from('shipments').delete().eq('id', shipmentBId);
      }
      if (userAId) {
        await supabaseAdmin.from('workspace_members').delete().eq('user_id', userAId);
        await supabaseAdmin.from('users').delete().eq('id', userAId);
        await supabaseAdmin.auth.admin.deleteUser(userAId);
      }
      if (userBId) {
        await supabaseAdmin.from('workspace_members').delete().eq('user_id', userBId);
        await supabaseAdmin.from('users').delete().eq('id', userBId);
        await supabaseAdmin.auth.admin.deleteUser(userBId);
      }
      if (wsAId) {
        await supabaseAdmin.from('workspaces').delete().eq('id', wsAId);
      }
      if (wsBId) {
        await supabaseAdmin.from('workspaces').delete().eq('id', wsBId);
      }
      if (organizationId) {
        await supabaseAdmin.from('organizations').delete().eq('id', organizationId);
      }

      console.log('✅ Cleanup E2E completato');
    } catch (err: any) {
      console.warn('⚠️ Cleanup parzialmente fallito:', err.message);
    }
  });

  // ============================================================
  // TEST 1: workspaceQuery(WS-A) vede solo spedizioni di WS-A
  // ============================================================
  it('workspaceQuery(WS-A) vede solo shipments di WS-A', async () => {
    if (skipTests) return;

    const wq = workspaceQuery(wsAId);
    const { data, error } = await wq.from('shipments').select('id, workspace_id, tracking_number');

    expect(error).toBeNull();
    expect(data).toBeDefined();

    // Deve contenere la spedizione di WS-A
    const hasShipA = data.some((s: any) => s.id === shipmentAId);
    expect(hasShipA).toBe(true);

    // NON deve contenere la spedizione di WS-B (ISOLAMENTO CRITICO)
    const hasShipB = data.some((s: any) => s.id === shipmentBId);
    expect(hasShipB).toBe(false);

    // Tutte le righe devono avere workspace_id = wsAId
    const allBelongToA = data.every((s: any) => s.workspace_id === wsAId);
    expect(allBelongToA).toBe(true);
  });

  // ============================================================
  // TEST 2: workspaceQuery(WS-B) vede solo spedizioni di WS-B
  // ============================================================
  it('workspaceQuery(WS-B) vede solo shipments di WS-B', async () => {
    if (skipTests) return;

    const wq = workspaceQuery(wsBId);
    const { data, error } = await wq.from('shipments').select('id, workspace_id, tracking_number');

    expect(error).toBeNull();
    expect(data).toBeDefined();

    // Deve contenere la spedizione di WS-B
    const hasShipB = data.some((s: any) => s.id === shipmentBId);
    expect(hasShipB).toBe(true);

    // NON deve contenere la spedizione di WS-A (ISOLAMENTO CRITICO)
    const hasShipA = data.some((s: any) => s.id === shipmentAId);
    expect(hasShipA).toBe(false);

    // Tutte le righe devono avere workspace_id = wsBId
    const allBelongToB = data.every((s: any) => s.workspace_id === wsBId);
    expect(allBelongToB).toBe(true);
  });

  // ============================================================
  // TEST 3: Price lists isolate
  // ============================================================
  it('workspaceQuery(WS-A) NON vede price_lists di WS-B', async () => {
    if (skipTests || !priceListAId || !priceListBId) return;

    const wq = workspaceQuery(wsAId);
    const { data, error } = await wq.from('price_lists').select('id, workspace_id, name');

    expect(error).toBeNull();
    expect(data).toBeDefined();

    // Deve avere il listino di WS-A
    const hasPlA = data.some((p: any) => p.id === priceListAId);
    expect(hasPlA).toBe(true);

    // NON deve avere il listino di WS-B
    const hasPlB = data.some((p: any) => p.id === priceListBId);
    expect(hasPlB).toBe(false);
  });

  // ============================================================
  // TEST 4: Wallet transactions isolate
  // ============================================================
  it('workspaceQuery(WS-B) NON vede wallet_transactions di WS-A', async () => {
    if (skipTests || !walletTxAId) return;

    const wq = workspaceQuery(wsBId);
    const { data, error } = await wq.from('wallet_transactions').select('id, workspace_id');

    expect(error).toBeNull();
    expect(data).toBeDefined();

    // NON deve contenere la transazione di WS-A
    const hasTxA = data.some((t: any) => t.id === walletTxAId);
    expect(hasTxA).toBe(false);

    // Tutto ciò che vede deve appartenere a WS-B
    const allBelongToB = data.every((t: any) => t.workspace_id === wsBId);
    expect(allBelongToB).toBe(true);
  });

  // ============================================================
  // TEST 5: INSERT con workspaceQuery inietta workspace_id corretto
  // ============================================================
  it('INSERT via workspaceQuery(WS-A) inietta workspace_id = wsAId', async () => {
    if (skipTests) return;

    const wq = workspaceQuery(wsAId);
    const trackingNumber = `TRK-INSERT-TEST-${suffix}`;

    const { data: inserted, error: insertErr } = await wq
      .from('shipments')
      .insert({
        user_id: userAId || '00000000-0000-0000-0000-000000000001',
        tracking_number: trackingNumber,
        status: 'pending',
        sender_name: 'Insert Test',
        sender_address: 'Via Test 1',
        sender_city: 'Milano',
        sender_zip: '20100',
        sender_province: 'MI',
        recipient_name: 'Recipient Test',
        recipient_address: 'Via Test 2',
        recipient_city: 'Roma',
        recipient_zip: '00100',
        recipient_province: 'RM',
        weight: 0.5,
        final_price: 5.0,
        deleted: false,
      })
      .select('id, workspace_id')
      .single();

    expect(insertErr).toBeNull();
    expect(inserted).toBeDefined();

    // workspace_id deve essere wsAId automaticamente
    expect(inserted.workspace_id).toBe(wsAId);

    // Cleanup immediato
    if (inserted?.id) {
      await supabaseAdmin.from('shipments').delete().eq('id', inserted.id);
    }
  });

  // ============================================================
  // TEST 6: UPDATE via workspaceQuery non modifica record di altro workspace
  // ============================================================
  it('UPDATE via workspaceQuery(WS-A) NON modifica shipments di WS-B', async () => {
    if (skipTests) return;

    // Tenta di aggiornare la spedizione di WS-B usando workspaceQuery di WS-A
    const wq = workspaceQuery(wsAId);
    const { error: updateErr } = await wq
      .from('shipments')
      .update({ sender_name: '🔴 COMPROMESSO' })
      .eq('id', shipmentBId);

    // Può non dare errore (l'update filtra per workspace_id = wsAId, quindi 0 righe)
    // Ma la spedizione B NON deve essere modificata
    expect(updateErr).toBeNull(); // Nessun errore DB (0 righe aggiornate è ok)

    // Verifica che shipment B sia invariato nel DB
    const { data: shipBAfter } = await supabaseAdmin
      .from('shipments')
      .select('sender_name')
      .eq('id', shipmentBId)
      .single();

    expect(shipBAfter?.sender_name).toBe('Sender B'); // NON deve essere cambiato
    expect(shipBAfter?.sender_name).not.toBe('🔴 COMPROMESSO');
  });

  // ============================================================
  // TEST 7: DELETE via workspaceQuery non elimina record di altro workspace
  // ============================================================
  it('DELETE via workspaceQuery(WS-A) NON elimina shipments di WS-B', async () => {
    if (skipTests) return;

    // Tenta di eliminare la spedizione di WS-B usando workspaceQuery di WS-A
    const wq = workspaceQuery(wsAId);
    await wq.from('shipments').delete().eq('id', shipmentBId);

    // La spedizione B deve ancora esistere nel DB
    const { data: shipBAfter, error } = await supabaseAdmin
      .from('shipments')
      .select('id')
      .eq('id', shipmentBId)
      .single();

    expect(error).toBeNull();
    expect(shipBAfter).toBeDefined();
    expect(shipBAfter?.id).toBe(shipmentBId); // Ancora presente
  });

  // ============================================================
  // TEST 8: workspaceQuery con ID vuoto lancia errore
  // ============================================================
  it('workspaceQuery con ID vuoto lancia errore', async () => {
    if (skipTests) return;

    expect(() => workspaceQuery('')).toThrow('workspaceId è obbligatorio');
  });

  // ============================================================
  // TEST 9: workspaceQuery(WS-A) con filtro by tracking number vede solo WS-A
  // ============================================================
  it('SELECT con filtro aggiuntivo rispetta isolamento workspace', async () => {
    if (skipTests) return;

    // Cerca per tracking number di WS-B usando workspaceQuery di WS-A
    const wq = workspaceQuery(wsAId);
    const { data } = await wq
      .from('shipments')
      .select('id, tracking_number')
      .eq('tracking_number', `TRK-B-${suffix}`);

    // Non deve trovare nulla — il filtro workspace_id esclude WS-B
    expect(data).toBeDefined();
    expect(data.length).toBe(0);
  });

  // ============================================================
  // TEST 10: Verifica che i due workspace siano effettivamente separati nel DB
  // ============================================================
  it('DB conferma: i due workspace hanno shipments disgiunti', async () => {
    if (skipTests) return;

    // Verifica diretta via supabaseAdmin (senza workspace filter)
    const { data: allShipments } = await supabaseAdmin
      .from('shipments')
      .select('id, workspace_id')
      .in('id', [shipmentAId, shipmentBId]);

    expect(allShipments).toHaveLength(2);

    const wsIds = allShipments.map((s: any) => s.workspace_id);
    expect(wsIds).toContain(wsAId);
    expect(wsIds).toContain(wsBId);

    // I due workspace_id devono essere diversi
    expect(wsAId).not.toBe(wsBId);
  });
});
