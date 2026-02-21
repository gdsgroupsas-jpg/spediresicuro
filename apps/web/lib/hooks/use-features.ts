/**
 * Hook per verificare e gestire le killer features dell'utente
 */

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

interface Feature {
  feature_code: string;
  feature_name: string;
  category: string;
  is_free: boolean;
  activation_type: string;
  expires_at: string | null;
}

export function useFeatures() {
  const { data: session } = useSession();
  const [features, setFeatures] = useState<Feature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadFeatures() {
      if (!session?.user?.email) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch('/api/features/list');

        if (!response.ok) {
          throw new Error('Errore nel caricamento delle features');
        }

        const data = await response.json();
        setFeatures(data.features || []);
      } catch (err: any) {
        console.error('Errore caricamento features:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadFeatures();
  }, [session]);

  /**
   * Verifica se l'utente ha accesso a una specifica feature
   */
  async function hasFeature(featureCode: string): Promise<boolean> {
    if (!session?.user?.email) {
      return false;
    }

    try {
      const response = await fetch(`/api/features/check?feature=${featureCode}`);

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      return data.hasAccess === true;
    } catch (err) {
      console.error('Errore verifica feature:', err);
      return false;
    }
  }

  return {
    features,
    isLoading,
    error,
    hasFeature,
    featuresCount: features.length,
  };
}
