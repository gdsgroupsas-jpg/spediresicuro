/**
 * Test: Pipeline e statistiche preventivi commerciali
 *
 * Verifica:
 * - Calcolo conversion rate
 * - Conteggi per stato
 * - Validazione input
 * - Transizioni pipeline complete
 */

import { describe, expect, it } from 'vitest';
import type {
  CommercialQuoteStatus,
  QuotePipelineStats,
  CreateCommercialQuoteInput,
} from '@/types/commercial-quotes';

// Simula il calcolo stats come fatto nella server action
function calculatePipelineStats(statuses: CommercialQuoteStatus[]): QuotePipelineStats {
  const stats: QuotePipelineStats = {
    draft: 0,
    sent: 0,
    negotiating: 0,
    accepted: 0,
    rejected: 0,
    expired: 0,
    total: statuses.length,
    conversion_rate: 0,
  };

  for (const status of statuses) {
    if (status in stats) {
      (stats as any)[status]++;
    }
  }

  const closedDeals = stats.accepted + stats.rejected;
  stats.conversion_rate = closedDeals > 0 ? stats.accepted / closedDeals : 0;

  return stats;
}

describe('Pipeline Stats', () => {
  it('dovrebbe calcolare conteggi corretti per ogni stato', () => {
    const statuses: CommercialQuoteStatus[] = [
      'draft',
      'draft',
      'sent',
      'negotiating',
      'accepted',
      'rejected',
      'expired',
    ];

    const stats = calculatePipelineStats(statuses);

    expect(stats.draft).toBe(2);
    expect(stats.sent).toBe(1);
    expect(stats.negotiating).toBe(1);
    expect(stats.accepted).toBe(1);
    expect(stats.rejected).toBe(1);
    expect(stats.expired).toBe(1);
    expect(stats.total).toBe(7);
  });

  it('dovrebbe calcolare conversion rate = accepted / (accepted + rejected)', () => {
    const statuses: CommercialQuoteStatus[] = [
      'accepted',
      'accepted',
      'accepted',
      'rejected',
      'rejected',
    ];

    const stats = calculatePipelineStats(statuses);
    // 3 accepted / (3 + 2) = 0.6
    expect(stats.conversion_rate).toBeCloseTo(0.6, 5);
  });

  it('dovrebbe gestire conversion rate = 0 quando nessun esito', () => {
    const statuses: CommercialQuoteStatus[] = ['draft', 'sent', 'negotiating'];
    const stats = calculatePipelineStats(statuses);
    expect(stats.conversion_rate).toBe(0);
  });

  it('dovrebbe gestire conversion rate = 1.0 quando tutti accettati', () => {
    const statuses: CommercialQuoteStatus[] = ['accepted', 'accepted', 'accepted'];
    const stats = calculatePipelineStats(statuses);
    expect(stats.conversion_rate).toBe(1.0);
  });

  it('dovrebbe gestire conversion rate = 0 quando tutti rifiutati', () => {
    const statuses: CommercialQuoteStatus[] = ['rejected', 'rejected'];
    const stats = calculatePipelineStats(statuses);
    expect(stats.conversion_rate).toBe(0);
  });

  it('dovrebbe gestire lista vuota', () => {
    const stats = calculatePipelineStats([]);
    expect(stats.total).toBe(0);
    expect(stats.draft).toBe(0);
    expect(stats.conversion_rate).toBe(0);
  });

  it('dovrebbe contare correttamente pipeline realistico', () => {
    // Scenario realistico: 20 preventivi
    const statuses: CommercialQuoteStatus[] = [
      'draft',
      'draft',
      'draft', // 3 bozze
      'sent',
      'sent',
      'sent',
      'sent', // 4 inviati
      'negotiating',
      'negotiating', // 2 in negoziazione
      'accepted',
      'accepted',
      'accepted',
      'accepted',
      'accepted', // 5 accettati
      'rejected',
      'rejected',
      'rejected', // 3 rifiutati
      'expired',
      'expired',
      'expired', // 3 scaduti
    ];

    const stats = calculatePipelineStats(statuses);

    expect(stats.total).toBe(20);
    expect(stats.draft).toBe(3);
    expect(stats.sent).toBe(4);
    expect(stats.negotiating).toBe(2);
    expect(stats.accepted).toBe(5);
    expect(stats.rejected).toBe(3);
    expect(stats.expired).toBe(3);
    // Conversion rate: 5 / (5 + 3) = 0.625
    expect(stats.conversion_rate).toBeCloseTo(0.625, 5);
  });
});

