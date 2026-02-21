/**
 * Test CRM Health Rules — Regole di alerting/automazione
 *
 * Verifica tutte le regole pure per health check CRM:
 * - Prospect stale/cold
 * - Lead caldi non contattati
 * - Lead qualificati fermi
 * - Candidati win-back
 * - Funzione aggregata evaluateHealthRules
 */

import { describe, it, expect } from 'vitest';
import {
  checkStaleNewProspect,
  checkColdContactedProspect,
  checkHotLeadUncontacted,
  checkStaleQualifiedLead,
  checkWinbackCandidate,
  evaluateHealthRules,
  daysBetween,
  HEALTH_THRESHOLDS,
} from '@/lib/crm/health-rules';
import type { HealthCheckEntity } from '@/lib/crm/health-rules';

// Helper per creare entita di test
function buildEntity(overrides: Partial<HealthCheckEntity> = {}): HealthCheckEntity {
  return {
    id: 'test-id-1',
    company_name: 'Test Company',
    status: 'new',
    lead_score: 0,
    created_at: '2026-01-01T10:00:00Z',
    last_contact_at: null,
    updated_at: '2026-01-01T10:00:00Z',
    ...overrides,
  };
}

describe('daysBetween', () => {
  it('calcola correttamente i giorni tra due date', () => {
    const from = '2026-01-01T10:00:00Z';
    const to = new Date('2026-01-05T10:00:00Z');
    expect(daysBetween(from, to)).toBe(4);
  });

  it('restituisce 0 per date uguali', () => {
    const from = '2026-01-01T10:00:00Z';
    const to = new Date('2026-01-01T10:00:00Z');
    expect(daysBetween(from, to)).toBe(0);
  });

  it('gestisce frazioni di giorno', () => {
    const from = '2026-01-01T00:00:00Z';
    const to = new Date('2026-01-01T12:00:00Z');
    expect(daysBetween(from, to)).toBe(0.5);
  });
});

describe('checkStaleNewProspect', () => {
  const now = new Date('2026-01-10T10:00:00Z');

  it('genera alert per prospect new da >3 giorni', () => {
    const prospect = buildEntity({
      status: 'new',
      created_at: '2026-01-05T10:00:00Z', // 5 giorni fa
    });
    const alert = checkStaleNewProspect(prospect, now);
    expect(alert).not.toBeNull();
    expect(alert!.type).toBe('stale_new_prospect');
    expect(alert!.level).toBe('warning');
    expect(alert!.daysSinceEvent).toBe(5);
  });

  it('non genera alert per prospect new da <3 giorni', () => {
    const prospect = buildEntity({
      status: 'new',
      created_at: '2026-01-08T10:00:00Z', // 2 giorni fa
    });
    const alert = checkStaleNewProspect(prospect, now);
    expect(alert).toBeNull();
  });

  it('usa last_contact_at se presente', () => {
    const prospect = buildEntity({
      status: 'new',
      created_at: '2026-01-01T10:00:00Z', // 9 giorni fa
      last_contact_at: '2026-01-09T10:00:00Z', // 1 giorno fa
    });
    const alert = checkStaleNewProspect(prospect, now);
    expect(alert).toBeNull(); // ultimo contatto recente
  });

  it('ignora prospect non in stato new', () => {
    const prospect = buildEntity({ status: 'contacted' });
    expect(checkStaleNewProspect(prospect, now)).toBeNull();
  });

  it('ignora prospect won', () => {
    const prospect = buildEntity({ status: 'won' });
    expect(checkStaleNewProspect(prospect, now)).toBeNull();
  });
});

describe('checkColdContactedProspect', () => {
  const now = new Date('2026-01-20T10:00:00Z');

  it('genera alert per prospect contacted da >7 giorni', () => {
    const prospect = buildEntity({
      status: 'contacted',
      last_contact_at: '2026-01-10T10:00:00Z', // 10 giorni fa
    });
    const alert = checkColdContactedProspect(prospect, now);
    expect(alert).not.toBeNull();
    expect(alert!.type).toBe('cold_contacted_prospect');
    expect(alert!.level).toBe('warning');
    expect(alert!.daysSinceEvent).toBe(10);
  });

  it('non genera alert per contatto recente (<7 giorni)', () => {
    const prospect = buildEntity({
      status: 'contacted',
      last_contact_at: '2026-01-15T10:00:00Z', // 5 giorni fa
    });
    const alert = checkColdContactedProspect(prospect, now);
    expect(alert).toBeNull();
  });

  it('usa updated_at come fallback se no last_contact_at', () => {
    const prospect = buildEntity({
      status: 'contacted',
      last_contact_at: null,
      updated_at: '2026-01-05T10:00:00Z', // 15 giorni fa
    });
    const alert = checkColdContactedProspect(prospect, now);
    expect(alert).not.toBeNull();
    expect(alert!.daysSinceEvent).toBe(15);
  });

  it('ignora prospect non in stato contacted', () => {
    const prospect = buildEntity({ status: 'new' });
    expect(checkColdContactedProspect(prospect, now)).toBeNull();
  });
});

