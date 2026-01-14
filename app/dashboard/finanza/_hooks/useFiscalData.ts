import useSWR from 'swr';
import { getMyFiscalData } from '@/app/actions/fiscal';
import type { FiscalContext } from '@/lib/agent/fiscal-data.types';

interface UseFiscalDataOptions {
  refreshInterval?: number; // milliseconds
  revalidateOnFocus?: boolean;
  revalidateOnReconnect?: boolean;
}

const DEFAULT_OPTIONS: UseFiscalDataOptions = {
  refreshInterval: 30000, // 30 seconds
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
};

/**
 * SWR hook for fiscal data with automatic caching and revalidation
 *
 * @example
 * ```tsx
 * const { data, error, isLoading, mutate } = useFiscalData({
 *   refreshInterval: 60000 // 1 minute
 * });
 * ```
 */
export function useFiscalData(options: UseFiscalDataOptions = {}) {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };

  const { data, error, isLoading, isValidating, mutate } = useSWR<FiscalContext>(
    'fiscal-data',
    async () => {
      const result = await getMyFiscalData();
      return result;
    },
    {
      refreshInterval: mergedOptions.refreshInterval,
      revalidateOnFocus: mergedOptions.revalidateOnFocus,
      revalidateOnReconnect: mergedOptions.revalidateOnReconnect,
      dedupingInterval: 10000, // 10 seconds - prevent duplicate requests
      focusThrottleInterval: 5000, // 5 seconds - throttle revalidation on focus
      errorRetryCount: 3,
      errorRetryInterval: 5000,
      onError: (err) => {
        console.error('[useFiscalData] Error fetching data:', err);
      },
    }
  );

  return {
    data,
    error,
    isLoading,
    isValidating, // true when data is being revalidated in background
    mutate, // manual revalidation
    refresh: () => mutate(), // alias for convenience
  };
}

/**
 * Hook for fiscal data with live updates (polling every 10 seconds)
 */
export function useLiveFiscalData() {
  return useFiscalData({
    refreshInterval: 10000, // 10 seconds for "live" updates
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
  });
}

/**
 * Hook for fiscal data with manual refresh only (no auto-revalidation)
 */
export function useStaticFiscalData() {
  return useFiscalData({
    refreshInterval: 0, // disable auto-refresh
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });
}
