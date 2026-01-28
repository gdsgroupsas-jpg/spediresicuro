'use client';

/**
 * Hook per suggerimenti destinatari da spedizioni precedenti
 *
 * Caratteristiche:
 * - Ricerca debounced (300ms)
 * - Cache in memoria per la sessione
 * - Gestione stati loading/error
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDebounce } from '@/hooks/useDebounce';
import type { SavedRecipient } from '@/types/recipients';

interface UseRecipientSuggestionsOptions {
  /** Delay debounce in ms (default: 300) */
  debounceMs?: number;
  /** Limite risultati (default: 10) */
  limit?: number;
}

interface UseRecipientSuggestionsResult {
  /** Lista suggerimenti */
  suggestions: SavedRecipient[];
  /** Caricamento in corso */
  isLoading: boolean;
  /** Errore (se presente) */
  error: string | null;
  /** Funzione per aggiornare la query di ricerca */
  search: (query: string) => void;
  /** Pulisce i suggerimenti */
  clearSuggestions: () => void;
  /** Query corrente */
  query: string;
}

export function useRecipientSuggestions(
  options: UseRecipientSuggestionsOptions = {}
): UseRecipientSuggestionsResult {
  const { debounceMs = 300, limit = 10 } = options;

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SavedRecipient[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cache in memoria per la sessione
  const cacheRef = useRef<Map<string, SavedRecipient[]>>(new Map());

  const debouncedQuery = useDebounce(query, debounceMs);

  const fetchSuggestions = useCallback(
    async (searchQuery: string) => {
      // Check cache
      const cacheKey = searchQuery.toLowerCase();
      const cached = cacheRef.current.get(cacheKey);
      if (cached) {
        setSuggestions(cached);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const url = new URL('/api/recipients/search', window.location.origin);
        url.searchParams.set('q', searchQuery);
        url.searchParams.set('limit', limit.toString());

        const response = await fetch(url.toString());

        if (!response.ok) {
          throw new Error('Errore nella ricerca');
        }

        const data = await response.json();
        const results = data.results || [];

        // Cache risultati
        cacheRef.current.set(cacheKey, results);
        setSuggestions(results);
      } catch (err) {
        console.error('Error fetching recipient suggestions:', err);
        setError(err instanceof Error ? err.message : 'Errore sconosciuto');
        setSuggestions([]);
      } finally {
        setIsLoading(false);
      }
    },
    [limit]
  );

  // Fetch quando cambia la query debounced
  useEffect(() => {
    // Se query >= 2 caratteri o vuota (mostra recenti)
    if (debouncedQuery.length >= 2 || debouncedQuery === '') {
      fetchSuggestions(debouncedQuery);
    } else {
      setSuggestions([]);
    }
  }, [debouncedQuery, fetchSuggestions]);

  const search = useCallback((newQuery: string) => {
    setQuery(newQuery);
  }, []);

  const clearSuggestions = useCallback(() => {
    setSuggestions([]);
    setQuery('');
  }, []);

  return {
    suggestions,
    isLoading,
    error,
    search,
    clearSuggestions,
    query,
  };
}
