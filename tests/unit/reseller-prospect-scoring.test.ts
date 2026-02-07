/**
 * Test Lead Scoring Algorithm
 *
 * Verifica il calcolo del punteggio prospect 0-100
 * basato su completezza dati, potenziale, engagement e pipeline.
 */

import { describe, it, expect } from 'vitest';
import { calculateLeadScore, getScoreLabel, getScoreColor } from '@/lib/crm/lead-scoring';
import type { LeadScoreInput } from '@/lib/crm/lead-scoring';

// Timestamp fisso per test deterministici
const NOW = new Date('2026-02-08T12:00:00Z');
const CREATED_AT = '2026-02-07T10:00:00Z'; // ieri

function makeInput(overrides: Partial<LeadScoreInput> = {}): LeadScoreInput {
  return {
    status: 'new',
    created_at: CREATED_AT,
    ...overrides,
  };
}

describe('calculateLeadScore', () => {
  describe('Base score', () => {
    it('prospect vuoto dovrebbe avere score base = 10', () => {
      const score = calculateLeadScore(makeInput(), NOW);
      expect(score).toBe(10);
    });
  });

  describe('Completezza dati', () => {
    it('+10 se ha email', () => {
      const score = calculateLeadScore(makeInput({ email: 'test@test.com' }), NOW);
      expect(score).toBe(20); // 10 base + 10 email
    });

    it('+5 se ha telefono', () => {
      const score = calculateLeadScore(makeInput({ phone: '+39123456789' }), NOW);
      expect(score).toBe(15); // 10 base + 5 phone
    });

    it('+15 se ha email + telefono', () => {
      const score = calculateLeadScore(
        makeInput({ email: 'test@test.com', phone: '+39123456789' }),
        NOW
      );
      expect(score).toBe(25); // 10 + 10 + 5
    });
  });

  describe('Potenziale business', () => {
    it('+15 per volume > 50 spedizioni/mese', () => {
      const score = calculateLeadScore(makeInput({ estimated_monthly_volume: 80 }), NOW);
      expect(score).toBe(25); // 10 + 15
    });

    it('+25 per volume > 200 spedizioni/mese (sostituisce +15)', () => {
      const score = calculateLeadScore(makeInput({ estimated_monthly_volume: 300 }), NOW);
      expect(score).toBe(35); // 10 + 25
    });

    it('nessun bonus per volume <= 50', () => {
      const score = calculateLeadScore(makeInput({ estimated_monthly_volume: 30 }), NOW);
      expect(score).toBe(10);
    });

    it('+10 per settore ecommerce', () => {
      const score = calculateLeadScore(makeInput({ sector: 'ecommerce' }), NOW);
      expect(score).toBe(20); // 10 + 10
    });

    it('+10 per settore pharma', () => {
      const score = calculateLeadScore(makeInput({ sector: 'pharma' }), NOW);
      expect(score).toBe(20); // 10 + 10
    });

    it('nessun bonus per settore food', () => {
      const score = calculateLeadScore(makeInput({ sector: 'food' }), NOW);
      expect(score).toBe(10);
    });
  });

  describe('Engagement email', () => {
    it('+5 per 1 apertura email', () => {
      const score = calculateLeadScore(makeInput({ email_open_count: 1 }), NOW);
      expect(score).toBe(15); // 10 + 5
    });

    it('+10 per 2 aperture email', () => {
      const score = calculateLeadScore(makeInput({ email_open_count: 2 }), NOW);
      expect(score).toBe(20); // 10 + 10
    });

    it('cap a +15 per molte aperture', () => {
      const score = calculateLeadScore(makeInput({ email_open_count: 10 }), NOW);
      expect(score).toBe(25); // 10 + 15 (cap)
    });
  });

  describe('Contatto rapido', () => {
    it('+10 se contattato entro 24h dalla creazione', () => {
      const score = calculateLeadScore(
        makeInput({
          created_at: '2026-02-07T10:00:00Z',
          last_contact_at: '2026-02-07T18:00:00Z', // 8 ore dopo
        }),
        NOW
      );
      // 10 base + 10 contatto rapido + 5 contatto recente (< 7gg)
      expect(score).toBe(25);
    });

    it('nessun bonus se contattato dopo 24h', () => {
      const score = calculateLeadScore(
        makeInput({
          created_at: '2026-02-05T10:00:00Z',
          last_contact_at: '2026-02-07T10:00:00Z', // 48h dopo
        }),
        NOW
      );
      // 10 base + 5 contatto recente (< 7gg) = 15 (no bonus 24h)
      expect(score).toBe(15);
    });
  });

  describe('Pipeline', () => {
    it('+15 se ha preventivo collegato', () => {
      const score = calculateLeadScore(makeInput({ linked_quote_ids: ['quote-1'] }), NOW);
      expect(score).toBe(25); // 10 + 15
    });

    it('+15 se status = quote_sent', () => {
      const score = calculateLeadScore(makeInput({ status: 'quote_sent' }), NOW);
      expect(score).toBe(25); // 10 + 15
    });

    it('+10 se status = negotiating', () => {
      const score = calculateLeadScore(makeInput({ status: 'negotiating' }), NOW);
      expect(score).toBe(20); // 10 + 10
    });
  });

  describe('Decay per inattivita', () => {
    it('+5 se ultimo contatto < 7 giorni', () => {
      const score = calculateLeadScore(makeInput({ last_contact_at: '2026-02-06T10:00:00Z' }), NOW);
      expect(score).toBe(15); // 10 + 5
    });

    it('-10 se ultimo contatto > 14 giorni', () => {
      const score = calculateLeadScore(makeInput({ last_contact_at: '2026-01-20T10:00:00Z' }), NOW);
      expect(score).toBe(0); // 10 - 10 = 0
    });

    it('-20 se ultimo contatto > 30 giorni', () => {
      const score = calculateLeadScore(makeInput({ last_contact_at: '2026-01-01T10:00:00Z' }), NOW);
      expect(score).toBe(0); // 10 - 20 = -10 → clamp a 0
    });
  });

  describe('Clamp 0-100', () => {
    it('non dovrebbe scendere sotto 0', () => {
      const score = calculateLeadScore(makeInput({ last_contact_at: '2025-12-01T10:00:00Z' }), NOW);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('non dovrebbe superare 100', () => {
      // Prospect "perfetto" con tutti i bonus
      const score = calculateLeadScore(
        makeInput({
          email: 'test@test.com',
          phone: '+39123',
          sector: 'ecommerce',
          estimated_monthly_volume: 500,
          email_open_count: 10,
          status: 'negotiating',
          linked_quote_ids: ['q1'],
          last_contact_at: '2026-02-08T10:00:00Z',
          created_at: '2026-02-08T08:00:00Z',
        }),
        NOW
      );
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('Scenari realistici', () => {
    it('prospect freddo: solo nome azienda', () => {
      const score = calculateLeadScore(makeInput(), NOW);
      expect(score).toBe(10);
      expect(getScoreLabel(score)).toBe('Molto Freddo');
    });

    it('prospect tiepido: email + settore ecommerce + volume medio', () => {
      const score = calculateLeadScore(
        makeInput({
          email: 'info@shop.it',
          sector: 'ecommerce',
          estimated_monthly_volume: 100,
          last_contact_at: '2026-02-06T10:00:00Z',
        }),
        NOW
      );
      // 10 + 10(email) + 10(ecommerce) + 15(volume) + 5(recente) = 50
      expect(score).toBe(50);
      expect(getScoreLabel(score)).toBe('Freddo');
    });

    it('prospect caldo: tutti i dati + preventivo + negoziazione', () => {
      const score = calculateLeadScore(
        makeInput({
          email: 'info@bigshop.it',
          phone: '+39333123456',
          sector: 'ecommerce',
          estimated_monthly_volume: 300,
          email_open_count: 3,
          status: 'negotiating',
          linked_quote_ids: ['q1'],
          last_contact_at: '2026-02-08T08:00:00Z',
          created_at: '2026-02-07T08:00:00Z',
        }),
        NOW
      );
      // 10 + 10 + 5 + 25 + 10 + 15 + 15 + 10 + 10 + 5 = 115 → clamp 100
      // Ma HAS_QUOTE e negotiating si sommano: 10+10+5+25+10+15+15+10+10+5 = 115 → 100
      expect(score).toBe(100);
      expect(getScoreLabel(score)).toBe('Caldo');
    });
  });
});

describe('getScoreLabel', () => {
  it('>=80 = Caldo', () => expect(getScoreLabel(80)).toBe('Caldo'));
  it('>=60 = Tiepido', () => expect(getScoreLabel(60)).toBe('Tiepido'));
  it('>=40 = Freddo', () => expect(getScoreLabel(40)).toBe('Freddo'));
  it('<40 = Molto Freddo', () => expect(getScoreLabel(20)).toBe('Molto Freddo'));
});

describe('getScoreColor', () => {
  it('>=80 = red', () => expect(getScoreColor(80)).toBe('red'));
  it('>=60 = orange', () => expect(getScoreColor(60)).toBe('orange'));
  it('>=40 = yellow', () => expect(getScoreColor(40)).toBe('yellow'));
  it('<40 = gray', () => expect(getScoreColor(20)).toBe('gray'));
});
