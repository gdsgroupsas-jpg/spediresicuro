/**
 * Test: Analytics preventivi commerciali
 *
 * Verifica computeAnalytics: KPI, funnel, margini, performance, timeline.
 * Funzione pura — nessun mock di DB necessario.
 */

import { describe, expect, it } from 'vitest';
import { computeAnalytics, filterLatestRevisions } from '@/lib/commercial-quotes/analytics';
import type { CommercialQuote } from '@/types/commercial-quotes';

// ============================================
// FACTORY: quote mock con default ragionevoli
// ============================================

const baseMatrix = {
  zones: ['Italia', 'Sicilia'],
  weight_ranges: [{ from: 0, to: 5, label: '0 - 5 kg' }],
  prices: [[6.0, 8.0]],
  services_included: [],
  carrier_display_name: 'GLS',
  vat_mode: 'excluded' as const,
  vat_rate: 22,
  pickup_fee: null,
  delivery_mode: 'carrier_pickup' as const,
  goods_needs_processing: false,
  processing_fee: null,
  generated_at: '2026-01-15T10:00:00.000Z',
};

function createQuote(overrides?: Partial<CommercialQuote>): CommercialQuote {
  return {
    id: `quote-${Math.random().toString(36).slice(2, 8)}`,
    workspace_id: 'ws-1',
    created_by: 'user-1',
    prospect_company: 'Acme SRL',
    prospect_contact_name: 'Mario Rossi',
    prospect_email: 'mario@acme.it',
    prospect_phone: null,
    prospect_sector: 'ecommerce',
    prospect_estimated_volume: 100,
    prospect_notes: null,
    carrier_code: 'gls-GLS-5000',
    contract_code: 'gls-GLS-5000',
    price_list_id: 'pl-1',
    margin_percent: 20,
    validity_days: 30,
    delivery_mode: 'carrier_pickup',
    pickup_fee: null,
    goods_needs_processing: false,
    processing_fee: null,
    revision: 1,
    parent_quote_id: null,
    revision_notes: null,
    price_matrix: baseMatrix,
    additional_carriers: null,
    price_includes: null,
    clauses: [],
    currency: 'EUR',
    vat_mode: 'excluded',
    vat_rate: 22,
    status: 'draft',
    sent_at: null,
    responded_at: null,
    response_notes: null,
    expires_at: null,
    pdf_storage_path: null,
    converted_user_id: null,
    converted_price_list_id: null,
    original_margin_percent: 20,
    created_at: '2026-01-15T10:00:00.000Z',
    updated_at: '2026-01-15T10:00:00.000Z',
    ...overrides,
  };
}

// ============================================
// filterLatestRevisions
// ============================================

