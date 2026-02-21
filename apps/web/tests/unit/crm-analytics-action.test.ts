/**
 * Test CRM Analytics Action — Mapping Lead/Prospect → CrmAnalyticsEntity
 *
 * Verifica:
 * - mapLeadsToCrmEntities: mapping corretto campi lead
 * - mapProspectsToCrmEntities: mapping corretto con null per source/zone
 * - Edge cases: null values, status prospect
 * - Compatibilita con computeCrmAnalytics
 */

import { describe, it, expect } from 'vitest';
import { mapLeadsToCrmEntities, mapProspectsToCrmEntities } from '@/lib/crm/analytics-mapping';
import { computeCrmAnalytics } from '@/lib/crm/analytics';

// ============================================
// LEAD MAPPING
// ============================================

describe('mapLeadsToCrmEntities', () => {
  it('mappa tutti i campi lead correttamente', () => {
    const rows = [
      {
        id: 'lead-1',
        status: 'qualified',
        lead_score: 75,
        lead_source: 'website_form',
        source: null,
        sector: 'ecommerce',
        geographic_zone: 'nord',
        estimated_monthly_volume: 200,
        created_at: '2026-01-01T10:00:00Z',
        updated_at: '2026-01-10T10:00:00Z',
        converted_at: null,
        last_contact_at: '2026-01-08T10:00:00Z',
      },
    ];

    const entities = mapLeadsToCrmEntities(rows);

    expect(entities).toHaveLength(1);
    expect(entities[0]).toEqual({
      id: 'lead-1',
      status: 'qualified',
      lead_score: 75,
      lead_source: 'website_form',
      source: null,
      sector: 'ecommerce',
      geographic_zone: 'nord',
      estimated_monthly_volume: 200,
      estimated_value: null,
      created_at: '2026-01-01T10:00:00Z',
      updated_at: '2026-01-10T10:00:00Z',
      converted_at: null,
      last_contact_at: '2026-01-08T10:00:00Z',
    });
  });

  it('mappa lead con source legacy (source invece di lead_source)', () => {
    const rows = [
      {
        id: 'lead-2',
        status: 'new',
        lead_score: 30,
        lead_source: null,
        source: 'referral',
        sector: null,
        geographic_zone: null,
        estimated_monthly_volume: null,
        created_at: '2026-01-01T10:00:00Z',
        updated_at: '2026-01-01T10:00:00Z',
        converted_at: null,
        last_contact_at: null,
      },
    ];

    const entities = mapLeadsToCrmEntities(rows);
    expect(entities[0].lead_source).toBeNull();
    expect(entities[0].source).toBe('referral');
  });

  it('mappa lead vinto con converted_at', () => {
    const rows = [
      {
        id: 'lead-3',
        status: 'won',
        lead_score: 90,
        lead_source: 'direct',
        source: null,
        sector: 'pharma',
        geographic_zone: 'centro',
        estimated_monthly_volume: 150,
        created_at: '2026-01-01T10:00:00Z',
        updated_at: '2026-01-20T10:00:00Z',
        converted_at: '2026-01-20T10:00:00Z',
        last_contact_at: '2026-01-18T10:00:00Z',
      },
    ];

    const entities = mapLeadsToCrmEntities(rows);
    expect(entities[0].converted_at).toBe('2026-01-20T10:00:00Z');
    expect(entities[0].status).toBe('won');
  });

  it('gestisce array vuoto', () => {
    expect(mapLeadsToCrmEntities([])).toEqual([]);
  });

  it('mappa lead multipli', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
      id: `lead-${i}`,
      status: 'new',
      lead_score: i * 20,
      lead_source: null,
      source: null,
      sector: null,
      geographic_zone: null,
      estimated_monthly_volume: null,
      created_at: '2026-01-01T10:00:00Z',
      updated_at: '2026-01-01T10:00:00Z',
      converted_at: null,
      last_contact_at: null,
    }));

    const entities = mapLeadsToCrmEntities(rows);
    expect(entities).toHaveLength(5);
    expect(entities[2].lead_score).toBe(40);
  });
});

// ============================================
// PROSPECT MAPPING
// ============================================

