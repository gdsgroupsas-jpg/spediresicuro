/**
 * Tier Badge Component
 * 
 * Badge per visualizzare tier del reseller (small, medium, enterprise)
 * Stile coerente con RoleBadge
 */

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ResellerTier } from '@/lib/db/tier-helpers'

interface TierBadgeProps {
  tier: ResellerTier | null | undefined
  className?: string
  showIcon?: boolean
}

/**
 * Badge per tier reseller
 */
export function TierBadge({ tier, className, showIcon = false }: TierBadgeProps) {
  if (!tier) {
    return null
  }

  const tierConfig = {
    small: {
      label: 'Small',
      variant: 'secondary' as const,
      className: 'bg-gray-100 text-gray-700 border-gray-200',
      icon: null,
    },
    medium: {
      label: 'Medium',
      variant: 'default' as const,
      className: 'bg-blue-50 text-blue-700 border-blue-200',
      icon: null,
    },
    enterprise: {
      label: 'Enterprise',
      variant: 'default' as const,
      className: 'bg-amber-50 text-amber-700 border-amber-200',
      icon: null,
    },
  }

  const config = tierConfig[tier]

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, className)}
    >
      {showIcon && config.icon && <span className="mr-1">{config.icon}</span>}
      {config.label}
    </Badge>
  )
}

/**
 * Badge span (per uso inline in testo)
 */
export function TierBadgeSpan({ tier, className }: TierBadgeProps) {
  if (!tier) {
    return null
  }

  const tierConfig = {
    small: {
      label: 'Small',
      className: 'bg-gray-100 text-gray-700 border border-gray-200',
    },
    medium: {
      label: 'Medium',
      className: 'bg-blue-50 text-blue-700 border border-blue-200',
    },
    enterprise: {
      label: 'Enterprise',
      className: 'bg-amber-50 text-amber-700 border border-amber-200',
    },
  }

  const config = tierConfig[tier]

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  )
}
