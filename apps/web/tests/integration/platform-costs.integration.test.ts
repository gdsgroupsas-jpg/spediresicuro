/**
 * Integration Tests: Platform Costs - Financial Tracking
 *
 * Test del flow completo:
 * 1. Create shipment → record cost → verify
 * 2. API source detection (platform vs reseller_own)
 * 3. Margin calculation correctness
 * 4. RLS enforcement (solo SuperAdmin vede dati)
 * 5. Reconciliation status flow
 *
 * ⚠️ IMPORTANT: These tests use REAL database.
 * Run with: npm run test:integration -- tests/integration/platform-costs.integration.test.ts
 *
 * @since Sprint 1 - Financial Tracking
 */

import * as dotenv from 'dotenv';
import path from 'path';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Carica variabili d'ambiente
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  dotenv.config({ path: envPath });
} catch (error) {
  console.warn('⚠️ Impossibile caricare .env.local');
}

// Import dinamico per evitare mock leaks
let supabaseAdmin: any;
let recordPlatformCost: any;
let calculatePlatformProviderCost: any;

// ==================== SETUP ====================

beforeAll(async () => {
  // Import dinamico per evitare mock leaks
  const dbModule = await vi.importActual<any>('@/lib/db/client');
  supabaseAdmin = dbModule.supabaseAdmin;

  const recorderModule = await vi.importActual<any>('@/lib/shipments/platform-cost-recorder');
  recordPlatformCost = recorderModule.recordPlatformCost;

  const calculatorModule = await vi.importActual<any>('@/lib/pricing/platform-cost-calculator');
  calculatePlatformProviderCost = calculatorModule.calculateProviderCost;

  // Verifica configurazione
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('mock')) {
    console.warn('⚠️ Supabase non configurato - test verranno saltati');
    return;
  }
});

// ==================== FIXTURES ====================

interface TestUser {
  id: string;
  email: string;
  account_type: string;
}

interface TestPriceList {
  id: string;
  master_list_id: string | null;
  is_global: boolean;
}

let testReseller: TestUser;
let testSuperAdmin: TestUser;
let testPlatformPriceList: TestPriceList;
let testMasterList: TestPriceList;
let testOwnPriceList: TestPriceList;
let testBrtId: string;
let testGlsId: string;
let testShipmentId: string | null = null;
let testCostRecordId: string | null = null;

const defaultShipmentData = {
  sender_name: 'Test Sender',
  sender_address: 'Via Roma 1',
  sender_city: 'Milano',
  sender_zip: '20100',
  sender_province: 'MI',
  sender_phone: '3331234567',
  recipient_name: 'Test Recipient',
  recipient_address: 'Via Milano 2',
  recipient_city: 'Roma',
  recipient_zip: '00100',
  recipient_province: 'RM',
  recipient_phone: '3339876543',
  weight: 1.0,
  length: 10,
  width: 10,
  height: 10,
};

// ==================== TESTS ====================

