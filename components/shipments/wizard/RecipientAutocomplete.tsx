'use client';

/**
 * Autocomplete per nome destinatario con suggerimenti da spedizioni precedenti
 *
 * Al click su un suggerimento, chiama onSelectRecipient con tutti i dati
 * per popolare automaticamente tutti i campi del form.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { User, Clock, MapPin, X, Loader2, History } from 'lucide-react';
import { useRecipientSuggestions } from '@/hooks/useRecipientSuggestions';
import type { SavedRecipient } from '@/types/recipients';
import type { AddressData } from './ShipmentWizardContext';

interface RecipientAutocompleteProps {
  /** Valore corrente del campo nome */
  value: string;
  /** Callback quando cambia il valore */
  onChange: (value: string) => void;
  /** Callback quando viene selezionato un destinatario - popola tutti i campi */
  onSelectRecipient: (recipient: AddressData) => void;
  /** Placeholder del campo */
  placeholder?: string;
  /** Classe CSS aggiuntiva */
  className?: string;
  /** Mostra errore */
  hasError?: boolean;
  /** ID per accessibilita */
  id?: string;
}

export function RecipientAutocomplete({
  value,
  onChange,
  onSelectRecipient,
  placeholder = 'Nome destinatario...',
  className = '',
  hasError = false,
  id,
}: RecipientAutocompleteProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  // Flag per evitare ricerche dopo selezione
  const [hasSelected, setHasSelected] = useState(false);

  const { suggestions, isLoading, search, clearSuggestions } = useRecipientSuggestions({
    debounceMs: 300,
    limit: 8,
  });

  // Trigger ricerca quando cambia il valore (e non e' una selezione)
  useEffect(() => {
    if (!hasSelected && value.length >= 1) {
      search(value);
      setIsOpen(true);
    } else if (value.length === 0) {
      // Mostra recenti se campo vuoto e focus
      search('');
    }
  }, [value, search, hasSelected]);

  // Reset flag selezione quando cambia il valore manualmente
  useEffect(() => {
    if (hasSelected) {
      setHasSelected(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Handle input change
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      setHasSelected(false);
      setSelectedIndex(-1);
      onChange(newValue);
    },
    [onChange]
  );

  // Handle selezione destinatario
  const handleSelectRecipient = useCallback(
    (recipient: SavedRecipient) => {
      setHasSelected(true);
      setIsOpen(false);
      setSelectedIndex(-1);
      clearSuggestions();

      // Mappa SavedRecipient -> AddressData
      onSelectRecipient({
        nome: recipient.name,
        indirizzo: recipient.address,
        citta: recipient.city,
        provincia: recipient.province,
        cap: recipient.zip,
        telefono: recipient.phone,
        email: recipient.email || '',
        company: recipient.company,
      });
    },
    [onSelectRecipient, clearSuggestions]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen || suggestions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
            handleSelectRecipient(suggestions[selectedIndex]);
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setSelectedIndex(-1);
          break;
      }
    },
    [isOpen, suggestions, selectedIndex, handleSelectRecipient]
  );

  // Chiudi dropdown quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus handler - mostra recenti
  const handleFocus = useCallback(() => {
    if (!hasSelected) {
      search(value || '');
      setIsOpen(true);
    }
  }, [hasSelected, search, value]);

  // Format data ultimo utilizzo
  const formatLastUsed = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'oggi';
    if (diffDays === 1) return 'ieri';
    if (diffDays < 7) return `${diffDays} giorni fa`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} sett. fa`;
    return date.toLocaleDateString('it-IT', { month: 'short', day: 'numeric' });
  };

  // Clear button
  const handleClear = useCallback(() => {
    onChange('');
    clearSuggestions();
    setIsOpen(false);
    inputRef.current?.focus();
  }, [onChange, clearSuggestions]);

  const showDropdown = isOpen && (suggestions.length > 0 || isLoading);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className={`
            w-full h-10 px-4 py-2 text-sm rounded-md border bg-white
            transition-colors duration-200
            focus:outline-none focus:ring-2 focus:ring-offset-0
            ${
              hasError
                ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 hover:border-gray-400'
            }
          `}
        />

        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none">
            <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />
          </div>
        )}

        {/* Clear button */}
        {value && !isLoading && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Cancella"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Dropdown suggerimenti */}
      {showDropdown && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-auto">
          {suggestions.length === 0 && isLoading ? (
            <div className="p-4 text-gray-500 text-sm text-center flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Ricerca in corso...
            </div>
          ) : suggestions.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm text-center">Nessun destinatario trovato</div>
          ) : (
            <>
              {/* Header */}
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 sticky top-0">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                  <History className="w-3 h-3" />
                  Destinatari recenti
                </span>
              </div>

              {/* Lista suggerimenti */}
              {suggestions.map((recipient, index) => (
                <button
                  key={recipient.id}
                  type="button"
                  onClick={() => handleSelectRecipient(recipient)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`
                    w-full px-4 py-3 text-left transition-colors
                    border-b border-gray-100 last:border-b-0
                    ${index === selectedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'}
                  `}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                      <User className="w-5 h-5 text-white" />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-gray-900 truncate">{recipient.name}</span>
                        <span className="text-xs text-gray-400 flex items-center gap-1 flex-shrink-0">
                          <Clock className="w-3 h-3" />
                          {formatLastUsed(recipient.lastUsed)}
                        </span>
                      </div>

                      <div className="text-sm text-gray-600 truncate flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 flex-shrink-0" />
                        {recipient.address}, {recipient.zip} {recipient.city} ({recipient.province})
                      </div>

                      {recipient.usageCount > 1 && (
                        <div className="text-xs text-gray-400 mt-1">
                          Usato {recipient.usageCount} volte
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
