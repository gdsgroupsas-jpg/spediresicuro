'use client'

import { TrendingUp, TrendingDown, Calendar } from 'lucide-react'
import type { PlatformMonthlyPnL } from '@/actions/platform-costs'

interface MonthlyPnLProps {
  data: PlatformMonthlyPnL[]
  isLoading: boolean
}

export function MonthlyPnL({ data, isLoading }: MonthlyPnLProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="p-6 space-y-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-purple-500" />
            P&L Mensile
          </h3>
        </div>
        <div className="p-12 text-center">
          <p className="text-gray-500">Nessun dato disponibile</p>
        </div>
      </div>
    )
  }

  // Calcola il max per la barra di progresso relativa
  const maxMargin = Math.max(...data.map(d => Math.abs(d.gross_margin)))

  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-')
    const monthNames = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
    return `${monthNames[parseInt(month) - 1]} ${year}`
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-purple-500" />
          P&L Mensile
        </h3>
        <p className="text-sm text-gray-500 mt-1">Ultimi {data.length} mesi</p>
      </div>

      <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
        {data.map((month, index) => {
          const isPositive = month.gross_margin >= 0
          const barWidth = maxMargin > 0 ? (Math.abs(month.gross_margin) / maxMargin) * 100 : 0
          
          return (
            <div key={month.month} className="group">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700 w-20">
                    {formatMonth(month.month)}
                  </span>
                  <span className="text-xs text-gray-500">
                    {month.total_shipments.toLocaleString('it-IT')} spedizioni
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isPositive ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  <span className={`text-sm font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    €{month.gross_margin.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
              
              {/* Progress bar */}
              <div className="h-6 bg-gray-100 rounded-lg overflow-hidden relative">
                <div 
                  className={`h-full rounded-lg transition-all duration-500 ${
                    isPositive ? 'bg-gradient-to-r from-green-400 to-green-600' : 'bg-gradient-to-r from-red-400 to-red-600'
                  }`}
                  style={{ width: `${Math.max(barWidth, 2)}%` }}
                />
                <div className="absolute inset-0 flex items-center px-3 justify-between text-xs">
                  <span className="text-white font-medium drop-shadow-sm">
                    Ricavi: €{month.total_revenue.toLocaleString('it-IT', { minimumFractionDigits: 0 })}
                  </span>
                  <span className={`font-medium ${barWidth > 50 ? 'text-white drop-shadow-sm' : 'text-gray-600'}`}>
                    {month.margin_percent_of_revenue.toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* Details on hover */}
              <div className="grid grid-cols-4 gap-2 mt-2 text-xs text-gray-500 opacity-60 group-hover:opacity-100 transition-opacity">
                <div>
                  <span className="block text-gray-400">Ricavi</span>
                  <span className="font-medium text-gray-700">€{month.total_revenue.toLocaleString('it-IT')}</span>
                </div>
                <div>
                  <span className="block text-gray-400">Costi</span>
                  <span className="font-medium text-gray-700">€{month.total_cost.toLocaleString('it-IT')}</span>
                </div>
                <div>
                  <span className="block text-gray-400">Utenti</span>
                  <span className="font-medium text-gray-700">{month.unique_users}</span>
                </div>
                <div>
                  <span className="block text-gray-400">Margini &lt;0</span>
                  <span className={`font-medium ${month.negative_margin_count > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {month.negative_margin_count}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