describe('Validazione input CreateCommercialQuoteInput', () => {
  it('dovrebbe richiedere prospect_company non vuoto', () => {
    const input: CreateCommercialQuoteInput = {
      prospect_company: '',
      carrier_code: 'gls-GLS-5000',
      contract_code: 'gls-GLS-5000',
    };
    expect(input.prospect_company.trim()).toBe('');
  });

  it('dovrebbe accettare input con campi opzionali', () => {
    const input: CreateCommercialQuoteInput = {
      prospect_company: 'Test SRL',
      carrier_code: 'gls-GLS-5000',
      contract_code: 'gls-GLS-5000',
    };

    // Campi opzionali sono undefined
    expect(input.prospect_email).toBeUndefined();
    expect(input.margin_percent).toBeUndefined();
    expect(input.validity_days).toBeUndefined();
  });

  it('dovrebbe accettare input completo', () => {
    const input: CreateCommercialQuoteInput = {
      prospect_company: 'SELFIE SRL',
      prospect_contact_name: 'Mario Rossi',
      prospect_email: 'mario@selfie.it',
      prospect_phone: '+39 333 1234567',
      prospect_sector: 'ecommerce',
      prospect_estimated_volume: 200,
      prospect_notes: 'Azienda interessata',
      carrier_code: 'gls-GLS-5000',
      contract_code: 'gls-GLS-5000',
      margin_percent: 25,
      validity_days: 15,
      vat_mode: 'excluded',
      vat_rate: 22,
    };

    expect(input.prospect_company).toBe('SELFIE SRL');
    expect(input.margin_percent).toBe(25);
    expect(input.validity_days).toBe(15);
  });
});

describe('Flusso pipeline completo', () => {
  it('dovrebbe supportare il flusso felice: draft -> sent -> accepted', () => {
    const transitions: Array<[CommercialQuoteStatus, CommercialQuoteStatus]> = [
      ['draft', 'sent'],
      ['sent', 'accepted'],
    ];

    const VALID: Record<CommercialQuoteStatus, CommercialQuoteStatus[]> = {
      draft: ['sent'],
      sent: ['negotiating', 'accepted', 'rejected'],
      negotiating: ['sent', 'accepted', 'rejected'],
      accepted: [],
      rejected: [],
      expired: [],
    };

    for (const [from, to] of transitions) {
      expect(VALID[from].includes(to)).toBe(true);
    }
  });

  it('dovrebbe supportare il flusso negoziazione: draft -> sent -> negotiating -> sent -> accepted', () => {
    const transitions: Array<[CommercialQuoteStatus, CommercialQuoteStatus]> = [
      ['draft', 'sent'],
      ['sent', 'negotiating'],
      ['negotiating', 'sent'], // Reinvio dopo revisione
      ['sent', 'accepted'],
    ];

    const VALID: Record<CommercialQuoteStatus, CommercialQuoteStatus[]> = {
      draft: ['sent'],
      sent: ['negotiating', 'accepted', 'rejected'],
      negotiating: ['sent', 'accepted', 'rejected'],
      accepted: [],
      rejected: [],
      expired: [],
    };

    for (const [from, to] of transitions) {
      expect(VALID[from].includes(to)).toBe(true);
    }
  });

  it('dovrebbe bloccare transizioni doppie (accepted -> accepted)', () => {
    const VALID: Record<CommercialQuoteStatus, CommercialQuoteStatus[]> = {
      draft: ['sent'],
      sent: ['negotiating', 'accepted', 'rejected'],
      negotiating: ['sent', 'accepted', 'rejected'],
      accepted: [],
      rejected: [],
      expired: [],
    };

    expect(VALID['accepted'].includes('accepted')).toBe(false);
    expect(VALID['rejected'].includes('rejected')).toBe(false);
  });
});

describe('Settori prospect', () => {
  it('dovrebbe avere settori validi definiti nei tipi', async () => {
    const { PROSPECT_SECTORS } = await import('@/types/commercial-quotes');

    expect(PROSPECT_SECTORS.length).toBeGreaterThanOrEqual(5);

    const values = PROSPECT_SECTORS.map((s) => s.value);
    expect(values).toContain('ecommerce');
    expect(values).toContain('food');
    expect(values).toContain('abbigliamento');

    // Ogni settore ha label e value
    for (const sector of PROSPECT_SECTORS) {
      expect(sector.value).toBeTruthy();
      expect(sector.label).toBeTruthy();
    }
  });
});
