/**
 * Test CRM Analytics — Funzioni pure per metriche cross-livello
 *
 * Verifica:
 * - KPI (conversion rate, pipeline value, avg score, avg days)
 * - Funnel conversione (conteggi per stato + dropoff)
 * - Analisi per fonte, settore, zona
 * - Distribuzione score
 * - Tempo a conversione (avg, min, max, median, per fonte)
 * - Funzione aggregata computeCrmAnalytics
 */

import { describe, it, expect } from 'vitest';
import { computeCrmAnalytics } from '@/lib/crm/analytics';
import type { CrmAnalyticsEntity } from '@/lib/crm/analytics';

// ============================================
// HELPER
// ============================================

function buildEntity(overrides: Partial<CrmAnalyticsEntity> = {}): CrmAnalyticsEntity {
  return {
    id: 'e-1',
    status: 'new',
    lead_score: 50,
    lead_source: 'direct',
    source: null,
    sector: 'ecommerce',
    geographic_zone: 'nord',
    estimated_monthly_volume: 100,
    estimated_value: null,
    created_at: '2026-01-01T10:00:00Z',
    updated_at: '2026-01-10T10:00:00Z',
    converted_at: null,
    last_contact_at: null,
    ...overrides,
  };
}

// Dataset realistico
function buildDataset(): CrmAnalyticsEntity[] {
  return [
    // Lead nuovi
    buildEntity({
      id: 'l1',
      status: 'new',
      lead_score: 30,
      lead_source: 'website_form',
      sector: 'ecommerce',
      geographic_zone: 'nord',
    }),
    buildEntity({
      id: 'l2',
      status: 'new',
      lead_score: 45,
      lead_source: 'referral',
      sector: 'food',
      geographic_zone: 'centro',
    }),
    // Lead contattati
    buildEntity({
      id: 'l3',
      status: 'contacted',
      lead_score: 55,
      lead_source: 'website_form',
      sector: 'ecommerce',
      geographic_zone: 'nord',
    }),
    // Lead qualificati
    buildEntity({
      id: 'l4',
      status: 'qualified',
      lead_score: 70,
      lead_source: 'direct',
      sector: 'pharma',
      geographic_zone: 'sud',
    }),
    // In negoziazione
    buildEntity({
      id: 'l5',
      status: 'negotiation',
      lead_score: 85,
      lead_source: 'referral',
      sector: 'ecommerce',
      geographic_zone: 'nord',
      estimated_monthly_volume: 300,
    }),
    // Vinti (convertiti)
    buildEntity({
      id: 'l6',
      status: 'won',
      lead_score: 90,
      lead_source: 'website_form',
      sector: 'ecommerce',
      geographic_zone: 'nord',
      created_at: '2026-01-01T10:00:00Z',
      converted_at: '2026-01-15T10:00:00Z',
      estimated_monthly_volume: 200,
    }),
    buildEntity({
      id: 'l7',
      status: 'won',
      lead_score: 80,
      lead_source: 'referral',
      sector: 'pharma',
      geographic_zone: 'centro',
      created_at: '2026-01-05T10:00:00Z',
      converted_at: '2026-01-25T10:00:00Z',
      estimated_monthly_volume: 150,
    }),
    // Persi
    buildEntity({
      id: 'l8',
      status: 'lost',
      lead_score: 20,
      lead_source: 'cold_outreach',
      sector: 'artigianato',
      geographic_zone: 'sud',
    }),
    buildEntity({
      id: 'l9',
      status: 'lost',
      lead_score: 35,
      lead_source: 'website_form',
      sector: 'food',
      geographic_zone: 'isole',
    }),
    buildEntity({
      id: 'l10',
      status: 'lost',
      lead_score: 25,
      lead_source: 'direct',
      sector: 'industria',
      geographic_zone: 'nord',
    }),
  ];
}

// ============================================
// TEST
// ============================================

