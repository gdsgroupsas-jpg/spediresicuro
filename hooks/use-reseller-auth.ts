'use client';

/**
 * Hook centralizzato per verifica autorizzazione reseller.
 *
 * Sostituisce le 5+ varianti duplicare nelle pagine dashboard/reseller.
 * Verifica: autenticato + (is_reseller || superadmin || admin).
 */

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export type ResellerAuthState = {
  /** null = loading, true = autorizzato, false = non autorizzato */
  isAuthorized: boolean | null;
  /** true durante il check iniziale */
  isLoading: boolean;
  /** account_type dell'utente (superadmin, admin, reseller, user, byoc) */
  accountType: string;
  /** ID utente */
  userId: string;
  /** session status */
  status: 'loading' | 'authenticated' | 'unauthenticated';
};

/**
 * Verifica che l'utente corrente sia un reseller (o superadmin/admin).
 * Redirige a /login se non autenticato.
 */
export function useResellerAuth(): ResellerAuthState {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accountType, setAccountType] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    async function checkAccess() {
      if (status === 'loading') return;

      if (status === 'unauthenticated' || !session?.user?.email) {
        router.push('/login');
        setIsAuthorized(false);
        setIsLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/user/info');
        if (res.ok) {
          const data = await res.json();
          const u = data.user || data;
          const at = u.account_type || u.accountType || '';

          setAccountType(at);
          setUserId(u.id || '');
          setIsAuthorized(at === 'superadmin' || at === 'admin' || u.is_reseller === true);
        } else {
          setIsAuthorized(false);
        }
      } catch {
        setIsAuthorized(false);
      } finally {
        setIsLoading(false);
      }
    }

    checkAccess();
  }, [session, status, router]);

  return { isAuthorized, isLoading, accountType, userId, status };
}