describe('filterLatestRevisions', () => {
  it('dovrebbe restituire solo ultima revisione per ogni root', () => {
    const root = createQuote({ id: 'root-1', revision: 1 });
    const rev2 = createQuote({
      id: 'rev-2',
      parent_quote_id: 'root-1',
      revision: 2,
    });
    const rev3 = createQuote({
      id: 'rev-3',
      parent_quote_id: 'root-1',
      revision: 3,
    });

    const result = filterLatestRevisions([root, rev2, rev3]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('rev-3');
  });

  it('dovrebbe gestire quote senza revisioni', () => {
    const q1 = createQuote({ id: 'q1' });
    const q2 = createQuote({ id: 'q2' });

    const result = filterLatestRevisions([q1, q2]);
    expect(result).toHaveLength(2);
  });

  it('dovrebbe restituire array vuoto per input vuoto', () => {
    expect(filterLatestRevisions([])).toHaveLength(0);
  });
});

// ============================================
// KPI
// ============================================

describe('computeAnalytics - KPI', () => {
  it('dovrebbe calcolare conversion_rate corretto', () => {
    const quotes = [
      createQuote({ status: 'accepted' }),
      createQuote({ status: 'accepted' }),
      createQuote({ status: 'rejected' }),
      createQuote({ status: 'draft' }),
    ];

    const { kpi } = computeAnalytics(quotes);
    // 2 accettati / (2 accettati + 1 rifiutato) = 0.666...
    expect(kpi.conversion_rate).toBeCloseTo(0.6667, 3);
    expect(kpi.total_accepted).toBe(2);
    expect(kpi.total_rejected).toBe(1);
    expect(kpi.total_quotes).toBe(4);
  });

  it('dovrebbe restituire conversion_rate 0 senza esiti', () => {
    const quotes = [createQuote({ status: 'draft' }), createQuote({ status: 'sent' })];
    const { kpi } = computeAnalytics(quotes);
    expect(kpi.conversion_rate).toBe(0);
  });

  it('dovrebbe calcolare margine medio accettati', () => {
    const quotes = [
      createQuote({ status: 'accepted', margin_percent: 15 }),
      createQuote({ status: 'accepted', margin_percent: 25 }),
      createQuote({ status: 'rejected', margin_percent: 30 }),
    ];

    const { kpi } = computeAnalytics(quotes);
    expect(kpi.average_margin_accepted).toBe(20);
  });

  it('dovrebbe calcolare giorni medi di chiusura', () => {
    const quotes = [
      createQuote({
        status: 'accepted',
        sent_at: '2026-01-01T10:00:00.000Z',
        responded_at: '2026-01-11T10:00:00.000Z',
      }),
      createQuote({
        status: 'rejected',
        sent_at: '2026-01-05T10:00:00.000Z',
        responded_at: '2026-01-08T10:00:00.000Z',
      }),
    ];

    const { kpi } = computeAnalytics(quotes);
    // (10 + 3) / 2 = 6.5
    expect(kpi.average_days_to_close).toBe(6.5);
  });

  it('dovrebbe calcolare valore totale revenue (volume * prezzo medio)', () => {
    const quotes = [
      createQuote({
        status: 'accepted',
        prospect_estimated_volume: 100,
        price_matrix: { ...baseMatrix, prices: [[10.0, 20.0]] },
      }),
    ];

    const { kpi } = computeAnalytics(quotes);
    // volume=100, prezzo medio=(10+20)/2=15, totale=1500
    expect(kpi.total_revenue_value).toBe(1500);
  });

  it('dovrebbe gestire array vuoto', () => {
    const { kpi } = computeAnalytics([]);
    expect(kpi.conversion_rate).toBe(0);
    expect(kpi.average_margin_accepted).toBe(0);
    expect(kpi.average_days_to_close).toBe(0);
    expect(kpi.total_revenue_value).toBe(0);
    expect(kpi.total_quotes).toBe(0);
  });
});

// ============================================
// FUNNEL
// ============================================

describe('computeAnalytics - Funnel', () => {
  it('dovrebbe contare correttamente ogni step del funnel', () => {
    const quotes = [
      createQuote({ status: 'draft' }), // solo created
      createQuote({ status: 'sent', sent_at: '2026-01-10T10:00:00.000Z' }), // created + sent
      createQuote({
        status: 'accepted',
        sent_at: '2026-01-10T10:00:00.000Z',
        responded_at: '2026-01-15T10:00:00.000Z',
      }), // tutti gli step
    ];

    const { funnel } = computeAnalytics(quotes);
    expect(funnel.created).toBe(3);
    expect(funnel.sent).toBe(2); // sent + accepted hanno sent_at
    expect(funnel.accepted).toBe(1);
  });

  it('dovrebbe calcolare drop-off percentuali', () => {
    const quotes = [
      createQuote({ status: 'draft' }),
      createQuote({ status: 'draft' }),
      createQuote({ status: 'sent', sent_at: '2026-01-10T10:00:00.000Z' }),
      createQuote({
        status: 'accepted',
        sent_at: '2026-01-10T10:00:00.000Z',
        responded_at: '2026-01-15T10:00:00.000Z',
      }),
    ];

    const { funnel } = computeAnalytics(quotes);
    // created=4, sent=2, accepted=1
    expect(funnel.dropoff_created_to_sent).toBeCloseTo(0.5, 3); // 1 - 2/4
    expect(funnel.dropoff_sent_to_accepted).toBeCloseTo(0.5, 3); // 1 - 1/2
  });

  it('dovrebbe gestire funnel vuoto', () => {
    const { funnel } = computeAnalytics([]);
    expect(funnel.created).toBe(0);
    expect(funnel.sent).toBe(0);
    expect(funnel.dropoff_created_to_sent).toBe(0);
  });
});

// ============================================
// MARGIN ANALYSIS
// ============================================

describe('computeAnalytics - Margin Analysis', () => {
  it('dovrebbe confrontare margine originale vs finale', () => {
    const quotes = [
      createQuote({
        status: 'accepted',
        margin_percent: 18,
        original_margin_percent: 25,
      }),
      createQuote({
        status: 'rejected',
        margin_percent: 30,
        original_margin_percent: 30,
      }),
    ];

    const { margin_analysis } = computeAnalytics(quotes);
    expect(margin_analysis.data_points).toHaveLength(2);

    const acceptedPoint = margin_analysis.data_points.find((p) => p.accepted);
    expect(acceptedPoint!.original_margin).toBe(25);
    expect(acceptedPoint!.final_margin).toBe(18);
    expect(acceptedPoint!.delta).toBe(-7);
  });

  it('dovrebbe calcolare medie separate per accettati e rifiutati', () => {
    const quotes = [
      createQuote({ status: 'accepted', margin_percent: 15, original_margin_percent: 20 }),
      createQuote({ status: 'accepted', margin_percent: 25, original_margin_percent: 25 }),
      createQuote({ status: 'rejected', margin_percent: 35, original_margin_percent: 35 }),
    ];

    const { margin_analysis } = computeAnalytics(quotes);
    expect(margin_analysis.avg_margin_accepted).toBe(20); // (15+25)/2
    expect(margin_analysis.avg_margin_rejected).toBe(35);
  });

  it('dovrebbe usare margin_percent come fallback se original_margin e null', () => {
    const quotes = [
      createQuote({
        status: 'accepted',
        margin_percent: 20,
        original_margin_percent: null,
      }),
    ];

    const { margin_analysis } = computeAnalytics(quotes);
    expect(margin_analysis.data_points[0].original_margin).toBe(20);
    expect(margin_analysis.data_points[0].delta).toBe(0);
  });

  it('dovrebbe escludere draft/sent/expired dalla margin analysis', () => {
    const quotes = [
      createQuote({ status: 'draft', margin_percent: 20 }),
      createQuote({ status: 'sent', margin_percent: 20 }),
      createQuote({ status: 'expired', margin_percent: 20 }),
    ];

    const { margin_analysis } = computeAnalytics(quotes);
    expect(margin_analysis.data_points).toHaveLength(0);
  });
});

// ============================================
// CARRIER PERFORMANCE
// ============================================

describe('computeAnalytics - Carrier Performance', () => {
  it('dovrebbe aggregare per corriere', () => {
    const quotes = [
      createQuote({ carrier_code: 'gls', status: 'accepted', margin_percent: 20 }),
      createQuote({ carrier_code: 'gls', status: 'rejected', margin_percent: 25 }),
      createQuote({
        carrier_code: 'brt',
        status: 'accepted',
        margin_percent: 15,
        price_matrix: { ...baseMatrix, carrier_display_name: 'BRT' },
      }),
    ];

    const { carrier_performance } = computeAnalytics(quotes);
    expect(carrier_performance).toHaveLength(2);

    const gls = carrier_performance.find((c) => c.carrier_code === 'gls');
    expect(gls!.total_quotes).toBe(2);
    expect(gls!.accepted).toBe(1);
    expect(gls!.rejected).toBe(1);
    expect(gls!.acceptance_rate).toBe(0.5);
    expect(gls!.average_margin).toBe(22.5); // (20+25)/2

    const brt = carrier_performance.find((c) => c.carrier_code === 'brt');
    expect(brt!.total_quotes).toBe(1);
    expect(brt!.acceptance_rate).toBe(1);
  });

  it('dovrebbe ordinare per totale preventivi decrescente', () => {
    const quotes = [
      createQuote({ carrier_code: 'brt' }),
      createQuote({ carrier_code: 'gls' }),
      createQuote({ carrier_code: 'gls' }),
      createQuote({ carrier_code: 'gls' }),
    ];

    const { carrier_performance } = computeAnalytics(quotes);
    expect(carrier_performance[0].carrier_code).toBe('gls');
    expect(carrier_performance[1].carrier_code).toBe('brt');
  });
});

// ============================================
// SECTOR PERFORMANCE
// ============================================

describe('computeAnalytics - Sector Performance', () => {
  it('dovrebbe aggregare per settore con label corrette', () => {
    const quotes = [
      createQuote({ prospect_sector: 'ecommerce', status: 'accepted' }),
      createQuote({ prospect_sector: 'ecommerce', status: 'rejected' }),
      createQuote({ prospect_sector: 'food', status: 'accepted' }),
    ];

    const { sector_performance } = computeAnalytics(quotes);
    expect(sector_performance).toHaveLength(2);

    const ecomm = sector_performance.find((s) => s.sector === 'ecommerce');
    expect(ecomm!.sector_label).toBe('E-commerce');
    expect(ecomm!.total_quotes).toBe(2);
    expect(ecomm!.acceptance_rate).toBe(0.5);

    const food = sector_performance.find((s) => s.sector === 'food');
    expect(food!.sector_label).toBe('Food & Beverage');
  });

  it('dovrebbe gestire settore null come "Non specificato"', () => {
    const quotes = [createQuote({ prospect_sector: null })];

    const { sector_performance } = computeAnalytics(quotes);
    const ns = sector_performance.find((s) => s.sector === 'non_specificato');
    expect(ns).toBeDefined();
    expect(ns!.sector_label).toBe('Non specificato');
  });
});

// ============================================
// TIMELINE
// ============================================

describe('computeAnalytics - Timeline', () => {
  it('dovrebbe raggruppare per settimana ISO', () => {
    const quotes = [
      createQuote({ created_at: '2026-01-05T10:00:00.000Z' }), // W02
      createQuote({ created_at: '2026-01-06T10:00:00.000Z' }), // W02
      createQuote({ created_at: '2026-01-12T10:00:00.000Z' }), // W03
    ];

    const { timeline } = computeAnalytics(quotes);
    expect(timeline).toHaveLength(2);
    expect(timeline[0].created).toBe(2);
    expect(timeline[1].created).toBe(1);
  });

  it('dovrebbe ordinare per periodo crescente', () => {
    const quotes = [
      createQuote({ created_at: '2026-02-01T10:00:00.000Z' }),
      createQuote({ created_at: '2026-01-01T10:00:00.000Z' }),
    ];

    const { timeline } = computeAnalytics(quotes);
    expect(timeline[0].period < timeline[1].period).toBe(true);
  });

  it('dovrebbe contare sent e status per settimana di creazione', () => {
    const quotes = [
      createQuote({
        created_at: '2026-01-05T10:00:00.000Z',
        status: 'accepted',
        sent_at: '2026-01-06T10:00:00.000Z',
      }),
      createQuote({
        created_at: '2026-01-05T10:00:00.000Z',
        status: 'rejected',
        sent_at: '2026-01-07T10:00:00.000Z',
      }),
    ];

    const { timeline } = computeAnalytics(quotes);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].sent).toBe(2);
    expect(timeline[0].accepted).toBe(1);
    expect(timeline[0].rejected).toBe(1);
  });

  it('dovrebbe gestire timeline vuota', () => {
    const { timeline } = computeAnalytics([]);
    expect(timeline).toHaveLength(0);
  });
});

