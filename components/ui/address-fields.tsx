'use client';

import { useState, useEffect, useCallback } from 'react';
import { Command } from 'cmdk';
import { MapPin, CheckCircle2 } from 'lucide-react';
import StreetAutocomplete from './street-autocomplete';
import type { PlaceDetails } from '@/lib/adapters/google-places/base';

interface AddressFieldsProps {
  label?: string;
  cityValue: string;
  provinceValue: string;
  postalCodeValue: string;
  onCityChange: (city: string) => void;
  onProvinceChange: (province: string) => void;
  onPostalCodeChange: (postalCode: string) => void;
  required?: boolean;
  cityValid?: boolean;
  provinceValid?: boolean;
  postalCodeValid?: boolean;
  /** Abilita autocomplete indirizzo via Google Places */
  enableStreetAutocomplete?: boolean;
  /** Valore campo indirizzo (via + civico) */
  streetValue?: string;
  /** Callback cambio indirizzo */
  onStreetChange?: (street: string) => void;
  /** Indirizzo validato (selezionato da autocomplete) */
  streetValid?: boolean;
}

interface LocationResult {
  city: string;
  province: string;
  postal_code: string;
}

// Lista province italiane (sigle)
const PROVINCE_ITALIANE = [
  'AG',
  'AL',
  'AN',
  'AO',
  'AR',
  'AP',
  'AT',
  'AV',
  'BA',
  'BT',
  'BL',
  'BN',
  'BG',
  'BI',
  'BO',
  'BZ',
  'BS',
  'BR',
  'CA',
  'CL',
  'CB',
  'CI',
  'CE',
  'CT',
  'CZ',
  'CH',
  'CO',
  'CS',
  'CR',
  'KR',
  'CN',
  'EN',
  'FM',
  'FE',
  'FI',
  'FG',
  'FC',
  'FR',
  'GE',
  'GO',
  'GR',
  'IM',
  'IS',
  'SP',
  'AQ',
  'LT',
  'LE',
  'LC',
  'LI',
  'LO',
  'LU',
  'MC',
  'MN',
  'MS',
  'MT',
  'ME',
  'MI',
  'MO',
  'MB',
  'NA',
  'NO',
  'NU',
  'OT',
  'OR',
  'PD',
  'PA',
  'PR',
  'PV',
  'PG',
  'PU',
  'PE',
  'PC',
  'PI',
  'PT',
  'PN',
  'PZ',
  'PO',
  'RG',
  'RA',
  'RC',
  'RE',
  'RI',
  'RN',
  'RM',
  'RO',
  'SA',
  'VS',
  'SS',
  'SV',
  'SI',
  'SR',
  'SO',
  'TA',
  'TE',
  'TR',
  'TO',
  'OG',
  'TP',
  'TN',
  'TV',
  'TS',
  'UD',
  'VA',
  'VE',
  'VB',
  'VC',
  'VR',
  'VV',
  'VI',
  'VT',
];

/**
 * Componente per gestire Città, Provincia e CAP separati
 * Stile Spedisci.online con autocomplete città e autofill
 */
