'use client'

/**
 * Componente Client per il pulsante Aggiorna
 * 
 * Gestisce il refresh della pagina usando router.refresh()
 */

import { useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'

export function RefreshButton() {
  const router = useRouter()
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    router.refresh()
    // Reset dello stato dopo un breve delay per permettere l'animazione
    setTimeout(() => setIsRefreshing(false), 500)
  }

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
      Aggiorna
    </button>
  )
}
