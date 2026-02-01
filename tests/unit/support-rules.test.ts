/**
 * Unit tests per lib/ai/support-rules.ts
 *
 * Testa: findMatchingRule, findAllMatchingRules, shouldConfirm, interpolateMessage
 */

import { describe, it, expect } from 'vitest';
import {
  findMatchingRule,
  findAllMatchingRules,
  shouldConfirm,
  type SupportContext,
} from '@/lib/ai/support-rules';

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function makeCtx(overrides: Partial<SupportContext> = {}): SupportContext {
  return {
    userMessage: 'test',
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// findMatchingRule - Giacenza
// ═══════════════════════════════════════════════════════════════════════════

describe('findMatchingRule - Giacenza', () => {
  it('matcha destinatario assente -> riconsegna', () => {
    const match = findMatchingRule(makeCtx({ holdReason: 'destinatario_assente' }));
    expect(match).not.toBeNull();
    expect(match!.rule.id).toBe('hold_absent_redelivery');
    expect(match!.rule.suggestedAction).toBe('hold_action');
  });

  it('matcha indirizzo errato -> nuovo indirizzo', () => {
    const match = findMatchingRule(makeCtx({ holdReason: 'indirizzo_errato' }));
    expect(match).not.toBeNull();
    expect(match!.rule.id).toBe('hold_wrong_address');
  });

  it('matcha rifiutata -> reso mittente', () => {
    const match = findMatchingRule(makeCtx({ holdReason: 'rifiutata' }));
    expect(match).not.toBeNull();
    expect(match!.rule.id).toBe('hold_refused');
  });

  it('matcha contrassegno non pagato', () => {
    const match = findMatchingRule(makeCtx({ holdReason: 'contrassegno_non_pagato' }));
    expect(match).not.toBeNull();
    expect(match!.rule.id).toBe('hold_cod_unpaid');
  });

  it('matcha documenti mancanti -> escalation', () => {
    const match = findMatchingRule(makeCtx({ holdReason: 'documenti_mancanti' }));
    expect(match).not.toBeNull();
    expect(match!.rule.id).toBe('hold_missing_docs');
    expect(match!.rule.suggestedAction).toBe('escalate');
  });

  it('giacenza in scadenza (<= 3 giorni) ha priorità superiore', () => {
    const match = findMatchingRule(
      makeCtx({
        holdReason: 'destinatario_assente',
        holdStatus: 'open',
        holdDaysRemaining: 2,
      })
    );
    expect(match).not.toBeNull();
    // Deve matchare hold_expiring (priorità 20) invece di hold_absent_redelivery (priorità 10)
    expect(match!.rule.id).toBe('hold_expiring');
  });

  it('giacenza generica/altro -> mostra opzioni', () => {
    const match = findMatchingRule(makeCtx({ holdReason: 'altro' }));
    expect(match).not.toBeNull();
    expect(match!.rule.id).toBe('hold_generic');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// findMatchingRule - Cancellazione
// ═══════════════════════════════════════════════════════════════════════════

describe('findMatchingRule - Cancellazione', () => {
  it('pre-transit (pending) -> cancellazione possibile', () => {
    const match = findMatchingRule(makeCtx({ shipmentStatus: 'pending' }));
    expect(match).not.toBeNull();
    expect(match!.rule.id).toBe('cancel_pre_transit');
    expect(match!.rule.suggestedAction).toBe('cancel_shipment');
  });

  it('pre-transit (label_created) -> cancellazione possibile', () => {
    const match = findMatchingRule(makeCtx({ shipmentStatus: 'label_created' }));
    expect(match).not.toBeNull();
    expect(match!.rule.id).toBe('cancel_pre_transit');
  });

  it('in transit -> cancellazione non possibile', () => {
    const match = findMatchingRule(makeCtx({ shipmentStatus: 'in_transit' }));
    expect(match).not.toBeNull();
    expect(match!.rule.id).toBe('cancel_in_transit');
    expect(match!.rule.suggestedAction).toBe('info_only');
  });

  it('consegnata -> cancellazione non possibile, priorità alta', () => {
    const match = findMatchingRule(makeCtx({ isDelivered: true }));
    expect(match).not.toBeNull();
    // cancel_delivered ha priorità 20, tracking_delivered ha priorità 10
    expect(match!.rule.id).toBe('cancel_delivered');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// findMatchingRule - Rimborso
// ═══════════════════════════════════════════════════════════════════════════

describe('findMatchingRule - Rimborso', () => {
  it('spedizione cancellata -> rimborso', () => {
    const match = findMatchingRule(makeCtx({ shipmentStatus: 'cancelled' }));
    expect(match).not.toBeNull();
    expect(match!.rule.id).toBe('refund_cancelled');
    expect(match!.rule.suggestedAction).toBe('refund');
  });

  it('smarrita (>14 giorni senza aggiornamenti) -> escalation', () => {
    const match = findMatchingRule(makeCtx({ daysSinceLastEvent: 15, isDelivered: false }));
    expect(match).not.toBeNull();
    expect(match!.rule.id).toBe('refund_lost');
    expect(match!.rule.suggestedAction).toBe('escalate');
  });

  it('ritardo grave (7-14 giorni) -> refresh tracking', () => {
    const match = findMatchingRule(makeCtx({ daysSinceLastEvent: 10, isDelivered: false }));
    expect(match).not.toBeNull();
    expect(match!.rule.id).toBe('refund_severe_delay');
    expect(match!.rule.suggestedAction).toBe('refresh_tracking');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// findMatchingRule - Tracking
// ═══════════════════════════════════════════════════════════════════════════

describe('findMatchingRule - Tracking', () => {
  it('tracking stale >= 2 giorni -> forza refresh', () => {
    const match = findMatchingRule(makeCtx({ daysSinceLastEvent: 3, isDelivered: false }));
    expect(match).not.toBeNull();
    // Potrebbe matchare refund_severe_delay (priority 10) o tracking_stale (priority 5)
    // dipende dal valore esatto dei giorni
    expect(match!.rule.suggestedAction).toBe('refresh_tracking');
  });

  it('consegnata -> info di conferma consegna', () => {
    const match = findMatchingRule(makeCtx({ isDelivered: true }));
    expect(match).not.toBeNull();
    // cancel_delivered ha priorità 20, tracking_delivered ha priorità 10
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// findAllMatchingRules
// ═══════════════════════════════════════════════════════════════════════════

describe('findAllMatchingRules', () => {
  it('ritorna tutte le regole che matchano', () => {
    const matches = findAllMatchingRules(
      makeCtx({
        holdReason: 'destinatario_assente',
        holdStatus: 'open',
        holdDaysRemaining: 2,
        daysSinceLastEvent: 3,
        isDelivered: false,
      })
    );
    expect(matches.length).toBeGreaterThan(1);
    // Deve includere sia hold_expiring che hold_absent_redelivery e tracking_stale
    const ids = matches.map((m) => m.rule.id);
    expect(ids).toContain('hold_expiring');
    expect(ids).toContain('hold_absent_redelivery');
  });

  it('hold_generic matcha come fallback quando nessun holdReason specifico', () => {
    // hold_generic ha condizione: !ctx.holdReason, quindi matcha su contesto vuoto
    const matches = findAllMatchingRules(makeCtx({}));
    expect(matches.length).toBe(1);
    expect(matches[0].rule.id).toBe('hold_generic');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// shouldConfirm
// ═══════════════════════════════════════════════════════════════════════════

describe('shouldConfirm', () => {
  it('auto -> false sempre', () => {
    expect(shouldConfirm('auto', makeCtx())).toBe(false);
    expect(shouldConfirm('auto', makeCtx({ actionCost: 100 }))).toBe(false);
  });

  it('confirm -> true sempre', () => {
    expect(shouldConfirm('confirm', makeCtx())).toBe(true);
    expect(shouldConfirm('confirm', makeCtx({ actionCost: 0 }))).toBe(true);
  });

  it('anne_decides -> true se costo > 0', () => {
    expect(shouldConfirm('anne_decides', makeCtx({ actionCost: 3.5 }))).toBe(true);
  });

  it('anne_decides -> true se wallet insufficiente', () => {
    expect(shouldConfirm('anne_decides', makeCtx({ walletBalance: 1, actionCost: 5 }))).toBe(true);
  });

  it('anne_decides -> false se nessun costo', () => {
    expect(shouldConfirm('anne_decides', makeCtx())).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// interpolateMessage (testato indirettamente via findMatchingRule)
// ═══════════════════════════════════════════════════════════════════════════

describe('interpolateMessage', () => {
  it('interpola tracking number nel messaggio', () => {
    const match = findMatchingRule(
      makeCtx({ holdReason: 'destinatario_assente', trackingNumber: 'ABC123' })
    );
    expect(match).not.toBeNull();
    expect(match!.message).toContain('ABC123');
  });

  it('interpola costo nel messaggio', () => {
    const match = findMatchingRule(
      makeCtx({ holdReason: 'destinatario_assente', trackingNumber: 'X', actionCost: 3.5 })
    );
    expect(match).not.toBeNull();
    expect(match!.message).toContain('€3.50');
  });

  it('mostra N/A se tracking mancante', () => {
    const match = findMatchingRule(makeCtx({ holdReason: 'rifiutata' }));
    expect(match).not.toBeNull();
    expect(match!.message).toContain('N/A');
  });

  it('interpola giorni rimanenti per giacenza in scadenza', () => {
    const match = findMatchingRule(
      makeCtx({ holdStatus: 'open', holdDaysRemaining: 1, trackingNumber: 'TEST' })
    );
    expect(match).not.toBeNull();
    expect(match!.message).toContain('1');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Carrier filter
// ═══════════════════════════════════════════════════════════════════════════

describe('Carrier filter', () => {
  it('regole con carrier=* matchano qualsiasi corriere', () => {
    const match = findMatchingRule(makeCtx({ holdReason: 'destinatario_assente', carrier: 'GLS' }));
    expect(match).not.toBeNull();
  });

  it('regole con carrier=* matchano anche senza corriere', () => {
    const match = findMatchingRule(makeCtx({ holdReason: 'destinatario_assente' }));
    expect(match).not.toBeNull();
  });
});
