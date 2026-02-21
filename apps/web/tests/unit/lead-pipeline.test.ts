/**
 * Test Pipeline Lead - Transizioni stato e labels (CRM Livello 1)
 *
 * Verifica:
 * - Transizioni stato valide/invalide per lead platform
 * - Labels e colori status
 * - Labels source, settore, zona
 * - Mapping status per scoring
 */

import { describe, it, expect } from 'vitest';
import {
  LEAD_VALID_TRANSITIONS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_COLORS,
  LEAD_SOURCE_LABELS,
  LEAD_SECTOR_LABELS,
  GEOGRAPHIC_ZONE_LABELS,
} from '@/types/leads';
import type { LeadStatus, LeadSource, LeadSector, GeographicZone } from '@/types/leads';

describe('Pipeline lead transizioni stato', () => {
  describe('Transizioni valide', () => {
    it('new → contacted (primo contatto)', () => {
      expect(LEAD_VALID_TRANSITIONS.new).toContain('contacted');
    });

    it('new → lost (scartato subito)', () => {
      expect(LEAD_VALID_TRANSITIONS.new).toContain('lost');
    });

    it('contacted → qualified (qualificazione)', () => {
      expect(LEAD_VALID_TRANSITIONS.contacted).toContain('qualified');
    });

    it('contacted → lost', () => {
      expect(LEAD_VALID_TRANSITIONS.contacted).toContain('lost');
    });

    it('qualified → negotiation', () => {
      expect(LEAD_VALID_TRANSITIONS.qualified).toContain('negotiation');
    });

    it('qualified → won (conversione diretta)', () => {
      expect(LEAD_VALID_TRANSITIONS.qualified).toContain('won');
    });

    it('qualified → lost', () => {
      expect(LEAD_VALID_TRANSITIONS.qualified).toContain('lost');
    });

    it('negotiation → won', () => {
      expect(LEAD_VALID_TRANSITIONS.negotiation).toContain('won');
    });

    it('negotiation → lost', () => {
      expect(LEAD_VALID_TRANSITIONS.negotiation).toContain('lost');
    });

    it('lost → new (riattivazione)', () => {
      expect(LEAD_VALID_TRANSITIONS.lost).toContain('new');
    });
  });

  describe('Transizioni invalide', () => {
    it('won non puo tornare indietro (stato finale)', () => {
      expect(LEAD_VALID_TRANSITIONS.won).toEqual([]);
    });

    it('new non puo saltare a won direttamente', () => {
      expect(LEAD_VALID_TRANSITIONS.new).not.toContain('won');
    });

    it('new non puo saltare a qualified direttamente', () => {
      expect(LEAD_VALID_TRANSITIONS.new).not.toContain('qualified');
    });

    it('new non puo saltare a negotiation direttamente', () => {
      expect(LEAD_VALID_TRANSITIONS.new).not.toContain('negotiation');
    });

    it('contacted non puo saltare a won direttamente', () => {
      expect(LEAD_VALID_TRANSITIONS.contacted).not.toContain('won');
    });

    it('contacted non puo saltare a negotiation direttamente', () => {
      expect(LEAD_VALID_TRANSITIONS.contacted).not.toContain('negotiation');
    });
  });

  describe('Copertura completa stati', () => {
    const allStatuses: LeadStatus[] = [
      'new',
      'contacted',
      'qualified',
      'negotiation',
      'won',
      'lost',
    ];

    it('tutti gli stati hanno transizioni definite', () => {
      for (const status of allStatuses) {
        expect(LEAD_VALID_TRANSITIONS).toHaveProperty(status);
        expect(Array.isArray(LEAD_VALID_TRANSITIONS[status])).toBe(true);
      }
    });

    it('le transizioni puntano solo a stati validi', () => {
      for (const status of allStatuses) {
        for (const target of LEAD_VALID_TRANSITIONS[status]) {
          expect(allStatuses).toContain(target);
        }
      }
    });
  });
});

