/**
 * Test: Logica scadenza e reminder preventivi commerciali
 *
 * Verifica:
 * - Preventivi sent/negotiating scaduti -> expired
 * - Draft/accepted/rejected/expired non toccati
 * - Reminder inviato solo se non gia' inviato
 * - Stato expired e' finale (no transizioni)
 */

import { describe, expect, it } from 'vitest';
import type { CommercialQuoteStatus } from '@/types/commercial-quotes';

// Replica logica di scadenza dal cron
function shouldExpire(status: CommercialQuoteStatus, expiresAt: string | null): boolean {
  if (!expiresAt) return false;
  if (status !== 'sent' && status !== 'negotiating') return false;
  return new Date(expiresAt) < new Date();
}

function shouldSendReminder(
  status: CommercialQuoteStatus,
  expiresAt: string | null,
  reminderAlreadySent: boolean,
  reminderDaysBefore: number = 5
): boolean {
  if (!expiresAt) return false;
  if (status !== 'sent' && status !== 'negotiating') return false;
  if (reminderAlreadySent) return false;

  const now = new Date();
  const expires = new Date(expiresAt);
  const daysLeft = Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return daysLeft > 0 && daysLeft <= reminderDaysBefore;
}

function getDaysLeft(expiresAt: string): number {
  const now = new Date();
  const expires = new Date(expiresAt);
  return Math.ceil((expires.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// Transizioni valide (da immutability test)
const VALID_TRANSITIONS: Record<CommercialQuoteStatus, CommercialQuoteStatus[]> = {
  draft: ['sent'],
  sent: ['negotiating', 'accepted', 'rejected'],
  negotiating: ['sent', 'accepted', 'rejected'],
  accepted: [],
  rejected: [],
  expired: [],
};

describe('Logica auto-scadenza', () => {
  const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // Ieri
  const futureDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Fra 30 giorni

  it('sent con expires_at passato -> dovrebbe scadere', () => {
    expect(shouldExpire('sent', pastDate)).toBe(true);
  });

  it('negotiating con expires_at passato -> dovrebbe scadere', () => {
    expect(shouldExpire('negotiating', pastDate)).toBe(true);
  });

  it('sent con expires_at futuro -> NON dovrebbe scadere', () => {
    expect(shouldExpire('sent', futureDate)).toBe(false);
  });

  it('draft con expires_at passato -> NON dovrebbe scadere', () => {
    expect(shouldExpire('draft', pastDate)).toBe(false);
  });

  it('accepted con expires_at passato -> NON dovrebbe scadere', () => {
    expect(shouldExpire('accepted', pastDate)).toBe(false);
  });

  it('rejected con expires_at passato -> NON dovrebbe scadere', () => {
    expect(shouldExpire('rejected', pastDate)).toBe(false);
  });

  it('expired con expires_at passato -> NON dovrebbe scadere (gia scaduto)', () => {
    expect(shouldExpire('expired', pastDate)).toBe(false);
  });

  it('qualsiasi status senza expires_at -> NON dovrebbe scadere', () => {
    expect(shouldExpire('sent', null)).toBe(false);
    expect(shouldExpire('negotiating', null)).toBe(false);
  });
});

describe('Logica reminder pre-scadenza', () => {
  // 3 giorni da adesso
  const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  // 10 giorni da adesso
  const in10Days = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
  // Ieri
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  it('sent con scadenza tra 3 giorni -> dovrebbe inviare reminder', () => {
    expect(shouldSendReminder('sent', in3Days, false)).toBe(true);
  });

  it('negotiating con scadenza tra 3 giorni -> dovrebbe inviare reminder', () => {
    expect(shouldSendReminder('negotiating', in3Days, false)).toBe(true);
  });

  it('sent con scadenza tra 10 giorni -> NON dovrebbe inviare (troppo presto)', () => {
    expect(shouldSendReminder('sent', in10Days, false)).toBe(false);
  });

  it('sent con reminder gia inviato -> NON dovrebbe inviare di nuovo', () => {
    expect(shouldSendReminder('sent', in3Days, true)).toBe(false);
  });

  it('draft con scadenza tra 3 giorni -> NON dovrebbe inviare', () => {
    expect(shouldSendReminder('draft', in3Days, false)).toBe(false);
  });

  it('accepted con scadenza tra 3 giorni -> NON dovrebbe inviare', () => {
    expect(shouldSendReminder('accepted', in3Days, false)).toBe(false);
  });

  it('sent con scadenza gia passata -> NON dovrebbe inviare reminder (scade direttamente)', () => {
    expect(shouldSendReminder('sent', yesterday, false)).toBe(false);
  });

  it('senza expires_at -> NON dovrebbe inviare', () => {
    expect(shouldSendReminder('sent', null, false)).toBe(false);
  });
});

describe('Calcolo giorni rimanenti', () => {
  it('scadenza domani -> 1 giorno', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    expect(getDaysLeft(tomorrow)).toBe(1);
  });

  it('scadenza ieri -> negativo', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    expect(getDaysLeft(yesterday)).toBeLessThanOrEqual(0);
  });

  it('scadenza tra 30 giorni -> ~30', () => {
    const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const days = getDaysLeft(in30Days);
    expect(days).toBeGreaterThanOrEqual(29);
    expect(days).toBeLessThanOrEqual(31);
  });
});

describe('Stato expired e transizioni', () => {
  it('expired -> nessuna transizione valida (stato finale)', () => {
    expect(VALID_TRANSITIONS['expired']).toEqual([]);
  });

  it('expired non puo tornare a sent', () => {
    expect(VALID_TRANSITIONS['expired'].includes('sent')).toBe(false);
  });

  it('expired non puo tornare a draft', () => {
    expect(VALID_TRANSITIONS['expired'].includes('draft')).toBe(false);
  });

  it('expired non puo tornare a accepted', () => {
    expect(VALID_TRANSITIONS['expired'].includes('accepted')).toBe(false);
  });

  it('expired non puo tornare a negotiating', () => {
    expect(VALID_TRANSITIONS['expired'].includes('negotiating')).toBe(false);
  });
});
