'use client';

import { useEffect, useState } from 'react';

/**
 * Hook per debounce di un valore
 * Ritorna il valore solo dopo che è passato il delay senza cambiamenti
 *
 * @param value - Valore da debounceare
 * @param delay - Ritardo in millisecondi (default: 300ms)
 * @returns Valore debouncato
 *
 * @example
 * const [search, setSearch] = useState('')
 * const debouncedSearch = useDebounce(search, 300)
 *
 * // debouncedSearch si aggiorna solo 300ms dopo l'ultimo cambiamento
 */
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