export default function AddressFields({
  label = 'Indirizzo',
  cityValue,
  provinceValue,
  postalCodeValue,
  onCityChange,
  onProvinceChange,
  onPostalCodeChange,
  required = true,
  cityValid,
  provinceValid,
  postalCodeValid,
  enableStreetAutocomplete = false,
  streetValue = '',
  onStreetChange,
  streetValid,
}: AddressFieldsProps) {
  const [cityInput, setCityInput] = useState(cityValue);
  const [searchResults, setSearchResults] = useState<LocationResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isSelectionInProgress, setIsSelectionInProgress] = useState(false);

  // Funzione di ricerca città (dichiarata prima per essere usata in useEffect)
  const searchCity = useCallback(async (query: string) => {
    if (query.length < 2) return;

    setIsSearching(true);
    try {
      const response = await fetch(`/api/geo/search?q=${encodeURIComponent(query)}`);
      if (!response.ok) throw new Error('Errore ricerca');

      const data = await response.json();

      // Deduplica e trasforma risultati
      const results: LocationResult[] = [];
      const seen = new Set<string>();

      for (const item of data.results || []) {
        // Per ogni città, crea un risultato per ogni CAP
        for (const cap of item.caps || []) {
          const key = `${item.city}-${item.province}-${cap}`;
          if (!seen.has(key)) {
            seen.add(key);
            results.push({
              city: item.city,
              province: item.province,
              postal_code: cap,
            });
          }
        }
      }

      setSearchResults(results);
      setShowResults(true);
    } catch (error) {
      console.error('Errore ricerca città:', error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // Aggiorna cityInput quando cityValue cambia (es. da OCR)
  // ⚠️ NON aggiornare se è in corso una selezione (evita loop)
  useEffect(() => {
    if (cityValue && cityValue !== cityInput && !isSelectionInProgress) {
      setCityInput(cityValue);
    }
  }, [cityValue, cityInput, isSelectionInProgress]);

  // Debounce search
  // ⚠️ NON fare ricerca se:
  // - È in corso una selezione
  // - La città è già validata (selezionata dall'autocomplete)
  useEffect(() => {
    // Se è in corso una selezione o la città è già validata, non fare ricerca
    if (isSelectionInProgress || cityValid) {
      setShowResults(false);
      return;
    }

    const timer = setTimeout(() => {
      if (cityInput.length >= 2) {
        searchCity(cityInput);
      } else {
        setSearchResults([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [cityInput, isSelectionInProgress, cityValid, searchCity]);

  const handleSelectResult = (result: LocationResult) => {
    console.log('🔍 [AddressFields] handleSelectResult chiamato:', result);

    // ⚠️ Flag per prevenire ricerca automatica dopo selezione
    setIsSelectionInProgress(true);

    // Chiudi dropdown immediatamente
    setShowResults(false);
    setSearchResults([]);

    // Aggiorna input
    setCityInput(result.city);

    // ⚠️ Chiama i callback nell'ordine corretto
    console.log('🔍 [AddressFields] Chiamando onCityChange:', result.city);
    onCityChange(result.city);

    console.log('🔍 [AddressFields] Chiamando onProvinceChange:', result.province);
    onProvinceChange(result.province);

    console.log('🔍 [AddressFields] Chiamando onPostalCodeChange:', result.postal_code);
    onPostalCodeChange(result.postal_code);

    // Reset flag dopo un breve delay per permettere ai callback di completare
    setTimeout(() => {
      setIsSelectionInProgress(false);
    }, 100);
  };

  const handleCityInputChange = (value: string) => {
    // Se l'utente sta modificando manualmente, reset flag selezione
    setIsSelectionInProgress(false);

    setCityInput(value);
    onCityChange(value);

    // Mostra risultati solo se non è validata (non selezionata)
    if (value.length >= 2 && !cityValid) {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  };

  const handlePlaceSelect = useCallback(
    (details: PlaceDetails) => {
      // Auto-fill city/province/CAP from selected place
      setIsSelectionInProgress(true);

      if (details.city) {
        setCityInput(details.city);
        onCityChange(details.city);
      }
      if (details.province) {
        onProvinceChange(details.province);
      }
      if (details.postalCode) {
        onPostalCodeChange(details.postalCode);
      }

      setTimeout(() => {
        setIsSelectionInProgress(false);
      }, 100);
    },
    [onCityChange, onProvinceChange, onPostalCodeChange]
  );

  return (
    <div className="space-y-3">
      {label && (
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          {label} {required && <span className="text-red-500">*</span>}
        </h3>
      )}

      {/* Street Autocomplete (Google Places) */}
      {enableStreetAutocomplete && onStreetChange && (
        <StreetAutocomplete
          value={streetValue}
          onChange={onStreetChange}
          onPlaceSelect={handlePlaceSelect}
          required={required}
          valid={streetValid}
        />
      )}

      {/* Città con Autocomplete */}
      <div className="relative">
        <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1.5">
          Città {required && <span className="text-red-500">*</span>}
        </label>
        <div className="relative">
          <Command shouldFilter={false} className="relative overflow-visible">
            <div className="relative">
              <Command.Input
                value={cityInput}
                onValueChange={handleCityInputChange}
                onFocus={() => {
                  // Mostra risultati solo se non è validata e ha almeno 2 caratteri
                  if (cityInput.length >= 2 && !cityValid && !isSelectionInProgress) {
                    setShowResults(true);
                  }
                }}
                placeholder="Cerca città..."
                className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 bg-white text-gray-900 font-medium ${
                  cityValid
                    ? 'border-green-500 ring-2 ring-green-200 focus:ring-green-500 focus:border-green-600 bg-green-50'
                    : 'border-gray-300 focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] focus:shadow-md hover:border-gray-400'
                } focus:outline-none placeholder:text-gray-500`}
              />

              {cityValid && (
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

            {/* Dropdown risultati */}
            {showResults && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                <Command.List>
                  {searchResults.map((result, index) => (
                    <Command.Item
                      key={`${result.city}-${result.province}-${result.postal_code}-${index}`}
                      value={`${result.city} ${result.province} ${result.postal_code}`}
                      onSelect={() => handleSelectResult(result)}
                      className="px-4 py-2 cursor-pointer hover:bg-gray-100 aria-selected:bg-gray-100 text-gray-900 font-medium flex items-center gap-2"
                    >
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span>
                        {result.city} ({result.province}) - {result.postal_code}
                      </span>
                    </Command.Item>
                  ))}
                </Command.List>
              </div>
            )}
          </Command>
        </div>
        {cityInput && !cityValid && (
          <p className="mt-1 text-xs text-red-600">⚠️ Seleziona una città dall&apos;autocomplete</p>
        )}
      </div>

      {/* Provincia e CAP in grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* CAP */}
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1.5">
            CAP {required && <span className="text-red-500">*</span>}
          </label>
          <input
            type="text"
            value={postalCodeValue}
            onChange={(e) => {
              const value = e.target.value.replace(/\D/g, '').slice(0, 5);
              onPostalCodeChange(value);
            }}
            placeholder="00000"
            maxLength={5}
            className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 bg-white text-gray-900 font-medium ${
              postalCodeValid
                ? 'border-green-500 ring-2 ring-green-200 focus:ring-green-500 focus:border-green-600 bg-green-50'
                : 'border-gray-300 focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] focus:shadow-md hover:border-gray-400'
            } focus:outline-none placeholder:text-gray-500`}
          />
          {postalCodeValue && !postalCodeValid && (
            <p className="mt-1 text-xs text-red-600">⚠️ CAP deve essere 5 cifre</p>
          )}
        </div>

        {/* Provincia */}
        <div>
          <label className="block text-xs font-semibold uppercase text-gray-500 tracking-wider mb-1.5">
            Provincia {required && <span className="text-red-500">*</span>}
          </label>
          <select
            value={provinceValue}
            onChange={(e) => onProvinceChange(e.target.value)}
            className={`w-full px-4 py-3 border-2 rounded-xl transition-all duration-200 bg-white text-gray-900 font-medium ${
              provinceValid
                ? 'border-green-500 ring-2 ring-green-200 focus:ring-green-500 focus:border-green-600 bg-green-50'
                : 'border-gray-300 focus:ring-2 focus:ring-[#FFD700] focus:border-[#FFD700] focus:shadow-md hover:border-gray-400'
            } focus:outline-none`}
          >
            <option value="">Seleziona...</option>
            {PROVINCE_ITALIANE.map((prov) => (
              <option key={prov} value={prov}>
                {prov}
              </option>
            ))}
          </select>
          {provinceValue && !provinceValid && (
            <p className="mt-1 text-xs text-red-600">⚠️ Provincia non valida</p>
          )}
        </div>
      </div>
    </div>
  );
}
