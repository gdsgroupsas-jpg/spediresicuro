/**
 * useDebounce Hook - Enterprise-Grade Debouncing
 * 
 * Previene chiamate multiple a funzioni costose (es. API calls)
 * Aspetta che l'utente finisca di interagire prima di eseguire
 */

import { useEffect, useState, useRef } from 'react';

/**
 * Debounce un valore
 * 
 * @param value - Valore da debounce
 * @param delay - Delay in millisecondi (default: 500ms)
 * @returns Valore debounced
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Debounce una funzione callback
 * 
 * @param callback - Funzione da debounce
 * @param delay - Delay in millisecondi (default: 500ms)
 * @returns Funzione debounced
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 500
): T {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const debouncedCallback = ((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }) as T;

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback;
}