describe('checkHotLeadUncontacted', () => {
  const now = new Date('2026-01-05T10:00:00Z');

  it('genera alert critical per lead caldo (score >80) in stato new', () => {
    const lead = buildEntity({
      status: 'new',
      lead_score: 85,
      created_at: '2026-01-03T10:00:00Z', // 2 giorni fa
    });
    const alert = checkHotLeadUncontacted(lead, now);
    expect(alert).not.toBeNull();
    expect(alert!.type).toBe('hot_lead_uncontacted');
    expect(alert!.level).toBe('critical');
    expect(alert!.message).toContain('CALDO');
    expect(alert!.message).toContain('85');
  });

  it('non genera alert per score basso', () => {
    const lead = buildEntity({
      status: 'new',
      lead_score: 50,
    });
    expect(checkHotLeadUncontacted(lead, now)).toBeNull();
  });

  it('genera alert per score esattamente 80 (soglia inclusiva >= 80)', () => {
    const lead = buildEntity({
      status: 'new',
      lead_score: 80,
    });
    const alert = checkHotLeadUncontacted(lead, now);
    expect(alert).not.toBeNull();
    expect(alert!.level).toBe('critical');
  });

  it('non genera alert per score 79 (sotto soglia)', () => {
    const lead = buildEntity({
      status: 'new',
      lead_score: 79,
    });
    expect(checkHotLeadUncontacted(lead, now)).toBeNull();
  });

  it('non genera alert se lead gia contattato', () => {
    const lead = buildEntity({
      status: 'contacted',
      lead_score: 90,
    });
    expect(checkHotLeadUncontacted(lead, now)).toBeNull();
  });

  it('non genera alert se score null', () => {
    const lead = buildEntity({
      status: 'new',
      lead_score: null,
    });
    expect(checkHotLeadUncontacted(lead, now)).toBeNull();
  });
});

describe('checkStaleQualifiedLead', () => {
  const now = new Date('2026-01-15T10:00:00Z');

  it('genera alert per lead qualified fermo da >5 giorni', () => {
    const lead = buildEntity({
      status: 'qualified',
      last_contact_at: '2026-01-08T10:00:00Z', // 7 giorni fa
    });
    const alert = checkStaleQualifiedLead(lead, now);
    expect(alert).not.toBeNull();
    expect(alert!.type).toBe('stale_qualified_lead');
    expect(alert!.level).toBe('warning');
    expect(alert!.daysSinceEvent).toBe(7);
  });

  it('non genera alert per lead qualificato recente', () => {
    const lead = buildEntity({
      status: 'qualified',
      last_contact_at: '2026-01-12T10:00:00Z', // 3 giorni fa
    });
    expect(checkStaleQualifiedLead(lead, now)).toBeNull();
  });

  it('ignora lead non in stato qualified', () => {
    const lead = buildEntity({ status: 'negotiation' });
    expect(checkStaleQualifiedLead(lead, now)).toBeNull();
  });
});

describe('checkWinbackCandidate', () => {
  it('genera alert per lead lost da 30-37 giorni', () => {
    const now = new Date('2026-02-05T10:00:00Z');
    const entity = buildEntity({
      status: 'lost',
      updated_at: '2026-01-03T10:00:00Z', // ~33 giorni fa
    });
    const alert = checkWinbackCandidate(entity, 'lead', now);
    expect(alert).not.toBeNull();
    expect(alert!.type).toBe('winback_candidate');
    expect(alert!.level).toBe('info');
    expect(alert!.entityType).toBe('lead');
  });

  it('genera alert per prospect lost da 30-37 giorni', () => {
    const now = new Date('2026-02-02T10:00:00Z');
    const entity = buildEntity({
      status: 'lost',
      updated_at: '2026-01-01T10:00:00Z', // 32 giorni fa
    });
    const alert = checkWinbackCandidate(entity, 'prospect', now);
    expect(alert).not.toBeNull();
    expect(alert!.entityType).toBe('prospect');
  });

  it('non genera alert per lost da meno di 30 giorni', () => {
    const now = new Date('2026-01-20T10:00:00Z');
    const entity = buildEntity({
      status: 'lost',
      updated_at: '2026-01-05T10:00:00Z', // 15 giorni fa
    });
    expect(checkWinbackCandidate(entity, 'lead', now)).toBeNull();
  });

  it('non genera alert per lost da piu di 37 giorni (fuori finestra)', () => {
    const now = new Date('2026-02-15T10:00:00Z');
    const entity = buildEntity({
      status: 'lost',
      updated_at: '2026-01-01T10:00:00Z', // 45 giorni fa
    });
    expect(checkWinbackCandidate(entity, 'lead', now)).toBeNull();
  });

  it('ignora entita non in stato lost', () => {
    const now = new Date('2026-02-05T10:00:00Z');
    const entity = buildEntity({ status: 'new' });
    expect(checkWinbackCandidate(entity, 'lead', now)).toBeNull();
  });
});

