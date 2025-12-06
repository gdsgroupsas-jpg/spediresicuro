'use client'

import { useState, useCallback } from 'react'

export interface ConfirmDialogOptions {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: 'default' | 'destructive'
  requireConfirmation?: boolean
  confirmationText?: string
}

interface ConfirmDialogState {
  isOpen: boolean
  options: ConfirmDialogOptions | null
  resolver: ((value: boolean) => void) | null
}

/**
 * Hook per gestire dialog di conferma in modo imperativo
 *
 * @example
 * const { confirm, isOpen, options, handleConfirm, handleCancel } = useConfirmDialog()
 *
 * // Nel componente
 * const handleDelete = async () => {
 *   const confirmed = await confirm({
 *     title: 'Conferma eliminazione',
 *     description: 'Sei sicuro di voler eliminare questo elemento?',
 *     variant: 'destructive',
 *   })
 *   if (confirmed) {
 *     // Procedi con eliminazione
 *   }
 * }
 */
export function useConfirmDialog() {
  const [state, setState] = useState<ConfirmDialogState>({
    isOpen: false,
    options: null,
    resolver: null,
  })

  const confirm = useCallback((opts: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        options: opts,
        resolver: resolve,
      })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    state.resolver?.(true)
    setState({
      isOpen: false,
      options: null,
      resolver: null,
    })
  }, [state.resolver])

  const handleCancel = useCallback(() => {
    state.resolver?.(false)
    setState({
      isOpen: false,
      options: null,
      resolver: null,
    })
  }, [state.resolver])

  const close = useCallback(() => {
    state.resolver?.(false)
    setState({
      isOpen: false,
      options: null,
      resolver: null,
    })
  }, [state.resolver])

  return {
    confirm,
    isOpen: state.isOpen,
    options: state.options,
    handleConfirm,
    handleCancel,
    close,
  }
}
