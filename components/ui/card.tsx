'use client'

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  hover?: boolean
  glass?: boolean
}

/**
 * Card Component - World-Class Design
 * 
 * Card con effetti hover avanzati, glassmorphism opzionale
 * e stile cruscotto finanziario per dati numerici.
 */
export function Card({ children, className, hover = true, glass = false }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl p-6',
        glass ? 'glass' : 'bg-[#0f0f11] border border-[#FACC15]/10',
        hover && 'card-lift',
        className
      )}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  children: ReactNode
  className?: string
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn('mb-4', className)}>
      {children}
    </div>
  )
}

interface CardTitleProps {
  children: ReactNode
  className?: string
}

export function CardTitle({ children, className }: CardTitleProps) {
  return (
    <h3 className={cn('text-lg font-semibold text-gray-100', className)}>
      {children}
    </h3>
  )
}

interface CardDescriptionProps {
  children: ReactNode
  className?: string
}

export function CardDescription({ children, className }: CardDescriptionProps) {
  return (
    <p className={cn('text-sm text-gray-400 mt-1', className)}>
      {children}
    </p>
  )
}

interface CardContentProps {
  children: ReactNode
  className?: string
}

export function CardContent({ children, className }: CardContentProps) {
  return (
    <div className={cn('text-gray-300', className)}>
      {children}
    </div>
  )
}

/**
 * FinancialDisplay - Stile cruscotto finanziario
 * 
 * Componente per mostrare numeri in stile cruscotto:
 * - Font monospaziato per allineamento perfetto
 * - Badge colorati per status
 * - Layout tabellare professionale
 */
interface FinancialDisplayProps {
  label: string
  value: string | number
  status?: 'success' | 'warning' | 'error' | 'info'
  className?: string
}

export function FinancialDisplay({ label, value, status, className }: FinancialDisplayProps) {
  const statusClasses = {
    success: 'status-success',
    warning: 'status-warning',
    error: 'status-error',
    info: 'status-info',
  }

  return (
    <div className={cn('flex items-center justify-between py-2 border-b border-[#FACC15]/5', className)}>
      <span className="text-sm text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono-numbers text-lg font-bold text-gray-100">
          {typeof value === 'number' ? value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}
        </span>
        {status && (
          <span className={cn('status-badge', statusClasses[status])}>
            {status}
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * TableRow - Riga tabella stile cruscotto
 */
interface TableRowProps {
  label: string
  value: string | number
  highlight?: boolean
  className?: string
}

export function TableRow({ label, value, highlight, className }: TableRowProps) {
  return (
    <tr className={cn(
      'border-b border-[#FACC15]/5',
      highlight && 'bg-[#FACC15]/5',
      className
    )}>
      <td className="py-3 px-4 text-sm text-gray-400">{label}</td>
      <td className="py-3 px-4 text-right">
        <span className="font-mono-numbers font-semibold text-gray-100">
          {typeof value === 'number' ? value.toLocaleString('it-IT') : value}
        </span>
      </td>
    </tr>
  )
}