describe('mapProspectsToCrmEntities', () => {
  it('mappa tutti i campi prospect correttamente', () => {
    const rows = [
      {
        id: 'prospect-1',
        status: 'quote_sent',
        lead_score: 65,
        sector: 'food',
        estimated_monthly_volume: 100,
        estimated_monthly_value: 5000,
        created_at: '2026-02-01T10:00:00Z',
        updated_at: '2026-02-05T10:00:00Z',
        converted_at: null,
        last_contact_at: '2026-02-04T10:00:00Z',
      },
    ];

    const entities = mapProspectsToCrmEntities(rows);

    expect(entities).toHaveLength(1);
    expect(entities[0]).toEqual({
      id: 'prospect-1',
      status: 'quote_sent',
      lead_score: 65,
      lead_source: null,
      source: null,
      sector: 'food',
      geographic_zone: null,
      estimated_monthly_volume: 100,
      estimated_value: 5000,
      created_at: '2026-02-01T10:00:00Z',
      updated_at: '2026-02-05T10:00:00Z',
      converted_at: null,
      last_contact_at: '2026-02-04T10:00:00Z',
    });
  });

  it('prospect non ha lead_source, source, geographic_zone', () => {
    const rows = [
      {
        id: 'p-1',
        status: 'new',
        lead_score: 20,
        sector: 'ecommerce',
        estimated_monthly_volume: 50,
        estimated_monthly_value: null,
        created_at: '2026-02-01T10:00:00Z',
        updated_at: '2026-02-01T10:00:00Z',
        converted_at: null,
        last_contact_at: null,
      },
    ];

    const entities = mapProspectsToCrmEntities(rows);
    expect(entities[0].lead_source).toBeNull();
    expect(entities[0].source).toBeNull();
    expect(entities[0].geographic_zone).toBeNull();
  });

  it('mappa estimated_monthly_value in estimated_value', () => {
    const rows = [
      {
        id: 'p-2',
        status: 'negotiating',
        lead_score: 80,
        sector: null,
        estimated_monthly_volume: 300,
        estimated_monthly_value: 15000,
        created_at: '2026-02-01T10:00:00Z',
        updated_at: '2026-02-10T10:00:00Z',
        converted_at: null,
        last_contact_at: null,
      },
    ];

    const entities = mapProspectsToCrmEntities(rows);
    expect(entities[0].estimated_value).toBe(15000);
    expect(entities[0].estimated_monthly_volume).toBe(300);
  });

  it('gestisce prospect vinto con converted_at', () => {
    const rows = [
      {
        id: 'p-3',
        status: 'won',
        lead_score: 95,
        sector: 'pharma',
        estimated_monthly_volume: 200,
        estimated_monthly_value: 10000,
        created_at: '2026-01-01T10:00:00Z',
        updated_at: '2026-01-25T10:00:00Z',
        converted_at: '2026-01-25T10:00:00Z',
        last_contact_at: '2026-01-20T10:00:00Z',
      },
    ];

    const entities = mapProspectsToCrmEntities(rows);
    expect(entities[0].converted_at).toBe('2026-01-25T10:00:00Z');
  });

  it('gestisce array vuoto', () => {
    expect(mapProspectsToCrmEntities([])).toEqual([]);
  });
});

// ============================================
// INTEGRAZIONE CON computeCrmAnalytics
// ============================================

describe('integrazione mapping → computeCrmAnalytics', () => {
  it('lead mappati producono analytics validi', () => {
    const rows = [
      {
        id: 'l1',
        status: 'new',
        lead_score: 30,
        lead_source: 'website_form',
        source: null,
        sector: 'ecommerce',
        geographic_zone: 'nord',
        estimated_monthly_volume: 100,
        created_at: '2026-01-01T10:00:00Z',
        updated_at: '2026-01-05T10:00:00Z',
        converted_at: null,
        last_contact_at: null,
      },
      {
        id: 'l2',
        status: 'won',
        lead_score: 85,
        lead_source: 'referral',
        source: null,
        sector: 'pharma',
        geographic_zone: 'centro',
        estimated_monthly_volume: 200,
        created_at: '2026-01-01T10:00:00Z',
        updated_at: '2026-01-15T10:00:00Z',
        converted_at: '2026-01-15T10:00:00Z',
        last_contact_at: '2026-01-10T10:00:00Z',
      },
      {
        id: 'l3',
        status: 'lost',
        lead_score: 20,
        lead_source: 'cold_outreach',
        source: null,
        sector: 'food',
        geographic_zone: 'sud',
        estimated_monthly_volume: null,
        created_at: '2026-01-01T10:00:00Z',
        updated_at: '2026-01-10T10:00:00Z',
        converted_at: null,
        last_contact_at: null,
      },
    ];

    const entities = mapLeadsToCrmEntities(rows);
    const result = computeCrmAnalytics(entities);

    expect(result.kpi.total).toBe(3);
    expect(result.kpi.won).toBe(1);
    expect(result.kpi.lost).toBe(1);
    expect(result.kpi.active).toBe(1);
    expect(result.kpi.conversion_rate).toBeCloseTo(0.5, 2);
    expect(result.funnel.new).toBe(1);
    expect(result.source_analysis.length).toBeGreaterThan(0);
    expect(result.sector_analysis.length).toBeGreaterThan(0);
    expect(result.zone_analysis.length).toBeGreaterThan(0);
  });

  it('prospect mappati producono analytics validi', () => {
    const rows = [
      {
        id: 'p1',
        status: 'new',
        lead_score: 40,
        sector: 'ecommerce',
        estimated_monthly_volume: 50,
        estimated_monthly_value: 2500,
        created_at: '2026-02-01T10:00:00Z',
        updated_at: '2026-02-01T10:00:00Z',
        converted_at: null,
        last_contact_at: null,
      },
      {
        id: 'p2',
        status: 'quote_sent',
        lead_score: 70,
        sector: 'pharma',
        estimated_monthly_volume: 100,
        estimated_monthly_value: 5000,
        created_at: '2026-02-01T10:00:00Z',
        updated_at: '2026-02-05T10:00:00Z',
        converted_at: null,
        last_contact_at: null,
      },
    ];

    const entities = mapProspectsToCrmEntities(rows);
    const result = computeCrmAnalytics(entities);

    expect(result.kpi.total).toBe(2);
    expect(result.kpi.active).toBe(2);
    // quote_sent → qualified nel funnel
    expect(result.funnel.qualified).toBe(1);
    // Prospect senza source → tutti "unknown"
    expect(result.source_analysis).toHaveLength(1);
    expect(result.source_analysis[0].source).toBe('unknown');
    // Prospect senza zone → tutti "unknown"
    expect(result.zone_analysis).toHaveLength(1);
    expect(result.zone_analysis[0].zone).toBe('unknown');
    // Pipeline con estimated_value
    expect(result.kpi.total_pipeline_value).toBe(2500 + 5000);
  });
});
