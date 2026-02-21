'use client';

import { useEffect, useCallback, useRef } from 'react';

/**
 * Hook per proteggere form con modifiche non salvate.
 * Mostra un warning del browser quando l'utente tenta di lasciare la pagina
 * con dati non salvati (refresh, chiusura tab, navigazione browser).
 *
 * @param isDirty - true se il form ha modifiche non salvate
 * @param message - messaggio di fallback (i browser moderni ignorano messaggi custom)
 */
export function useUnsavedChanges(isDirty: boolean, message?: string) {
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  const handleBeforeUnload = useCallback((e: BeforeUnloadEvent) => {
    if (!isDirtyRef.current) return;
    e.preventDefault();
    // I browser moderni mostrano un messaggio generico, non il custom
  }, []);

  useEffect(() => {
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [handleBeforeUnload]);
}
