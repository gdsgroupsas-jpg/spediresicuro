'use client';

import { AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export type OperationState = 'idle' | 'loading' | 'success' | 'error';

export interface StateIndicatorProps {
  /** Stato corrente dell'operazione */
  state: OperationState;
  /** Messaggio opzionale da mostrare */
  message?: string;
  /** Dimensione del badge */
  size?: 'sm' | 'md' | 'lg';
  /** Se mostrare l'icona */
  showIcon?: boolean;
  /** Custom className */
  className?: string;
  /** Variante display: badge compatto o inline */
  variant?: 'badge' | 'inline' | 'minimal';
}

/** Configurazione per stato */
const stateConfig = {
  idle: {
    icon: Clock,
    label: 'Pronto',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600',
    iconColor: 'text-gray-500',
    borderColor: 'border-gray-200',
    dotColor: 'bg-gray-400',
    animate: false,
  },
  loading: {
    icon: Loader2,
    label: 'In corso',
    bgColor: 'bg-blue-50',
    textColor: 'text-blue-700',
    iconColor: 'text-blue-500',
    borderColor: 'border-blue-200',
    dotColor: 'bg-blue-500',
    animate: true,
  },
  success: {
    icon: CheckCircle2,
    label: 'Completato',
    bgColor: 'bg-green-50',
    textColor: 'text-green-700',
    iconColor: 'text-green-500',
    borderColor: 'border-green-200',
    dotColor: 'bg-green-500',
    animate: false,
  },
  error: {
    icon: AlertCircle,
    label: 'Errore',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    iconColor: 'text-red-500',
    borderColor: 'border-red-200',
    dotColor: 'bg-red-500',
    animate: false,
  },
};

/** Dimensioni */
const sizeConfig = {
  sm: {
    padding: 'px-2 py-0.5',
    text: 'text-xs',
    icon: 'w-3 h-3',
    dot: 'w-1.5 h-1.5',
  },
  md: {
    padding: 'px-3 py-1',
    text: 'text-sm',
    icon: 'w-4 h-4',
    dot: 'w-2 h-2',
  },
  lg: {
    padding: 'px-4 py-1.5',
    text: 'text-base',
    icon: 'w-5 h-5',
    dot: 'w-2.5 h-2.5',
  },
};

/**
 * StateIndicator - Badge che mostra lo stato corrente di un'operazione
 *
 * Design specs (ANALISI_REFACTOR_UI_ENTERPRISE_GRADE.md):
 * - 4 stati: IDLE, LOADING, SUCCESS, ERROR
 * - Color-coded per stato
 * - Optional progress indicator during LOADING
 */
export function StateIndicator({
  state,
  message,
  size = 'md',
  showIcon = true,
  className,
  variant = 'badge',
}: StateIndicatorProps) {
  const config = stateConfig[state];
  const sizeStyles = sizeConfig[size];
  const IconComponent = config.icon;

  // Minimal variant - just a dot
  if (variant === 'minimal') {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <span
          className={cn(
            'rounded-full',
            sizeStyles.dot,
            config.dotColor,
            state === 'loading' && 'animate-pulse'
          )}
        />
        {message && <span className={cn(sizeStyles.text, config.textColor)}>{message}</span>}
      </div>
    );
  }

  // Inline variant - icon + text, no background
  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-1.5', config.textColor, className)}>
        {showIcon && (
          <IconComponent
            className={cn(sizeStyles.icon, config.iconColor, config.animate && 'animate-spin')}
          />
        )}
        <span className={cn(sizeStyles.text, 'font-medium')}>{message || config.label}</span>
      </div>
    );
  }

  // Badge variant (default) - full background
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border',
        sizeStyles.padding,
        config.bgColor,
        config.borderColor,
        className
      )}
      role="status"
      aria-label={`Stato: ${config.label}${message ? ` - ${message}` : ''}`}
    >
      {showIcon && (
        <IconComponent
          className={cn(sizeStyles.icon, config.iconColor, config.animate && 'animate-spin')}
        />
      )}
      <span className={cn(sizeStyles.text, 'font-medium', config.textColor)}>
        {message || config.label}
      </span>
    </div>
  );
}

export default StateIndicator;
