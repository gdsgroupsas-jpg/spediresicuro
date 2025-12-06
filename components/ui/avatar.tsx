'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { getInitials } from '@/lib/utils'

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg'
}

const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, size = 'md', ...props }, ref) => {
    const sizes = {
      sm: 'h-8 w-8 text-xs',
      md: 'h-10 w-10 text-sm',
      lg: 'h-12 w-12 text-base',
    }

    return (
      <div
        ref={ref}
        className={cn(
          'relative flex shrink-0 overflow-hidden rounded-full',
          sizes[size],
          className
        )}
        {...props}
      />
    )
  }
)
Avatar.displayName = 'Avatar'

interface AvatarImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {}

const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, alt, ...props }, ref) => {
    return (
      <img
        ref={ref}
        className={cn('aspect-square h-full w-full object-cover', className)}
        alt={alt}
        {...props}
      />
    )
  }
)
AvatarImage.displayName = 'AvatarImage'

interface AvatarFallbackProps extends React.HTMLAttributes<HTMLDivElement> {
  name?: string
}

const AvatarFallback = React.forwardRef<HTMLDivElement, AvatarFallbackProps>(
  ({ className, children, name, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex h-full w-full items-center justify-center rounded-full',
          'bg-gradient-to-br from-[#FFD700]/20 to-[#FF9500]/20 text-[#CC9900] font-medium',
          className
        )}
        {...props}
      >
        {children || (name ? getInitials(name) : '?')}
      </div>
    )
  }
)
AvatarFallback.displayName = 'AvatarFallback'

export { Avatar, AvatarImage, AvatarFallback }