// ============================================
// INTEGRAZIONE: computeAnalytics completo
// ============================================

describe('computeAnalytics - integrazione', () => {
  it('dovrebbe filtrare revisioni e calcolare analytics solo sulle ultime', () => {
    const root = createQuote({
      id: 'root-1',
      revision: 1,
      status: 'sent',
      margin_percent: 25,
      sent_at: '2026-01-10T10:00:00.000Z',
    });
    const rev2 = createQuote({
      id: 'rev-2',
      parent_quote_id: 'root-1',
      revision: 2,
      status: 'accepted',
      margin_percent: 20,
      original_margin_percent: 25,
      sent_at: '2026-01-12T10:00:00.000Z',
      responded_at: '2026-01-15T10:00:00.000Z',
    });

    const result = computeAnalytics([root, rev2]);

    // Solo 1 quote (ultima revisione)
    expect(result.kpi.total_quotes).toBe(1);
    expect(result.kpi.total_accepted).toBe(1);
    expect(result.kpi.conversion_rate).toBe(1);
    expect(result.kpi.average_margin_accepted).toBe(20);
  });

  it('dovrebbe gestire scenario realistico con mix di stati', () => {
    const quotes = [
      // 3 accepted con margini diversi
      createQuote({
        id: 'q1',
        status: 'accepted',
        margin_percent: 15,
        carrier_code: 'gls',
        prospect_sector: 'ecommerce',
        sent_at: '2026-01-01T00:00:00Z',
        responded_at: '2026-01-05T00:00:00Z',
      }),
      createQuote({
        id: 'q2',
        status: 'accepted',
        margin_percent: 20,
        carrier_code: 'gls',
        prospect_sector: 'food',
        sent_at: '2026-01-02T00:00:00Z',
        responded_at: '2026-01-10T00:00:00Z',
      }),
      createQuote({
        id: 'q3',
        status: 'accepted',
        margin_percent: 25,
        carrier_code: 'brt',
        prospect_sector: 'ecommerce',
        sent_at: '2026-01-03T00:00:00Z',
        responded_at: '2026-01-06T00:00:00Z',
        price_matrix: { ...baseMatrix, carrier_display_name: 'BRT' },
      }),
      // 2 rejected
      createQuote({
        id: 'q4',
        status: 'rejected',
        margin_percent: 30,
        carrier_code: 'gls',
        prospect_sector: 'ecommerce',
        sent_at: '2026-01-04T00:00:00Z',
        responded_at: '2026-01-08T00:00:00Z',
      }),
      createQuote({
        id: 'q5',
        status: 'rejected',
        margin_percent: 35,
        carrier_code: 'brt',
        prospect_sector: 'cosmetica',
        sent_at: '2026-01-05T00:00:00Z',
        responded_at: '2026-01-12T00:00:00Z',
        price_matrix: { ...baseMatrix, carrier_display_name: 'BRT' },
      }),
      // 1 draft, 1 sent
      createQuote({ id: 'q6', status: 'draft', carrier_code: 'gls' }),
      createQuote({
        id: 'q7',
        status: 'sent',
        carrier_code: 'gls',
        sent_at: '2026-01-06T00:00:00Z',
      }),
    ];

    const result = computeAnalytics(quotes);

    // KPI
    expect(result.kpi.total_quotes).toBe(7);
    expect(result.kpi.total_accepted).toBe(3);
    expect(result.kpi.total_rejected).toBe(2);
    expect(result.kpi.conversion_rate).toBeCloseTo(0.6, 1); // 3/5

    // Funnel
    expect(result.funnel.created).toBe(7);
    expect(result.funnel.sent).toBeGreaterThan(0);

    // Carrier performance: 2 corrieri
    expect(result.carrier_performance).toHaveLength(2);

    // Sector performance: 3 settori
    expect(result.sector_performance.length).toBeGreaterThanOrEqual(3);

    // Timeline: almeno 1 settimana
    expect(result.timeline.length).toBeGreaterThan(0);
  });
});
