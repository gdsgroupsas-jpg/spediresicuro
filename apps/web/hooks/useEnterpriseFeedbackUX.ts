'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

/**
 * Feature flag per Enterprise Feedback UX
 *
 * Design specs (ANALISI_REFACTOR_UI_ENTERPRISE_GRADE.md):
 * - Feature flag: ENABLE_ENTERPRISE_FEEDBACK_UX
 * - false: Legacy flow, toast feedback only
 * - true: State machine flow, modal/dialog feedback
 *
 * Strategie di attivazione:
 * 1. LocalStorage override (per testing)
 * 2. User feature flag (da API/DB)
 * 3. Default fallback
 */

const FEATURE_FLAG_KEY = 'enterprise_feedback_ux_enabled';
const LOCAL_STORAGE_KEY = 'spediresicuro_enterprise_feedback_ux';

interface UseEnterpriseFeedbackUXReturn {
  /** Se la feature è abilitata */
  isEnabled: boolean;
  /** Se stiamo caricando lo stato */
  isLoading: boolean;
  /** Override manuale (per testing/debug) */
  setOverride: (enabled: boolean | null) => void;
  /** Rimuovi override */
  clearOverride: () => void;
  /** Verifica se c'è un override attivo */
  hasOverride: boolean;
}

/**
 * Hook per controllare se il feedback UX enterprise è abilitato
 *
 * Priorità:
 * 1. localStorage override (per testing locale)
 * 2. User settings/feature flag (da API)
 * 3. Default: true (nuova implementazione attiva per default)
 *
 * @example
 * ```tsx
 * const { isEnabled, isLoading } = useEnterpriseFeedbackUX()
 *
 * if (isEnabled) {
 *   // Mostra SuccessModal / ErrorDialog
 * } else {
 *   // Legacy: toast/inline feedback
 * }
 * ```
 */
export function useEnterpriseFeedbackUX(): UseEnterpriseFeedbackUXReturn {
  const { data: session } = useSession();
  const [isEnabled, setIsEnabled] = useState(true); // Default: enabled
  const [isLoading, setIsLoading] = useState(true);
  const [hasOverride, setHasOverride] = useState(false);

  useEffect(() => {
    async function checkFeatureFlag() {
      try {
        // 1. Check localStorage override first (for testing)
        if (typeof window !== 'undefined') {
          const localOverride = localStorage.getItem(LOCAL_STORAGE_KEY);
          if (localOverride !== null) {
            setIsEnabled(localOverride === 'true');
            setHasOverride(true);
            setIsLoading(false);
            return;
          }
        }

        // 2. Check user feature flag via API (if logged in)
        if (session?.user?.email) {
          try {
            const response = await fetch(`/api/features/check?feature=${FEATURE_FLAG_KEY}`);
            if (response.ok) {
              const data = await response.json();
              // Se l'API restituisce un valore esplicito, usalo
              if (typeof data.hasAccess === 'boolean') {
                setIsEnabled(data.hasAccess);
                setIsLoading(false);
                return;
              }
            }
          } catch (err) {
            // Se l'API fallisce, usa il default
            console.warn('Feature flag API check failed, using default', err);
          }
        }

        // 3. Default: enabled (nuova implementazione attiva)
        // NOTA: Cambia a `false` per rollout graduale
        setIsEnabled(true);
        setIsLoading(false);
      } catch (error) {
        console.error('Error checking enterprise feedback UX feature flag:', error);
        setIsEnabled(true); // Default on error
        setIsLoading(false);
      }
    }

    checkFeatureFlag();
  }, [session]);

  // Override manuale (per testing)
  const setOverride = (enabled: boolean | null) => {
    if (typeof window === 'undefined') return;

    if (enabled === null) {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      setHasOverride(false);
      // Ri-triggera il check
      setIsLoading(true);
    } else {
      localStorage.setItem(LOCAL_STORAGE_KEY, String(enabled));
      setIsEnabled(enabled);
      setHasOverride(true);
    }
  };

  const clearOverride = () => {
    setOverride(null);
  };

  return {
    isEnabled,
    isLoading,
    setOverride,
    clearOverride,
    hasOverride,
  };
}

export default useEnterpriseFeedbackUX;
