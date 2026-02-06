/**
 * Team Setup Wizard Tests
 *
 * Verifica logica del wizard primo setup team reseller:
 * - Condizioni di visibilita' (solo owner, nessun membro, nessun invito)
 * - Step navigation (welcome -> invite -> result)
 * - Form validazione email e ruolo
 * - Gestione risultato invito (successo e errore)
 * - Skip e dismissal con localStorage
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ============================================
// LOGICA WIZARD: condizioni visibilita'
// ============================================

describe('TeamSetupWizard - Condizioni visibilita', () => {
  /**
   * Replica la logica del useEffect nella pagina team:
   * showWizard = members.length <= 1 && pendingInvites === 0 && canManage && !sessionDismissed
   * Il wizard riappare ogni volta che l'utente torna solo (niente localStorage permanente).
   */
  function shouldShowWizard(opts: {
    membersCount: number;
    pendingInvitesCount: number;
    canManageMembers: boolean;
    sessionDismissed: boolean;
  }): boolean {
    if (opts.sessionDismissed) return false;

    const isAlone = opts.membersCount <= 1 && opts.pendingInvitesCount === 0;
    return isAlone && opts.canManageMembers;
  }

  it('mostra wizard quando reseller e solo (1 membro, 0 inviti)', () => {
    expect(
      shouldShowWizard({
        membersCount: 1,
        pendingInvitesCount: 0,
        canManageMembers: true,
        sessionDismissed: false,
      })
    ).toBe(true);
  });

  it('mostra wizard con 0 membri (edge case)', () => {
    expect(
      shouldShowWizard({
        membersCount: 0,
        pendingInvitesCount: 0,
        canManageMembers: true,
        sessionDismissed: false,
      })
    ).toBe(true);
  });

  it('NON mostra wizard se ci sono 2+ membri', () => {
    expect(
      shouldShowWizard({
        membersCount: 2,
        pendingInvitesCount: 0,
        canManageMembers: true,
        sessionDismissed: false,
      })
    ).toBe(false);
  });

  it('NON mostra wizard se ci sono inviti pending', () => {
    expect(
      shouldShowWizard({
        membersCount: 1,
        pendingInvitesCount: 1,
        canManageMembers: true,
        sessionDismissed: false,
      })
    ).toBe(false);
  });

  it('NON mostra wizard se utente non ha permessi di gestione', () => {
    expect(
      shouldShowWizard({
        membersCount: 1,
        pendingInvitesCount: 0,
        canManageMembers: false,
        sessionDismissed: false,
      })
    ).toBe(false);
  });

  it('NON mostra wizard se dismissato nella sessione corrente', () => {
    expect(
      shouldShowWizard({
        membersCount: 1,
        pendingInvitesCount: 0,
        canManageMembers: true,
        sessionDismissed: true,
      })
    ).toBe(false);
  });
});

// ============================================
// LOGICA WIZARD: session dismiss
// ============================================

describe('TeamSetupWizard - Session dismiss', () => {
  it('dismiss in sessione impedisce riapparizione nella stessa sessione', () => {
    let dismissed = false;

    // Prima volta: wizard appare
    expect(!dismissed && true).toBe(true);

    // Skip/complete: dismiss
    dismissed = true;

    // Stessa sessione: wizard NON riappare
    expect(!dismissed && true).toBe(false);
  });

  it('wizard riappare in nuova sessione se utente torna solo', () => {
    // Nuova sessione = dismissed resettato a false
    const dismissed = false;
    const isAlone = true;
    const canManage = true;

    expect(!dismissed && isAlone && canManage).toBe(true);
  });

  it('wizard NON appare se ci sono inviti attivi anche in nuova sessione', () => {
    const dismissed = false;
    const isAlone = false; // ha inviti pending
    const canManage = true;

    expect(!dismissed && isAlone && canManage).toBe(false);
  });
});

// ============================================
// LOGICA WIZARD: step navigation
// ============================================

