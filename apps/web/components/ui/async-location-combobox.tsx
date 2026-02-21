'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Command } from 'cmdk';
import { CheckCircle2, AlertCircle } from 'lucide-react';
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
  isValid?: boolean;
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
  isValid,
}: AsyncLocationComboboxProps) {
  // Formato semplificato: solo "Città (Provincia)" o "Città (Provincia) - CAP"
  const formatLocationText = (city: string, province: string, cap?: string | null) => {
    if (cap) {
      return `${city} (${province}) - ${cap}`;
    }
    return `${city} (${province})`;
  };

  const [inputValue, setInputValue] = useState(
    defaultValue
      ? formatLocationText(defaultValue.city, defaultValue.province, defaultValue.cap)
      : ''
  );
  const [results, setResults] = useState<GeoLocationOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<GeoLocationOption | null>(null);
  const [showCapSelector, setShowCapSelector] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Aggiorna inputValue quando defaultValue cambia (es. quando AI popola i campi)
  useEffect(() => {
    if (defaultValue) {
      const newValue = formatLocationText(
        defaultValue.city,
        defaultValue.province,
        defaultValue.cap
      );
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

      if (data.error) {
        setError(data.error);
        setResults([]);
      } else {
        // Deduplicate results based on city and province
        const uniqueResults = (data.results || []).filter(
          (v: GeoLocationOption, i: number, a: GeoLocationOption[]) =>
            a.findIndex((t) => t.city === v.city && t.province === v.province) === i
        );
        setResults(uniqueResults);
      }
    } catch (err) {
      console.error('Errore ricerca location:', err);
      setError('Errore di connessione. Riprova.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Esegui ricerca
  useEffect(() => {
    // Prevent search if we have a selected location (avoids re-opening menu on selection)
    if (debouncedQuery && debouncedQuery.length >= 2 && !selectedLocation) {
      searchLocations(debouncedQuery);
      setIsOpen(true);
    } else if (!debouncedQuery) {
      setResults([]);
      setIsOpen(false);
    }
  }, [debouncedQuery, searchLocations, selectedLocation]);

  /**
   * Gestisce selezione location
   */
  const handleSelectLocation = (location: GeoLocationOption) => {
    setSelectedLocation(location);
    setInputValue(`${location.city} (${location.province})`);

    // Se ha un solo CAP, seleziona direttamente
    if (location.caps.length === 1) {
      onSelect({
        city: location.city,
        province: location.province,
        cap: location.caps[0],
        caps: location.caps,
      });
      setInputValue(formatLocationText(location.city, location.province, location.caps[0]));
      setIsOpen(false);
      setShowCapSelector(false);
    } else if (location.caps.length > 1) {
      setShowCapSelector(true);
      setIsOpen(false);
    } else {
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

  const hasValue = inputValue.length > 0;
  const showValid = hasValue && isValid === true;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <Command shouldFilter={false} className="relative overflow-visible">
        {/* Input Wrapper per Icone */}
        <div className="relative">
          <Command.Input
            value={inputValue}
            onValueChange={(val) => {
              setInputValue(val);
              setSelectedLocation(null);
              setShowCapSelector(false);
              // Open menu on typing, wait for debounce for search
              if (val.length >= 2) setIsOpen(true);
            }}
            placeholder={placeholder}
            className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 bg-white text-gray-900 font-medium ${
              showValid
                ? 'border-green-500 ring-2 ring-green-200 focus:ring-green-500 focus:border-green-600 bg-green-50'
                : 'border-gray-300 focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] focus:shadow-md hover:border-gray-400'
            } focus:outline-none placeholder:text-gray-500`}
          />

          {/* Valid Icon */}
          {showValid && (
            <div className="absolute right-10 top-1/2 -translate-y-1/2 text-green-500 pointer-events-none">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-cyan"></div>
            </div>
          )}

          {/* Reset button (solo se non loading e non valido o valido ma modificabile) */}
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
              <div className="p-4 text-gray-500 text-sm text-center">Nessun risultato trovato</div>
            ) : (
              <Command.List>
                {results.map((location, index) => (
                  <Command.Item
                    key={`${location.city}-${location.province}-${index}`}
                    value={`${location.city} ${location.province}`} // Value required for keyboard nav
                    onSelect={() => handleSelectLocation(location)}
                    className="px-4 py-2 cursor-pointer hover:bg-gray-100 aria-selected:bg-gray-100 text-gray-900 font-medium"
                  >
                    {location.displayText}
                  </Command.Item>
                ))}
              </Command.List>
            )}
          </div>
        )}
      </Command>

      {/* Selector CAP secondario (fuori dal Command, gestito custom) */}
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
                className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded focus:outline-none focus:bg-gray-100 text-gray-900"
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
