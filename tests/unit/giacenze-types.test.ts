import { describe, it, expect } from 'vitest';
import {
  HOLD_REASON_LABELS,
  HOLD_ACTION_LABELS,
  HOLD_STATUS_LABELS,
  type HoldActionType,
  type HoldReason,
  type HoldStatus,
} from '@/types/giacenze';

describe('Giacenze Types & Labels', () => {
  describe('HOLD_REASON_LABELS', () => {
    const allReasons: HoldReason[] = [
      'destinatario_assente',
      'indirizzo_errato',
      'rifiutata',
      'documenti_mancanti',
      'contrassegno_non_pagato',
      'zona_non_accessibile',
      'altro',
    ];

    it('should have labels for all reasons', () => {
      for (const reason of allReasons) {
        expect(HOLD_REASON_LABELS[reason]).toBeDefined();
        expect(typeof HOLD_REASON_LABELS[reason]).toBe('string');
        expect(HOLD_REASON_LABELS[reason].length).toBeGreaterThan(0);
      }
    });
  });

  describe('HOLD_ACTION_LABELS', () => {
    const allActions: HoldActionType[] = [
      'riconsegna',
      'riconsegna_nuovo_destinatario',
      'reso_mittente',
      'distruggere',
      'ritiro_in_sede',
      'consegna_parziale_rendi',
      'consegna_parziale_distruggi',
    ];

    it('should have label and description for all actions', () => {
      for (const action of allActions) {
        expect(HOLD_ACTION_LABELS[action]).toBeDefined();
        expect(HOLD_ACTION_LABELS[action].label).toBeTruthy();
        expect(HOLD_ACTION_LABELS[action].description).toBeTruthy();
      }
    });

    it('riconsegna_nuovo_destinatario should mention new address', () => {
      expect(HOLD_ACTION_LABELS.riconsegna_nuovo_destinatario.description.toLowerCase()).toContain(
        'divers'
      );
    });
  });

  describe('HOLD_STATUS_LABELS', () => {
    const allStatuses: HoldStatus[] = [
      'open',
      'action_requested',
      'action_confirmed',
      'resolved',
      'expired',
    ];

    it('should have Italian labels for all statuses', () => {
      for (const status of allStatuses) {
        expect(HOLD_STATUS_LABELS[status]).toBeDefined();
        expect(typeof HOLD_STATUS_LABELS[status]).toBe('string');
      }
    });
  });
});
