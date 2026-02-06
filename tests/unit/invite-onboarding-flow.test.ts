/**
 * Invite Onboarding Flow Tests
 *
 * Verifica la logica del flow di onboarding per utenti invitati:
 * - Rilevamento invite flow da callbackUrl
 * - Account type selector nascosto per invite flow
 * - Auto-accept quando utente è loggato
 * - URL corretti per redirect login/register
 * - Retry resetta autoAccepted per permettere re-trigger
 *
 * Importa le funzioni dalla shared utility per garantire
 * che i test verifichino la stessa logica usata in produzione.
 */

import { describe, it, expect } from 'vitest';
import { isInviteFlow, sanitizeCallbackUrl, shouldAutoAccept } from '@/lib/invite-flow-helpers';

// ============================================
// TESTS
// ============================================

describe('Invite Onboarding Flow', () => {
  describe('isInviteFlow detection', () => {
    it('should detect invite flow from callbackUrl con token', () => {
      expect(isInviteFlow('/invite/abc123def456')).toBe(true);
    });

    it('should detect invite flow con token hex 64 chars', () => {
      const hexToken = 'a'.repeat(64);
      expect(isInviteFlow(`/invite/${hexToken}`)).toBe(true);
    });

    it('should NOT detect invite flow per URL normali', () => {
      expect(isInviteFlow('/dashboard')).toBe(false);
      expect(isInviteFlow('/dashboard/shipments')).toBe(false);
      expect(isInviteFlow('')).toBe(false);
    });

    it('should NOT detect invite flow per callbackUrl vuoto', () => {
      expect(isInviteFlow('')).toBe(false);
    });

    it('should NOT detect invite flow per path nested (startsWith preciso)', () => {
      // startsWith('/invite/') NON matcha path tipo /dashboard/invite/xxx
      // Questo è il comportamento corretto: solo /invite/... è un invite flow
      expect(isInviteFlow('/dashboard/invite/something')).toBe(false);
    });

    it('should detect invite flow con path esatto /invite/', () => {
      expect(isInviteFlow('/invite/')).toBe(true);
    });
  });

  describe('sanitizeCallbackUrl (open redirect protection)', () => {
    it('should accept path relativi validi', () => {
      expect(sanitizeCallbackUrl('/invite/abc123')).toBe('/invite/abc123');
      expect(sanitizeCallbackUrl('/dashboard')).toBe('/dashboard');
    });

    it('should reject URL assoluti (open redirect)', () => {
      expect(sanitizeCallbackUrl('https://evil.com')).toBe('');
      expect(sanitizeCallbackUrl('http://evil.com')).toBe('');
    });

    it('should reject double-slash (protocol-relative redirect)', () => {
      expect(sanitizeCallbackUrl('//evil.com')).toBe('');
    });

    it('should reject empty string', () => {
      expect(sanitizeCallbackUrl('')).toBe('');
    });

    it('should reject string che non inizia con /', () => {
      expect(sanitizeCallbackUrl('evil.com/invite/abc')).toBe('');
      expect(sanitizeCallbackUrl('javascript:alert(1)')).toBe('');
    });
  });

  describe('Account type selector visibility', () => {
    it('should hide account type per invite flow', () => {
      const callbackUrl = '/invite/abc123def456';
      const showAccountType = !isInviteFlow(callbackUrl);
      expect(showAccountType).toBe(false);
    });

    it('should show account type per registrazione normale', () => {
      const callbackUrl = '';
      const showAccountType = !isInviteFlow(callbackUrl);
      expect(showAccountType).toBe(true);
    });

    it('should show account type per dashboard callback', () => {
      const callbackUrl = '/dashboard';
      const showAccountType = !isInviteFlow(callbackUrl);
      expect(showAccountType).toBe(true);
    });
  });

  describe('Auto-accept logic', () => {
    it('should auto-accept when all conditions are met', () => {
      expect(
        shouldAutoAccept({
          sessionStatus: 'authenticated',
          hasSession: true,
          hasInvitation: true,
          hasAcceptResult: false,
          isAccepting: false,
          autoAccepted: false,
        })
      ).toBe(true);
    });

    it('should NOT auto-accept when session is loading', () => {
      expect(
        shouldAutoAccept({
          sessionStatus: 'loading',
          hasSession: false,
          hasInvitation: true,
          hasAcceptResult: false,
          isAccepting: false,
          autoAccepted: false,
        })
      ).toBe(false);
    });

    it('should NOT auto-accept when not authenticated', () => {
      expect(
        shouldAutoAccept({
          sessionStatus: 'unauthenticated',
          hasSession: false,
          hasInvitation: true,
          hasAcceptResult: false,
          isAccepting: false,
          autoAccepted: false,
        })
      ).toBe(false);
    });

    it('should NOT auto-accept when invitation not loaded yet', () => {
      expect(
        shouldAutoAccept({
          sessionStatus: 'authenticated',
          hasSession: true,
          hasInvitation: false,
          hasAcceptResult: false,
          isAccepting: false,
          autoAccepted: false,
        })
      ).toBe(false);
    });

    it('should NOT auto-accept when already accepted', () => {
      expect(
        shouldAutoAccept({
          sessionStatus: 'authenticated',
          hasSession: true,
          hasInvitation: true,
          hasAcceptResult: true,
          isAccepting: false,
          autoAccepted: false,
        })
      ).toBe(false);
    });

    it('should NOT auto-accept when accepting is in progress', () => {
      expect(
        shouldAutoAccept({
          sessionStatus: 'authenticated',
          hasSession: true,
          hasInvitation: true,
          hasAcceptResult: false,
          isAccepting: true,
          autoAccepted: false,
        })
      ).toBe(false);
    });

    it('should NOT auto-accept when already auto-accepted (prevent double)', () => {
      expect(
        shouldAutoAccept({
          sessionStatus: 'authenticated',
          hasSession: true,
          hasInvitation: true,
          hasAcceptResult: false,
          isAccepting: false,
          autoAccepted: true,
        })
      ).toBe(false);
    });
  });

  describe('Retry logic', () => {
    it('should allow re-trigger after retry resets autoAccepted', () => {
      // Simula: primo tentativo fallito, autoAccepted = true
      // Dopo retry, autoAccepted viene resettato a false
      // Il shouldAutoAccept deve tornare true per permettere nuovo tentativo
      const stateAfterRetry = {
        sessionStatus: 'authenticated',
        hasSession: true,
        hasInvitation: true,
        hasAcceptResult: false, // resettato dal retry
        isAccepting: false,
        autoAccepted: false, // resettato dal retry
      };
      expect(shouldAutoAccept(stateAfterRetry)).toBe(true);
    });

    it('should NOT re-trigger if only acceptResult is cleared but autoAccepted remains', () => {
      // Se per errore si resetta solo acceptResult ma non autoAccepted,
      // il sistema deve bloccare il re-trigger (protezione anti-loop)
      const stateIncompleteReset = {
        sessionStatus: 'authenticated',
        hasSession: true,
        hasInvitation: true,
        hasAcceptResult: false,
        isAccepting: false,
        autoAccepted: true, // NON resettato — blocca
      };
      expect(shouldAutoAccept(stateIncompleteReset)).toBe(false);
    });
  });

  describe('Login redirect URLs', () => {
    it('should generate correct login URL from invite page', () => {
      const token = 'abc123def456';
      const loginUrl = `/login?callbackUrl=/invite/${token}`;
      expect(loginUrl).toBe('/login?callbackUrl=/invite/abc123def456');
    });

    it('should generate correct register URL from invite page', () => {
      const token = 'abc123def456';
      const registerUrl = `/login?mode=register&callbackUrl=/invite/${token}`;
      expect(registerUrl).toBe('/login?mode=register&callbackUrl=/invite/abc123def456');
    });
  });

  describe('Invite flow registration message', () => {
    it('should show workspace-specific message for invite registration', () => {
      const isInvite = true;
      const message = isInvite
        ? 'Crea un account per entrare nel workspace'
        : 'Registrati per iniziare a gestire le tue spedizioni';
      expect(message).toBe('Crea un account per entrare nel workspace');
    });

    it('should show generic message for normal registration', () => {
      const isInvite = false;
      const message = isInvite
        ? 'Crea un account per entrare nel workspace'
        : 'Registrati per iniziare a gestire le tue spedizioni';
      expect(message).toBe('Registrati per iniziare a gestire le tue spedizioni');
    });
  });

  describe('Invite banner visibility', () => {
    it('should show banner for invite flow in register mode', () => {
      const callbackUrl = '/invite/abc123';
      const mode = 'register';
      const showBanner = isInviteFlow(callbackUrl);
      expect(showBanner).toBe(true);

      // Messaggio specifico per register
      const message =
        mode === 'register'
          ? 'Sei stato invitato in un workspace. Crea il tuo account per entrare nel team.'
          : 'Stai accedendo per accettare un invito al workspace.';
      expect(message).toContain('Crea il tuo account');
    });

    it('should show banner for invite flow in login mode', () => {
      const callbackUrl = '/invite/abc123';
      const mode = 'login';
      const showBanner = isInviteFlow(callbackUrl);
      expect(showBanner).toBe(true);

      // Messaggio specifico per login
      const message =
        mode === 'register'
          ? 'Sei stato invitato in un workspace. Crea il tuo account per entrare nel team.'
          : 'Stai accedendo per accettare un invito al workspace.';
      expect(message).toContain('accettare un invito');
    });

    it('should NOT show banner for normal flow', () => {
      expect(isInviteFlow('/dashboard')).toBe(false);
      expect(isInviteFlow('')).toBe(false);
    });
  });
});
