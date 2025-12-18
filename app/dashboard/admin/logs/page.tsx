/**
 * Admin Dashboard - Log Diagnostici
 * 
 * Pagina per visualizzare i log diagnostici del sistema.
 * Mostra errori, warning, info e performance events dalla tabella diagnostics_events.
 * 
 * ⚠️ SOLO PER ADMIN: Accesso riservato agli amministratori
 */

import { getSystemLogs } from '@/actions/get-logs'
import type { DiagnosticEvent } from '@/types/diagnostics'
import DashboardNav from '@/components/dashboard-nav'
import { RefreshButton } from './refresh-button'
import { LogRow } from './log-row'

// ⚠️ FORZA RENDERING DINAMICO: Questa pagina usa cookies (createServerActionClient)
// per autenticazione, quindi non può essere pre-renderizzata staticamente
export const dynamic = 'force-dynamic'
export const revalidate = 0

/**
 * Pagina principale - Server Component
 */
export default async function LogsPage() {
  // Recupera i log dal database
  const logs = await getSystemLogs(50)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <DashboardNav
          title="Log Diagnostici"
          subtitle="Visualizzazione eventi di diagnostica, errori e monitoring del sistema"
          showBackButton={true}
        />

        {/* Header con pulsante Aggiorna */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Eventi Diagnostici
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {logs.length} eventi trovati
            </p>
          </div>
          <RefreshButton />
        </div>

        {/* Tabella Log */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Livello
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    Messaggio
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                    IP
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                      <p>Nessun log trovato</p>
                    </td>
                  </tr>
                ) : (
                  logs.map((log) => (
                    <LogRow key={log.id} log={log} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          <p>
            Mostrati gli ultimi {logs.length} eventi. I log vengono aggiornati in tempo reale.
          </p>
        </div>
      </div>
    </div>
  )
}
