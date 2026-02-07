/**
 * Test: Audit Actions per preventivi commerciali
 *
 * Verifica che le azioni audit per il modulo commerciale
 * siano registrate e valide.
 */

import { describe, expect, it } from 'vitest';
import {
  AUDIT_ACTIONS,
  AUDIT_RESOURCE_TYPES,
  isValidAuditAction,
  isValidResourceType,
} from '@/lib/security/audit-actions';

describe('AUDIT_ACTIONS - Commercial Quote Operations', () => {
  it('dovrebbe avere tutte le 6 azioni per preventivi commerciali', () => {
    expect(AUDIT_ACTIONS.COMMERCIAL_QUOTE_CREATED).toBe('commercial_quote_created');
    expect(AUDIT_ACTIONS.COMMERCIAL_QUOTE_SENT).toBe('commercial_quote_sent');
    expect(AUDIT_ACTIONS.COMMERCIAL_QUOTE_REVISED).toBe('commercial_quote_revised');
    expect(AUDIT_ACTIONS.COMMERCIAL_QUOTE_ACCEPTED).toBe('commercial_quote_accepted');
    expect(AUDIT_ACTIONS.COMMERCIAL_QUOTE_REJECTED).toBe('commercial_quote_rejected');
    expect(AUDIT_ACTIONS.COMMERCIAL_QUOTE_CONVERTED).toBe('commercial_quote_converted');
  });

  it('dovrebbe validare azioni commerciali come valide', () => {
    expect(isValidAuditAction('commercial_quote_created')).toBe(true);
    expect(isValidAuditAction('commercial_quote_sent')).toBe(true);
    expect(isValidAuditAction('commercial_quote_revised')).toBe(true);
    expect(isValidAuditAction('commercial_quote_accepted')).toBe(true);
    expect(isValidAuditAction('commercial_quote_rejected')).toBe(true);
    expect(isValidAuditAction('commercial_quote_converted')).toBe(true);
  });

  it('dovrebbe rifiutare azioni non canoniche', () => {
    expect(isValidAuditAction('commercial_quote_unknown')).toBe(false);
    expect(isValidAuditAction('random_action')).toBe(false);
    expect(isValidAuditAction('')).toBe(false);
  });

  it('dovrebbe seguire naming convention VERB_NOUN', () => {
    const commercialActions = [
      AUDIT_ACTIONS.COMMERCIAL_QUOTE_CREATED,
      AUDIT_ACTIONS.COMMERCIAL_QUOTE_SENT,
      AUDIT_ACTIONS.COMMERCIAL_QUOTE_REVISED,
      AUDIT_ACTIONS.COMMERCIAL_QUOTE_ACCEPTED,
      AUDIT_ACTIONS.COMMERCIAL_QUOTE_REJECTED,
      AUDIT_ACTIONS.COMMERCIAL_QUOTE_CONVERTED,
    ];

    for (const action of commercialActions) {
      // Formato: parola_parola[_parola] (snake_case)
      expect(action).toMatch(/^[a-z]+(_[a-z]+)+$/);
    }
  });

  it('dovrebbe avere azioni uniche (no duplicati)', () => {
    const allValues = Object.values(AUDIT_ACTIONS);
    const uniqueValues = new Set(allValues);
    expect(uniqueValues.size).toBe(allValues.length);
  });
});

describe('AUDIT_RESOURCE_TYPES - Copertura preventivi', () => {
  it('dovrebbe avere resource type per price_list (usato nella conversione)', () => {
    expect(AUDIT_RESOURCE_TYPES.PRICE_LIST).toBe('price_list');
    expect(isValidResourceType('price_list')).toBe(true);
  });

  it('dovrebbe avere resource type per price_list_assignment', () => {
    expect(AUDIT_RESOURCE_TYPES.PRICE_LIST_ASSIGNMENT).toBe('price_list_assignment');
    expect(isValidResourceType('price_list_assignment')).toBe(true);
  });

  it('dovrebbe avere resource types unici', () => {
    const allValues = Object.values(AUDIT_RESOURCE_TYPES);
    const uniqueValues = new Set(allValues);
    expect(uniqueValues.size).toBe(allValues.length);
  });
});

describe('Copertura azioni per flusso preventivo', () => {
  it('dovrebbe coprire ogni step del flusso pipeline', () => {
    // Flusso: create -> send -> negotiate -> accept/reject -> convert
    const pipelineActions = {
      creazione: AUDIT_ACTIONS.COMMERCIAL_QUOTE_CREATED,
      invio: AUDIT_ACTIONS.COMMERCIAL_QUOTE_SENT,
      revisione: AUDIT_ACTIONS.COMMERCIAL_QUOTE_REVISED,
      accettazione: AUDIT_ACTIONS.COMMERCIAL_QUOTE_ACCEPTED,
      rifiuto: AUDIT_ACTIONS.COMMERCIAL_QUOTE_REJECTED,
      conversione: AUDIT_ACTIONS.COMMERCIAL_QUOTE_CONVERTED,
    };

    // Ogni step ha un'azione audit
    for (const [step, action] of Object.entries(pipelineActions)) {
      expect(action).toBeTruthy();
      expect(isValidAuditAction(action)).toBe(true);
    }
  });
});