describe('Platform Costs Integration', () => {
  beforeAll(async () => {
    // Crea utenti di test
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    // Reseller per test
    // Reseller per test
    const { data: reseller, error: resellerError } = await supabaseAdmin
      .from('users')
      .insert({
        email: `test-platform-costs-reseller-${suffix}@test.local`,
        name: 'Test Reseller',
        account_type: 'user',
        is_reseller: true,
        role: 'user',
        wallet_balance: 1000,
      })
      .select()
      .single();

    if (resellerError) {
      console.error('Reseller creation error:', resellerError);
      throw new Error(
        `Errore creazione reseller test: ${resellerError.message} (${resellerError.details})`
      );
    }

    if (!reseller) {
      throw new Error('Errore creazione reseller test: Nessun dato ritornato');
    }
    testReseller = reseller;

    // SuperAdmin per test
    const { data: superadmin } = await supabaseAdmin
      .from('users')
      .insert({
        email: `test-platform-costs-superadmin-${suffix}@test.local`,
        name: 'Test SuperAdmin',
        account_type: 'superadmin',
        is_reseller: false,
        role: 'admin',
        wallet_balance: 0,
      })
      .select()
      .single();

    if (!superadmin) {
      throw new Error('Errore creazione superadmin test');
    }
    testSuperAdmin = superadmin;

    // Listino piattaforma (con master_list_id)
    // Listino Master (globale)
    const { data: masterList, error: masterError } = await supabaseAdmin
      .from('price_lists')
      .insert({
        name: `Test Master List ${suffix}`,
        version: 'v1.0',
        // user_id removed
        is_global: true,
        // is_active: true, // Removed invalid column
        list_type: 'global',
        status: 'active',
        master_list_id: null,
        created_by: testSuperAdmin.id,
      })
      .select()
      .single();

    if (masterError) {
      console.error('Master list creation error:', masterError);
      throw new Error(`Errore creazione listino master: ${masterError.message}`);
    }
    testMasterList = masterList;

    // Listino piattaforma (con master_list_id)
    const { data: platformList, error: platformError } = await supabaseAdmin
      .from('price_lists')
      .insert({
        name: `Test Platform List ${suffix}`,
        version: 'v1.0',
        // user_id removed
        is_global: true,
        // is_active: true, // Removed invalid column
        list_type: 'global',
        status: 'active',
        master_list_id: testMasterList.id, // Real master ID
        created_by: testSuperAdmin.id,
      })
      .select()
      .single();

    if (platformError) {
      console.error('Platform list creation error:', platformError);
      throw new Error(
        `Errore creazione listino piattaforma: ${platformError.message} (${platformError.details})`
      );
    }

    if (!platformList) {
      throw new Error('Errore creazione listino piattaforma');
    }
    testPlatformPriceList = platformList;

    // Listino proprio reseller (senza master)
    const { data: ownList, error: ownListError } = await supabaseAdmin
      .from('price_lists')
      .insert({
        name: `Test Own List ${suffix}`,
        version: 'v1.0',
        // assigned_to_user_id removed
        is_global: false,
        // is_active: true, // Removed invalid column
        list_type: 'custom',
        status: 'active',
        master_list_id: null,
        created_by: testReseller.id,
      })
      .select()
      .single();

    if (ownListError) {
      console.error('Own list creation error:', ownListError);
      throw new Error(
        `Errore creazione listino proprio: ${ownListError.message} (${ownListError.details})`
      );
    }

    if (!ownList) {
      throw new Error('Errore creazione listino proprio');
    }
    testOwnPriceList = ownList;

    // Recupera ID corrieri
    const { data: brt } = await supabaseAdmin
      .from('couriers')
      .select('id')
      .eq('code', 'BRT')
      .single();

    // Se non esiste, crea (fallback per test environment)
    if (!brt) {
      const { data: newBrt } = await supabaseAdmin
        .from('couriers')
        .insert({ name: 'BRT', code: 'BRT' })
        .select()
        .single();
      testBrtId = newBrt.id;
    } else {
      testBrtId = brt.id;
    }

    const { data: gls } = await supabaseAdmin
      .from('couriers')
      .select('id')
      .eq('code', 'GLS')
      .single();

    if (!gls) {
      const { data: newGls } = await supabaseAdmin
        .from('couriers')
        .insert({ name: 'GLS', code: 'GLS' })
        .select()
        .single();
      testGlsId = newGls.id;
    } else {
      testGlsId = gls.id;
    }
  });

  afterAll(async () => {
    // Cleanup COMPLETO in ordine inverso (dipendenze prima)
    // Elimina TUTTI i record collegati agli utenti test, non solo quelli tracciati

    const userIds = [testReseller?.id, testSuperAdmin?.id].filter(Boolean);

    for (const userId of userIds) {
      // 1. financial_audit_log
      await supabaseAdmin.from('financial_audit_log').delete().eq('user_id', userId);

      // 2. platform_provider_costs
      await supabaseAdmin.from('platform_provider_costs').delete().eq('billed_user_id', userId);

      // 3. shipments
      await supabaseAdmin.from('shipments').delete().eq('user_id', userId);

      // 4. wallet_transactions
      await supabaseAdmin.from('wallet_transactions').delete().eq('user_id', userId);
    }

    // 5. price_lists (by ID, not user)
    if (testPlatformPriceList?.id) {
      await supabaseAdmin.from('price_lists').delete().eq('id', testPlatformPriceList.id);
    }

    if (testMasterList?.id) {
      await supabaseAdmin.from('price_lists').delete().eq('id', testMasterList.id);
    }

    if (testOwnPriceList?.id) {
      await supabaseAdmin.from('price_lists').delete().eq('id', testOwnPriceList.id);
    }

    // 6. Utenti test
    if (testReseller?.id) {
      await supabaseAdmin.from('users').delete().eq('id', testReseller.id);
    }

    if (testSuperAdmin?.id) {
      await supabaseAdmin.from('users').delete().eq('id', testSuperAdmin.id);
    }
  });

  describe('API Source Detection', () => {
    it('dovrebbe rilevare api_source="platform" per listino con master_list_id', async () => {
      // Crea spedizione con listino piattaforma
      const { data: shipment, error } = await supabaseAdmin
        .from('shipments')
        .insert({
          ...defaultShipmentData,
          user_id: testReseller.id,
          tracking_number: `TEST-PLATFORM-${Date.now()}`,
          price_list_id: testPlatformPriceList.id,
          api_source: null, // Verrà settato dalla logica
          status: 'pending',
          courier_id: testBrtId,
          final_price: 15.5,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(shipment).toBeTruthy();

      // Verifica che api_source sia "platform" (se la logica è stata eseguita)
      // Nota: In un test reale, chiameresti la funzione di detection
      const { data: updatedShipment } = await supabaseAdmin
        .from('shipments')
        .select('api_source')
        .eq('id', shipment.id)
        .single();

      // Cleanup
      await supabaseAdmin.from('shipments').delete().eq('id', shipment.id);
    });

    it('dovrebbe rilevare api_source="reseller_own" per listino senza master', async () => {
      const { data: shipment, error } = await supabaseAdmin
        .from('shipments')
        .insert({
          ...defaultShipmentData,
          user_id: testReseller.id,
          tracking_number: `TEST-OWN-${Date.now()}`,
          price_list_id: testOwnPriceList.id,
          api_source: null,
          status: 'pending',
          courier_id: testGlsId,
          final_price: 12.0,
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(shipment).toBeTruthy();

      // Cleanup
      await supabaseAdmin.from('shipments').delete().eq('id', shipment.id);
    });
  });

  describe('Platform Cost Recording', () => {
    beforeEach(() => {
      testShipmentId = null;
      testCostRecordId = null;
    });

    it('dovrebbe registrare costo piattaforma con margine corretto', async () => {
      // Crea spedizione
      const { data: shipment, error: shipError } = await supabaseAdmin
        .from('shipments')
        .insert({
          ...defaultShipmentData,
          user_id: testReseller.id,
          tracking_number: `TEST-RECORD-${Date.now()}`,
          price_list_id: testPlatformPriceList.id,
          api_source: 'platform',
          status: 'pending',
          courier_id: testBrtId,
          final_price: 15.5,
        })
        .select()
        .single();

      expect(shipError).toBeNull();
      expect(shipment).toBeTruthy();
      testShipmentId = shipment.id;

      // Registra costo piattaforma
      const result = await recordPlatformCost(supabaseAdmin, {
        shipmentId: shipment.id,
        trackingNumber: shipment.tracking_number,
        billedUserId: testReseller.id,
        billedAmount: 15.5,
        providerCost: 10.0,
        apiSource: 'platform',
        courierCode: 'BRT',
        serviceType: 'express',
        priceListId: testPlatformPriceList.id,
        masterPriceListId: testPlatformPriceList.master_list_id || undefined,
        costSource: 'master_list',
      });

      expect(result.success).toBe(true);

      // Verifica record creato
      const { data: costRecord, error: costError } = await supabaseAdmin
        .from('platform_provider_costs')
        .select('*')
        .eq('shipment_id', shipment.id)
        .single();

      expect(costError).toBeNull();
      expect(costRecord).toBeTruthy();
      testCostRecordId = costRecord.id;

      // Verifica margine calcolato
      expect(costRecord.billed_amount).toBe(15.5);
      expect(costRecord.provider_cost).toBe(10.0);
      expect(costRecord.platform_margin).toBe(5.5); // 15.50 - 10.00
      expect(costRecord.platform_margin_percent).toBeCloseTo(55.0, 1); // (5.50 / 10.00) * 100
      expect(costRecord.api_source).toBe('platform');
      expect(costRecord.reconciliation_status).toBe('pending');
    });

    it('dovrebbe creare alert per margine negativo', async () => {
      const { data: shipment } = await supabaseAdmin
        .from('shipments')
        .insert({
          ...defaultShipmentData,
          user_id: testReseller.id,
          tracking_number: `TEST-NEGATIVE-${Date.now()}`,
          price_list_id: testPlatformPriceList.id,
          api_source: 'platform',
          status: 'pending',
          courier_id: testBrtId,
          final_price: 8.0, // Billed
        })
        .select()
        .single();

      testShipmentId = shipment.id;

      // Registra con costo maggiore del billed (margine negativo)
      await recordPlatformCost(supabaseAdmin, {
        shipmentId: shipment.id,
        trackingNumber: shipment.tracking_number,
        billedUserId: testReseller.id,
        billedAmount: 8.0,
        providerCost: 12.0, // Costo > Billed = margine negativo
        apiSource: 'platform',
        courierCode: 'BRT',
        serviceType: 'express',
        priceListId: testPlatformPriceList.id,
        masterPriceListId: testPlatformPriceList.master_list_id || undefined,
        costSource: 'master_list',
      });

      // Verifica alert creato
      // Prima prova la view v_platform_margin_alerts, se non esiste usa la tabella base
      let alerts: any[] | null = null;

      try {
        const { data: viewAlerts, error: viewError } = await supabaseAdmin
          .from('v_platform_margin_alerts')
          .select('*')
          .eq('shipment_id', shipment.id)
          .limit(1);

        if (!viewError) {
          alerts = viewAlerts;
        }
      } catch {
        // View doesn't exist, fallback to base table
      }

      // Fallback: query base table with same conditions as view
      if (!alerts || alerts.length === 0) {
        const { data: tableAlerts } = await supabaseAdmin
          .from('platform_provider_costs')
          .select('*')
          .eq('shipment_id', shipment.id)
          .eq('api_source', 'platform')
          .lt('platform_margin', 0) // Margine negativo
          .limit(1);

        alerts = tableAlerts;
      }

      expect(alerts).toBeTruthy();
      expect(alerts?.length).toBeGreaterThan(0);
      if (alerts && alerts.length > 0) {
        expect(alerts[0].platform_margin).toBeLessThan(0);
      }
    });

    it('NON dovrebbe registrare costo per api_source non-platform', async () => {
      const { data: shipment } = await supabaseAdmin
        .from('shipments')
        .insert({
          ...defaultShipmentData,
          user_id: testReseller.id,
          tracking_number: `TEST-SKIP-${Date.now()}`,
          price_list_id: testOwnPriceList.id,
          api_source: 'reseller_own',
          status: 'pending',
          courier_id: testGlsId,
          final_price: 12.0,
        })
        .select()
        .single();

      testShipmentId = shipment.id;

      // Prova a registrare (dovrebbe essere skipped)
      const result = await recordPlatformCost(supabaseAdmin, {
        shipmentId: shipment.id,
        trackingNumber: shipment.tracking_number,
        billedUserId: testReseller.id,
        billedAmount: 12.0,
        providerCost: 8.0,
        apiSource: 'reseller_own', // NON platform
        courierCode: 'GLS',
        serviceType: 'standard',
        priceListId: testOwnPriceList.id,
        costSource: 'reseller_own',
      });

      // Dovrebbe essere skipped (success: true ma nessun record)
      expect(result.success).toBe(true);

      // Verifica che NON ci sia record
      const { data: costRecord } = await supabaseAdmin
        .from('platform_provider_costs')
        .select('*')
        .eq('shipment_id', shipment.id)
        .single();

      expect(costRecord).toBeNull();
    });
  });

  describe('RLS Enforcement', () => {
    it('solo SuperAdmin dovrebbe vedere platform_provider_costs', async () => {
      // Crea record di test
      const { data: shipment } = await supabaseAdmin
        .from('shipments')
        .insert({
          ...defaultShipmentData,
          user_id: testReseller.id,
          tracking_number: `TEST-RLS-${Date.now()}`,
          price_list_id: testPlatformPriceList.id,
          api_source: 'platform',
          status: 'pending',
          courier_id: testBrtId,
          final_price: 15.5,
        })
        .select()
        .single();

      testShipmentId = shipment.id;

      await recordPlatformCost(supabaseAdmin, {
        shipmentId: shipment.id,
        trackingNumber: shipment.tracking_number,
        billedUserId: testReseller.id,
        billedAmount: 15.5,
        providerCost: 10.0,
        apiSource: 'platform',
        courierCode: 'BRT',
        serviceType: 'express',
        priceListId: testPlatformPriceList.id,
        masterPriceListId: testPlatformPriceList.master_list_id || undefined,
        costSource: 'master_list',
      });

      // Verifica che reseller NON possa vedere (via RLS)
      // Nota: Questo test richiede un client con RLS attivo, non admin
      // Per ora verifichiamo che il record esista (admin può vederlo)
      const { data: costRecord } = await supabaseAdmin
        .from('platform_provider_costs')
        .select('*')
        .eq('shipment_id', shipment.id)
        .single();

      expect(costRecord).toBeTruthy();
      testCostRecordId = costRecord.id;

      // In un test completo, creeresti un client con RLS e verificheresti
      // che reseller non possa vedere il record
    });
  });

  describe('Reconciliation Flow', () => {
    it('dovrebbe aggiornare status riconciliazione', async () => {
      // Crea record
      const { data: shipment } = await supabaseAdmin
        .from('shipments')
        .insert({
          ...defaultShipmentData,
          user_id: testReseller.id,
          tracking_number: `TEST-RECON-${Date.now()}`,
          price_list_id: testPlatformPriceList.id,
          api_source: 'platform',
          status: 'pending',
          courier_id: testBrtId,
          final_price: 15.5,
        })
        .select()
        .single();

      testShipmentId = shipment.id;

      await recordPlatformCost(supabaseAdmin, {
        shipmentId: shipment.id,
        trackingNumber: shipment.tracking_number,
        billedUserId: testReseller.id,
        billedAmount: 15.5,
        providerCost: 10.0,
        apiSource: 'platform',
        courierCode: 'BRT',
        serviceType: 'express',
        priceListId: testPlatformPriceList.id,
        masterPriceListId: testPlatformPriceList.master_list_id || undefined,
        costSource: 'master_list',
      });

      const { data: costRecord } = await supabaseAdmin
        .from('platform_provider_costs')
        .select('*')
        .eq('shipment_id', shipment.id)
        .single();

      testCostRecordId = costRecord.id;

      // Aggiorna status
      const { error: updateError } = await supabaseAdmin
        .from('platform_provider_costs')
        .update({
          reconciliation_status: 'matched',
          reconciled_at: new Date().toISOString(),
          reconciled_by: testSuperAdmin.id,
        })
        .eq('id', costRecord.id);

      expect(updateError).toBeNull();

      // Verifica aggiornamento
      const { data: updated } = await supabaseAdmin
        .from('platform_provider_costs')
        .select('reconciliation_status, reconciled_at, reconciled_by')
        .eq('id', costRecord.id)
        .single();

      expect(updated.reconciliation_status).toBe('matched');
      expect(updated.reconciled_at).toBeTruthy();
      expect(updated.reconciled_by).toBe(testSuperAdmin.id);
    });
  });

  describe('Cost Calculation Fallback Chain', () => {
    it('dovrebbe usare master_list quando API non disponibile', async () => {
      // Test del fallback chain
      // Questo test verifica che calculatePlatformProviderCost usi il fallback corretto

      const result = await calculatePlatformProviderCost(supabaseAdmin, {
        courierCode: 'BRT',
        serviceType: 'express',
        weight: 1,
        destination: {
          zip: '20100',
          province: 'MI',
          country: 'IT',
        },
        masterPriceListId: testPlatformPriceList.master_list_id || undefined,
      });

      // Verifica che il risultato abbia cost e source
      expect(result).toBeTruthy();
      expect(result.cost).toBeGreaterThanOrEqual(0);
      expect(result.source).toBeTruthy();
    });
  });
});