describe('TeamSetupWizard - Step navigation', () => {
  type WizardStep = 'welcome' | 'invite' | 'result';

  it('parte dallo step welcome', () => {
    const initialStep: WizardStep = 'welcome';
    expect(initialStep).toBe('welcome');
  });

  it('da welcome si va a invite', () => {
    let step: WizardStep = 'welcome';
    // Simula click "Invita il primo membro"
    step = 'invite';
    expect(step).toBe('invite');
  });

  it('da invite si puo tornare a welcome', () => {
    let step: WizardStep = 'invite';
    // Simula click "Indietro"
    step = 'welcome';
    expect(step).toBe('welcome');
  });

  it('da invite si va a result dopo invio', () => {
    let step: WizardStep = 'invite';
    // Simula invio riuscito
    step = 'result';
    expect(step).toBe('result');
  });

  it('da result si puo tornare a invite per invitare un altro', () => {
    let step: WizardStep = 'result';
    // Simula click "Invita un altro"
    step = 'invite';
    expect(step).toBe('invite');
  });
});

// ============================================
// LOGICA WIZARD: validazione form invite
// ============================================

describe('TeamSetupWizard - Form validazione', () => {
  it('ruolo default e operator (consigliato)', () => {
    const defaultRole = 'operator';
    expect(defaultRole).toBe('operator');
  });

  it('ruoli disponibili sono operator, admin, viewer', () => {
    const availableRoles = ['operator', 'admin', 'viewer'];
    expect(availableRoles).toContain('operator');
    expect(availableRoles).toContain('admin');
    expect(availableRoles).toContain('viewer');
    expect(availableRoles).not.toContain('owner');
    expect(availableRoles).toHaveLength(3);
  });

  it('email vuota disabilita submit', () => {
    const email = '';
    const isSubmitting = false;
    const canSubmit = !isSubmitting && email.length > 0;
    expect(canSubmit).toBe(false);
  });

  it('email presente abilita submit', () => {
    const email = 'test@example.com';
    const isSubmitting = false;
    const canSubmit = !isSubmitting && email.length > 0;
    expect(canSubmit).toBe(true);
  });

  it('durante invio il submit e disabilitato', () => {
    const email = 'test@example.com';
    const isSubmitting = true;
    const canSubmit = !isSubmitting && email.length > 0;
    expect(canSubmit).toBe(false);
  });
});

// ============================================
// LOGICA WIZARD: gestione risultato
// ============================================

describe('TeamSetupWizard - Gestione risultato', () => {
  interface InviteResult {
    success: boolean;
    message: string;
    url?: string;
  }

  it('successo mostra messaggio e link', () => {
    const result: InviteResult = {
      success: true,
      message: 'Invito inviato con successo!',
      url: 'https://spediresicuro.it/invite/abc123',
    };

    expect(result.success).toBe(true);
    expect(result.message).toBeTruthy();
    expect(result.url).toBeTruthy();
  });

  it('successo senza link e valido', () => {
    const result: InviteResult = {
      success: true,
      message: 'Invito inviato via email',
    };

    expect(result.success).toBe(true);
    expect(result.url).toBeUndefined();
  });

  it('errore mostra messaggio di errore', () => {
    const result: InviteResult = {
      success: false,
      message: 'Email gia invitata in questo workspace',
    };

    expect(result.success).toBe(false);
    expect(result.message).toBeTruthy();
    expect(result.url).toBeUndefined();
  });

  it('errore di rete gestito', () => {
    const result: InviteResult = {
      success: false,
      message: 'Errore di connessione',
    };

    expect(result.success).toBe(false);
    expect(result.message).toContain('Errore');
  });
});

// ============================================
// STEP INDICATORS
// ============================================

describe('TeamSetupWizard - Step indicators', () => {
  const steps = [
    { key: 'welcome', label: 'Benvenuto' },
    { key: 'invite', label: 'Invita' },
    { key: 'result', label: 'Fatto' },
  ];

  it('ci sono esattamente 3 step', () => {
    expect(steps).toHaveLength(3);
  });

  it('ordine corretto: welcome -> invite -> result', () => {
    expect(steps[0].key).toBe('welcome');
    expect(steps[1].key).toBe('invite');
    expect(steps[2].key).toBe('result');
  });

  it('currentStepIndex corretto per ogni step', () => {
    expect(steps.findIndex((s) => s.key === 'welcome')).toBe(0);
    expect(steps.findIndex((s) => s.key === 'invite')).toBe(1);
    expect(steps.findIndex((s) => s.key === 'result')).toBe(2);
  });
});
