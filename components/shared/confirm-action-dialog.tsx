'use client'

import { useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ConfirmActionDialogProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  requireConfirmation?: boolean
  confirmationText?: string
  isLoading?: boolean
}

/**
 * Dialog di conferma azione con supporto per conferma testuale
 */
export function ConfirmActionDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Conferma',
  cancelText = 'Annulla',
  variant = 'default',
  requireConfirmation = false,
  confirmationText = '',
  isLoading = false,
}: ConfirmActionDialogProps) {
  const [inputValue, setInputValue] = useState('')

  if (!isOpen) return null

  const isConfirmEnabled = !requireConfirmation || inputValue === confirmationText

  const handleConfirm = () => {
    if (isConfirmEnabled && !isLoading) {
      onConfirm()
      setInputValue('')
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setInputValue('')
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-4">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'p-2 rounded-lg',
                variant === 'destructive' ? 'bg-red-100' : 'bg-amber-100'
              )}
            >
              <AlertTriangle
                className={cn(
                  'h-5 w-5',
                  variant === 'destructive' ? 'text-red-600' : 'text-amber-600'
                )}
              />
            </div>
            <div>
              <h2 id="dialog-title" className="text-lg font-semibold text-gray-900">
                {title}
              </h2>
              <p className="mt-1 text-sm text-gray-500">{description}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            aria-label="Chiudi"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Confirmation Input */}
        {requireConfirmation && (
          <div className="px-6 pb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Digita &quot;{confirmationText}&quot; per confermare:
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className={cn(
                'w-full px-3 py-2 text-sm border rounded-lg',
                'focus:outline-none focus:ring-2 focus:ring-[#FFD700]/50',
                inputValue === confirmationText
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200'
              )}
              placeholder={confirmationText}
              disabled={isLoading}
              autoFocus
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-100">
          <button
            onClick={handleClose}
            disabled={isLoading}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg',
              'border border-gray-200 bg-white text-gray-700',
              'hover:bg-gray-50 transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isConfirmEnabled || isLoading}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              variant === 'destructive'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-gradient-to-r from-[#FFD700] to-[#FF9500] text-white hover:opacity-90'
            )}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Caricamento...
              </span>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
