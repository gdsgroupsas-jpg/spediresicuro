/**
 * Invite Flow Helpers
 *
 * Funzioni condivise per il flow di onboarding via invito workspace.
 * Usate sia dai componenti React che dai test.
 *
 * @module lib/invite-flow-helpers
 */

/**
 * Rileva se il callbackUrl indica un flow di accettazione invito.
 * Usa startsWith per evitare falsi positivi su path nested.
 */
export function isInviteFlow(callbackUrl: string): boolean {
  return callbackUrl.startsWith('/invite/');
}

/**
 * Sanitizza callbackUrl per prevenire open redirect.
 * Accetta solo path relativi (no URL assoluti, no protocol-relative).
 */
export function sanitizeCallbackUrl(raw: string): string {
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : '';
}

/**
 * Determina se l'auto-accept deve partire.
 * Tutte le condizioni devono essere soddisfatte:
 * - Utente autenticato con sessione valida
 * - Invito caricato
 * - Nessun risultato precedente (successo o errore)
 * - Nessuna accettazione in corso
 * - Non già auto-accettato (previene doppio trigger)
 */
export function shouldAutoAccept(params: {
  sessionStatus: string;
  hasSession: boolean;
  hasInvitation: boolean;
  hasAcceptResult: boolean;
  isAccepting: boolean;
  autoAccepted: boolean;
}): boolean {
  return (
    params.sessionStatus === 'authenticated' &&
    params.hasSession &&
    params.hasInvitation &&
    !params.hasAcceptResult &&
    !params.isAccepting &&
    !params.autoAccepted
  );
}
