'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

type ProfileCompletionState = {
  isComplete: boolean | null;
  isLoading: boolean;
};

export function useProfileCompletion(): ProfileCompletionState {
  const { data: session, status } = useSession();
  const [isComplete, setIsComplete] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadProfileCompletion() {
      if (status !== 'authenticated' || !session?.user?.email) {
        if (!cancelled) {
          setIsComplete(null);
          setIsLoading(false);
        }
        return;
      }

      const userEmail = session.user.email.toLowerCase();
      if (userEmail === 'test@spediresicuro.it') {
        if (!cancelled) {
          setIsComplete(true);
          setIsLoading(false);
        }
        return;
      }

      try {
        const response = await fetch('/api/user/dati-cliente', {
          cache: 'no-store',
        });
        if (!response.ok) {
          if (!cancelled) {
            setIsComplete(false);
            setIsLoading(false);
          }
          return;
        }
        const data = await response.json();
        const completed = !!data?.datiCliente?.datiCompletati;
        if (!cancelled) {
          setIsComplete(completed);
          setIsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setIsComplete(false);
          setIsLoading(false);
        }
      }
    }

    loadProfileCompletion();

    return () => {
      cancelled = true;
    };
  }, [status, session?.user?.email]);

  return { isComplete, isLoading };
}
