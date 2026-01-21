/**
 * Hook React per verificare platform features lato client
 */

import { useEffect, useState } from 'react';

interface PlatformFeatureStatus {
  feature_code: string;
  is_enabled: boolean;
  is_visible: boolean;
  is_active: boolean;
}

/**
 * Hook per verificare se una platform feature è attiva
 */
export function usePlatformFeature(featureCode: string) {
  const [status, setStatus] = useState<PlatformFeatureStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkFeature() {
      try {
        setIsLoading(true);
        const response = await fetch(`/api/platform-features/check?feature=${featureCode}`);

        if (!response.ok) {
          throw new Error('Errore durante la verifica della feature');
        }

        const data = await response.json();
        setStatus(data);
      } catch (err: any) {
        console.error('Errore verifica platform feature:', err);
        setError(err.message);
        // In caso di errore, assumiamo che la feature sia attiva (compatibilità)
        setStatus({
          feature_code: featureCode,
          is_enabled: true,
          is_visible: true,
          is_active: true,
        });
      } finally {
        setIsLoading(false);
      }
    }

    checkFeature();
  }, [featureCode]);

  return {
    isEnabled: status?.is_enabled ?? true,
    isVisible: status?.is_visible ?? true,
    isActive: status?.is_active ?? true,
    isLoading,
    error,
  };
}

/**
 * Hook per verificare più platform features contemporaneamente
 */
export function usePlatformFeatures(featureCodes: string[]) {
  const [features, setFeatures] = useState<Record<string, PlatformFeatureStatus>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkFeatures() {
      try {
        setIsLoading(true);
        const promises = featureCodes.map(async (code) => {
          const response = await fetch(`/api/platform-features/check?feature=${code}`);
          if (!response.ok) {
            throw new Error(`Errore verifica feature ${code}`);
          }
          const data = await response.json();
          return { code, status: data };
        });

        const results = await Promise.all(promises);
        const featuresMap: Record<string, PlatformFeatureStatus> = {};

        results.forEach(({ code, status }) => {
          featuresMap[code] = status;
        });

        setFeatures(featuresMap);
      } catch (err: any) {
        console.error('Errore verifica platform features:', err);
        setError(err.message);
        // In caso di errore, assumiamo che tutte le features siano attive
        const featuresMap: Record<string, PlatformFeatureStatus> = {};
        featureCodes.forEach((code) => {
          featuresMap[code] = {
            feature_code: code,
            is_enabled: true,
            is_visible: true,
            is_active: true,
          };
        });
        setFeatures(featuresMap);
      } finally {
        setIsLoading(false);
      }
    }

    if (featureCodes.length > 0) {
      checkFeatures();
    } else {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featureCodes.join(',')]);

  return {
    features,
    isLoading,
    error,
    isFeatureEnabled: (code: string) => features[code]?.is_enabled ?? true,
    isFeatureVisible: (code: string) => features[code]?.is_visible ?? true,
    isFeatureActive: (code: string) => features[code]?.is_active ?? true,
  };
}
