/**
 * Test: sendPremiumWelcomeEmail — Template Ferrari-level
 *
 * Verifica:
 * - Variante self-registration (senza credenziali)
 * - Variante reseller-created (con credenziali + branding)
 * - Branding reseller (nome + company)
 * - Sanitizzazione parametri (XSS in userName, resellerName)
 * - Fallback se parametri mancanti
 * - Subject line corretta per variante
 * - 3 step onboarding presenti
 * - CTA corretta per variante
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

import { sendPremiumWelcomeEmail } from '@/lib/email/resend';

beforeEach(() => {
  vi.clearAllMocks();
  mockSend.mockResolvedValue({ data: { id: 'email-123' }, error: null });
});

describe('sendPremiumWelcomeEmail', () => {
  // ─── VARIANTE SELF-REGISTRATION ───

  describe('self-registration (senza credenziali)', () => {
    const selfRegParams = {
      to: 'mario@example.it',
      userName: 'Mario Rossi',
    };

    it('dovrebbe inviare email senza credenziali', async () => {
      await sendPremiumWelcomeEmail(selfRegParams);

      expect(mockSend).toHaveBeenCalledOnce();
      const call = mockSend.mock.calls[0][0];

      // NO credenziali nel body
      expect(call.html).not.toContain('Le tue credenziali');
      expect(call.html).not.toContain('Password');
    });

    it('dovrebbe avere subject SpedireSicuro', async () => {
      await sendPremiumWelcomeEmail(selfRegParams);
      const call = mockSend.mock.calls[0][0];

      expect(call.subject).toContain('SpedireSicuro');
      expect(call.subject).toContain('pronto');
    });

    it('dovrebbe avere CTA "Completa il tuo profilo"', async () => {
      await sendPremiumWelcomeEmail(selfRegParams);
      const call = mockSend.mock.calls[0][0];

      expect(call.html).toContain('Completa il tuo profilo');
    });

    it('dovrebbe includere il nome utente', async () => {
      await sendPremiumWelcomeEmail(selfRegParams);
      const call = mockSend.mock.calls[0][0];

      expect(call.html).toContain('Mario Rossi');
    });

    it('dovrebbe includere i 3 step onboarding', async () => {
      await sendPremiumWelcomeEmail(selfRegParams);
      const call = mockSend.mock.calls[0][0];

      expect(call.html).toContain('Profilo');
      expect(call.html).toContain('Wallet');
      expect(call.html).toContain('Spedisci');
      expect(call.html).toContain('3 semplici passi');
    });

    it('dovrebbe includere social proof', async () => {
      await sendPremiumWelcomeEmail(selfRegParams);
      const call = mockSend.mock.calls[0][0];

      expect(call.html).toContain('500 aziende italiane');
    });

    it('dovrebbe includere link assistenza', async () => {
      await sendPremiumWelcomeEmail(selfRegParams);
      const call = mockSend.mock.calls[0][0];

      expect(call.html).toContain('assistenza@spediresicuro.it');
    });

    it('dovrebbe usare "utente" come fallback senza userName', async () => {
      await sendPremiumWelcomeEmail({ to: 'test@test.it' });
      const call = mockSend.mock.calls[0][0];

      expect(call.html).toContain('utente');
    });
  });

  // ─── VARIANTE RESELLER-CREATED ───

  describe('reseller crea client (con credenziali)', () => {
    const resellerParams = {
      to: 'cliente@acme.it',
      userName: 'Anna Verdi',
      credentials: { email: 'cliente@acme.it', password: 'TempPass123!' },
      resellerName: 'Luca Bianchi',
      resellerCompany: 'ExpressShip SRL',
    };

    it('dovrebbe includere credenziali nel body', async () => {
      await sendPremiumWelcomeEmail(resellerParams);
      const call = mockSend.mock.calls[0][0];

      expect(call.html).toContain('credenziali');
      expect(call.html).toContain('cliente@acme.it');
      expect(call.html).toContain('TempPass123!');
    });

    it('dovrebbe avere CTA "Accedi al tuo account"', async () => {
      await sendPremiumWelcomeEmail(resellerParams);
      const call = mockSend.mock.calls[0][0];

      expect(call.html).toContain('Accedi al tuo account');
    });

    it('dovrebbe avere subject con branding reseller', async () => {
      await sendPremiumWelcomeEmail(resellerParams);
      const call = mockSend.mock.calls[0][0];

      expect(call.subject).toContain('ExpressShip SRL');
    });

    it('dovrebbe includere branding reseller nel header', async () => {
      await sendPremiumWelcomeEmail(resellerParams);
      const call = mockSend.mock.calls[0][0];

      expect(call.html).toContain('ExpressShip SRL');
      expect(call.html).toContain('powered by SpedireSicuro');
    });

    it('dovrebbe includere nome reseller come creatore', async () => {
      await sendPremiumWelcomeEmail(resellerParams);
      const call = mockSend.mock.calls[0][0];

      expect(call.html).toContain('Luca Bianchi');
    });

    it('dovrebbe includere avviso cambio password', async () => {
      await sendPremiumWelcomeEmail(resellerParams);
      const call = mockSend.mock.calls[0][0];

      expect(call.html).toContain('Cambia la password');
    });
  });

  // ─── BRANDING & FALLBACK ───

  describe('branding e fallback', () => {
    it('dovrebbe usare SpedireSicuro se resellerCompany non fornito', async () => {
      await sendPremiumWelcomeEmail({
        to: 'test@test.it',
        userName: 'Test',
      });
      const call = mockSend.mock.calls[0][0];

      expect(call.html).toContain('Benvenuto su SpedireSicuro');
      expect(call.html).toContain('La tua piattaforma di spedizioni');
    });

    it('dovrebbe usare resellerCompany nel branding', async () => {
      await sendPremiumWelcomeEmail({
        to: 'test@test.it',
        userName: 'Test',
        resellerCompany: 'Logistica Milano',
      });
      const call = mockSend.mock.calls[0][0];

      expect(call.html).toContain('Benvenuto su Logistica Milano');
      expect(call.html).toContain('powered by SpedireSicuro');
    });

    it('dovrebbe usare loginUrl custom', async () => {
      await sendPremiumWelcomeEmail({
        to: 'test@test.it',
        loginUrl: 'https://custom.example.com/login',
      });
      const call = mockSend.mock.calls[0][0];

      expect(call.html).toContain('custom.example.com/login');
    });

    it('dovrebbe usare URL dashboard default', async () => {
      await sendPremiumWelcomeEmail({ to: 'test@test.it' });
      const call = mockSend.mock.calls[0][0];

      expect(call.html).toContain('spediresicuro.it/dashboard');
    });
  });

  // ─── SANITIZZAZIONE XSS ───

  describe('sanitizzazione XSS', () => {
    it('dovrebbe sanitizzare userName con tag HTML', async () => {
      await sendPremiumWelcomeEmail({
        to: 'test@test.it',
        userName: '<script>alert("xss")</script>',
      });
      const call = mockSend.mock.calls[0][0];

      expect(call.html).not.toContain('<script>');
      expect(call.html).toContain('&lt;script&gt;');
    });

    it('dovrebbe sanitizzare resellerName con tag HTML', async () => {
      await sendPremiumWelcomeEmail({
        to: 'test@test.it',
        resellerName: '<img src=x onerror=alert(1)>',
        credentials: { email: 'a@b.it', password: 'test' },
      });
      const call = mockSend.mock.calls[0][0];

      expect(call.html).not.toContain('<img');
      expect(call.html).toContain('&lt;img');
    });

    it('dovrebbe sanitizzare resellerCompany', async () => {
      await sendPremiumWelcomeEmail({
        to: 'test@test.it',
        resellerCompany: '"><script>evil()</script>',
      });
      const call = mockSend.mock.calls[0][0];

      expect(call.html).not.toContain('"><script>');
    });

    it('dovrebbe sanitizzare credenziali email', async () => {
      await sendPremiumWelcomeEmail({
        to: 'test@test.it',
        credentials: { email: '<b>hacked</b>@test.it', password: '<script>x</script>' },
      });
      const call = mockSend.mock.calls[0][0];

      expect(call.html).not.toContain('<b>hacked</b>');
      expect(call.html).not.toContain('<script>x</script>');
    });

    it('dovrebbe sanitizzare single quotes', async () => {
      await sendPremiumWelcomeEmail({
        to: 'test@test.it',
        userName: "O'Malley",
      });
      const call = mockSend.mock.calls[0][0];

      expect(call.html).toContain('&#39;');
      expect(call.html).not.toMatch(/O'Malley/);
    });

    it('dovrebbe bloccare loginUrl javascript:', async () => {
      await sendPremiumWelcomeEmail({
        to: 'test@test.it',
        loginUrl: 'javascript:alert(1)',
      });
      const call = mockSend.mock.calls[0][0];

      expect(call.html).not.toContain('javascript:');
      expect(call.html).toContain('spediresicuro.it/dashboard');
    });

    it('dovrebbe bloccare loginUrl data:', async () => {
      await sendPremiumWelcomeEmail({
        to: 'test@test.it',
        loginUrl: 'data:text/html,<script>alert(1)</script>',
      });
      const call = mockSend.mock.calls[0][0];

      expect(call.html).not.toContain('data:text/html');
      expect(call.html).toContain('spediresicuro.it/dashboard');
    });

    it('dovrebbe accettare loginUrl https valido', async () => {
      await sendPremiumWelcomeEmail({
        to: 'test@test.it',
        loginUrl: 'https://spediresicuro.it/dashboard/dati-cliente',
      });
      const call = mockSend.mock.calls[0][0];

      expect(call.html).toContain('spediresicuro.it/dashboard/dati-cliente');
    });
  });

  // ─── RISULTATO ───

  describe('risultato', () => {
    it('dovrebbe restituire success=true', async () => {
      const result = await sendPremiumWelcomeEmail({ to: 'test@test.it' });
      expect(result.success).toBe(true);
    });

    it('dovrebbe gestire errore Resend', async () => {
      mockSend.mockResolvedValueOnce({ data: null, error: { message: 'Rate limited' } });
      const result = await sendPremiumWelcomeEmail({ to: 'test@test.it' });
      expect(result.success).toBe(false);
    });

    it('dovrebbe inviare a indirizzo corretto', async () => {
      await sendPremiumWelcomeEmail({ to: 'destinatario@firma.it' });
      const call = mockSend.mock.calls[0][0];
      expect(call.to).toEqual(['destinatario@firma.it']);
    });

    it('dovrebbe inviare dal FROM_EMAIL corretto', async () => {
      await sendPremiumWelcomeEmail({ to: 'test@test.it' });
      const call = mockSend.mock.calls[0][0];
      expect(call.from).toContain('SpedireSicuro');
      expect(call.from).toContain('noreply@spediresicuro.it');
    });
  });

  // ─── STRUTTURA HTML ───

  describe('struttura HTML', () => {
    it('dovrebbe avere doctype HTML', async () => {
      await sendPremiumWelcomeEmail({ to: 'test@test.it' });
      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('<!DOCTYPE html>');
    });

    it('dovrebbe avere meta viewport per responsive', async () => {
      await sendPremiumWelcomeEmail({ to: 'test@test.it' });
      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('viewport');
    });

    it('dovrebbe avere accent bar gradiente arancione', async () => {
      await sendPremiumWelcomeEmail({ to: 'test@test.it' });
      const call = mockSend.mock.calls[0][0];
      // Gradiente arancio SpedireSicuro
      expect(call.html).toContain('#f97316');
      expect(call.html).toContain('#ea580c');
    });

    it('dovrebbe avere max-width 600px', async () => {
      await sendPremiumWelcomeEmail({ to: 'test@test.it' });
      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('max-width: 600px');
    });

    it('dovrebbe avere border-radius 16px sulla card', async () => {
      await sendPremiumWelcomeEmail({ to: 'test@test.it' });
      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('border-radius: 16px');
    });

    it('dovrebbe avere box-shadow premium sulla card', async () => {
      await sendPremiumWelcomeEmail({ to: 'test@test.it' });
      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('box-shadow');
    });
  });
});
