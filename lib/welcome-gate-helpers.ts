/**
 * WelcomeGate Helpers
 *
 * Logica pura testabile per il WelcomeGate:
 * - Traduzione ruoli in italiano
 * - Messaggi di benvenuto personalizzati
 * - Generazione particelle
 * - Timing animazioni
 *
 * @module lib/welcome-gate-helpers
 */

/**
 * Traduce ruolo workspace in italiano.
 * Condiviso tra WelcomeGate, invite page e team page.
 */
export function getRoleLabel(role: string): string {
  switch (role) {
    case 'owner':
      return 'Proprietario';
    case 'admin':
      return 'Amministratore';
    case 'operator':
      return 'Operatore';
    case 'viewer':
      return 'Visualizzatore';
    default:
      return role;
  }
}

/**
 * Genera messaggi di benvenuto personalizzati per Anne.
 * Ritorna array di righe da mostrare con typing effect.
 */
export function getWelcomeLines(
  userName: string,
  workspaceName?: string,
  orgName?: string
): string[] {
  const greeting = userName ? `Ciao ${userName}! 👋` : 'Ciao! 👋';

  const welcome = workspaceName
    ? `Benvenuto nel team di ${orgName || workspaceName}`
    : 'Benvenuto su SpedireSicuro';

  return [greeting, welcome];
}

/** Singola particella floating */
export interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  color: 'amber' | 'cyan';
}

/**
 * Genera particelle con posizioni random.
 * Ogni 3a particella è ambra, le altre cyan (palette del logo).
 */
export function generateParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 3 + 1,
    duration: Math.random() * 15 + 10,
    delay: Math.random() * 3,
    color: (i % 3 === 0 ? 'amber' : 'cyan') as 'amber' | 'cyan',
  }));
}

/**
 * Delay prima dell'auto-close in millisecondi.
 * Reduced motion: 2s (tutto visibile subito).
 * Standard: 5.3s (animazione completa + fade-out).
 */
export function getAutoCloseDelay(reducedMotion: boolean): number {
  return reducedMotion ? 2000 : 5300;
}

/** Key localStorage per "welcome già visto" */
export const WELCOME_SEEN_KEY = 'spediresicuro-welcome-seen';
