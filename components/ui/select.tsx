'use client';

import * as React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          className={cn(
            'flex h-10 w-full appearance-none rounded-lg border bg-white px-3 py-2 pr-10 text-sm font-medium',
            'text-gray-900 placeholder:text-gray-500',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700]/50 focus-visible:border-[#FFD700]',
            'hover:border-gray-400',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'transition-all duration-200',
            error
              ? 'border-red-500 focus-visible:ring-red-500/50 focus-visible:border-red-500'
              : 'border-gray-300',
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>
    );
  }
);

Select.displayName = 'Select';

export { Select };