describe('computeCrmAnalytics', () => {
  const data = buildDataset();
  const result = computeCrmAnalytics(data);

  describe('KPI', () => {
    it('calcola totale entita', () => {
      expect(result.kpi.total).toBe(10);
    });

    it('calcola entita attive (non won/lost)', () => {
      expect(result.kpi.active).toBe(5); // l1-l5
    });

    it('calcola vinti e persi', () => {
      expect(result.kpi.won).toBe(2); // l6, l7
      expect(result.kpi.lost).toBe(3); // l8, l9, l10
    });

    it('calcola conversion rate (won / decided)', () => {
      // 2 won / (2 won + 3 lost) = 0.4
      expect(result.kpi.conversion_rate).toBeCloseTo(0.4, 2);
    });

    it('calcola score medio', () => {
      // (30+45+55+70+85+90+80+20+35+25) / 10 = 53.5
      expect(result.kpi.avg_score).toBeCloseTo(53.5, 1);
    });

    it('calcola tempo medio a conversione', () => {
      // l6: 14 giorni, l7: 20 giorni → media 17
      expect(result.kpi.avg_days_to_conversion).toBe(17);
    });

    it('calcola pipeline value per entita attive', () => {
      // Entita attive: l1(100*5=500), l2(100*5=500), l3(100*5=500), l4(100*5=500), l5(300*5=1500)
      expect(result.kpi.total_pipeline_value).toBe(3500);
    });
  });

  describe('Funnel', () => {
    it('conta entita per stato', () => {
      expect(result.funnel.new).toBe(2);
      expect(result.funnel.contacted).toBe(1);
      expect(result.funnel.qualified).toBe(1);
      expect(result.funnel.negotiation).toBe(1);
      expect(result.funnel.won).toBe(2);
      expect(result.funnel.lost).toBe(3);
    });

    it('calcola dropoff new → contacted', () => {
      // pastNew = 1+1+1+2+3 = 8, total = 10
      // dropoff = 1 - 8/10 = 0.2
      expect(result.funnel.dropoff_new_to_contacted).toBeCloseTo(0.2, 2);
    });

    it('calcola dropoff contacted → won', () => {
      // pastNew = 8, won = 2
      // dropoff = 1 - 2/8 = 0.75
      expect(result.funnel.dropoff_contacted_to_won).toBeCloseTo(0.75, 2);
    });
  });

  describe('Source Analysis', () => {
    it('raggruppa per fonte', () => {
      expect(result.source_analysis.length).toBeGreaterThan(0);
      const sources = result.source_analysis.map((s) => s.source);
      expect(sources).toContain('website_form');
      expect(sources).toContain('referral');
      expect(sources).toContain('direct');
    });

    it('calcola conversion rate per fonte', () => {
      // website_form: 1 won (l6) + 1 lost (l9) → 0.5
      const wf = result.source_analysis.find((s) => s.source === 'website_form')!;
      expect(wf.total).toBe(4); // l1, l3, l6, l9
      expect(wf.won).toBe(1);
    });

    it('ordina per conversion rate decrescente', () => {
      for (let i = 0; i < result.source_analysis.length - 1; i++) {
        expect(result.source_analysis[i].conversion_rate).toBeGreaterThanOrEqual(
          result.source_analysis[i + 1].conversion_rate
        );
      }
    });

    it('include labels italiane', () => {
      const wf = result.source_analysis.find((s) => s.source === 'website_form');
      expect(wf?.label).toBe('Form Sito Web');
    });
  });

  describe('Sector Analysis', () => {
    it('raggruppa per settore', () => {
      const sectors = result.sector_analysis.map((s) => s.sector);
      expect(sectors).toContain('ecommerce');
      expect(sectors).toContain('pharma');
    });

    it('calcola volume medio per settore', () => {
      const ecommerce = result.sector_analysis.find((s) => s.sector === 'ecommerce')!;
      // l1(100), l3(100), l5(300), l6(200) → media 175
      expect(ecommerce.avg_volume).toBeCloseTo(175, 0);
    });

    it('include labels italiane', () => {
      const pharma = result.sector_analysis.find((s) => s.sector === 'pharma');
      expect(pharma?.label).toBe('Farmaceutico');
    });
  });

  describe('Zone Analysis', () => {
    it('raggruppa per zona', () => {
      const zones = result.zone_analysis.map((z) => z.zone);
      expect(zones).toContain('nord');
      expect(zones).toContain('centro');
      expect(zones).toContain('sud');
    });

    it('nord ha piu entita', () => {
      const nord = result.zone_analysis.find((z) => z.zone === 'nord')!;
      expect(nord.total).toBe(5); // l1, l3, l5, l6, l10
    });

    it('include labels italiane', () => {
      const isole = result.zone_analysis.find((z) => z.zone === 'isole');
      expect(isole?.label).toBe('Isole');
    });
  });

  describe('Score Distribution', () => {
    it('classifica score nelle 4 categorie (solo attivi)', () => {
      // Attivi: l1(30), l2(45), l3(55), l4(70), l5(85)
      expect(result.score_distribution.hot).toBe(1); // l5 (85)
      expect(result.score_distribution.warm).toBe(1); // l4 (70)
      expect(result.score_distribution.cold).toBe(2); // l2 (45), l3 (55)
      expect(result.score_distribution.very_cold).toBe(1); // l1 (30)
    });

    it('somma delle categorie = entita attive', () => {
      const sum =
        result.score_distribution.hot +
        result.score_distribution.warm +
        result.score_distribution.cold +
        result.score_distribution.very_cold;
      expect(sum).toBe(result.kpi.active);
    });
  });

  describe('Time to Conversion', () => {
    it('calcola tempo medio, min, max', () => {
      // l6: 14 giorni, l7: 20 giorni
      expect(result.time_to_conversion.avg_days).toBe(17);
      expect(result.time_to_conversion.min_days).toBe(14);
      expect(result.time_to_conversion.max_days).toBe(20);
    });

    it('calcola mediana', () => {
      // [14, 20] → mediana = 17
      expect(result.time_to_conversion.median_days).toBe(17);
    });

    it('breakdown per fonte', () => {
      expect(result.time_to_conversion.by_source.length).toBeGreaterThan(0);
      const wf = result.time_to_conversion.by_source.find((s) => s.source === 'website_form');
      expect(wf?.avg_days).toBe(14); // solo l6
    });
  });
});

