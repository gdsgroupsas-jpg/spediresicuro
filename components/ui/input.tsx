'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-lg border-2 bg-white px-3 py-2 text-sm font-semibold',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'text-gray-900 placeholder:text-gray-500',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:border-[#FFD700] focus-visible:shadow-md',
          'hover:border-gray-400',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-100',
          'transition-all duration-200',
          '[color-scheme:light]', // Forza color scheme chiaro per visibilità
          error
            ? 'border-red-500 focus-visible:ring-red-500 focus-visible:border-red-500 bg-red-50'
            : 'border-gray-300',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)

Input.displayName = 'Input'

export { Input }
