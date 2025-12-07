'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          'flex min-h-[80px] w-full rounded-lg border-2 bg-white px-3 py-2 text-sm font-semibold',
          'text-gray-900 placeholder:text-gray-400',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FFD700] focus-visible:border-[#FFD700] focus-visible:shadow-md',
          'hover:border-gray-400',
          'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-100',
          'transition-all duration-200',
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

Textarea.displayName = 'Textarea'

export { Textarea }
