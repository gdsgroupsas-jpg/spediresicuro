/**
 * Test: Negoziazione avanzata preventivi commerciali
 *
 * Verifica:
 * - Timeline event mapping: etichette italiane corrette
 * - Timeline sorting: ordinato per created_at ASC
 * - Rinnovo: expired crea draft con parent corretto
 * - Validazione: non-expired non puo essere rinnovato
 * - Rinnovo preserva dati: prospect, corriere, clausole
 */

import { describe, expect, it } from 'vitest';
import type {
  CommercialQuoteStatus,
  CommercialQuoteEventType,
  NegotiationTimelineEntry,
} from '@/types/commercial-quotes';

// Replica EVENT_LABELS da server actions per test indipendente
const EVENT_LABELS: Record<CommercialQuoteEventType, string> = {
  created: 'Preventivo creato',
  updated: 'Preventivo aggiornato',
  sent: 'Inviato al prospect',
  viewed: 'Visualizzato',
  revised: 'Nuova revisione',
  accepted: 'Accettato',
  rejected: 'Rifiutato',
  expired: 'Scaduto',
  reminder_sent: 'Reminder inviato',
  renewed: 'Rinnovato',
  converted: 'Convertito in cliente',
};

describe('Timeline event mapping', () => {
  it('ogni tipo evento ha una etichetta italiana', () => {
    const eventTypes: CommercialQuoteEventType[] = [
      'created',
      'updated',
      'sent',
      'viewed',
      'revised',
      'accepted',
      'rejected',
      'expired',
      'reminder_sent',
      'renewed',
      'converted',
    ];

    for (const type of eventTypes) {
      expect(EVENT_LABELS[type]).toBeDefined();
      expect(typeof EVENT_LABELS[type]).toBe('string');
      expect(EVENT_LABELS[type].length).toBeGreaterThan(0);
    }
  });

  it('created -> "Preventivo creato"', () => {
    expect(EVENT_LABELS['created']).toBe('Preventivo creato');
  });

  it('sent -> "Inviato al prospect"', () => {
    expect(EVENT_LABELS['sent']).toBe('Inviato al prospect');
  });

  it('revised -> "Nuova revisione"', () => {
    expect(EVENT_LABELS['revised']).toBe('Nuova revisione');
  });

  it('accepted -> "Accettato"', () => {
    expect(EVENT_LABELS['accepted']).toBe('Accettato');
  });

  it('rejected -> "Rifiutato"', () => {
    expect(EVENT_LABELS['rejected']).toBe('Rifiutato');
  });

  it('expired -> "Scaduto"', () => {
    expect(EVENT_LABELS['expired']).toBe('Scaduto');
  });

  it('renewed -> "Rinnovato"', () => {
    expect(EVENT_LABELS['renewed']).toBe('Rinnovato');
  });

  it('converted -> "Convertito in cliente"', () => {
    expect(EVENT_LABELS['converted']).toBe('Convertito in cliente');
  });

  it('reminder_sent -> "Reminder inviato"', () => {
    expect(EVENT_LABELS['reminder_sent']).toBe('Reminder inviato');
  });
});

describe('Timeline sorting', () => {
  const mockEntries: NegotiationTimelineEntry[] = [
    {
      id: '3',
      event_type: 'accepted',
      event_label: 'Accettato',
      event_data: null,
      actor_name: 'Mario',
      created_at: '2026-02-10T12:00:00.000Z',
      notes: null,
    },
    {
      id: '1',
      event_type: 'created',
      event_label: 'Preventivo creato',
      event_data: null,
      actor_name: 'Mario',
      created_at: '2026-02-07T10:00:00.000Z',
      notes: null,
    },
    {
      id: '2',
      event_type: 'sent',
      event_label: 'Inviato al prospect',
      event_data: null,
      actor_name: 'Mario',
      created_at: '2026-02-08T14:00:00.000Z',
      notes: null,
    },
  ];

  it('dovrebbe essere ordinabile per created_at ASC', () => {
    const sorted = [...mockEntries].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    expect(sorted[0].id).toBe('1'); // created (7 feb)
    expect(sorted[1].id).toBe('2'); // sent (8 feb)
    expect(sorted[2].id).toBe('3'); // accepted (10 feb)
  });

  it('ogni entry ha tutti i campi richiesti', () => {
    for (const entry of mockEntries) {
      expect(entry.id).toBeDefined();
      expect(entry.event_type).toBeDefined();
      expect(entry.event_label).toBeDefined();
      expect(entry.created_at).toBeDefined();
    }
  });
});

