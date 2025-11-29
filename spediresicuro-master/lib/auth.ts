/**
 * Utility per autenticazione
 * 
 * Helper functions per gestire sessioni e protezione route
 * NextAuth v5 API
 */

import { auth } from '@/lib/auth-config';

/**
 * Ottiene la sessione corrente (server-side)
 */
export async function getSession() {
  return await auth();
}

/**
 * Verifica se l'utente è autenticato
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await auth();
  return !!session;
}

/**
 * Reindirizza al login se non autenticato
 */
export async function requireAuth() {
  const session = await auth();
  if (!session) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }
  return { session };
}
