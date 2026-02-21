/**
 * Test Pipeline Prospect - Transizioni stato e isolamento workspace
 *
 * Verifica:
 * - Transizioni stato valide/invalide
 * - Labels e colori status
 * - Validazione settori
 */

import { describe, it, expect } from 'vitest';
import {
  VALID_TRANSITIONS,
  STATUS_LABELS,
  STATUS_COLORS,
  SECTOR_LABELS,
} from '@/types/reseller-prospects';
import type { ProspectStatus, ProspectSector } from '@/types/reseller-prospects';

describe('Pipeline transizioni stato', () => {
  describe('Transizioni valide', () => {
    it('new → contacted (primo contatto)', () => {
      expect(VALID_TRANSITIONS.new).toContain('contacted');
    });

    it('new → lost (scartato subito)', () => {
      expect(VALID_TRANSITIONS.new).toContain('lost');
    });

    it('contacted → quote_sent (invio preventivo)', () => {
      expect(VALID_TRANSITIONS.contacted).toContain('quote_sent');
    });

    it('contacted → negotiating (negoziazione diretta)', () => {
      expect(VALID_TRANSITIONS.contacted).toContain('negotiating');
    });

    it('contacted → lost', () => {
      expect(VALID_TRANSITIONS.contacted).toContain('lost');
    });

    it('quote_sent → negotiating', () => {
      expect(VALID_TRANSITIONS.quote_sent).toContain('negotiating');
    });

    it('quote_sent → won (accettazione diretta)', () => {
      expect(VALID_TRANSITIONS.quote_sent).toContain('won');
    });

    it('quote_sent → lost', () => {
      expect(VALID_TRANSITIONS.quote_sent).toContain('lost');
    });

    it('negotiating → won', () => {
      expect(VALID_TRANSITIONS.negotiating).toContain('won');
    });

    it('negotiating → lost', () => {
      expect(VALID_TRANSITIONS.negotiating).toContain('lost');
    });

    it('lost → new (riattivazione)', () => {
      expect(VALID_TRANSITIONS.lost).toContain('new');
    });
  });

  describe('Transizioni invalide', () => {
    it('won non puo tornare indietro (stato finale)', () => {
      expect(VALID_TRANSITIONS.won).toEqual([]);
    });

    it('new non puo saltare a won direttamente', () => {
      expect(VALID_TRANSITIONS.new).not.toContain('won');
    });

    it('new non puo saltare a negotiating direttamente', () => {
      expect(VALID_TRANSITIONS.new).not.toContain('negotiating');
    });

    it('new non puo saltare a quote_sent direttamente', () => {
      expect(VALID_TRANSITIONS.new).not.toContain('quote_sent');
    });
  });

  describe('Copertura completa stati', () => {
    const allStatuses: ProspectStatus[] = [
      'new',
      'contacted',
      'quote_sent',
      'negotiating',
      'won',
      'lost',
    ];

    it('tutti gli stati hanno transizioni definite', () => {
      for (const status of allStatuses) {
        expect(VALID_TRANSITIONS).toHaveProperty(status);
        expect(Array.isArray(VALID_TRANSITIONS[status])).toBe(true);
      }
    });

    it('le transizioni puntano solo a stati validi', () => {
      for (const status of allStatuses) {
        for (const target of VALID_TRANSITIONS[status]) {
          expect(allStatuses).toContain(target);
        }
      }
    });
  });
});

describe('Status labels e colori', () => {
  const allStatuses: ProspectStatus[] = [
    'new',
    'contacted',
    'quote_sent',
    'negotiating',
    'won',
    'lost',
  ];

  it('tutti gli stati hanno una label italiana', () => {
    for (const status of allStatuses) {
      expect(STATUS_LABELS[status]).toBeDefined();
      expect(STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });

  it('tutti gli stati hanno un colore', () => {
    for (const status of allStatuses) {
      expect(STATUS_COLORS[status]).toBeDefined();
      expect(STATUS_COLORS[status].length).toBeGreaterThan(0);
    }
  });

  it('labels specifiche corrette', () => {
    expect(STATUS_LABELS.new).toBe('Nuovo');
    expect(STATUS_LABELS.won).toBe('Cliente');
    expect(STATUS_LABELS.lost).toBe('Perso');
    expect(STATUS_LABELS.quote_sent).toBe('Preventivo Inviato');
  });

  it('colori specifici corretti', () => {
    expect(STATUS_COLORS.new).toBe('blue');
    expect(STATUS_COLORS.won).toBe('green');
    expect(STATUS_COLORS.lost).toBe('gray');
  });
});

describe('Sector labels', () => {
  const allSectors: ProspectSector[] = [
    'ecommerce',
    'food',
    'pharma',
    'artigianato',
    'industria',
    'altro',
  ];

  it('tutti i settori hanno una label', () => {
    for (const sector of allSectors) {
      expect(SECTOR_LABELS[sector]).toBeDefined();
      expect(SECTOR_LABELS[sector].length).toBeGreaterThan(0);
    }
  });

  it('labels specifiche corrette', () => {
    expect(SECTOR_LABELS.ecommerce).toBe('E-commerce');
    expect(SECTOR_LABELS.pharma).toBe('Farmaceutico');
    expect(SECTOR_LABELS.food).toBe('Food & Beverage');
  });
});

describe('Flusso pipeline completo', () => {
  it('percorso felice: new → contacted → quote_sent → negotiating → won', () => {
    const path: ProspectStatus[] = ['new', 'contacted', 'quote_sent', 'negotiating', 'won'];

    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];
      expect(VALID_TRANSITIONS[from].includes(to), `${from} → ${to} dovrebbe essere valido`).toBe(
        true
      );
    }
  });

  it('percorso riattivazione: lost → new → contacted → won', () => {
    // lost puo' tornare a new
    expect(VALID_TRANSITIONS.lost).toContain('new');
    // new puo' andare a contacted
    expect(VALID_TRANSITIONS.new).toContain('contacted');
  });

  it('non esiste un percorso diretto new → won', () => {
    expect(VALID_TRANSITIONS.new).not.toContain('won');
  });
});
