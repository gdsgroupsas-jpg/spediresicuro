'use client'

import { Users, TrendingUp, Award } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface ResellerUsage {
  user_id: string
  user_email: string
  user_name: string | null
  total_shipments: number
  total_billed: number
  margin_generated: number
}

interface TopResellersTableProps {
  data: ResellerUsage[]
  isLoading: boolean
}

export function TopResellersTable({ data, isLoading }: TopResellersTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
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
            <Users className="w-5 h-5 text-orange-500" />
            Top Reseller (Platform Usage)
          </h3>
        </div>
        <div className="p-12 text-center">
          <p className="text-gray-500">Nessun dato disponibile</p>
        </div>
      </div>
    )
  }

  // Ordina per fatturato
  const sortedData = [...data].sort((a, b) => b.total_billed - a.total_billed)
  const topThree = sortedData.slice(0, 3)
  const rest = sortedData.slice(3)

  const getMedalColor = (index: number) => {
    switch (index) {
      case 0: return 'bg-yellow-400 text-yellow-900'
      case 1: return 'bg-gray-300 text-gray-700'
      case 2: return 'bg-amber-600 text-amber-100'
      default: return 'bg-gray-100 text-gray-600'
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-orange-500" />
          Top Reseller (Platform Usage)
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Classifica per fatturato generato con contratti piattaforma
        </p>
      </div>

      {/* Top 3 con highlight */}
      {topThree.length > 0 && (
        <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-amber-100">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {topThree.map((reseller, index) => (
              <div 
                key={reseller.user_id}
                className={`bg-white rounded-lg p-4 shadow-sm border ${
                  index === 0 ? 'border-yellow-300 ring-2 ring-yellow-200' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getMedalColor(index)}`}>
                    <Award className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {reseller.user_name || reseller.user_email.split('@')[0]}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{reseller.user_email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs">Fatturato</p>
                    <p className="font-bold text-gray-900">
                      €{reseller.total_billed.toLocaleString('it-IT')}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">Margine</p>
                    <p className="font-bold text-green-600">
                      €{reseller.margin_generated.toLocaleString('it-IT')}
                    </p>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <p className="text-xs text-gray-500">
                    {reseller.total_shipments.toLocaleString('it-IT')} spedizioni
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resto della lista */}
      {rest.length > 0 && (
        <div className="divide-y divide-gray-100 max-h-[300px] overflow-y-auto">
          {rest.map((reseller, index) => (
            <div 
              key={reseller.user_id}
              className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-center text-sm font-medium text-gray-400">
                  #{index + 4}
                </span>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-gray-100 text-gray-600">
                    {(reseller.user_name || reseller.user_email)[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {reseller.user_name || reseller.user_email.split('@')[0]}
                  </p>
                  <p className="text-xs text-gray-500">
                    {reseller.total_shipments.toLocaleString('it-IT')} spedizioni
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-right">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    €{reseller.total_billed.toLocaleString('it-IT')}
                  </p>
                  <p className="text-xs text-gray-400">fatturato</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-green-600">
                    €{reseller.margin_generated.toLocaleString('it-IT')}
                  </p>
                  <p className="text-xs text-gray-400">margine</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
