/**
 * Test: Email template preventivi commerciali
 *
 * Verifica:
 * - sendQuoteToProspectEmail: HTML corretto, attachment PDF
 * - sendQuoteExpiryReminderEmail: HTML corretto, dati scadenza
 * - Edge case: email mancante -> skip invio
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock Resend SDK
const mockSend = vi.fn().mockResolvedValue({ data: { id: 'email-123' }, error: null });

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: { send: mockSend },
  })),
}));

// Imposta RESEND_API_KEY per non skippare
vi.stubEnv('RESEND_API_KEY', 'test-key');

import { sendQuoteToProspectEmail, sendQuoteExpiryReminderEmail } from '@/lib/email/resend';

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });
});

describe('sendQuoteToProspectEmail', () => {
  const defaultParams = {
    to: 'mario@selfie.it',
    prospectName: 'Mario Rossi',
    resellerCompanyName: 'ExpressShip SRL',
    quoteValidityDays: 30,
    pdfBuffer: Buffer.from('fake-pdf-content'),
  };

  it('dovrebbe inviare email con parametri corretti', async () => {
    await sendQuoteToProspectEmail(defaultParams);

    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0][0];

    expect(call.to).toEqual(['mario@selfie.it']);
    expect(call.subject).toContain('ExpressShip SRL');
    expect(call.subject).toContain('Preventivo');
  });

  it('dovrebbe includere il nome del prospect nel body HTML', async () => {
    await sendQuoteToProspectEmail(defaultParams);
    const call = mockSend.mock.calls[0][0];

    expect(call.html).toContain('Mario Rossi');
  });

  it('dovrebbe includere il nome del reseller nel body HTML', async () => {
    await sendQuoteToProspectEmail(defaultParams);
    const call = mockSend.mock.calls[0][0];

    expect(call.html).toContain('ExpressShip SRL');
  });

  it('dovrebbe includere i giorni di validita nel body HTML', async () => {
    await sendQuoteToProspectEmail(defaultParams);
    const call = mockSend.mock.calls[0][0];

    expect(call.html).toContain('30 giorni');
  });

  it('dovrebbe allegare il PDF come attachment', async () => {
    await sendQuoteToProspectEmail(defaultParams);
    const call = mockSend.mock.calls[0][0];

    expect(call.attachments).toHaveLength(1);
    expect(call.attachments[0].filename).toBe('preventivo.pdf');
    expect(call.attachments[0].contentType).toBe('application/pdf');
    expect(call.attachments[0].content).toBeInstanceOf(Buffer);
  });

  it('dovrebbe restituire success=true', async () => {
    const result = await sendQuoteToProspectEmail(defaultParams);
    expect(result.success).toBe(true);
  });

  it('dovrebbe gestire errore Resend', async () => {
    mockSend.mockResolvedValueOnce({ data: null, error: { message: 'Rate limit' } });
    const result = await sendQuoteToProspectEmail(defaultParams);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Rate limit');
  });
});

describe('sendQuoteExpiryReminderEmail', () => {
  const defaultParams = {
    to: 'reseller@example.com',
    resellerName: 'Luca Bianchi',
    prospectCompany: 'ACME Corp',
    expiresAt: '2026-02-15T12:00:00.000Z',
  };

  it('dovrebbe inviare email con parametri corretti', async () => {
    await sendQuoteExpiryReminderEmail(defaultParams);

    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0][0];

    expect(call.to).toEqual(['reseller@example.com']);
    expect(call.subject).toContain('ACME Corp');
    expect(call.subject).toContain('scadenza');
  });

  it('dovrebbe includere il nome del reseller nel body HTML', async () => {
    await sendQuoteExpiryReminderEmail(defaultParams);
    const call = mockSend.mock.calls[0][0];

    expect(call.html).toContain('Luca Bianchi');
  });

  it('dovrebbe includere il nome del prospect nel body HTML', async () => {
    await sendQuoteExpiryReminderEmail(defaultParams);
    const call = mockSend.mock.calls[0][0];

    expect(call.html).toContain('ACME Corp');
  });

  it('dovrebbe includere la data di scadenza formattata in italiano', async () => {
    await sendQuoteExpiryReminderEmail(defaultParams);
    const call = mockSend.mock.calls[0][0];

    // Data formattata in italiano: "15 febbraio 2026"
    expect(call.html).toContain('2026');
    expect(call.html).toContain('febbraio');
  });

  it('dovrebbe NON avere attachment (solo reminder testuale)', async () => {
    await sendQuoteExpiryReminderEmail(defaultParams);
    const call = mockSend.mock.calls[0][0];

    expect(call.attachments).toBeUndefined();
  });

  it('dovrebbe usare dashboardUrl di default se non specificato', async () => {
    await sendQuoteExpiryReminderEmail(defaultParams);
    const call = mockSend.mock.calls[0][0];

    expect(call.html).toContain('spediresicuro.it/dashboard/reseller/preventivo');
  });

  it('dovrebbe usare dashboardUrl custom se specificato', async () => {
    await sendQuoteExpiryReminderEmail({
      ...defaultParams,
      dashboardUrl: 'https://custom.example.com/quotes',
    });
    const call = mockSend.mock.calls[0][0];

    expect(call.html).toContain('custom.example.com/quotes');
  });

  it('dovrebbe avere stile amber/warning nel header', async () => {
    await sendQuoteExpiryReminderEmail(defaultParams);
    const call = mockSend.mock.calls[0][0];

    // Header con gradiente amber
    expect(call.html).toContain('#d97706');
    expect(call.html).toContain('#f59e0b');
  });
});

describe('Email edge cases', () => {
  it('sendQuoteToProspectEmail senza RESEND_API_KEY torna errore', async () => {
    // Temporaneamente rimuovi la key
    const origKey = process.env.RESEND_API_KEY;
    delete process.env.RESEND_API_KEY;

    const result = await sendQuoteToProspectEmail({
      to: 'test@test.com',
      prospectName: 'Test',
      resellerCompanyName: 'Test SRL',
      quoteValidityDays: 30,
      pdfBuffer: Buffer.from('pdf'),
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('RESEND_API_KEY');

    // Ripristina
    process.env.RESEND_API_KEY = origKey;
  });
});
