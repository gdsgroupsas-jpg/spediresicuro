'use client'

import { useEffect, useRef } from 'react'
import {
  AlertCircle,
  CreditCard,
  HelpCircle,
  MessageSquare,
  RefreshCw,
  Settings,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ErrorAction {
  /** ID univoco azione */
  id: string
  /** Label descrittiva dell'azione */
  label: string
  /** Testo del bottone */
  buttonText: string
  /** Destinazione (URL o null per azione locale) */
  destination?: string | null
  /** Tipo di bottone */
  type: 'primary' | 'secondary' | 'tertiary'
  /** Icona opzionale */
  icon?: 'wallet' | 'courier' | 'support' | 'settings' | 'retry'
}

export interface ErrorData {
  /** Codice errore (es. WALLET_INSUFFICIENT) */
  code: string
  /** Titolo user-friendly */
  title: string
  /** Messaggio descrittivo */
  message: string
  /** Dettagli aggiuntivi (es. "Current balance: €20.00") */
  details?: string
  /** Importo richiesto (per errori wallet) */
  required?: number
  /** Balance attuale (per errori wallet) */
  balance?: number
  /** Shortfall (differenza) */
  shortfall?: number
}

export interface ErrorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Dati errore strutturati */
  error: ErrorData
  /** Azioni di recovery disponibili */
  actions?: ErrorAction[]
  /** Se retry e abilitato */
  canRetry?: boolean
  /** Callback per retry (usa stessa idempotency key) */
  onRetry?: () => void
  /** Callback quando utente clicca un'azione */
  onAction?: (action: ErrorAction) => void
  /** Indica se retry in corso */
  isRetrying?: boolean
}

/** Mappa icone per tipo azione */
const iconMap = {
  wallet: CreditCard,
  courier: Settings,
  support: MessageSquare,
  settings: Settings,
  retry: RefreshCw,
}

/**
 * ErrorDialog - Dialog errore con azioni di recovery
 *
 * Design specs (ANALISI_REFACTOR_UI_ENTERPRISE_GRADE.md):
 * - Dialog centrato, persistente (no auto-dismiss)
 * - Problema description (simple, non-technical)
 * - Actionable steps con CTAs
 * - Retry button (protected by idempotency)
 * - Supportive tone (non-technical language)
 */
export function ErrorDialog({
  open,
  onOpenChange,
  error,
  actions = [],
  canRetry = true,
  onRetry,
  onAction,
  isRetrying = false,
}: ErrorDialogProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      // Focus close button for accessibility
      setTimeout(() => closeButtonRef.current?.focus(), 100)
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [open])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open && !isRetrying) {
        onOpenChange(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onOpenChange, isRetrying])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="error-dialog-title"
      aria-describedby="error-dialog-description"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in-0 duration-200"
        aria-hidden="true"
      />

      {/* Dialog Content */}
      <div
        className={cn(
          'relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden',
          'animate-in fade-in-0 zoom-in-95 duration-200',
          // Subtle shake animation for attention
          'motion-safe:animate-[shake_0.4s_ease-in-out]'
        )}
        style={{
          // @ts-ignore - Custom keyframes via inline style
          '--tw-animate-shake':
            'shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97) both',
        }}
      >
        {/* Close Button */}
        <button
          ref={closeButtonRef}
          onClick={() => !isRetrying && onOpenChange(false)}
          disabled={isRetrying}
          className={cn(
            'absolute right-4 top-4 p-1 rounded-lg',
            'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
            'transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
          aria-label="Chiudi"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Content */}
        <div className="p-8">
          {/* Error Icon + Title */}
          <div className="flex items-start gap-4 mb-6">
            <div className="p-3 bg-red-100 rounded-xl flex-shrink-0">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <h2
                id="error-dialog-title"
                className="text-xl font-bold text-red-600 mb-1"
              >
                {error.title}
              </h2>
              <p id="error-dialog-description" className="text-gray-600">
                {error.message}
              </p>
              {error.details && (
                <p className="text-sm text-gray-500 mt-2">{error.details}</p>
              )}
            </div>
          </div>

          {/* Actions Section */}
          {actions.length > 0 && (
            <div className="mb-6">
              <p className="text-sm font-medium text-gray-700 mb-4">
                Cosa vorresti fare?
              </p>
              <div className="space-y-3">
                {actions.map((action) => {
                  const IconComponent = action.icon
                    ? iconMap[action.icon]
                    : HelpCircle
                  return (
                    <div
                      key={action.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
                    >
                      <div className="flex items-center gap-3">
                        <IconComponent className="w-5 h-5 text-gray-500" />
                        <span className="text-sm text-gray-700">
                          {action.label}
                        </span>
                      </div>
                      <button
                        onClick={() => onAction?.(action)}
                        disabled={isRetrying}
                        className={cn(
                          'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
                          'disabled:opacity-50 disabled:cursor-not-allowed',
                          action.type === 'primary'
                            ? 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white hover:opacity-90'
                            : action.type === 'secondary'
                            ? 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-100'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        )}
                      >
                        {action.buttonText}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-gray-200 my-6" />

          {/* Retry Button */}
          {canRetry && onRetry && (
            <button
              onClick={onRetry}
              disabled={isRetrying}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
                'border-2 border-gray-200 text-gray-700 font-semibold',
                'hover:bg-gray-50 hover:border-gray-300 transition-colors',
                'focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Riprovo...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Riprova
                </>
              )}
            </button>
          )}

          {/* Help text */}
          <p className="text-xs text-gray-400 text-center mt-4">
            Se il problema persiste, contatta il supporto.
          </p>
        </div>
      </div>

      {/* Shake animation keyframes */}
      <style jsx global>{`
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          10%,
          30%,
          50%,
          70%,
          90% {
            transform: translateX(-5px);
          }
          20%,
          40%,
          60%,
          80% {
            transform: translateX(5px);
          }
        }
      `}</style>
    </div>
  )
}

export default ErrorDialog
