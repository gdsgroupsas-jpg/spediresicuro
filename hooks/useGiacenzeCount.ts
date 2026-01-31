/**
 * Hook: useGiacenzeCount
 *
 * Polling del conteggio giacenze aperte per badge navigazione.
 * Aggiorna ogni 60 secondi.
 */

import { useState, useEffect, useCallback } from 'react';

const POLL_INTERVAL = 60_000; // 60 secondi

export function useGiacenzeCount() {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    try {
      const response = await fetch('/api/giacenze/stats');
      if (!response.ok) return;
      const data = await response.json();
      setCount(data.open_count || 0);
    } catch {
      // Silently fail - badge is non-critical
    }
  }, []);

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchCount]);

  return count;
}
