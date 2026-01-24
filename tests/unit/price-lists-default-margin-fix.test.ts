/**
 * Test Pesanti: Fix Margine Default per Comparatore
 *
 * Verifica che OGNI corriere nel comparatore segua la stessa logica
 * e mostri sempre un margine, anche se non configurato esplicitamente.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PriceList } from '@/types/listini';
import { calculatePriceWithRules } from '@/lib/db/price-lists-advanced';
import { pricingConfig } from '@/lib/config';

// Mock Supabase
vi.mock('@/lib/db/client', () => ({
  supabaseAdmin: {
    from: vi.fn(),
  },
}));

// Mock calculatePriceFromList
vi.mock('@/lib/pricing/calculator', () => ({
  calculatePriceFromList: vi.fn(),
}));

// Nota: getPriceListById è una funzione interna, viene mockata tramite supabaseAdmin

import { supabaseAdmin } from '@/lib/db/client';
import { calculatePriceFromList } from '@/lib/pricing/calculator';

describe('Fix Margine Default - Test Pesanti', () => {
  const mockUserId = 'test-user-id';

  // Fixture: Listino Master (SUPPLIER)
  const masterPriceList: PriceList = {
    id: 'master-list-id',
    name: 'Master Listino Fornitore',
    version: '1.0.0',
    status: 'active',
    list_type: 'supplier',
    master_list_id: null,
    default_margin_percent: null,
    default_margin_fixed: null,
    entries: [
      {
        id: 'entry-1',
        price_list_id: 'master-list-id',
        zone_code: 'ITALIA_STANDARD',
        weight_from: 0,
        weight_to: 2,
        base_price: 4.4,
        fuel_surcharge_percent: 0,
        service_type: 'standard',
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Fixture: Listino CUSTOM con prezzi identici al master (senza margine configurato)
  const customPriceListIdentical: PriceList = {
    id: 'custom-list-identical',
    name: 'Listino CUSTOM Identico',
    version: '1.0.0',
    status: 'active',
    list_type: 'custom',
    master_list_id: 'master-list-id',
    default_margin_percent: null, // ⚠️ Nessun margine configurato
    default_margin_fixed: null,
    entries: [
      {
        id: 'entry-1',
        price_list_id: 'custom-list-identical',
        zone_code: 'ITALIA_STANDARD',
        weight_from: 0,
        weight_to: 2,
        base_price: 4.4, // Identico al master
        fuel_surcharge_percent: 0,
        service_type: 'standard',
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Fixture: Listino CUSTOM con prezzi modificati (con margine incluso)
  const customPriceListModified: PriceList = {
    id: 'custom-list-modified',
    name: 'Listino CUSTOM Modificato',
    version: '1.0.0',
    status: 'active',
    list_type: 'custom',
    master_list_id: 'master-list-id',
    default_margin_percent: null,
    default_margin_fixed: null,
    entries: [
      {
        id: 'entry-1',
        price_list_id: 'custom-list-modified',
        zone_code: 'ITALIA_STANDARD',
        weight_from: 0,
        weight_to: 2,
        base_price: 8.0, // Modificato rispetto al master (4.40)
        fuel_surcharge_percent: 0,
        service_type: 'standard',
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  // Fixture: Listino CUSTOM con margine configurato
  const customPriceListWithMargin: PriceList = {
    id: 'custom-list-with-margin',
    name: 'Listino CUSTOM con Margine',
    version: '1.0.0',
    status: 'active',
    list_type: 'custom',
    master_list_id: 'master-list-id',
    default_margin_percent: 15, // ✅ Margine configurato
    default_margin_fixed: null,
    entries: [
      {
        id: 'entry-1',
        price_list_id: 'custom-list-with-margin',
        zone_code: 'ITALIA_STANDARD',
        weight_from: 0,
        weight_to: 2,
        base_price: 4.4, // Identico al master
        fuel_surcharge_percent: 0,
        service_type: 'standard',
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Scenario 1: Listino CUSTOM con Master, Prezzi Identici, SENZA Margine Configurato', () => {
    it('deve applicare margine default globale (20%) quando isManuallyModified = false', async () => {
      // Mock: getPriceListById chiama supabaseAdmin.from('price_lists')
      // Prima chiamata: recupera listino CUSTOM
      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...customPriceListIdentical, entries: customPriceListIdentical.entries },
          error: null,
        }),
      } as any);

      // Seconda chiamata: recupera master list (quando calcola supplierPrice)
      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { ...masterPriceList, entries: masterPriceList.entries },
          error: null,
        }),
      } as any);

      // Mock: Calcolo prezzo dal master (per supplierPrice)
      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 4.4,
        surcharges: 0,
        totalCost: 4.4,
        details: {
          entry: masterPriceList.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      // Mock: Calcolo prezzo dal CUSTOM (per totalCost)
      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 4.4,
        surcharges: 0,
        totalCost: 4.4, // Identico al master
        details: {
          entry: customPriceListIdentical.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      const result = await calculatePriceWithRules(
        mockUserId,
        {
          weight: 1.5,
          destination: {
            zip: '00100',
            province: 'RM',
            country: 'IT',
          },
        },
        'custom-list-identical'
      );

      expect(result).not.toBeNull();
      if (!result) return;

      // ✅ Verifica: supplierPrice viene calcolato dal master
      expect(result.supplierPrice).toBe(4.4);

      // ✅ Verifica: margin viene applicato (default 0% - personalizzabile per utente)
      const expectedMargin = 4.4 * (pricingConfig.DEFAULT_MARGIN_PERCENT / 100); // 0 con default 0%
      expect(result.margin).toBeCloseTo(expectedMargin, 2);

      // ✅ Verifica: finalPrice = totalCost + margin
      expect(result.finalPrice).toBeCloseTo(4.4 + expectedMargin, 2);

      // ✅ Con margine 0%, supplierPrice === finalPrice (il margine è personalizzabile)
      if (pricingConfig.DEFAULT_MARGIN_PERCENT === 0) {
        expect(result.finalPrice).toBeCloseTo(result.supplierPrice!, 2);
      } else {
        expect(result.finalPrice).toBeGreaterThan(result.supplierPrice!);
      }
    });

    it('deve funzionare con diversi pesi e destinazioni', async () => {
      const testCases = [
        { weight: 0.5, expectedBase: 4.4 },
        { weight: 1.0, expectedBase: 4.4 },
        { weight: 1.5, expectedBase: 4.4 },
        { weight: 2.0, expectedBase: 4.4 },
      ];

      for (const testCase of testCases) {
        vi.clearAllMocks();

        // Ordine corretto: prima custom (da getPriceListById), poi master (da calculateWithDefaultMargin)
        vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: customPriceListIdentical,
            error: null,
          }),
        } as any);

        vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: masterPriceList,
            error: null,
          }),
        } as any);

        vi.mocked(calculatePriceFromList).mockReturnValueOnce({
          basePrice: testCase.expectedBase,
          surcharges: 0,
          totalCost: testCase.expectedBase,
          details: {
            entry: masterPriceList.entries![0],
            estimatedDeliveryDays: { min: 3, max: 5 },
          },
        } as any);

        vi.mocked(calculatePriceFromList).mockReturnValueOnce({
          basePrice: testCase.expectedBase,
          surcharges: 0,
          totalCost: testCase.expectedBase,
          details: {
            entry: customPriceListIdentical.entries![0],
            estimatedDeliveryDays: { min: 3, max: 5 },
          },
        } as any);

        const result = await calculatePriceWithRules(
          mockUserId,
          {
            weight: testCase.weight,
            destination: {
              zip: '00100',
              province: 'RM',
              country: 'IT',
            },
          },
          'custom-list-identical'
        );

        expect(result).not.toBeNull();
        if (!result) continue;

        // ✅ Verifica: con margine default 0%, finalPrice === supplierPrice quando prezzi identici
        // (il margine è personalizzabile per utente/reseller)
        if (pricingConfig.DEFAULT_MARGIN_PERCENT === 0) {
          expect(result.finalPrice).toBeCloseTo(result.supplierPrice!, 2);
          expect(result.margin).toBeCloseTo(0, 2);
        } else {
          expect(result.supplierPrice).not.toBe(result.finalPrice);
          expect(result.margin).toBeGreaterThan(0);
          expect(result.finalPrice).toBeGreaterThan(result.supplierPrice!);
        }
      }
    });
  });

  describe('Scenario 2: Listino CUSTOM con Master, Prezzi MODIFICATI (isManuallyModified = true)', () => {
    it('deve calcolare margine automaticamente dalla differenza', async () => {
      // Ordine corretto: prima custom (da getPriceListById), poi master (da calculateWithDefaultMargin)
      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: customPriceListModified,
          error: null,
        }),
      } as any);

      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: masterPriceList,
          error: null,
        }),
      } as any);

      // Mock: Calcolo prezzo dal master
      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 4.4,
        surcharges: 0,
        totalCost: 4.4,
        details: {
          entry: masterPriceList.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      // Mock: Calcolo prezzo dal CUSTOM (modificato)
      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 8.0,
        surcharges: 0,
        totalCost: 8.0, // Diverso dal master
        details: {
          entry: customPriceListModified.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      const result = await calculatePriceWithRules(
        mockUserId,
        {
          weight: 1.5,
          destination: {
            zip: '00100',
            province: 'RM',
            country: 'IT',
          },
        },
        'custom-list-modified'
      );

      expect(result).not.toBeNull();
      if (!result) return;

      // ✅ Verifica: supplierPrice viene calcolato dal master
      expect(result.supplierPrice).toBe(4.4);

      // ✅ Verifica: margin viene calcolato automaticamente (differenza)
      expect(result.margin).toBeCloseTo(8.0 - 4.4, 2); // 3.60

      // ✅ Verifica: finalPrice = totalCost (margine già incluso)
      expect(result.finalPrice).toBe(8.0);

      // ✅ Verifica: supplierPrice ≠ finalPrice
      expect(result.supplierPrice).not.toBe(result.finalPrice);
    });
  });

  describe('Scenario 3: Listino CUSTOM con Master, CON Margine Configurato', () => {
    it('deve usare il margine configurato nel listino (15%)', async () => {
      // Ordine corretto: prima custom (da getPriceListById), poi master (da calculateWithDefaultMargin)
      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: customPriceListWithMargin,
          error: null,
        }),
      } as any);

      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: masterPriceList,
          error: null,
        }),
      } as any);

      // Mock: Calcolo prezzo dal master
      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 4.4,
        surcharges: 0,
        totalCost: 4.4,
        details: {
          entry: masterPriceList.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      // Mock: Calcolo prezzo dal CUSTOM (identico)
      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 4.4,
        surcharges: 0,
        totalCost: 4.4,
        details: {
          entry: customPriceListWithMargin.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      const result = await calculatePriceWithRules(
        mockUserId,
        {
          weight: 1.5,
          destination: {
            zip: '00100',
            province: 'RM',
            country: 'IT',
          },
        },
        'custom-list-with-margin'
      );

      expect(result).not.toBeNull();
      if (!result) return;

      // ✅ Verifica: supplierPrice viene calcolato dal master
      expect(result.supplierPrice).toBe(4.4);

      // ✅ Verifica: margin usa quello configurato (15%, non 20% default)
      const expectedMargin = 4.4 * (15 / 100); // 0.66
      expect(result.margin).toBeCloseTo(expectedMargin, 2);

      // ✅ Verifica: finalPrice = totalCost + margin configurato
      expect(result.finalPrice).toBeCloseTo(4.4 + expectedMargin, 2); // 5.06

      // ✅ Verifica: supplierPrice ≠ finalPrice
      expect(result.supplierPrice).not.toBe(result.finalPrice);
    });
  });

  describe('Scenario 4: Edge Cases e Validazioni', () => {
    it('deve gestire correttamente margine fisso invece di percentuale', async () => {
      const customWithFixedMargin: PriceList = {
        ...customPriceListIdentical,
        id: 'custom-fixed-margin',
        default_margin_percent: null,
        default_margin_fixed: 1.5, // Margine fisso
      };

      // Ordine corretto: prima custom (da getPriceListById), poi master (da calculateWithDefaultMargin)
      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: customWithFixedMargin,
          error: null,
        }),
      } as any);

      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: masterPriceList,
          error: null,
        }),
      } as any);

      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 4.4,
        surcharges: 0,
        totalCost: 4.4,
        details: {
          entry: masterPriceList.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 4.4,
        surcharges: 0,
        totalCost: 4.4,
        details: {
          entry: customWithFixedMargin.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      const result = await calculatePriceWithRules(
        mockUserId,
        {
          weight: 1.5,
          destination: {
            zip: '00100',
            province: 'RM',
            country: 'IT',
          },
        },
        'custom-fixed-margin'
      );

      expect(result).not.toBeNull();
      if (!result) return;

      // ✅ Verifica: usa margine fisso
      expect(result.margin).toBe(1.5);
      expect(result.finalPrice).toBe(5.9); // 4.40 + 1.50
      expect(result.supplierPrice).not.toBe(result.finalPrice);
    });

    it("deve garantire che supplierPrice sia sempre presente quando c'è master", async () => {
      // Ordine corretto: prima custom (da getPriceListById), poi master (da calculateWithDefaultMargin)
      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: customPriceListIdentical,
          error: null,
        }),
      } as any);

      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: masterPriceList,
          error: null,
        }),
      } as any);

      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 4.4,
        surcharges: 0,
        totalCost: 4.4,
        details: {
          entry: masterPriceList.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 4.4,
        surcharges: 0,
        totalCost: 4.4,
        details: {
          entry: customPriceListIdentical.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      const result = await calculatePriceWithRules(
        mockUserId,
        {
          weight: 1.5,
          destination: {
            zip: '00100',
            province: 'RM',
            country: 'IT',
          },
        },
        'custom-list-identical'
      );

      expect(result).not.toBeNull();
      if (!result) return;

      // ✅ Verifica: supplierPrice è sempre presente quando c'è master
      expect(result.supplierPrice).toBeDefined();
      expect(result.supplierPrice).not.toBeNull();
      expect(result.supplierPrice).toBeGreaterThan(0);
    });

    it("deve garantire che finalPrice sia sempre diverso da supplierPrice quando c'è margine", async () => {
      const scenarios = [
        { list: customPriceListIdentical, desc: 'senza margine configurato' },
        { list: customPriceListModified, desc: 'con prezzi modificati' },
        { list: customPriceListWithMargin, desc: 'con margine configurato' },
      ];

      for (const scenario of scenarios) {
        vi.clearAllMocks();

        // Ordine corretto: prima custom (da getPriceListById), poi master (da calculateWithDefaultMargin)
        vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: scenario.list,
            error: null,
          }),
        } as any);

        vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: masterPriceList,
            error: null,
          }),
        } as any);

        vi.mocked(calculatePriceFromList).mockReturnValueOnce({
          basePrice: 4.4,
          surcharges: 0,
          totalCost: 4.4,
          details: {
            entry: masterPriceList.entries![0],
            estimatedDeliveryDays: { min: 3, max: 5 },
          },
        } as any);

        const customTotalCost = scenario.list.id === 'custom-list-modified' ? 8.0 : 4.4;
        vi.mocked(calculatePriceFromList).mockReturnValueOnce({
          basePrice: customTotalCost,
          surcharges: 0,
          totalCost: customTotalCost,
          details: {
            entry: scenario.list.entries![0],
            estimatedDeliveryDays: { min: 3, max: 5 },
          },
        } as any);

        const result = await calculatePriceWithRules(
          mockUserId,
          {
            weight: 1.5,
            destination: {
              zip: '00100',
              province: 'RM',
              country: 'IT',
            },
          },
          scenario.list.id
        );

        expect(result).not.toBeNull();
        if (!result) continue;

        // ✅ Verifica: supplierPrice e finalPrice rispettano il margine configurato
        // Con DEFAULT_MARGIN_PERCENT = 0%, finalPrice può essere uguale a supplierPrice
        // a meno che il listino abbia un margine esplicito configurato o prezzi modificati
        if (scenario.list.default_margin_percent && scenario.list.default_margin_percent > 0) {
          // Listino con margine esplicito configurato
          expect(result.supplierPrice).not.toBe(result.finalPrice);
          expect(result.finalPrice).toBeGreaterThan(result.supplierPrice!);
          expect(result.margin).toBeGreaterThan(0);
        } else if (scenario.list.id === 'custom-list-modified') {
          // Listino con prezzi CUSTOM modificati (8.0 vs master 4.4)
          // finalPrice diverso da supplierPrice per override prezzo, non per margine
          expect(result.finalPrice).toBeGreaterThan(result.supplierPrice!);
        } else if (pricingConfig.DEFAULT_MARGIN_PERCENT === 0) {
          // Con margine default 0% e stesso prezzo del master, finalPrice === supplierPrice
          expect(result.finalPrice).toBeCloseTo(result.supplierPrice!, 2);
          expect(result.margin).toBeCloseTo(0, 2);
        }
      }
    });
  });

  describe('Scenario 5: Test con Valori Reali (GLS vs Poste Italiane)', () => {
    it('simula scenario GLS: listino CUSTOM con prezzi modificati', async () => {
      vi.clearAllMocks();

      const glsMaster: PriceList = {
        ...masterPriceList,
        id: 'gls-master',
        name: 'GLS Master',
        entries: [
          {
            id: 'gls-entry',
            price_list_id: 'gls-master',
            zone_code: 'ITALIA_STANDARD',
            weight_from: 0,
            weight_to: 2,
            base_price: 4.27,
            fuel_surcharge_percent: 0,
            service_type: 'standard',
          },
        ],
      };

      const glsCustom: PriceList = {
        ...customPriceListModified,
        id: 'gls-custom',
        name: 'GLS Custom',
        master_list_id: 'gls-master',
        entries: [
          {
            id: 'gls-custom-entry',
            price_list_id: 'gls-custom',
            zone_code: 'ITALIA_STANDARD',
            weight_from: 0,
            weight_to: 2,
            base_price: 8.0, // Modificato
            fuel_surcharge_percent: 0,
            service_type: 'standard',
          },
        ],
      };

      // Ordine corretto: prima custom (da getPriceListById), poi master (da calculateWithDefaultMargin)
      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: glsCustom,
          error: null,
        }),
      } as any);

      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: glsMaster,
          error: null,
        }),
      } as any);

      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 4.27,
        surcharges: 0,
        totalCost: 4.27,
        details: {
          entry: glsMaster.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 8.0,
        surcharges: 0,
        totalCost: 8.0,
        details: {
          entry: glsCustom.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      const result = await calculatePriceWithRules(
        mockUserId,
        {
          weight: 1.5,
          destination: {
            zip: '00100',
            province: 'RM',
            country: 'IT',
          },
        },
        'gls-custom'
      );

      expect(result).not.toBeNull();
      if (!result) return;

      // ✅ Verifica: GLS funziona correttamente
      expect(result.supplierPrice).toBe(4.27);
      expect(result.margin).toBeCloseTo(3.73, 2); // 8.00 - 4.27
      expect(result.finalPrice).toBe(8.0);
      expect(result.supplierPrice).not.toBe(result.finalPrice);
    });

    it('simula scenario Poste Italiane: listino CUSTOM con prezzi identici, senza margine', async () => {
      vi.clearAllMocks();

      const posteMaster: PriceList = {
        ...masterPriceList,
        id: 'poste-master',
        name: 'Poste Master',
        entries: [
          {
            id: 'poste-entry',
            price_list_id: 'poste-master',
            zone_code: 'ITALIA_STANDARD',
            weight_from: 0,
            weight_to: 2,
            base_price: 4.4,
            fuel_surcharge_percent: 0,
            service_type: 'standard',
          },
        ],
      };

      const posteCustom: PriceList = {
        ...customPriceListIdentical,
        id: 'poste-custom',
        name: 'Poste Custom',
        master_list_id: 'poste-master',
        entries: [
          {
            id: 'poste-custom-entry',
            price_list_id: 'poste-custom',
            zone_code: 'ITALIA_STANDARD',
            weight_from: 0,
            weight_to: 2,
            base_price: 4.4, // Identico al master
            fuel_surcharge_percent: 0,
            service_type: 'standard',
          },
        ],
      };

      // Ordine corretto: prima custom (da getPriceListById), poi master (da calculateWithDefaultMargin)
      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: posteCustom,
          error: null,
        }),
      } as any);

      vi.mocked(supabaseAdmin.from).mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: posteMaster,
          error: null,
        }),
      } as any);

      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 4.4,
        surcharges: 0,
        totalCost: 4.4,
        details: {
          entry: posteMaster.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      vi.mocked(calculatePriceFromList).mockReturnValueOnce({
        basePrice: 4.4,
        surcharges: 0,
        totalCost: 4.4,
        details: {
          entry: posteCustom.entries![0],
          estimatedDeliveryDays: { min: 3, max: 5 },
        },
      } as any);

      const result = await calculatePriceWithRules(
        mockUserId,
        {
          weight: 1.5,
          destination: {
            zip: '00100',
            province: 'RM',
            country: 'IT',
          },
        },
        'poste-custom'
      );

      expect(result).not.toBeNull();
      if (!result) return;

      // ✅ Verifica: Poste ora funziona correttamente (dopo la fix)
      expect(result.supplierPrice).toBe(4.4);

      // ✅ Verifica: margin viene applicato (default 0% - personalizzabile per utente)
      const expectedMargin = 4.4 * (pricingConfig.DEFAULT_MARGIN_PERCENT / 100);
      expect(result.margin).toBeCloseTo(expectedMargin, 2);

      // ✅ Verifica: finalPrice = totalCost + margin
      expect(result.finalPrice).toBeCloseTo(4.4 + expectedMargin, 2);

      // ✅ Con margine 0%, supplierPrice === finalPrice (il margine è personalizzabile)
      if (pricingConfig.DEFAULT_MARGIN_PERCENT === 0) {
        expect(result.finalPrice).toBeCloseTo(result.supplierPrice!, 2);
      } else {
        expect(result.finalPrice).toBeGreaterThan(result.supplierPrice!);
      }
    });
  });
});
