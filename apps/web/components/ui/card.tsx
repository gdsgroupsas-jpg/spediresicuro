'use client';

import { ReactNode, createContext, useContext } from 'react';
import { cn } from '@/lib/utils';

// Context per propagare il variant ai sotto-componenti
type CardVariant = 'light' | 'dark';
const CardVariantContext = createContext<CardVariant>('light');
function useCardVariant() {
  return useContext(CardVariantContext);
}

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  glass?: boolean;
  variant?: CardVariant;
}

/**
 * Card Component
 *
 * Light (default): bg bianco, bordo grigio, ombra sottile — per dashboard
 * Dark: bg void, bordo giallo — per landing/marketing
 * Glass: glassmorphism (sempre dark)
 */
export function Card({
  children,
  className,
  hover = true,
  glass = false,
  variant = 'light',
}: CardProps) {
  // Glass forza il dark
  const effectiveVariant = glass ? 'dark' : variant;

  return (
    <CardVariantContext.Provider value={effectiveVariant}>
      <div
        className={cn(
          'rounded-xl p-6',
          glass
            ? 'glass'
            : effectiveVariant === 'dark'
              ? 'bg-[#0f0f11] border border-[#FACC15]/10'
              : 'bg-white border border-gray-200 shadow-sm',
          hover && 'card-lift',
          className
        )}
      >
        {children}
      </div>
    </CardVariantContext.Provider>
  );
}

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return <div className={cn('mb-4', className)}>{children}</div>;
}

interface CardTitleProps {
  children: ReactNode;
  className?: string;
}

export function CardTitle({ children, className }: CardTitleProps) {
  const variant = useCardVariant();
  return (
    <h3
      className={cn(
        'text-lg font-semibold',
        variant === 'dark' ? 'text-gray-100' : 'text-gray-900',
        className
      )}
    >
      {children}
    </h3>
  );
}

interface CardDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function CardDescription({ children, className }: CardDescriptionProps) {
  const variant = useCardVariant();
  return (
    <p
      className={cn(
        'text-sm mt-1',
        variant === 'dark' ? 'text-gray-400' : 'text-gray-500',
        className
      )}
    >
      {children}
    </p>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  const variant = useCardVariant();
  return (
    <div className={cn(variant === 'dark' ? 'text-gray-300' : 'text-gray-700', className)}>
      {children}
    </div>
  );
}

/**
 * FinancialDisplay - Stile cruscotto finanziario
 */
interface FinancialDisplayProps {
  label: string;
  value: string | number;
  status?: 'success' | 'warning' | 'error' | 'info';
  className?: string;
}

export function FinancialDisplay({ label, value, status, className }: FinancialDisplayProps) {
  const variant = useCardVariant();
  const statusClasses = {
    success: 'status-success',
    warning: 'status-warning',
    error: 'status-error',
    info: 'status-info',
  };

  return (
    <div
      className={cn(
        'flex items-center justify-between py-2 border-b',
        variant === 'dark' ? 'border-[#FACC15]/5' : 'border-gray-100',
        className
      )}
    >
      <span className={cn('text-sm', variant === 'dark' ? 'text-gray-400' : 'text-gray-500')}>
        {label}
      </span>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'font-mono-numbers text-lg font-bold',
            variant === 'dark' ? 'text-gray-100' : 'text-gray-900'
          )}
        >
          {typeof value === 'number'
            ? value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : value}
        </span>
        {status && <span className={cn('status-badge', statusClasses[status])}>{status}</span>}
      </div>
    </div>
  );
}

/**
 * TableRow - Riga tabella stile cruscotto
 */
interface TableRowProps {
  label: string;
  value: string | number;
  highlight?: boolean;
  className?: string;
}

export function TableRow({ label, value, highlight, className }: TableRowProps) {
  const variant = useCardVariant();
  return (
    <tr
      className={cn(
        'border-b',
        variant === 'dark' ? 'border-[#FACC15]/5' : 'border-gray-100',
        highlight && (variant === 'dark' ? 'bg-[#FACC15]/5' : 'bg-amber-50'),
        className
      )}
    >
      <td
        className={cn('py-3 px-4 text-sm', variant === 'dark' ? 'text-gray-400' : 'text-gray-500')}
      >
        {label}
      </td>
      <td className="py-3 px-4 text-right">
        <span
          className={cn(
            'font-mono-numbers font-semibold',
            variant === 'dark' ? 'text-gray-100' : 'text-gray-900'
          )}
        >
          {typeof value === 'number' ? value.toLocaleString('it-IT') : value}
        </span>
      </td>
    </tr>
  );
}