describe('Lead status labels e colori', () => {
  const allStatuses: LeadStatus[] = ['new', 'contacted', 'qualified', 'negotiation', 'won', 'lost'];

  it('tutti gli stati hanno una label italiana', () => {
    for (const status of allStatuses) {
      expect(LEAD_STATUS_LABELS[status]).toBeDefined();
      expect(LEAD_STATUS_LABELS[status].length).toBeGreaterThan(0);
    }
  });

  it('tutti gli stati hanno un colore', () => {
    for (const status of allStatuses) {
      expect(LEAD_STATUS_COLORS[status]).toBeDefined();
      expect(LEAD_STATUS_COLORS[status].length).toBeGreaterThan(0);
    }
  });

  it('labels specifiche corrette', () => {
    expect(LEAD_STATUS_LABELS.new).toBe('Nuovo');
    expect(LEAD_STATUS_LABELS.won).toBe('Convertito');
    expect(LEAD_STATUS_LABELS.lost).toBe('Perso');
    expect(LEAD_STATUS_LABELS.qualified).toBe('Qualificato');
    expect(LEAD_STATUS_LABELS.negotiation).toBe('In Negoziazione');
  });

  it('colori specifici corretti', () => {
    expect(LEAD_STATUS_COLORS.new).toBe('blue');
    expect(LEAD_STATUS_COLORS.won).toBe('green');
    expect(LEAD_STATUS_COLORS.lost).toBe('gray');
  });
});

describe('Lead source labels', () => {
  const allSources: LeadSource[] = [
    'direct',
    'website_form',
    'referral',
    'cold_outreach',
    'event',
    'partner',
  ];

  it('tutte le fonti hanno una label', () => {
    for (const source of allSources) {
      expect(LEAD_SOURCE_LABELS[source]).toBeDefined();
      expect(LEAD_SOURCE_LABELS[source].length).toBeGreaterThan(0);
    }
  });

  it('labels specifiche corrette', () => {
    expect(LEAD_SOURCE_LABELS.direct).toBe('Diretto');
    expect(LEAD_SOURCE_LABELS.referral).toBe('Referral');
    expect(LEAD_SOURCE_LABELS.website_form).toBe('Form Sito Web');
  });
});

describe('Lead sector labels', () => {
  const allSectors: LeadSector[] = [
    'ecommerce',
    'food',
    'pharma',
    'artigianato',
    'industria',
    'logistica',
    'altro',
  ];

  it('tutti i settori hanno una label', () => {
    for (const sector of allSectors) {
      expect(LEAD_SECTOR_LABELS[sector]).toBeDefined();
      expect(LEAD_SECTOR_LABELS[sector].length).toBeGreaterThan(0);
    }
  });

  it('labels specifiche corrette', () => {
    expect(LEAD_SECTOR_LABELS.ecommerce).toBe('E-commerce');
    expect(LEAD_SECTOR_LABELS.pharma).toBe('Farmaceutico');
    expect(LEAD_SECTOR_LABELS.food).toBe('Food & Beverage');
    expect(LEAD_SECTOR_LABELS.logistica).toBe('Logistica');
  });
});

describe('Geographic zone labels', () => {
  const allZones: GeographicZone[] = ['nord', 'centro', 'sud', 'isole'];

  it('tutte le zone hanno una label', () => {
    for (const zone of allZones) {
      expect(GEOGRAPHIC_ZONE_LABELS[zone]).toBeDefined();
      expect(GEOGRAPHIC_ZONE_LABELS[zone].length).toBeGreaterThan(0);
    }
  });

  it('labels specifiche corrette', () => {
    expect(GEOGRAPHIC_ZONE_LABELS.nord).toBe('Nord Italia');
    expect(GEOGRAPHIC_ZONE_LABELS.isole).toBe('Isole');
  });
});

describe('Flusso pipeline lead completo', () => {
  it('percorso felice: new → contacted → qualified → negotiation → won', () => {
    const path: LeadStatus[] = ['new', 'contacted', 'qualified', 'negotiation', 'won'];

    for (let i = 0; i < path.length - 1; i++) {
      const from = path[i];
      const to = path[i + 1];
      expect(
        LEAD_VALID_TRANSITIONS[from].includes(to),
        `${from} → ${to} dovrebbe essere valido`
      ).toBe(true);
    }
  });

  it('percorso diretto: qualified → won (senza negoziazione)', () => {
    expect(LEAD_VALID_TRANSITIONS.qualified).toContain('won');
  });

  it('percorso riattivazione: lost → new → contacted', () => {
    expect(LEAD_VALID_TRANSITIONS.lost).toContain('new');
    expect(LEAD_VALID_TRANSITIONS.new).toContain('contacted');
  });

  it('non esiste un percorso diretto new → won', () => {
    expect(LEAD_VALID_TRANSITIONS.new).not.toContain('won');
  });
});
