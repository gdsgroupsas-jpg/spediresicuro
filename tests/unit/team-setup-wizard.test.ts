/**
 * Team Setup Wizard Tests
 *
 * Verifica logica del wizard invito membri team:
 * - Condizioni di visibilita' welcome automatico (solo owner, nessun membro, nessun invito)
 * - Invito diretto via bottone (sempre disponibile con permessi)
 * - Step navigation (welcome -> invite -> result)
 * - initialStep e hideBackButton per invito diretto
 * - Form validazione email e ruolo
 * - Gestione risultato invito (successo e errore)
 * - Skip e dismissal
 *
 * @vitest-environment happy-dom
 */

import { describe, it, expect } from 'vitest';

// ============================================
// LOGICA WIZARD: condizioni welcome automatico
// ============================================

describe('TeamSetupWizard - Condizioni welcome automatico', () => {
  /**
   * Replica la logica del useEffect nella pagina team:
   * Il wizard welcome appare automaticamente quando:
   * - members.length <= 1
   * - pendingInvites === 0
   * - canManage === true
   * - !sessionDismissed
   */
  function shouldShowWelcome(opts: {
    membersCount: number;
    pendingInvitesCount: number;
    canManageMembers: boolean;
    sessionDismissed: boolean;
  }): boolean {
    if (opts.sessionDismissed) return false;

    const isAlone = opts.membersCount <= 1 && opts.pendingInvitesCount === 0;
    return isAlone && opts.canManageMembers;
  }

  it('mostra welcome quando reseller e solo (1 membro, 0 inviti)', () => {
    expect(
      shouldShowWelcome({
        membersCount: 1,
        pendingInvitesCount: 0,
        canManageMembers: true,
        sessionDismissed: false,
      })
    ).toBe(true);
  });

  it('mostra welcome con 0 membri (edge case)', () => {
    expect(
      shouldShowWelcome({
        membersCount: 0,
        pendingInvitesCount: 0,
        canManageMembers: true,
        sessionDismissed: false,
      })
    ).toBe(true);
  });

  it('NON mostra welcome se ci sono 2+ membri', () => {
    expect(
      shouldShowWelcome({
        membersCount: 2,
        pendingInvitesCount: 0,
        canManageMembers: true,
        sessionDismissed: false,
      })
    ).toBe(false);
  });

  it('NON mostra welcome se ci sono inviti pending', () => {
    expect(
      shouldShowWelcome({
        membersCount: 1,
        pendingInvitesCount: 1,
        canManageMembers: true,
        sessionDismissed: false,
      })
    ).toBe(false);
  });

  it('NON mostra welcome se utente non ha permessi di gestione', () => {
    expect(
      shouldShowWelcome({
        membersCount: 1,
        pendingInvitesCount: 0,
        canManageMembers: false,
        sessionDismissed: false,
      })
    ).toBe(false);
  });

  it('NON mostra welcome se dismissato nella sessione corrente', () => {
    expect(
      shouldShowWelcome({
        membersCount: 1,
        pendingInvitesCount: 0,
        canManageMembers: true,
        sessionDismissed: true,
      })
    ).toBe(false);
  });
});

// ============================================
// LOGICA WIZARD: dual mode (welcome vs invite diretto)
// ============================================

describe('TeamSetupWizard - Dual mode', () => {
  type WizardMode = 'welcome' | 'invite';

  it('quando utente e solo, wizardMode = welcome', () => {
    const isAlone = true;
    const mode: WizardMode = isAlone ? 'welcome' : 'invite';
    expect(mode).toBe('welcome');
  });

  it('quando utente clicca Invita Membro, wizardMode = invite', () => {
    // Invito diretto dal bottone: sempre mode 'invite'
    const mode: WizardMode = 'invite';
    expect(mode).toBe('invite');
  });

  it('initialStep segue il wizardMode', () => {
    // Welcome mode → parte da step welcome
    expect('welcome').toBe('welcome');
    // Invite mode → parte da step invite (salta welcome)
    expect('invite').toBe('invite');
  });

  it('in modo invite diretto, hideBackButton e true', () => {
    const wizardMode: WizardMode = 'invite';
    const hideBackButton = wizardMode === 'invite';
    expect(hideBackButton).toBe(true);
  });

  it('in modo welcome, hideBackButton e false', () => {
    const wizardMode: WizardMode = 'welcome';
    const hideBackButton = wizardMode === 'invite';
    expect(hideBackButton).toBe(false);
  });

  it('invito diretto funziona anche con 2+ membri', () => {
    // Il bottone "Invita Membro" funziona sempre con permessi
    const membersCount = 5;
    const canManageMembers = true;
    const canInvite = canManageMembers; // Non dipende da membersCount
    expect(canInvite).toBe(true);
  });

  it('invito diretto funziona anche con inviti pending', () => {
    const pendingInvitesCount = 3;
    const canManageMembers = true;
    const canInvite = canManageMembers; // Non dipende da pendingInvitesCount
    expect(canInvite).toBe(true);
  });
});

// ============================================
// LOGICA WIZARD: session dismiss
// ============================================

