/**
 * Test Lead Scoring per CRM Livello 1
 *
 * Verifica che calculateLeadScore funzioni correttamente
 * nel contesto dei lead platform (con mapping status lead→prospect).
 *
 * NB: I test dettagliati del scoring puro sono in reseller-prospect-scoring.test.ts
 * Qui testiamo l'applicazione al contesto lead.
 */

import { describe, it, expect } from 'vitest';
import { calculateLeadScore, getScoreLabel, getScoreColor } from '@/lib/crm/lead-scoring';
import type { LeadScoreInput } from '@/lib/crm/lead-scoring';
import type { LeadStatus } from '@/types/leads';

// Helper: crea input score da dati lead
function buildLeadInput(overrides: Partial<LeadScoreInput> = {}): LeadScoreInput {
  return {
    status: 'new',
    created_at: '2026-01-01T10:00:00Z',
    ...overrides,
  };
}

// Mapping status lead → prospect (come in leads.ts server action)
function mapStatus(
  status: LeadStatus
): 'new' | 'contacted' | 'quote_sent' | 'negotiating' | 'won' | 'lost' {
  const map: Record<
    LeadStatus,
    'new' | 'contacted' | 'quote_sent' | 'negotiating' | 'won' | 'lost'
  > = {
    new: 'new',
    contacted: 'contacted',
    qualified: 'contacted',
    negotiation: 'negotiating',
    won: 'won',
    lost: 'lost',
  };
  return map[status];
}

