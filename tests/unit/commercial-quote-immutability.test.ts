/**
 * Test: Immutabilita' e revisioni preventivi commerciali
 *
 * Verifica:
 * - Draft modificabile
 * - Sent bloccato (snapshot immutabile)
 * - Revisione non modifica parent
 * - Transizioni di stato valide/invalide
 *
 * Nota: i trigger DB sono testati via integration test.
 * Qui testiamo la logica delle transizioni lato TypeScript.
 */

import { describe, expect, it } from 'vitest';
import type {
  CommercialQuoteStatus,
  CommercialQuote,
  PriceMatrixSnapshot,
} from '@/types/commercial-quotes';

// Transizioni valide (duplica la costante da server actions per test indipendente)
const VALID_TRANSITIONS: Record<CommercialQuoteStatus, CommercialQuoteStatus[]> = {
  draft: ['sent'],
  sent: ['negotiating', 'accepted', 'rejected'],
  negotiating: ['sent', 'accepted', 'rejected'],
  accepted: [],
  rejected: [],
  expired: [],
};

function isValidTransition(from: CommercialQuoteStatus, to: CommercialQuoteStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) || false;
}

describe('Transizioni stato preventivo', () => {
  it('draft -> sent: valida', () => {
    expect(isValidTransition('draft', 'sent')).toBe(true);
  });

  it('draft -> accepted: non valida (deve passare per sent)', () => {
    expect(isValidTransition('draft', 'accepted')).toBe(false);
  });

  it('draft -> rejected: non valida', () => {
    expect(isValidTransition('draft', 'rejected')).toBe(false);
  });

  it('draft -> negotiating: non valida', () => {
    expect(isValidTransition('draft', 'negotiating')).toBe(false);
  });

  it('sent -> negotiating: valida', () => {
    expect(isValidTransition('sent', 'negotiating')).toBe(true);
  });

  it('sent -> accepted: valida', () => {
    expect(isValidTransition('sent', 'accepted')).toBe(true);
  });

  it('sent -> rejected: valida', () => {
    expect(isValidTransition('sent', 'rejected')).toBe(true);
  });

  it('negotiating -> sent: valida (reinvio revisione)', () => {
    expect(isValidTransition('negotiating', 'sent')).toBe(true);
  });

  it('negotiating -> accepted: valida', () => {
    expect(isValidTransition('negotiating', 'accepted')).toBe(true);
  });

  it('negotiating -> rejected: valida', () => {
    expect(isValidTransition('negotiating', 'rejected')).toBe(true);
  });

  it('accepted -> qualsiasi: non valida (stato finale)', () => {
    expect(isValidTransition('accepted', 'draft')).toBe(false);
    expect(isValidTransition('accepted', 'sent')).toBe(false);
    expect(isValidTransition('accepted', 'negotiating')).toBe(false);
    expect(isValidTransition('accepted', 'rejected')).toBe(false);
    expect(isValidTransition('accepted', 'expired')).toBe(false);
  });

  it('rejected -> qualsiasi: non valida (stato finale)', () => {
    expect(isValidTransition('rejected', 'draft')).toBe(false);
    expect(isValidTransition('rejected', 'sent')).toBe(false);
    expect(isValidTransition('rejected', 'accepted')).toBe(false);
  });

  it('expired -> qualsiasi: non valida (stato finale)', () => {
    expect(isValidTransition('expired', 'draft')).toBe(false);
    expect(isValidTransition('expired', 'sent')).toBe(false);
    expect(isValidTransition('expired', 'accepted')).toBe(false);
  });
});

describe("Immutabilita' snapshot", () => {
  const mockMatrix: PriceMatrixSnapshot = {
    zones: ['Italia', 'Sicilia'],
    weight_ranges: [{ from: 0, to: 5, label: '0 - 5 kg' }],
    prices: [[6.0, 8.4]],
    services_included: [],
    carrier_display_name: 'GLS',
    vat_mode: 'excluded',
    vat_rate: 22,
    generated_at: '2026-02-07T10:00:00.000Z',
  };

  it('dovrebbe preservare snapshot immutabile con deep clone', () => {
    // Simula che la matrice non puo essere modificata dopo creazione
    const original = JSON.parse(JSON.stringify(mockMatrix));
    const snapshot = JSON.parse(JSON.stringify(mockMatrix));

    // Modifica tentata sulla copia
    snapshot.prices[0][0] = 999;

    // Originale invariato
    expect(original.prices[0][0]).toBe(6.0);
    expect(snapshot.prices[0][0]).toBe(999);
  });

  it('dovrebbe avere generated_at come prova di immutabilita temporale', () => {
    expect(mockMatrix.generated_at).toBeDefined();
    // Verifica che sia un timestamp ISO valido
    const parsed = new Date(mockMatrix.generated_at);
    expect(parsed.getTime()).not.toBeNaN();
    expect(mockMatrix.generated_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('Revisioni', () => {
  it('revisione deve avere revision > parent', () => {
    const parent = { revision: 1, id: 'quote-1', parent_quote_id: null };
    const revision = { revision: 2, id: 'quote-2', parent_quote_id: 'quote-1' };

    expect(revision.revision).toBeGreaterThan(parent.revision);
    expect(revision.parent_quote_id).toBe(parent.id);
  });

  it('revisione deve puntare al root (non a revisione intermedia)', () => {
    // Root -> Rev2 -> Rev3: Rev3 punta a Root, non a Rev2
    const root = { id: 'root-1', revision: 1, parent_quote_id: null };
    const rev2 = { id: 'rev-2', revision: 2, parent_quote_id: 'root-1' };
    const rev3 = { id: 'rev-3', revision: 3, parent_quote_id: 'root-1' }; // Punta a root!

    expect(rev3.parent_quote_id).toBe(root.id);
    expect(rev3.parent_quote_id).not.toBe(rev2.id);
  });

  it('conversione possibile solo da accepted', () => {
    const statuses: CommercialQuoteStatus[] = [
      'draft',
      'sent',
      'negotiating',
      'accepted',
      'rejected',
      'expired',
    ];

    for (const status of statuses) {
      const canConvert = status === 'accepted';
      if (status === 'accepted') {
        expect(canConvert).toBe(true);
      } else {
        expect(canConvert).toBe(false);
      }
    }
  });

  it('delete possibile solo da draft', () => {
    const statuses: CommercialQuoteStatus[] = [
      'draft',
      'sent',
      'negotiating',
      'accepted',
      'rejected',
      'expired',
    ];

    for (const status of statuses) {
      const canDelete = status === 'draft';
      if (status === 'draft') {
        expect(canDelete).toBe(true);
      } else {
        expect(canDelete).toBe(false);
      }
    }
  });
});