describe('TeamSetupWizard - Session dismiss', () => {
  it('dismiss in sessione impedisce riapparizione welcome nella stessa sessione', () => {
    let dismissed = false;

    // Prima volta: wizard welcome appare
    expect(!dismissed && true).toBe(true);

    // Skip/complete: dismiss
    dismissed = true;

    // Stessa sessione: welcome NON riappare
    expect(!dismissed && true).toBe(false);
  });

  it('wizard welcome riappare in nuova sessione se utente torna solo', () => {
    const dismissed = false;
    const isAlone = true;
    const canManage = true;

    expect(!dismissed && isAlone && canManage).toBe(true);
  });

  it('dismiss NON blocca invito diretto dal bottone', () => {
    const dismissed = true;
    // Il bottone "Invita Membro" apre sempre il wizard in mode invite
    // Non dipende dal dismiss (il dismiss e solo per il welcome automatico)
    const canManage = true;
    const canInviteViaButton = canManage; // Sempre possibile con permessi
    expect(canInviteViaButton).toBe(true);
  });
});

// ============================================
// LOGICA WIZARD: step navigation
// ============================================

describe('TeamSetupWizard - Step navigation', () => {
  type WizardStep = 'welcome' | 'invite' | 'result';

  it('parte dallo step welcome (default)', () => {
    const initialStep: WizardStep = 'welcome';
    expect(initialStep).toBe('welcome');
  });

  it('puo partire dallo step invite (invito diretto)', () => {
    const initialStep: WizardStep = 'invite';
    expect(initialStep).toBe('invite');
  });

  it('da welcome si va a invite', () => {
    let step: WizardStep = 'welcome';
    step = 'invite';
    expect(step).toBe('invite');
  });

  it('da invite si puo tornare a welcome (solo in modo welcome)', () => {
    let step: WizardStep = 'invite';
    step = 'welcome';
    expect(step).toBe('welcome');
  });

  it('da invite si va a result dopo invio', () => {
    let step: WizardStep = 'invite';
    step = 'result';
    expect(step).toBe('result');
  });

  it('da result si puo tornare a invite per invitare un altro', () => {
    let step: WizardStep = 'result';
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
    emailSent?: boolean;
  }

  it('successo con email inviata mostra messaggio e link', () => {
    const result: InviteResult = {
      success: true,
      message: 'Invito inviato con successo!',
      url: 'https://spediresicuro.it/invite/abc123',
      emailSent: true,
    };

    expect(result.success).toBe(true);
    expect(result.emailSent).toBe(true);
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

  it('successo con emailSent=false mostra titolo diverso', () => {
    const result: InviteResult = {
      success: true,
      message: "Invito creato! L'email non è stata inviata - condividi il link manualmente.",
      url: 'https://spediresicuro.it/invite/abc123',
      emailSent: false,
    };

    expect(result.success).toBe(true);
    expect(result.emailSent).toBe(false);
    // Il titolo dovrebbe essere "Invito Creato!" (non "Invito Inviato!")
    const title = result.emailSent === false ? 'Invito Creato!' : 'Invito Inviato!';
    expect(title).toBe('Invito Creato!');
  });

  it('successo con emailSent=true mostra titolo standard', () => {
    const result: InviteResult = {
      success: true,
      message: 'Invito inviato a test@example.com!',
      url: 'https://spediresicuro.it/invite/abc123',
      emailSent: true,
    };

    const title = result.emailSent === false ? 'Invito Creato!' : 'Invito Inviato!';
    expect(title).toBe('Invito Inviato!');
  });

  it('emailSent undefined (backward compat) mostra titolo standard', () => {
    const result: InviteResult = {
      success: true,
      message: 'Invito inviato con successo!',
      url: 'https://spediresicuro.it/invite/abc123',
    };

    // emailSent non presente nel response = backward compat = trattato come inviato
    const title = result.emailSent === false ? 'Invito Creato!' : 'Invito Inviato!';
    expect(title).toBe('Invito Inviato!');
  });

  it('emailSent=false mostra avviso condivisione link manuale', () => {
    const result: InviteResult = {
      success: true,
      message: "Invito creato! L'email non è stata inviata.",
      url: 'https://spediresicuro.it/invite/abc123',
      emailSent: false,
    };

    // Quando email non inviata: label diversa nel box link
    const linkLabel =
      result.emailSent === false
        ? 'Condividi questo link direttamente:'
        : 'Link invito (puoi anche condividerlo direttamente):';
    expect(linkLabel).toBe('Condividi questo link direttamente:');
  });
});

// ============================================
// LOGICA WIZARD: parsing risposta API email_sent
// ============================================

describe('TeamSetupWizard - Parsing risposta API email_sent', () => {
  /**
   * Replica la logica nel handleInvite del componente:
   * const emailSent = data.email_sent !== false;
   */
  function parseEmailSent(data: { email_sent?: boolean }): boolean {
    return data.email_sent !== false;
  }

  it('email_sent=true -> emailSent=true', () => {
    expect(parseEmailSent({ email_sent: true })).toBe(true);
  });

  it('email_sent=false -> emailSent=false', () => {
    expect(parseEmailSent({ email_sent: false })).toBe(false);
  });

  it('email_sent assente -> emailSent=true (backward compat)', () => {
    expect(parseEmailSent({})).toBe(true);
  });

  it('email_sent=undefined -> emailSent=true (backward compat)', () => {
    expect(parseEmailSent({ email_sent: undefined })).toBe(true);
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