describe('evaluateHealthRules', () => {
  const now = new Date('2026-01-15T10:00:00Z');

  it('applica regole prospect (stale new + cold contacted)', () => {
    const prospects = [
      buildEntity({
        id: 'p1',
        status: 'new',
        created_at: '2026-01-05T10:00:00Z', // 10 giorni fa → stale
      }),
      buildEntity({
        id: 'p2',
        status: 'contacted',
        last_contact_at: '2026-01-02T10:00:00Z', // 13 giorni fa → cold
      }),
      buildEntity({
        id: 'p3',
        status: 'new',
        created_at: '2026-01-14T10:00:00Z', // 1 giorno fa → ok
      }),
    ];

    const alerts = evaluateHealthRules(prospects, 'prospect', now);
    expect(alerts).toHaveLength(2);
    expect(alerts.map((a) => a.entityId)).toContain('p1');
    expect(alerts.map((a) => a.entityId)).toContain('p2');
    expect(alerts.map((a) => a.entityId)).not.toContain('p3');
  });

  it('applica regole lead (hot uncontacted + stale qualified)', () => {
    const leads = [
      buildEntity({
        id: 'l1',
        status: 'new',
        lead_score: 90,
        created_at: '2026-01-10T10:00:00Z',
      }),
      buildEntity({
        id: 'l2',
        status: 'qualified',
        last_contact_at: '2026-01-05T10:00:00Z', // 10 giorni fa → stale
      }),
      buildEntity({
        id: 'l3',
        status: 'contacted',
        lead_score: 50,
      }),
    ];

    const alerts = evaluateHealthRules(leads, 'lead', now);
    expect(alerts).toHaveLength(2);
    expect(alerts.find((a) => a.entityId === 'l1')?.type).toBe('hot_lead_uncontacted');
    expect(alerts.find((a) => a.entityId === 'l2')?.type).toBe('stale_qualified_lead');
  });

  it('include winback per entrambi i livelli', () => {
    const now = new Date('2026-02-05T10:00:00Z');
    const entities = [
      buildEntity({
        id: 'e1',
        status: 'lost',
        updated_at: '2026-01-03T10:00:00Z', // ~33 giorni fa
      }),
    ];

    const leadAlerts = evaluateHealthRules(entities, 'lead', now);
    expect(leadAlerts).toHaveLength(1);
    expect(leadAlerts[0].type).toBe('winback_candidate');
    expect(leadAlerts[0].entityType).toBe('lead');

    const prospectAlerts = evaluateHealthRules(entities, 'prospect', now);
    expect(prospectAlerts).toHaveLength(1);
    expect(prospectAlerts[0].entityType).toBe('prospect');
  });

  it('restituisce array vuoto per entita sane', () => {
    const leads = [
      buildEntity({
        id: 'l1',
        status: 'contacted',
        lead_score: 50,
        last_contact_at: '2026-01-14T10:00:00Z', // ieri
      }),
    ];
    const alerts = evaluateHealthRules(leads, 'lead', now);
    expect(alerts).toHaveLength(0);
  });

  it('restituisce array vuoto per lista vuota', () => {
    const alerts = evaluateHealthRules([], 'lead', now);
    expect(alerts).toHaveLength(0);
  });
});

describe('Costanti configurazione', () => {
  it('soglie hanno valori ragionevoli', () => {
    expect(HEALTH_THRESHOLDS.STALE_NEW_DAYS).toBe(3);
    expect(HEALTH_THRESHOLDS.COLD_CONTACTED_DAYS).toBe(7);
    expect(HEALTH_THRESHOLDS.HOT_SCORE_THRESHOLD).toBe(80);
    expect(HEALTH_THRESHOLDS.STALE_QUALIFIED_DAYS).toBe(5);
    expect(HEALTH_THRESHOLDS.WINBACK_DAYS).toBe(30);
    expect(HEALTH_THRESHOLDS.SCORE_DECAY_THRESHOLD).toBe(15);
  });
});
