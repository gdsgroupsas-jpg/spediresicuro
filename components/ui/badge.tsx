'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'success' | 'warning' | 'error' | 'outline'
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    const variants = {
      default: 'bg-[#FFD700]/10 text-[#CC9900] border-[#FFD700]/20',
      secondary: 'bg-gray-100 text-gray-700 border-gray-200',
      success: 'bg-teal-100 text-teal-800 border-teal-200', // Verde/Teal per Reseller
      warning: 'bg-amber-100 text-amber-800 border-amber-200', // Viola/Amber per Admin
      error: 'bg-red-100 text-red-800 border-red-200', // Rosso per Super Admin
      outline: 'bg-transparent text-gray-700 border-gray-300',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border',
          variants[variant],
          className
        )}
        {...props}
      />
    )
  }
)

Badge.displayName = 'Badge'

export { Badge }