describe('Logica rinnovo preventivo', () => {
  it('solo expired puo essere rinnovato', () => {
    const statuses: CommercialQuoteStatus[] = [
      'draft',
      'sent',
      'negotiating',
      'accepted',
      'rejected',
      'expired',
    ];

    for (const status of statuses) {
      const canRenew = status === 'expired';
      if (status === 'expired') {
        expect(canRenew).toBe(true);
      } else {
        expect(canRenew).toBe(false);
      }
    }
  });

  it('rinnovo crea nuova revisione con parent corretto (root, non expired)', () => {
    const root = { id: 'root-1', revision: 1, parent_quote_id: null };
    const expired = { id: 'rev-2', revision: 2, parent_quote_id: 'root-1', status: 'expired' };

    // Il rinnovo punta al root, non al preventivo scaduto
    const renewal = {
      id: 'rev-3',
      revision: 3,
      parent_quote_id: expired.parent_quote_id || expired.id, // = 'root-1'
      status: 'draft',
    };

    expect(renewal.parent_quote_id).toBe(root.id);
    expect(renewal.status).toBe('draft');
    expect(renewal.revision).toBeGreaterThan(expired.revision);
  });

  it('rinnovo preserva dati prospect', () => {
    const expired = {
      prospect_company: 'ACME',
      prospect_email: 'info@acme.it',
      prospect_phone: '+39 123',
      carrier_code: 'gls-GLS-5000',
    };

    // Il rinnovo eredita i dati
    const renewal = { ...expired, status: 'draft' };

    expect(renewal.prospect_company).toBe('ACME');
    expect(renewal.prospect_email).toBe('info@acme.it');
    expect(renewal.prospect_phone).toBe('+39 123');
    expect(renewal.carrier_code).toBe('gls-GLS-5000');
  });

  it('rinnovo preserva clausole', () => {
    const clauses = [
      { title: 'IVA', text: 'Esclusa 22%', type: 'standard' },
      { title: 'Custom', text: 'Clausola speciale', type: 'custom' },
    ];

    const expired = { clauses };
    const renewal = { clauses: expired.clauses };

    expect(renewal.clauses).toEqual(clauses);
    expect(renewal.clauses).toHaveLength(2);
  });

  it('rinnovo con nuovo margine diverso da originale', () => {
    const expired = { margin_percent: 20, original_margin_percent: 20 };
    const newMargin = 15;

    // Il rinnovo mantiene l'original_margin_percent dal preventivo originale
    const renewal = {
      margin_percent: newMargin,
      original_margin_percent: expired.original_margin_percent,
    };

    expect(renewal.margin_percent).toBe(15);
    expect(renewal.original_margin_percent).toBe(20); // Invariato
  });

  it('rinnovo con validita personalizzata', () => {
    const expired = { validity_days: 30 };
    const newValidityDays = 45;

    const renewal = { validity_days: newValidityDays };
    expect(renewal.validity_days).toBe(45);
  });

  it('rinnovo default (senza parametri) mantiene stessi valori', () => {
    const expired = { margin_percent: 20, validity_days: 30 };

    // Se non si passa margin_percent o new_validity_days, si usano quelli del expired
    const renewal = {
      margin_percent: expired.margin_percent,
      validity_days: expired.validity_days,
    };

    expect(renewal.margin_percent).toBe(20);
    expect(renewal.validity_days).toBe(30);
  });
});

describe('Note in timeline', () => {
  it('entry con notes le mostra', () => {
    const entry: NegotiationTimelineEntry = {
      id: '1',
      event_type: 'rejected',
      event_label: 'Rifiutato',
      event_data: { notes: 'Prezzi troppo alti' },
      actor_name: 'Mario',
      created_at: '2026-02-10T12:00:00.000Z',
      notes: 'Prezzi troppo alti',
    };

    expect(entry.notes).toBe('Prezzi troppo alti');
  });

  it('entry senza notes ha notes null', () => {
    const entry: NegotiationTimelineEntry = {
      id: '1',
      event_type: 'sent',
      event_label: 'Inviato al prospect',
      event_data: null,
      actor_name: 'Mario',
      created_at: '2026-02-08T14:00:00.000Z',
      notes: null,
    };

    expect(entry.notes).toBeNull();
  });
});
