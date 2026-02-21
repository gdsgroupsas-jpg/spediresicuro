'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { isAdminOrAbove, isSuperAdminCheck, isResellerCheck } from '@/lib/auth-helpers';

// Dati utente condivisi — un singolo fetch sostituisce 19+ fetch ridondanti
export interface UserData {
  id: string;
  email: string;
  name: string;
  role: string;
  account_type: string;
  is_reseller: boolean;
  reseller_role: string | null;
  wallet_balance: number;
  company_name?: string;
  vat_number?: string;
  phone?: string;
  datiCliente?: Record<string, unknown> | null;
  defaultSender?: Record<string, unknown> | null;
  integrazioni?: Record<string, unknown> | null;
  provider?: string;
  image?: string;
}

interface UserContextValue {
  user: UserData | null;
  isLoading: boolean;
  error: string | null;
  // Helper derivati
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isReseller: boolean;
  hasCompletedOnboarding: boolean;
  // Refresh manuale dopo mutazioni (es. wallet topup, salvataggio dati cliente)
  refresh: () => Promise<void>;
}

const UserContext = createContext<UserContextValue>({
  user: null,
  isLoading: true,
  error: null,
  isAdmin: false,
  isSuperAdmin: false,
  isReseller: false,
  hasCompletedOnboarding: false,
  refresh: async () => {},
});

export function UserProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const [user, setUser] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserInfo = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/user/info');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      const u = data.user || data;
      setUser({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        account_type: u.account_type || u.role,
        is_reseller: u.is_reseller === true,
        reseller_role: u.reseller_role || null,
        wallet_balance: u.wallet_balance || 0,
        company_name: u.company_name,
        vat_number: u.vat_number,
        phone: u.phone,
        datiCliente: u.datiCliente,
        defaultSender: u.defaultSender,
        integrazioni: u.integrazioni,
        provider: u.provider,
        image: u.image,
      });
    } catch (err) {
      console.error('UserContext: errore fetch user info:', err);
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch una sola volta quando la sessione e' autenticata
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.email) {
      fetchUserInfo();
    } else if (status === 'unauthenticated') {
      setUser(null);
      setIsLoading(false);
    }
  }, [status, session?.user?.email, fetchUserInfo]);

  // Valori derivati — account_type e' la source of truth
  const isAdmin = user ? isAdminOrAbove(user) : false;
  const isSuperAdmin = user ? isSuperAdminCheck(user) : false;
  const isReseller = user ? isResellerCheck(user) : false;
  const hasCompletedOnboarding =
    (user?.datiCliente as Record<string, unknown>)?.datiCompletati === true;

  return (
    <UserContext.Provider
      value={{
        user,
        isLoading,
        error,
        isAdmin,
        isSuperAdmin,
        isReseller,
        hasCompletedOnboarding,
        refresh: fetchUserInfo,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
