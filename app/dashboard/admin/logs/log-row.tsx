'use client'

/**
 * Componente per una riga della tabella log
 * 
 * Mostra i dettagli di un singolo evento diagnostico con supporto
 * per espandere/collassare il JSON completo del context
 */

import { useState } from 'react'
import type { DiagnosticEvent } from '@/types/diagnostics'
import { AlertCircle, AlertTriangle, Info, Activity, User, XCircle, Link as LinkIcon, ChevronDown } from 'lucide-react'

/**
 * Formatta una data ISO in formato 'dd/MM HH:mm'
 */
function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString)
    const day = String(date.getDate()).padStart(2, '0')
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${day}/${month} ${hours}:${minutes}`
  } catch {
    return dateString
  }
}

/**
 * Estrae il messaggio dal contesto JSON
 * Se non trova context.message, ritorna 'Dettagli'
 */
function extractMessage(context: any): string {
  if (!context) return 'Dettagli'
  
  // Cerca prima context.message
  if (context.message) return String(context.message)
  
  // Fallback ad altri campi comuni
  if (typeof context === 'string') return context
  if (context.error) return String(context.error)
  if (context.msg) return String(context.msg)
  if (context.description) return String(context.description)
  
  // Se non c'è un messaggio esplicito, mostra 'Dettagli'
  return 'Dettagli'
}

/**
 * Ottiene il colore del badge in base alla severità
 */
function getSeverityBadgeColor(severity: DiagnosticEvent['severity']): string {
  switch (severity) {
    case 'critical':
    case 'high':
      return 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800'
    case 'low':
      return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800'
    case 'info':
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
  }
}

/**
 * Ottiene l'icona in base al tipo di evento
 */
function getTypeIcon(type: DiagnosticEvent['type']) {
  switch (type) {
    case 'error':
      return <XCircle className="w-4 h-4" />
    case 'warning':
      return <AlertTriangle className="w-4 h-4" />
    case 'info':
      return <Info className="w-4 h-4" />
    case 'performance':
      return <Activity className="w-4 h-4" />
    case 'user_action':
      return <User className="w-4 h-4" />
    default:
      return <Info className="w-4 h-4" />
  }
}

/**
 * Componente per il badge del livello di severità
 */
function SeverityBadge({ severity }: { severity: DiagnosticEvent['severity'] }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${getSeverityBadgeColor(severity)}`}
    >
      {severity.toUpperCase()}
    </span>
  )
}

/**
 * Componente per il badge del tipo di evento
 */
function TypeBadge({ type }: { type: DiagnosticEvent['type'] }) {
  const typeLabels: Record<DiagnosticEvent['type'], string> = {
    error: 'Errore',
    warning: 'Warning',
    info: 'Info',
    performance: 'Performance',
    user_action: 'Azione Utente',
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {getTypeIcon(type)}
      {typeLabels[type]}
    </span>
  )
}

interface LogRowProps {
  log: DiagnosticEvent
}

export function LogRow({ log }: LogRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <>
      <tr
        onClick={() => setIsExpanded(!isExpanded)}
        className="hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
      >
        {/* Data */}
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
          {formatDate(log.created_at)}
        </td>

        {/* Livello Severità */}
        <td className="px-6 py-4 whitespace-nowrap">
          <SeverityBadge severity={log.severity} />
        </td>

        {/* Tipo */}
        <td className="px-6 py-4 whitespace-nowrap">
          <TypeBadge type={log.type} />
        </td>

        {/* Messaggio */}
        <td className="px-6 py-4 text-sm text-gray-700 dark:text-gray-300 max-w-md">
          <div className="flex flex-col gap-1">
            <span className="break-words">
              {extractMessage(log.context)}
            </span>
            {log.correlation_id && (
              <span className="inline-flex items-center gap-1 text-xs font-mono text-gray-500 dark:text-gray-400">
                <LinkIcon className="w-3 h-3" />
                {log.correlation_id}
              </span>
            )}
          </div>
        </td>

        {/* IP Address */}
        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400 font-mono">
          {log.ip_address || '-'}
        </td>
      </tr>
      
      {/* Riga espansa con dettagli JSON */}
      {isExpanded && (
        <tr className="bg-gray-50 dark:bg-slate-900/50">
          <td colSpan={5} className="px-6 py-4">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              <ChevronDown className="w-4 h-4" />
              Dettagli Completi (JSON)
            </div>
            <div className="mt-2 p-4 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-x-auto">
              <pre className="text-xs font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">
                {JSON.stringify(log.context, null, 2)}
              </pre>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
