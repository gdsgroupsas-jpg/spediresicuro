/**
 * Test: Email benvenuto su conversione preventivo
 *
 * Verifica:
 * - Email benvenuto inviata con parametri corretti
 * - Fallback "SpedireSicuro" se companyName non fornito
 * - Contenuto HTML corretto (nome, password, email)
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// Mock Resend SDK
const mockSend = vi.fn().mockResolvedValue({ data: { id: 'email-123' }, error: null });

vi.mock('resend', () => ({
  Resend: vi.fn(() => ({
    emails: { send: mockSend },
  })),
}));

// Imposta RESEND_API_KEY
vi.stubEnv('RESEND_API_KEY', 'test-key');

import { sendWelcomeEmail } from '@/lib/email/resend';

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });
});

describe('sendWelcomeEmail su conversione preventivo', () => {
  const defaultParams = {
    to: 'nuovo@acme.it',
    userName: 'Mario Rossi',
    password: 'Temp1234!',
    createdBy: 'Luca Bianchi',
    companyName: 'ExpressShip SRL',
  };

  it('dovrebbe inviare email con parametri corretti', async () => {
    await sendWelcomeEmail(defaultParams);

    expect(mockSend).toHaveBeenCalledOnce();
    const call = mockSend.mock.calls[0][0];

    expect(call.to).toEqual(['nuovo@acme.it']);
    expect(call.subject).toContain('Benvenuto');
    expect(call.subject).toContain('ExpressShip SRL');
  });

  it('dovrebbe includere nome utente nel body', async () => {
    await sendWelcomeEmail(defaultParams);
    const call = mockSend.mock.calls[0][0];

    expect(call.html).toContain('Mario Rossi');
  });

  it('dovrebbe includere email nel body', async () => {
    await sendWelcomeEmail(defaultParams);
    const call = mockSend.mock.calls[0][0];

    expect(call.html).toContain('nuovo@acme.it');
  });

  it('dovrebbe includere password nel body', async () => {
    await sendWelcomeEmail(defaultParams);
    const call = mockSend.mock.calls[0][0];

    expect(call.html).toContain('Temp1234!');
  });

  it('dovrebbe includere nome del creatore', async () => {
    await sendWelcomeEmail(defaultParams);
    const call = mockSend.mock.calls[0][0];

    expect(call.html).toContain('Luca Bianchi');
  });

  it('dovrebbe includere companyName nel branding', async () => {
    await sendWelcomeEmail(defaultParams);
    const call = mockSend.mock.calls[0][0];

    expect(call.html).toContain('ExpressShip SRL');
  });

  it('dovrebbe usare "SpedireSicuro" come fallback senza companyName', async () => {
    await sendWelcomeEmail({
      to: 'nuovo@acme.it',
      userName: 'Mario Rossi',
      password: 'Temp1234!',
    });
    const call = mockSend.mock.calls[0][0];

    expect(call.html).toContain('SpedireSicuro');
    expect(call.subject).toContain('SpedireSicuro');
  });

  it('dovrebbe usare "SpedireSicuro" come fallback se companyName undefined', async () => {
    await sendWelcomeEmail({
      to: 'nuovo@acme.it',
      userName: 'Mario',
      password: 'Test1234!',
      companyName: undefined,
    });
    const call = mockSend.mock.calls[0][0];

    expect(call.html).toContain('SpedireSicuro');
  });

  it('dovrebbe avere link login nel body', async () => {
    await sendWelcomeEmail(defaultParams);
    const call = mockSend.mock.calls[0][0];

    expect(call.html).toContain('spediresicuro.it/login');
  });

  it('dovrebbe avere avviso cambio password', async () => {
    await sendWelcomeEmail(defaultParams);
    const call = mockSend.mock.calls[0][0];

    expect(call.html).toContain('cambiare la password');
  });

  it('dovrebbe restituire success=true', async () => {
    const result = await sendWelcomeEmail(defaultParams);
    expect(result.success).toBe(true);
  });

  it('dovrebbe gestire loginUrl custom', async () => {
    await sendWelcomeEmail({
      ...defaultParams,
      loginUrl: 'https://custom.example.com/login',
    });
    const call = mockSend.mock.calls[0][0];

    expect(call.html).toContain('custom.example.com/login');
  });
});
