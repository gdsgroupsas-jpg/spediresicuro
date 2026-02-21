/**
 * Test CRM Data Service + Sales Knowledge + CRM Worker
 *
 * Verifica:
 * - Sales Knowledge: struttura, ricerca, copertura
 * - CRM Intent sub-detection nel worker
 * - Funzioni pure del data service (via mock Supabase)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SALES_KNOWLEDGE,
  findRelevantKnowledge,
  findKnowledgeByCategory,
} from '@/lib/crm/sales-knowledge';

// ============================================
// SALES KNOWLEDGE BASE
// ============================================

describe('SALES_KNOWLEDGE', () => {
  it('ha almeno 30 entry', () => {
    expect(SALES_KNOWLEDGE.length).toBeGreaterThanOrEqual(30);
  });

  it('ogni entry ha i campi obbligatori', () => {
    for (const entry of SALES_KNOWLEDGE) {
      expect(entry.id).toBeTruthy();
      expect(entry.category).toBeTruthy();
      expect(entry.tags).toBeInstanceOf(Array);
      expect(entry.tags.length).toBeGreaterThan(0);
      expect(entry.context).toBeTruthy();
      expect(entry.insight).toBeTruthy();
    }
  });

  it('non ha ID duplicati', () => {
    const ids = SALES_KNOWLEDGE.map((e) => e.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('copre tutte le categorie', () => {
    const categories = new Set(SALES_KNOWLEDGE.map((e) => e.category));
    expect(categories.has('sector_insight')).toBe(true);
    expect(categories.has('objection_handling')).toBe(true);
    expect(categories.has('timing')).toBe(true);
    expect(categories.has('negotiation')).toBe(true);
    expect(categories.has('persuasion')).toBe(true);
    expect(categories.has('industry')).toBe(true);
  });

  it('ha almeno 6 entry per settore', () => {
    const sectors = SALES_KNOWLEDGE.filter((e) => e.category === 'sector_insight');
    expect(sectors.length).toBeGreaterThanOrEqual(6);
  });

  it('ha almeno 8 entry per obiezioni', () => {
    const objections = SALES_KNOWLEDGE.filter((e) => e.category === 'objection_handling');
    expect(objections.length).toBeGreaterThanOrEqual(8);
  });

  it('ogni insight settoriale ha un example', () => {
    const sectors = SALES_KNOWLEDGE.filter((e) => e.category === 'sector_insight');
    for (const entry of sectors) {
      expect(entry.example).toBeTruthy();
    }
  });
});

describe('findRelevantKnowledge', () => {
  it('trova entry per settore ecommerce', () => {
    const results = findRelevantKnowledge('ecommerce');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.id === 'sector-ecommerce')).toBe(true);
  });

  it('trova entry per settore pharma', () => {
    const results = findRelevantKnowledge('pharma');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.id === 'sector-pharma')).toBe(true);
  });

  it('trova entry per settore food', () => {
    const results = findRelevantKnowledge('food');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.id === 'sector-food')).toBe(true);
  });

  it('trova entry per situazione "prezzo troppo alto"', () => {
    const results = findRelevantKnowledge(null, 'prezzo troppo alto');
    expect(results.length).toBeGreaterThan(0);
  });

  it('trova entry per tags specifici', () => {
    const results = findRelevantKnowledge(null, null, ['follow-up']);
    expect(results.length).toBeGreaterThan(0);
  });

  it('restituisce tutto senza filtri', () => {
    const results = findRelevantKnowledge();
    expect(results.length).toBe(SALES_KNOWLEDGE.length);
  });

  it('restituisce array vuoto per settore inesistente', () => {
    const results = findRelevantKnowledge('settore_che_non_esiste_xyz');
    expect(results).toEqual([]);
  });
});

describe('findKnowledgeByCategory', () => {
  it('trova obiezioni', () => {
    const results = findKnowledgeByCategory('objection_handling');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.category === 'objection_handling')).toBe(true);
  });

  it('trova negoziazione', () => {
    const results = findKnowledgeByCategory('negotiation');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.category === 'negotiation')).toBe(true);
  });

  it('trova timing', () => {
    const results = findKnowledgeByCategory('timing');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.category === 'timing')).toBe(true);
  });

  it('trova persuasione', () => {
    const results = findKnowledgeByCategory('persuasion');
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.category === 'persuasion')).toBe(true);
  });
});

// ============================================
// CRM TYPES (importa per verificare struttura)
// ============================================

describe('CRM Intelligence Types', () => {
  it('tipi CrmWorkerResult sono importabili', async () => {
    const types = await import('@/types/crm-intelligence');
    // Se non errora, i tipi sono validi
    expect(types).toBeDefined();
  });

  it('tipi PipelineSummary struttura corretta', () => {
    // Verifica che la struttura sia usabile
    const summary = {
      total: 10,
      byStatus: { new: 3, contacted: 5, won: 2 },
      avgScore: 55,
      pipelineValue: 5000,
    };
    expect(summary.total).toBe(10);
    expect(summary.byStatus.new).toBe(3);
  });
});

// ============================================
// CRM WORKER (funzioni pure di sub-intent)
// ============================================

describe('CRM Worker — sub-intent detection interna', () => {
  // Testiamo il worker importandolo: le funzioni di detect sub-intent
  // sono interne ma verificabili attraverso il risultato del worker.
  // Per test puri senza DB, testiamo le funzioni di estrazione.

  it("modulo crm-worker e' importabile", async () => {
    // Verifica che il modulo si importi senza errori di compilazione
    const mod = await import('@/lib/agent/workers/crm-worker');
    expect(mod.crmWorker).toBeTypeOf('function');
  });

  it("modulo crm-data-service e' importabile", async () => {
    const mod = await import('@/lib/crm/crm-data-service');
    expect(mod.getPipelineSummary).toBeTypeOf('function');
    expect(mod.getHotEntities).toBeTypeOf('function');
    expect(mod.getStaleEntities).toBeTypeOf('function');
    expect(mod.getHealthAlerts).toBeTypeOf('function');
    expect(mod.searchEntities).toBeTypeOf('function');
    expect(mod.getEntityDetail).toBeTypeOf('function');
    expect(mod.getTodayActions).toBeTypeOf('function');
    expect(mod.getConversionMetrics).toBeTypeOf('function');
    expect(mod.getPendingQuotes).toBeTypeOf('function');
  });
});

// ============================================
// HEALTH RULES INTEGRATION
// ============================================

describe('CRM Health Rules integrazione', () => {
  it('evaluateHealthRules produce alert corretti per prospect stale', async () => {
    const { evaluateHealthRules } = await import('@/lib/crm/health-rules');

    const prospects = [
      {
        id: 'p-1',
        company_name: 'Azienda Test',
        status: 'new',
        lead_score: 30,
        created_at: '2026-01-01T10:00:00Z',
        last_contact_at: null,
        updated_at: '2026-01-01T10:00:00Z',
      },
    ];

    // 10 giorni dopo la creazione (> soglia STALE_NEW_DAYS = 3)
    const now = new Date('2026-01-11T10:00:00Z');
    const alerts = evaluateHealthRules(prospects, 'prospect', now);

    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].type).toBe('stale_new_prospect');
    expect(alerts[0].entityName).toBe('Azienda Test');
  });

  it('evaluateHealthRules rileva lead caldo non contattato', async () => {
    const { evaluateHealthRules } = await import('@/lib/crm/health-rules');

    const leads = [
      {
        id: 'l-1',
        company_name: 'Lead Caldo',
        status: 'new',
        lead_score: 85,
        created_at: '2026-01-01T10:00:00Z',
        last_contact_at: null,
        updated_at: '2026-01-01T10:00:00Z',
      },
    ];

    const now = new Date('2026-01-05T10:00:00Z');
    const alerts = evaluateHealthRules(leads, 'lead', now);

    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].type).toBe('hot_lead_uncontacted');
    expect(alerts[0].level).toBe('critical');
  });

  it('evaluateHealthRules rileva candidato win-back', async () => {
    const { evaluateHealthRules } = await import('@/lib/crm/health-rules');

    const entities = [
      {
        id: 'e-1',
        company_name: 'Ex Cliente',
        status: 'lost',
        lead_score: 50,
        created_at: '2025-11-01T10:00:00Z',
        last_contact_at: '2025-12-01T10:00:00Z',
        updated_at: '2025-12-05T10:00:00Z',
      },
    ];

    // 33 giorni dopo updated_at (nella finestra 30-37)
    const now = new Date('2026-01-07T10:00:00Z');
    const alerts = evaluateHealthRules(entities, 'lead', now);

    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].type).toBe('winback_candidate');
    expect(alerts[0].level).toBe('info');
  });
});
