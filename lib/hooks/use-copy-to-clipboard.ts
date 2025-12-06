'use client'

import { useState, useCallback } from 'react'
import { toast } from 'sonner'

/**
 * Hook per copiare testo negli appunti con feedback
 *
 * @example
 * const { copy, isCopied } = useCopyToClipboard()
 *
 * <button onClick={() => copy(userId)}>
 *   {isCopied ? 'Copiato!' : 'Copia ID'}
 * </button>
 */
export function useCopyToClipboard(resetDelay: number = 2000) {
  const [isCopied, setIsCopied] = useState(false)

  const copy = useCallback(async (text: string, successMessage?: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setIsCopied(true)
      toast.success(successMessage || 'Copiato negli appunti')

      setTimeout(() => setIsCopied(false), resetDelay)
      return true
    } catch (error) {
      console.error('Errore copia negli appunti:', error)
      toast.error('Errore durante la copia')
      return false
    }
  }, [resetDelay])

  return { copy, isCopied }
}