describe('computeCrmAnalytics — edge cases', () => {
  it('gestisce array vuoto', () => {
    const result = computeCrmAnalytics([]);
    expect(result.kpi.total).toBe(0);
    expect(result.kpi.conversion_rate).toBe(0);
    expect(result.kpi.avg_score).toBe(0);
    expect(result.funnel.new).toBe(0);
    expect(result.source_analysis).toHaveLength(0);
    expect(result.score_distribution.hot).toBe(0);
    expect(result.time_to_conversion.avg_days).toBe(0);
  });

  it('gestisce entita tutte nuove (nessuna conversione)', () => {
    const entities = [
      buildEntity({ id: 'a', status: 'new', lead_score: 10 }),
      buildEntity({ id: 'b', status: 'new', lead_score: 20 }),
    ];
    const result = computeCrmAnalytics(entities);
    expect(result.kpi.conversion_rate).toBe(0);
    expect(result.kpi.won).toBe(0);
    expect(result.kpi.avg_days_to_conversion).toBe(0);
    expect(result.time_to_conversion.avg_days).toBe(0);
  });

  it('gestisce entita senza settore/zona/fonte', () => {
    const entities = [
      buildEntity({
        id: 'x',
        sector: null,
        geographic_zone: null,
        lead_source: null,
        source: null,
      }),
    ];
    const result = computeCrmAnalytics(entities);
    expect(result.sector_analysis.find((s) => s.sector === 'unknown')).toBeDefined();
    expect(result.zone_analysis.find((z) => z.zone === 'unknown')).toBeDefined();
    expect(result.source_analysis.find((s) => s.source === 'unknown')).toBeDefined();
  });

  it('gestisce entita won senza converted_at', () => {
    const entities = [buildEntity({ id: 'w1', status: 'won', converted_at: null })];
    const result = computeCrmAnalytics(entities);
    expect(result.kpi.won).toBe(1);
    expect(result.kpi.avg_days_to_conversion).toBe(0); // nessuna data conversione
  });

  it('usa estimated_value se presente per pipeline', () => {
    const entities = [
      buildEntity({
        id: 'v1',
        status: 'new',
        estimated_value: 10000,
        estimated_monthly_volume: 50,
      }),
    ];
    const result = computeCrmAnalytics(entities);
    expect(result.kpi.total_pipeline_value).toBe(10000); // usa estimated_value, non volume*5
  });

  it('prospect status (quote_sent, negotiating) mappati nel funnel', () => {
    const entities = [
      buildEntity({ id: 'p1', status: 'quote_sent' }),
      buildEntity({ id: 'p2', status: 'negotiating' }),
    ];
    const result = computeCrmAnalytics(entities);
    expect(result.funnel.qualified).toBe(1); // quote_sent → qualified
    expect(result.funnel.negotiation).toBe(1); // negotiating → negotiation
  });
});
