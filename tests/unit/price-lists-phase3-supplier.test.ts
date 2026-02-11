/**
 * Test Fase 3: Listini Fornitore - Server Actions & Permessi
 *
 * Verifica:
 * - Server Actions per listini fornitore (Reseller/BYOC)
 * - Permessi e isolamento listini
 * - CRUD operations per Reseller e BYOC
 * - Visibilita': Reseller vede listini globali + propri supplier
 *
 * NOTA: Questo test verifica principalmente la logica delle Server Actions
 * usando mock per l'autenticazione. Per test end-to-end completi, vedere
 * tests/integration/price-lists-phase3-integration.test.ts
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import * as dotenv from 'dotenv';
import path from 'path';

// Carica variabili d'ambiente da .env.local
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  dotenv.config({ path: envPath });
  console.log("✅ Variabili d'ambiente caricate da .env.local");
} catch (error) {
  console.warn('⚠️  Impossibile caricare .env.local, uso valori mock');
}

// Setup variabili d'ambiente mock se non presenti
if (
  !process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL.includes('mock')
) {
  console.warn('⚠️  Usando valori mock per Supabase');
  process.env.NEXT_PUBLIC_SUPABASE_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://mock.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'mock-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY =
    process.env.SUPABASE_SERVICE_ROLE_KEY || 'mock-service-key';
} else {
  console.log('✅ Supabase configurato correttamente');
  console.log(`   URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30)}...`);
}

import { supabaseAdmin } from '@/lib/db/client';
import {
  createSupplierPriceListAction,
  listSupplierPriceListsAction,
  getSupplierPriceListForCourierAction,
  updatePriceListAction,
  deletePriceListAction,
  listPriceListsAction,
} from '@/actions/price-lists';
import { getAvailableCouriersForUser } from '@/lib/db/price-lists';

// Mock getSafeAuth per test (le Server Actions usano getSafeAuth, non auth diretto)
vi.mock('@/lib/safe-auth', () => ({
  getSafeAuth: vi.fn(),
}));

import { getSafeAuth } from '@/lib/safe-auth';

describe('Fase 3: Listini Fornitore - Server Actions', () => {
  let resellerUserId: string;
  let byocUserId: string;
  let adminUserId: string;
  let testCourierId: string;
  let createdPriceLists: string[] = [];
  let createdConfigs: string[] = [];
  // Salva riferimento originale per evitare ricorsione nei mock
  let originalSupabaseFrom: typeof supabaseAdmin.from;

  beforeAll(async () => {
    // Salva riferimento originale prima di qualsiasi mock
    originalSupabaseFrom = supabaseAdmin.from.bind(supabaseAdmin);

    // Verifica se Supabase è configurato
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('mock')) {
      console.warn('⚠️  Supabase non configurato - alcuni test verranno saltati');
      // Usa ID mock per i test
      resellerUserId = 'mock-reseller-id';
      byocUserId = 'mock-byoc-id';
      adminUserId = 'mock-admin-id';
      testCourierId = 'mock-courier-id';
      return;
    }

    try {
      // Crea utenti di test
      const { data: reseller, error: resellerError } = await supabaseAdmin
        .from('users')
        .insert({
          email: `test-reseller-phase3-${Date.now()}@test.local`,
          name: 'Test Reseller Phase 3',
          account_type: 'user',
          is_reseller: true,
          role: 'user',
          wallet_balance: 0,
        })
        .select()
        .single();

      const { data: byoc, error: byocError } = await supabaseAdmin
        .from('users')
        .insert({
          email: `test-byoc-phase3-${Date.now()}@test.local`,
          name: 'Test BYOC Phase 3',
          account_type: 'byoc',
          is_reseller: false,
          role: 'user',
          wallet_balance: 0,
        })
        .select()
        .single();

      const { data: admin, error: adminError } = await supabaseAdmin
        .from('users')
        .insert({
          email: `test-admin-phase3-${Date.now()}@test.local`,
          name: 'Test Admin Phase 3',
          account_type: 'admin',
          is_reseller: false,
          role: 'admin',
          wallet_balance: 0,
        })
        .select()
        .single();

      if (resellerError || byocError || adminError || !reseller || !byoc || !admin) {
        console.warn('⚠️  Errore creazione utenti di test:', {
          resellerError,
          byocError,
          adminError,
        });
        // Usa ID mock
        resellerUserId = 'mock-reseller-id';
        byocUserId = 'mock-byoc-id';
        adminUserId = 'mock-admin-id';
        testCourierId = 'mock-courier-id';
        return;
      }

      resellerUserId = reseller.id;
      byocUserId = byoc.id;
      adminUserId = admin.id;

      // Crea corrieri di test
      const { data: courier1, error: courierError } = await supabaseAdmin
        .from('couriers')
        .insert({
          name: 'Test Courier Phase 3',
          code: 'TEST3',
          is_active: true,
        })
        .select()
        .single();

      if (courierError || !courier1) {
        console.warn('⚠️  Errore creazione corriere di test:', courierError);
        testCourierId = 'mock-courier-id';
        return;
      }

      testCourierId = courier1.id;
    } catch (error) {
      console.warn('⚠️  Errore setup test:', error);
      // Usa ID mock
      resellerUserId = 'mock-reseller-id';
      byocUserId = 'mock-byoc-id';
      adminUserId = 'mock-admin-id';
      testCourierId = 'mock-courier-id';
    }
  });

  afterAll(async () => {
    // Skip cleanup se usiamo ID mock
    if (resellerUserId.startsWith('mock-')) {
      return;
    }

    try {
      // Cleanup: elimina listini creati
      if (createdPriceLists.length > 0) {
        await supabaseAdmin.from('price_lists').delete().in('id', createdPriceLists);
      }

      // Cleanup: elimina configurazioni create
      if (createdConfigs.length > 0) {
        await supabaseAdmin.from('courier_configs').delete().in('id', createdConfigs);
      }

      // Elimina utenti di test
      await supabaseAdmin
        .from('users')
        .delete()
        .in('id', [resellerUserId, byocUserId, adminUserId]);

      // Elimina corrieri di test
      await supabaseAdmin.from('couriers').delete().eq('id', testCourierId);
    } catch (error) {
      console.warn('⚠️  Errore cleanup test:', error);
    }
  });

  describe('createSupplierPriceListAction', () => {
    it('Reseller può creare listino fornitore', async () => {
      if (resellerUserId.startsWith('mock-')) {
        console.log('⏭️  Test saltato: Supabase non configurato');
        return;
      }
      // Mock auth per Reseller
      (getSafeAuth as any).mockResolvedValue({
        actor: { email: `test-reseller-phase3-${Date.now()}@test.local` },
      });

      const mockPriceListId = `test-pricelist-${Date.now()}`;

      // Mock completo per users e price_lists
      vi.spyOn(supabaseAdmin, 'from').mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: resellerUserId,
                    account_type: 'user',
                    is_reseller: true,
                  },
                }),
              }),
            }),
          } as any;
        }
        if (table === 'price_lists') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: mockPriceListId,
                    name: 'Listino Fornitore Test Reseller',
                    version: '1.0.0',
                    status: 'draft',
                    list_type: 'supplier',
                    is_global: false,
                    courier_id: testCourierId,
                    created_by: resellerUserId,
                  },
                }),
              }),
            }),
          } as any;
        }
        // Per altre tabelle, usa il riferimento originale
        return originalSupabaseFrom(table);
      });

      const result = await createSupplierPriceListAction({
        name: 'Listino Fornitore Test Reseller',
        version: '1.0.0',
        status: 'draft',
        courier_id: testCourierId,
      });

      expect(result.success).toBe(true);
      expect(result.priceList).toBeDefined();
      if (result.priceList) {
        expect(result.priceList.list_type).toBe('supplier');
        expect(result.priceList.is_global).toBe(false);
        if (result.priceList.id) {
          createdPriceLists.push(result.priceList.id);
        }
      }
    });

    it('BYOC può creare listino fornitore', async () => {
      if (byocUserId.startsWith('mock-')) {
        console.log('⏭️  Test saltato: Supabase non configurato');
        return;
      }
      // Mock auth per BYOC
      (getSafeAuth as any).mockResolvedValue({
        actor: { email: `test-byoc-phase3-${Date.now()}@test.local` },
      });

      const mockPriceListId = `test-pricelist-byoc-${Date.now()}`;

      // Mock completo per users e price_lists
      vi.spyOn(supabaseAdmin, 'from').mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: byocUserId,
                    account_type: 'byoc',
                    is_reseller: false,
                  },
                }),
              }),
            }),
          } as any;
        }
        if (table === 'price_lists') {
          return {
            insert: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: mockPriceListId,
                    name: 'Listino Fornitore Test BYOC',
                    version: '1.0.0',
                    status: 'draft',
                    list_type: 'supplier',
                    is_global: false,
                    courier_id: testCourierId,
                    created_by: byocUserId,
                  },
                }),
              }),
            }),
          } as any;
        }
        return originalSupabaseFrom(table);
      });

      const result = await createSupplierPriceListAction({
        name: 'Listino Fornitore Test BYOC',
        version: '1.0.0',
        status: 'draft',
        courier_id: testCourierId,
      });

      expect(result.success).toBe(true);
      expect(result.priceList).toBeDefined();
      if (result.priceList?.id) {
        createdPriceLists.push(result.priceList.id);
      }
    });

    it('Utente normale NON può creare listino fornitore', async () => {
      // Mock auth per utente normale
      (getSafeAuth as any).mockResolvedValue({
        actor: { email: `test-user-phase3-${Date.now()}@test.local` },
      });

      // Mock recupero utente normale
      vi.spyOn(supabaseAdmin, 'from').mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'user-normal-id',
                    account_type: 'user',
                    is_reseller: false,
                  },
                }),
              }),
            }),
          } as any;
        }
        return originalSupabaseFrom(table);
      });

      const result = await createSupplierPriceListAction({
        name: 'Listino Fornitore Test User',
        version: '1.0.0',
        status: 'draft',
        courier_id: testCourierId,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Solo Reseller e BYOC');
    });
  });

  describe('listSupplierPriceListsAction', () => {
    it('Reseller vede solo i propri listini fornitore', async () => {
      if (resellerUserId.startsWith('mock-')) {
        console.log('⏭️  Test saltato: Supabase non configurato');
        return;
      }

      const mockPriceListId = `test-pricelist-list-${Date.now()}`;

      // Mock auth per Reseller
      (getSafeAuth as any).mockResolvedValue({
        actor: { email: `test-reseller-phase3-${Date.now()}@test.local` },
      });

      // Mock completo per users e price_lists
      vi.spyOn(supabaseAdmin, 'from').mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: resellerUserId,
                    account_type: 'user',
                    is_reseller: true,
                  },
                }),
              }),
            }),
          } as any;
        }
        if (table === 'price_lists') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: mockPriceListId,
                        name: 'Listino Reseller Test',
                        version: '1.0.0',
                        status: 'draft',
                        list_type: 'supplier',
                        is_global: false,
                        courier_id: testCourierId,
                        created_by: resellerUserId,
                      },
                    ],
                  }),
                }),
              }),
            }),
          } as any;
        }
        return originalSupabaseFrom(table);
      });

      const result = await listSupplierPriceListsAction();

      expect(result.success).toBe(true);
      expect(result.priceLists).toBeDefined();
      if (result.priceLists) {
        // Verifica che tutti i listini siano del Reseller
        result.priceLists.forEach((pl) => {
          expect(pl.created_by).toBe(resellerUserId);
          expect(pl.list_type).toBe('supplier');
        });
      }
    });
  });

  describe('Visibilita Listini Globali', () => {
    it('Reseller vede sia propri listini supplier che listini globali', async () => {
      if (resellerUserId.startsWith('mock-')) {
        console.log('⏭️  Test saltato: Supabase non configurato');
        return;
      }

      // Mock auth per Reseller
      (getSafeAuth as any).mockResolvedValue({
        actor: { email: `test-reseller-phase3-${Date.now()}@test.local` },
      });

      // Mock RPC get_user_price_lists - restituisce solo listini creati dal reseller
      const mockRpcData = [
        {
          id: 'test-pricelist-supplier',
          name: 'Listino Supplier Test',
          version: '1.0.0',
          status: 'draft',
          list_type: 'supplier',
          is_global: false,
          courier_id: testCourierId,
          created_by: resellerUserId,
        },
      ];

      vi.spyOn(supabaseAdmin, 'rpc').mockResolvedValue({
        data: mockRpcData,
        error: null,
      } as any);

      // Listini globali del superadmin che il reseller deve poter vedere
      const mockGlobalLists = [
        {
          id: 'global-pricelist-1',
          name: 'Listino Globale GLS',
          version: '1.0.0',
          status: 'active',
          list_type: 'global',
          is_global: true,
          courier_id: 'gls-courier-id',
          created_by: adminUserId,
        },
      ];

      // Mock from() per le query supplementari
      vi.spyOn(supabaseAdmin, 'from').mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: resellerUserId,
                    account_type: 'user',
                    is_reseller: true,
                    assigned_price_list_id: null,
                  },
                }),
              }),
            }),
          } as any;
        }
        if (table === 'price_list_assignments') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                is: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          } as any;
        }
        if (table === 'workspace_members') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          } as any;
        }
        if (table === 'price_lists') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                data: mockGlobalLists,
                error: null,
              }),
              in: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            }),
          } as any;
        }
        if (table === 'couriers') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { id: testCourierId, name: 'Test Courier', code: 'TEST' },
                  { id: 'gls-courier-id', name: 'GLS', code: 'GLS' },
                ],
                error: null,
              }),
            }),
          } as any;
        }
        return originalSupabaseFrom(table);
      });

      const result = await listPriceListsAction();

      expect(result.success).toBe(true);
      expect(result.priceLists).toBeDefined();
      expect(result.priceLists!.length).toBeGreaterThanOrEqual(2);

      // Verifica che contenga sia supplier propri che globali
      const supplierLists = result.priceLists!.filter((pl: any) => pl.list_type === 'supplier');
      const globalLists = result.priceLists!.filter((pl: any) => pl.is_global === true);

      expect(supplierLists.length).toBeGreaterThanOrEqual(1);
      expect(globalLists.length).toBeGreaterThanOrEqual(1);
      expect(globalLists[0].name).toBe('Listino Globale GLS');
    });
  });

  describe('getAvailableCouriersForUser', () => {
    it('Restituisce corrieri disponibili per utente con configurazioni API', async () => {
      if (resellerUserId.startsWith('mock-')) {
        console.log('⏭️  Test saltato: Supabase non configurato');
        return;
      }
      // Crea configurazione API per Reseller
      const { data: config } = await supabaseAdmin
        .from('courier_configs')
        .insert({
          owner_user_id: resellerUserId,
          provider_id: 'test-provider',
          contract_mapping: {
            GLS: 'GLS123',
            BRT: 'BRT456',
          },
          is_active: true,
        })
        .select()
        .single();

      if (config?.id) {
        createdConfigs.push(config.id);
      }

      const couriers = await getAvailableCouriersForUser(resellerUserId);

      expect(couriers).toBeDefined();
      expect(Array.isArray(couriers)).toBe(true);
      // Verifica che ci siano corrieri se la configurazione esiste
      if (config) {
        expect(couriers.length).toBeGreaterThan(0);
        const courierNames = couriers.map((c) => c.courierName);
        expect(courierNames).toContain('GLS');
        expect(courierNames).toContain('BRT');
      }
    });

    it('Restituisce array vuoto se utente non ha configurazioni', async () => {
      if (resellerUserId.startsWith('mock-')) {
        console.log('⏭️  Test saltato: Supabase non configurato');
        return;
      }

      // Rimuovi mock per questo test
      vi.restoreAllMocks();

      const couriers = await getAvailableCouriersForUser('user-senza-config-12345');

      expect(couriers).toBeDefined();
      expect(Array.isArray(couriers)).toBe(true);
      expect(couriers.length).toBe(0);
    });
  });
});
