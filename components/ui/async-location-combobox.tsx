/**
 * Componente: Async Location Combobox
 * 
 * Combobox intelligente per ricerca e selezione comuni italiani.
 * 
 * Features:
 * - Ricerca in tempo reale con debounce (300ms)
 * - Supporto multi-CAP (se comune ha più CAP, mostra dropdown secondario)
 * - Skeleton loader durante ricerca
 * - Gestione errori network
 * - Accessibile (keyboard navigation, ARIA labels)
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Command } from 'cmdk';
import type { GeoLocationOption, OnLocationSelect } from '@/types/geo';

interface AsyncLocationComboboxProps {
  onSelect: OnLocationSelect;
  placeholder?: string;
  className?: string;
  defaultValue?: {
    city: string;
    province: string;
    cap: string | null;
  };
}

/**
 * Hook per debounce
 */
function useDebounce<T>(value: T, delay: number): T {
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

export default function AsyncLocationCombobox({
  onSelect,
  placeholder = 'Cerca città, provincia o CAP...',
  className = '',
  defaultValue,
}: AsyncLocationComboboxProps) {
  // Formato semplificato: solo "Città (Provincia)" o "Città (Provincia) - CAP"
  const formatLocationText = (city: string, province: string, cap?: string | null) => {
    if (cap) {
      return `${city} (${province}) - ${cap}`;
    }
    return `${city} (${province})`;
  };

  const [inputValue, setInputValue] = useState(
    defaultValue ? formatLocationText(defaultValue.city, defaultValue.province, defaultValue.cap) : ''
  );
  const [results, setResults] = useState<GeoLocationOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<GeoLocationOption | null>(null);
  const [showCapSelector, setShowCapSelector] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Aggiorna inputValue quando defaultValue cambia (es. quando AI popola i campi)
  useEffect(() => {
    if (defaultValue) {
      const newValue = formatLocationText(defaultValue.city, defaultValue.province, defaultValue.cap);
      // Aggiorna solo se il valore è diverso per evitare loop infiniti
      if (inputValue !== newValue) {
        setInputValue(newValue);
      }
    }
  }, [defaultValue, inputValue]);

  // Debounce input (300ms)
  const debouncedQuery = useDebounce(inputValue, 300);

  /**
   * Cerca comuni via API
   */
  const searchLocations = useCallback(async (query: string) => {
    if (query.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/geo/search?q=${encodeURIComponent(query)}`);

      if (!response.ok) {
        throw new Error(`Errore ricerca: ${response.status}`);
      }

      const data = await response.json();
      
      // Se c'è un errore nella risposta, mostralo
      if (data.error) {
        setError(data.error);
        setResults([]);
      } else {
        setResults(data.results || []);
      }
    } catch (err) {
      console.error('Errore ricerca location:', err);
      setError('Errore di connessione. Riprova.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Esegui ricerca quando debouncedQuery cambia
  useEffect(() => {
    if (debouncedQuery && debouncedQuery.length >= 2) {
      searchLocations(debouncedQuery);
      setIsOpen(true);
    } else {
      setResults([]);
      setIsOpen(false);
    }
  }, [debouncedQuery, searchLocations]);

  /**
   * Gestisce selezione location
   */
  const handleSelectLocation = (location: GeoLocationOption) => {
    setSelectedLocation(location);
    // Mostra solo città e provincia, senza regione o altre info
    setInputValue(`${location.city} (${location.province})`);

    // Se ha un solo CAP, seleziona direttamente
    if (location.caps.length === 1) {
      onSelect({
        city: location.city,
        province: location.province,
        cap: location.caps[0],
        caps: location.caps,
      });
      // Aggiorna input con CAP
      setInputValue(formatLocationText(location.city, location.province, location.caps[0]));
      setIsOpen(false);
      setShowCapSelector(false);
    } else if (location.caps.length > 1) {
      // Se ha più CAP, mostra selector secondario
      setShowCapSelector(true);
      setIsOpen(false);
    } else {
      // Nessun CAP disponibile
      onSelect({
        city: location.city,
        province: location.province,
        cap: null,
        caps: [],
      });
      setIsOpen(false);
    }
  };

  /**
   * Gestisce selezione CAP
   */
  const handleSelectCap = (cap: string) => {
    if (!selectedLocation) return;

    onSelect({
      city: selectedLocation.city,
      province: selectedLocation.province,
      cap,
      caps: selectedLocation.caps,
    });

    setInputValue(formatLocationText(selectedLocation.city, selectedLocation.province, cap));
    setShowCapSelector(false);
    setSelectedLocation(null);
  };

  /**
   * Reset selezione
   */
  const handleReset = () => {
    setInputValue('');
    setSelectedLocation(null);
    setShowCapSelector(false);
    setResults([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  // Click outside per chiudere
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input principale */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setSelectedLocation(null);
            setShowCapSelector(false);
          }}
          onFocus={() => {
            if (inputValue.length >= 2 && results.length > 0) {
              setIsOpen(true);
            }
          }}
          placeholder={placeholder}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-cyan focus:border-transparent"
          aria-label="Cerca città, provincia o CAP"
          aria-haspopup="listbox"
          aria-controls={isOpen ? 'location-results' : undefined}
        />

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-cyan"></div>
          </div>
        )}

        {/* Reset button */}
        {inputValue && !isLoading && (
          <button
            type="button"
            onClick={handleReset}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Cancella"
          >
            ✕
          </button>
        )}
      </div>

      {/* Dropdown risultati */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
          {error ? (
            <div className="p-4 text-red-600 text-sm">{error}</div>
          ) : results.length === 0 && !isLoading ? (
            <div className="p-4 text-gray-500 text-sm text-center">
              Nessun risultato trovato
            </div>
          ) : (
            <Command>
              <Command.List>
                {results.map((location, index) => (
                  <Command.Item
                    key={`${location.city}-${location.province}-${index}`}
                    onSelect={() => handleSelectLocation(location)}
                    className="px-4 py-2 cursor-pointer hover:bg-gray-100 focus:bg-gray-100 focus:outline-none"
                  >
                    <span className="font-medium">{location.displayText}</span>
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          )}
        </div>
      )}

      {/* Selector CAP secondario */}
      {showCapSelector && selectedLocation && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4">
          <div className="mb-2 text-sm font-medium text-gray-700">
            Seleziona CAP per {selectedLocation.city} ({selectedLocation.province})
          </div>
          <div className="max-h-40 overflow-auto">
            {selectedLocation.caps.map((cap) => (
              <button
                key={cap}
                type="button"
                onClick={() => handleSelectCap(cap)}
                className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded focus:outline-none focus:bg-gray-100"
              >
                {cap}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              setShowCapSelector(false);
              setSelectedLocation(null);
              inputRef.current?.focus();
            }}
            className="mt-2 text-sm text-gray-500 hover:text-gray-700"
          >
            Annulla
          </button>
        </div>
      )}
    </div>
  );
}

