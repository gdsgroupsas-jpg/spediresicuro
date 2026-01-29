'use client';

/**
 * Street Autocomplete Component
 *
 * Search-as-you-type per indirizzi italiani via Google Places.
 * Quando l'utente seleziona un indirizzo, auto-compila città/CAP/provincia.
 *
 * Usa session token per billing optimization Google Places:
 * autocomplete + details = 1 sessione fatturata.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Command } from 'cmdk';
import { MapPin, CheckCircle2, Navigation } from 'lucide-react';

interface PlacesAutocompleteResult {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

interface PlaceDetails {
  streetName: string;
  streetNumber: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  lat: number;
  lng: number;
  formattedAddress: string;
}

export interface StreetAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (details: PlaceDetails) => void;
  disabled?: boolean;
  required?: boolean;
  valid?: boolean;
  placeholder?: string;
}

/**
 * Genera UUID v4 per session token Google Places
 */
function generateSessionToken(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function StreetAutocomplete({
  value,
  onChange,
  onPlaceSelect,
  disabled = false,
  required = false,
  valid,
  placeholder = 'Cerca indirizzo (es. Via Roma 20, Milano)...',
}: StreetAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [results, setResults] = useState<PlacesAutocompleteResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isSelectionInProgress, setIsSelectionInProgress] = useState(false);
  const sessionTokenRef = useRef(generateSessionToken());

  // Sync external value changes
  useEffect(() => {
    if (value !== inputValue && !isSelectionInProgress) {
      setInputValue(value);
    }
  }, [value, inputValue, isSelectionInProgress]);

  // Debounced search
  const searchAddress = useCallback(async (query: string) => {
    if (query.length < 3) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        q: query,
        session: sessionTokenRef.current,
      });

      const response = await fetch(`/api/address/autocomplete?${params}`);
      if (!response.ok) throw new Error('Errore ricerca');

      const data = await response.json();
      setResults(data.results || []);
      setShowResults((data.results || []).length > 0);
    } catch (error) {
      console.error('[StreetAutocomplete] Errore ricerca:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Debounce input
  useEffect(() => {
    if (isSelectionInProgress || valid) {
      setShowResults(false);
      return;
    }

    const timer = setTimeout(() => {
      if (inputValue.length >= 3) {
        searchAddress(inputValue);
      } else {
        setResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, isSelectionInProgress, valid, searchAddress]);

  const handleSelect = async (result: PlacesAutocompleteResult) => {
    setIsSelectionInProgress(true);
    setShowResults(false);
    setResults([]);
    setInputValue(result.mainText);
    onChange(result.mainText);

    // Fetch place details
    try {
      const params = new URLSearchParams({
        placeId: result.placeId,
        session: sessionTokenRef.current,
      });

      const response = await fetch(`/api/address/details?${params}`);
      if (response.ok) {
        const data = await response.json();
        if (data.details) {
          const details = data.details as PlaceDetails;
          // Update input with full street + number
          const fullAddress = details.streetNumber
            ? `${details.streetName} ${details.streetNumber}`
            : details.streetName;
          setInputValue(fullAddress);
          onChange(fullAddress);
          onPlaceSelect(details);
        }
      }
    } catch (error) {
      console.error('[StreetAutocomplete] Errore dettagli:', error);
    }

    // Generate new session token for next search
    sessionTokenRef.current = generateSessionToken();

    setTimeout(() => {
      setIsSelectionInProgress(false);
    }, 100);
  };

  const handleInputChange = (newValue: string) => {
    setIsSelectionInProgress(false);
    setInputValue(newValue);
    onChange(newValue);
  };

  return (
    <div className="relative">
      <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1.5">
        Indirizzo {required && <span className="text-red-500">*</span>}
      </label>
      <Command shouldFilter={false} className="relative overflow-visible">
        <div className="relative">
          <Command.Input
            value={inputValue}
            onValueChange={handleInputChange}
            onFocus={() => {
              if (inputValue.length >= 3 && !valid && !isSelectionInProgress) {
                setShowResults(true);
              }
            }}
            placeholder={placeholder}
            disabled={disabled}
            className={`w-full px-4 py-3 pl-10 border-2 rounded-xl transition-all duration-200 bg-white text-gray-900 font-medium ${
              valid
                ? 'border-green-500 ring-2 ring-green-200 focus:ring-green-500 focus:border-green-600 bg-green-50'
                : 'border-gray-300 focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] focus:shadow-md hover:border-gray-400'
            } focus:outline-none placeholder:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed`}
          />

          <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />

          {valid && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 pointer-events-none">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          )}

          {isSearching && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#FFD700]"></div>
            </div>
          )}
        </div>

        {showResults && results.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
            <Command.List>
              {results.map((result, index) => (
                <Command.Item
                  key={`${result.placeId}-${index}`}
                  value={result.description}
                  onSelect={() => handleSelect(result)}
                  className="px-4 py-2.5 cursor-pointer hover:bg-gray-100 aria-selected:bg-gray-100 text-gray-900 font-medium flex items-start gap-2"
                >
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-semibold">{result.mainText}</div>
                    <div className="text-xs text-gray-500">{result.secondaryText}</div>
                  </div>
                </Command.Item>
              ))}
            </Command.List>
          </div>
        )}
      </Command>
    </div>
  );
}