describe('Lead scoring applicato a lead platform', () => {
  const now = new Date('2026-01-05T10:00:00Z');

  describe('Score base', () => {
    it('lead vuoto ottiene solo punteggio base (10)', () => {
      const score = calculateLeadScore(buildLeadInput(), now);
      expect(score).toBe(10);
    });

    it('lead con email ottiene +10', () => {
      const score = calculateLeadScore(buildLeadInput({ email: 'test@example.com' }), now);
      expect(score).toBe(20); // 10 base + 10 email
    });

    it('lead con email + telefono ottiene +15', () => {
      const score = calculateLeadScore(
        buildLeadInput({ email: 'test@example.com', phone: '+39123456789' }),
        now
      );
      expect(score).toBe(25); // 10 + 10 + 5
    });
  });

  describe('Potenziale business', () => {
    it('volume > 50/mese aggiunge +15', () => {
      const score = calculateLeadScore(buildLeadInput({ estimated_monthly_volume: 80 }), now);
      expect(score).toBe(25); // 10 + 15
    });

    it('volume > 200/mese aggiunge +25 (sostituisce +15)', () => {
      const score = calculateLeadScore(buildLeadInput({ estimated_monthly_volume: 300 }), now);
      expect(score).toBe(35); // 10 + 25
    });

    it('settore ecommerce aggiunge +10', () => {
      const score = calculateLeadScore(buildLeadInput({ sector: 'ecommerce' }), now);
      expect(score).toBe(20); // 10 + 10
    });

    it('settore pharma aggiunge +10', () => {
      const score = calculateLeadScore(buildLeadInput({ sector: 'pharma' }), now);
      expect(score).toBe(20); // 10 + 10
    });

    it('settore artigianato non aggiunge bonus', () => {
      const score = calculateLeadScore(buildLeadInput({ sector: 'artigianato' }), now);
      expect(score).toBe(10); // solo base
    });
  });

  describe('Mapping status lead → prospect per scoring', () => {
    it('qualified mappa a contacted (nessun bonus pipeline)', () => {
      expect(mapStatus('qualified')).toBe('contacted');
      const score = calculateLeadScore(buildLeadInput({ status: mapStatus('qualified') }), now);
      // 'contacted' non da bonus pipeline specifico
      expect(score).toBe(10);
    });

    it('negotiation mappa a negotiating (+10 pipeline)', () => {
      expect(mapStatus('negotiation')).toBe('negotiating');
      const score = calculateLeadScore(buildLeadInput({ status: mapStatus('negotiation') }), now);
      expect(score).toBe(20); // 10 base + 10 negotiating
    });
  });

  describe('Engagement e recency', () => {
    it('contatto recente (< 7gg) aggiunge +5', () => {
      const score = calculateLeadScore(
        buildLeadInput({
          last_contact_at: '2026-01-02T10:00:00Z', // 3 giorni fa
        }),
        now
      );
      expect(score).toBe(25); // 10 + 10 (contatto rapido <24h) + 5 (recente)
    });

    it('contatto stale (> 14gg) sottrae -10', () => {
      const staleNow = new Date('2026-01-20T10:00:00Z');
      const score = calculateLeadScore(
        buildLeadInput({
          last_contact_at: '2026-01-02T10:00:00Z', // 18 giorni fa
        }),
        staleNow
      );
      expect(score).toBe(10); // 10 + 10 (contatto rapido) - 10 (stale 14d)
    });

    it('contatto molto stale (> 30gg) sottrae -20', () => {
      const veryStaleNow = new Date('2026-02-10T10:00:00Z');
      const score = calculateLeadScore(
        buildLeadInput({
          last_contact_at: '2026-01-02T10:00:00Z', // 39 giorni fa
        }),
        veryStaleNow
      );
      expect(score).toBe(0); // 10 + 10 (contatto rapido) - 20 (stale 30d) = 0 (clamped)
    });

    it('email aperte aggiungono +5 per apertura (max +15)', () => {
      const score = calculateLeadScore(buildLeadInput({ email_open_count: 5 }), now);
      expect(score).toBe(25); // 10 + 15 (cap email opens)
    });
  });

  describe('Lead completo (scenario reale)', () => {
    it('lead caldo: ecommerce + alto volume + negoziazione + contatto recente', () => {
      const score = calculateLeadScore(
        buildLeadInput({
          email: 'hot@ecommerce.it',
          phone: '+39123',
          sector: 'ecommerce',
          estimated_monthly_volume: 300,
          status: 'negotiating', // mappato da negotiation
          email_open_count: 3,
          last_contact_at: '2026-01-04T10:00:00Z',
        }),
        now
      );
      // 10 base + 10 email + 5 phone + 10 ecommerce + 25 volume
      // + 15 email opens (3*5 capped at 15) + 10 negotiating + 5 recente (<7gg)
      // NB: contatto rapido NON si attiva (last_contact 3gg dopo created_at, >24h)
      expect(score).toBe(90);
    });

    it('lead freddo: solo nome azienda, nessun contatto', () => {
      const score = calculateLeadScore(buildLeadInput(), now);
      expect(score).toBe(10); // solo base
    });

    it('lead tiepido: email + settore + volume medio', () => {
      const score = calculateLeadScore(
        buildLeadInput({
          email: 'info@example.com',
          sector: 'pharma',
          estimated_monthly_volume: 80,
        }),
        now
      );
      // 10 base + 10 email + 10 pharma + 15 volume medio = 45
      expect(score).toBe(45);
    });
  });
});

describe('Score labels e colori (applicazione lead)', () => {
  it('score >= 80 = Caldo (rosso)', () => {
    expect(getScoreLabel(85)).toBe('Caldo');
    expect(getScoreColor(85)).toBe('red');
  });

  it('score >= 60 = Tiepido (arancio)', () => {
    expect(getScoreLabel(65)).toBe('Tiepido');
    expect(getScoreColor(65)).toBe('orange');
  });

  it('score >= 40 = Freddo (giallo)', () => {
    expect(getScoreLabel(45)).toBe('Freddo');
    expect(getScoreColor(45)).toBe('yellow');
  });

  it('score < 40 = Molto Freddo (grigio)', () => {
    expect(getScoreLabel(20)).toBe('Molto Freddo');
    expect(getScoreColor(20)).toBe('gray');
  });
});
