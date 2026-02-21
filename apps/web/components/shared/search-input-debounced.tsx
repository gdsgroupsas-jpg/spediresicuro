'use client';

import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useDebounce } from '@/lib/hooks/use-debounce';
import { cn } from '@/lib/utils';

interface SearchInputDebouncedProps {
  onSearch: (value: string) => void;
  placeholder?: string;
  delay?: number;
  className?: string;
  defaultValue?: string;
}

/**
 * Input di ricerca con debounce integrato
 * Emette il valore solo dopo che l'utente ha smesso di digitare
 */
export function SearchInputDebounced({
  onSearch,
  placeholder = 'Cerca...',
  delay = 300,
  className,
  defaultValue = '',
}: SearchInputDebouncedProps) {
  const [value, setValue] = useState(defaultValue);
  const debouncedValue = useDebounce(value, delay);

  useEffect(() => {
    onSearch(debouncedValue);
  }, [debouncedValue, onSearch]);

  const handleClear = () => {
    setValue('');
  };

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full pl-10 pr-10 py-2 text-sm',
          'border border-gray-200 rounded-lg',
          'bg-white focus:bg-gray-50',
          'focus:outline-none focus:ring-2 focus:ring-[#FFD700]/50 focus:border-[#FFD700]',
          'placeholder:text-gray-400',
          'transition-all duration-200'
        )}
      />
      {value && (
        <button
          onClick={handleClear}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
          type="button"
          aria-label="Cancella ricerca"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
