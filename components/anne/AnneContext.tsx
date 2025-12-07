/**
 * Anne Context Provider
 *
 * Context globale per gestire lo stato di Anne e i suggerimenti proattivi
 * attraverso tutta l'applicazione.
 */

'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

interface AnneSuggestion {
  id: string;
  type: 'tip' | 'warning' | 'feature' | 'help';
  message: string;
  page: string;
  priority: 'low' | 'medium' | 'high';
  dismissible: boolean;
}

interface AnneContextType {
  currentSuggestion: AnneSuggestion | null;
  addSuggestion: (suggestion: AnneSuggestion) => void;
  dismissSuggestion: (id: string) => void;
  isAnneVisible: boolean;
  setIsAnneVisible: (visible: boolean) => void;
  userInteractions: number;
  incrementInteractions: () => void;
}

const AnneContext = createContext<AnneContextType | undefined>(undefined);

export function AnneProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [currentSuggestion, setCurrentSuggestion] = useState<AnneSuggestion | null>(null);
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [isAnneVisible, setIsAnneVisible] = useState(false);
  const [userInteractions, setUserInteractions] = useState(0);

  // Carica suggerimenti dismissati da localStorage
  useEffect(() => {
    const saved = localStorage.getItem('anne-dismissed-suggestions');
    if (saved) {
      try {
        setDismissedSuggestions(new Set(JSON.parse(saved)));
      } catch (e) {
        console.error('Errore caricamento suggerimenti dismissati:', e);
      }
    }

    const interactions = localStorage.getItem('anne-interactions');
    if (interactions) {
      setUserInteractions(parseInt(interactions, 10));
    }
  }, []);

  // Salva suggerimenti dismissati
  useEffect(() => {
    localStorage.setItem(
      'anne-dismissed-suggestions',
      JSON.stringify(Array.from(dismissedSuggestions))
    );
  }, [dismissedSuggestions]);

  // Salva interazioni
  useEffect(() => {
    localStorage.setItem('anne-interactions', userInteractions.toString());
  }, [userInteractions]);

  // Analizza il contesto e suggerisci proattivamente
  useEffect(() => {
    if (!pathname) return;

    // Genera suggerimenti contestuali in base alla pagina
    const suggestion = generateContextualSuggestion(pathname, userInteractions);

    if (suggestion && !dismissedSuggestions.has(suggestion.id)) {
      // Ritarda il suggerimento per non essere invadente
      const delay = suggestion.priority === 'high' ? 2000 : 5000;
      const timer = setTimeout(() => {
        setCurrentSuggestion(suggestion);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [pathname, userInteractions, dismissedSuggestions]);

  const addSuggestion = (suggestion: AnneSuggestion) => {
    if (!dismissedSuggestions.has(suggestion.id)) {
      setCurrentSuggestion(suggestion);
    }
  };

  const dismissSuggestion = (id: string) => {
    setDismissedSuggestions((prev) => new Set([...prev, id]));
    setCurrentSuggestion(null);
  };

  const incrementInteractions = () => {
    setUserInteractions((prev) => prev + 1);
  };

  return (
    <AnneContext.Provider
      value={{
        currentSuggestion,
        addSuggestion,
        dismissSuggestion,
        isAnneVisible,
        setIsAnneVisible,
        userInteractions,
        incrementInteractions,
      }}
    >
      {children}
    </AnneContext.Provider>
  );
}

export function useAnneContext() {
  const context = useContext(AnneContext);
  if (context === undefined) {
    throw new Error('useAnneContext must be used within AnneProvider');
  }
  return context;
}

/**
 * Genera suggerimenti contestuali intelligenti
 */
function generateContextualSuggestion(
  pathname: string,
  interactions: number
): AnneSuggestion | null {
  // Suggerimenti per nuovi utenti (< 5 interazioni)
  if (interactions < 5) {
    if (pathname === '/dashboard' && interactions === 0) {
      return {
        id: 'welcome-first-time',
        type: 'tip',
        message:
          '👋 Benvenuto! Ti consiglio di iniziare creando la tua prima spedizione. Clicca su "Nuova Spedizione" per partire!',
        page: pathname,
        priority: 'high',
        dismissible: true,
      };
    }

    if (pathname === '/dashboard/spedizioni' && interactions < 3) {
      return {
        id: 'tip-filters',
        type: 'tip',
        message:
          '💡 Suggerimento: usa i filtri per trovare rapidamente le spedizioni. Puoi filtrare per stato, corriere o data.',
        page: pathname,
        priority: 'medium',
        dismissible: true,
      };
    }
  }

  // Suggerimenti contestuali per pagina
  const pageSuggestions: Record<string, AnneSuggestion> = {
    '/dashboard/spedizioni/nuova': {
      id: 'tip-new-shipment',
      type: 'feature',
      message:
        '🚀 Novità! Puoi usare il Voice Control per creare spedizioni a voce. Prova dicendo "Crea spedizione per Roma".',
      page: pathname,
      priority: 'low',
      dismissible: true,
    },
    '/dashboard/wallet': {
      id: 'tip-wallet-recharge',
      type: 'tip',
      message:
        '💰 Ricarica il wallet in anticipo per velocizzare le spedizioni. Le ricariche sono immediate!',
      page: pathname,
      priority: 'medium',
      dismissible: true,
    },
    '/dashboard/integrazioni': {
      id: 'tip-integrations',
      type: 'feature',
      message:
        '🔌 Connetti il tuo e-commerce per importare ordini automaticamente. Risparmia tempo!',
      page: pathname,
      priority: 'medium',
      dismissible: true,
    },
  };

  return pageSuggestions[pathname] || null;
}

/**
 * Hook per tracciare le azioni utente e apprendere
 */
export function useAnneTracking() {
  const { incrementInteractions } = useAnneContext();

  const trackAction = (action: string, metadata?: Record<string, any>) => {
    incrementInteractions();

    // Invia telemetria ad Anne per apprendimento
    // (opzionale - può essere usato per migliorare i suggerimenti nel tempo)
    if (typeof window !== 'undefined') {
      const trackingData = {
        action,
        metadata,
        timestamp: new Date().toISOString(),
      };

      // Salva in localStorage per analisi locale
      const existingTracking = localStorage.getItem('anne-tracking') || '[]';
      try {
        const tracking = JSON.parse(existingTracking);
        tracking.push(trackingData);

        // Mantieni solo gli ultimi 100 eventi
        const recentTracking = tracking.slice(-100);
        localStorage.setItem('anne-tracking', JSON.stringify(recentTracking));
      } catch (e) {
        console.error('Errore tracking Anne:', e);
      }
    }
  };

  return { trackAction };
}
