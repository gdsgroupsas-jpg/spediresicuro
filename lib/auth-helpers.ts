/**
 * Auth Helpers — Funzioni pure per check ruolo/tipo account
 *
 * Funzionano con qualsiasi oggetto che abbia account_type e/o is_reseller.
 * Usare in server actions, API routes, e componenti (sia server che client).
 *
 * SOURCE OF TRUTH: campo account_type nella tabella users.
 * Il campo role e' deprecated e viene IGNORATO da questi helper.
 *
 * Per check con ActingContext (impersonation-aware), usare
 * isSuperAdmin/isAdminOrAbove/isReseller da @/lib/safe-auth.
 */

/**
 * Interfaccia minima per check ruolo — accetta qualsiasi oggetto
 * con account_type e/o is_reseller
 */
export interface AuthCheckable {
  account_type?: string | null;
  is_reseller?: boolean;
}

/**
 * Superadmin: accesso totale alla piattaforma (impersonation, admin panel, billing)
 *
 * REGOLA: solo account_type === 'superadmin' conta.
 * Il campo role e' deprecated e non viene controllato.
 */
export function isSuperAdminCheck(u: AuthCheckable): boolean {
  return u.account_type?.toLowerCase() === 'superadmin';
}

/**
 * Admin o Superadmin: accesso admin panel, gestione utenti, listini master
 *
 * Usare per gate che richiedono almeno livello admin.
 * Per gate superadmin-only, usare isSuperAdminCheck().
 */
export function isAdminOrAbove(u: AuthCheckable): boolean {
  const at = u.account_type?.toLowerCase();
  return at === 'admin' || at === 'superadmin';
}

/**
 * Reseller: gestisce sub-utenti, listini propri, wallet sub-client
 */
export function isResellerCheck(u: AuthCheckable): boolean {
  return u.is_reseller === true;
}

/**
 * BYOC (Bring Your Own Courier): utente con corriere proprio
 */
export function isBYOC(u: AuthCheckable): boolean {
  return u.account_type?.toLowerCase() === 'byoc';
}
