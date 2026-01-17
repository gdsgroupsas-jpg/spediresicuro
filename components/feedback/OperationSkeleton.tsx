'use client'

import { cn } from '@/lib/utils'

export type SkeletonShape = 'ticket' | 'table-row' | 'form-fields' | 'message' | 'card' | 'custom'

export interface OperationSkeletonProps {
  /** Tipo di contenuto da simulare */
  shape?: SkeletonShape
  /** Messaggio da mostrare durante il loading */
  message?: string
  /** Numero di righe (per table-row shape) */
  rows?: number
  /** Custom className */
  className?: string
  /** Se true, mostra un'animazione shimmer */
  shimmer?: boolean
}

/**
 * OperationSkeleton - Placeholder animato durante operazioni async
 *
 * Design specs (ANALISI_REFACTOR_UI_ENTERPRISE_GRADE.md):
 * - Animated shimmer effect (Framer Motion + Tailwind)
 * - Color: bg-gray-200 animate-pulse
 * - Structure matches expected content shape
 * - Locations: preview area, table rows, form fields, AI messages
 */
export function OperationSkeleton({
  shape = 'ticket',
  message,
  rows = 3,
  className,
  shimmer = true,
}: OperationSkeletonProps) {
  const baseAnimation = shimmer ? 'animate-pulse' : ''

  return (
    <div className={cn('w-full', className)}>
      {/* Message */}
      {message && (
        <div className="flex items-center justify-center gap-2 mb-4 text-gray-500">
          <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm font-medium">{message}</span>
        </div>
      )}

      {/* Shape-specific skeleton */}
      {shape === 'ticket' && <TicketSkeleton baseAnimation={baseAnimation} />}
      {shape === 'table-row' && (
        <TableRowSkeleton rows={rows} baseAnimation={baseAnimation} />
      )}
      {shape === 'form-fields' && <FormFieldsSkeleton baseAnimation={baseAnimation} />}
      {shape === 'message' && <MessageSkeleton baseAnimation={baseAnimation} />}
      {shape === 'card' && <CardSkeleton baseAnimation={baseAnimation} />}
      {shape === 'custom' && (
        <div className={cn('h-32 bg-gray-200 rounded-xl', baseAnimation)} />
      )}
    </div>
  )
}

/** Skeleton per ticket/preview spedizione */
function TicketSkeleton({ baseAnimation }: { baseAnimation: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header skeleton */}
      <div className={cn('h-12 bg-gray-200', baseAnimation)} />

      <div className="p-4 space-y-4">
        {/* Route section */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className={cn('w-3 h-3 rounded-full bg-gray-200', baseAnimation)} />
            <div className={cn('h-4 bg-gray-200 rounded w-24', baseAnimation)} />
          </div>
          <div className="ml-1.5 border-l-2 border-dashed border-gray-200 h-6" />
          <div className="flex items-center gap-3">
            <div className={cn('w-3 h-3 rounded-full bg-gray-200', baseAnimation)} />
            <div className={cn('h-4 bg-gray-200 rounded w-28', baseAnimation)} />
          </div>
        </div>

        {/* Info section */}
        <div className="pt-4 border-t border-gray-100 space-y-3">
          <div className="flex justify-between">
            <div className={cn('h-3 bg-gray-200 rounded w-16', baseAnimation)} />
            <div className={cn('h-3 bg-gray-200 rounded w-20', baseAnimation)} />
          </div>
          <div className="flex justify-between">
            <div className={cn('h-3 bg-gray-200 rounded w-12', baseAnimation)} />
            <div className={cn('h-3 bg-gray-200 rounded w-24', baseAnimation)} />
          </div>
        </div>

        {/* Price skeleton */}
        <div className="pt-4 border-t border-gray-100">
          <div className={cn('h-10 bg-gray-200 rounded-lg w-24 mx-auto', baseAnimation)} />
        </div>

        {/* Button skeleton */}
        <div className={cn('h-12 bg-gray-200 rounded-xl mt-4', baseAnimation)} />
      </div>
    </div>
  )
}

/** Skeleton per righe tabella */
function TableRowSkeleton({
  rows,
  baseAnimation,
}: {
  rows: number
  baseAnimation: string
}) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center gap-4 p-3 bg-gray-50 rounded-lg',
            baseAnimation
          )}
          style={{ animationDelay: `${i * 100}ms` }}
        >
          <div className={cn('w-10 h-10 bg-gray-200 rounded-lg', baseAnimation)} />
          <div className="flex-1 space-y-2">
            <div className={cn('h-4 bg-gray-200 rounded w-3/4', baseAnimation)} />
            <div className={cn('h-3 bg-gray-200 rounded w-1/2', baseAnimation)} />
          </div>
          <div className={cn('h-6 bg-gray-200 rounded w-16', baseAnimation)} />
        </div>
      ))}
    </div>
  )
}

/** Skeleton per campi form */
function FormFieldsSkeleton({ baseAnimation }: { baseAnimation: string }) {
  return (
    <div className="space-y-4">
      {/* Label + Input */}
      <div className="space-y-2">
        <div className={cn('h-3 bg-gray-200 rounded w-20', baseAnimation)} />
        <div className={cn('h-10 bg-gray-200 rounded-lg w-full', baseAnimation)} />
      </div>
      {/* Grid inputs */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className={cn('h-3 bg-gray-200 rounded w-16', baseAnimation)} />
          <div className={cn('h-10 bg-gray-200 rounded-lg w-full', baseAnimation)} />
        </div>
        <div className="space-y-2">
          <div className={cn('h-3 bg-gray-200 rounded w-14', baseAnimation)} />
          <div className={cn('h-10 bg-gray-200 rounded-lg w-full', baseAnimation)} />
        </div>
      </div>
      {/* Textarea */}
      <div className="space-y-2">
        <div className={cn('h-3 bg-gray-200 rounded w-12', baseAnimation)} />
        <div className={cn('h-20 bg-gray-200 rounded-lg w-full', baseAnimation)} />
      </div>
    </div>
  )
}

/** Skeleton per messaggi AI/chat */
function MessageSkeleton({ baseAnimation }: { baseAnimation: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn('w-8 h-8 bg-gray-200 rounded-full flex-shrink-0', baseAnimation)} />
      <div className="flex-1 space-y-2">
        <div className={cn('h-4 bg-gray-200 rounded w-full', baseAnimation)} />
        <div className={cn('h-4 bg-gray-200 rounded w-5/6', baseAnimation)} />
        <div className={cn('h-4 bg-gray-200 rounded w-2/3', baseAnimation)} />
      </div>
    </div>
  )
}

/** Skeleton per card generica */
function CardSkeleton({ baseAnimation }: { baseAnimation: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className={cn('w-10 h-10 bg-gray-200 rounded-lg', baseAnimation)} />
        <div className={cn('h-5 bg-gray-200 rounded w-32', baseAnimation)} />
      </div>
      <div className="space-y-3">
        <div className={cn('h-4 bg-gray-200 rounded w-full', baseAnimation)} />
        <div className={cn('h-4 bg-gray-200 rounded w-3/4', baseAnimation)} />
        <div className={cn('h-4 bg-gray-200 rounded w-1/2', baseAnimation)} />
      </div>
    </div>
  )
}

export default OperationSkeleton
