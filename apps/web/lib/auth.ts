/**
 * Utility per autenticazione
 *
 * Helper functions per gestire sessioni e protezione route
 * NextAuth v5 API
 *
 * ⚠️ MIGRATED: Ora usa getSafeAuth() per supportare impersonation
 */

import { getSafeAuth, ActingContext } from '@/lib/safe-auth';

/**
 * Ottiene la sessione corrente (server-side)
 * ⚠️ MIGRATED: Usa getSafeAuth per supportare impersonation
 */
export async function getSession(): Promise<ActingContext | null> {
  return await getSafeAuth();
}

/**
 * Verifica se l'utente è autenticato
 */
export async function isAuthenticated(): Promise<boolean> {
  const context = await getSafeAuth();
  return !!context;
}

/**
 * Reindirizza al login se non autenticato
 * ⚠️ MIGRATED: Ritorna context invece di session
 */
export async function requireAuth() {
  const context = await getSafeAuth();
  if (!context) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }
  return { context };
}
