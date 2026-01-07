'use client'

import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  AlertTriangle, 
  Clock,
  Percent,
  CreditCard
} from 'lucide-react'

interface StatsCardsProps {
  stats: {
    totalShipments: number
    totalRevenue: number
    totalCost: number
    totalMargin: number
    avgMarginPercent: number
    pendingReconciliation: number
    negativeMarginCount: number
    last30DaysShipments: number
  } | null
  isLoading: boolean
}

export function StatsCards({ stats, isLoading }: StatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <div 
            key={i} 
            className="bg-white rounded-xl p-6 border border-gray-200 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-24 mb-4"></div>
            <div className="h-8 bg-gray-200 rounded w-32"></div>
          </div>
        ))}
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700">
        Impossibile caricare le statistiche
      </div>
    )
  }

  const cards = [
    {
      title: 'Spedizioni Totali',
      value: stats.totalShipments.toLocaleString('it-IT'),
      subtitle: `${stats.last30DaysShipments} ultimi 30gg`,
      icon: Package,
      color: 'blue',
    },
    {
      title: 'Ricavi Totali',
      value: `€${stats.totalRevenue.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
      subtitle: 'Importi addebitati',
      icon: DollarSign,
      color: 'green',
    },
    {
      title: 'Costi Provider',
      value: `€${stats.totalCost.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
      subtitle: 'Pagato ai corrieri',
      icon: CreditCard,
      color: 'orange',
    },
    {
      title: 'Margine Lordo',
      value: `€${stats.totalMargin.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
      subtitle: 'Profitto piattaforma',
      icon: stats.totalMargin >= 0 ? TrendingUp : TrendingDown,
      color: stats.totalMargin >= 0 ? 'emerald' : 'red',
    },
    {
      title: 'Margine Medio',
      value: `${stats.avgMarginPercent.toFixed(1)}%`,
      subtitle: 'Sul costo provider',
      icon: Percent,
      color: stats.avgMarginPercent >= 15 ? 'emerald' : stats.avgMarginPercent >= 5 ? 'yellow' : 'red',
    },
    {
      title: 'Da Riconciliare',
      value: stats.pendingReconciliation.toString(),
      subtitle: 'In attesa verifica',
      icon: Clock,
      color: stats.pendingReconciliation > 50 ? 'orange' : 'blue',
    },
    {
      title: 'Margini Negativi',
      value: stats.negativeMarginCount.toString(),
      subtitle: 'Spedizioni in perdita',
      icon: AlertTriangle,
      color: stats.negativeMarginCount > 0 ? 'red' : 'green',
    },
    {
      title: 'Ultimi 30 Giorni',
      value: stats.last30DaysShipments.toString(),
      subtitle: 'Nuove spedizioni',
      icon: Package,
      color: 'purple',
    },
  ]

  const colorClasses: Record<string, { bg: string; icon: string; text: string }> = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-900' },
    green: { bg: 'bg-green-50', icon: 'text-green-600', text: 'text-green-900' },
    orange: { bg: 'bg-orange-50', icon: 'text-orange-600', text: 'text-orange-900' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-900' },
    red: { bg: 'bg-red-50', icon: 'text-red-600', text: 'text-red-900' },
    yellow: { bg: 'bg-yellow-50', icon: 'text-yellow-600', text: 'text-yellow-900' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', text: 'text-purple-900' },
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, index) => {
        const colors = colorClasses[card.color]
        const Icon = card.icon
        
        return (
          <div 
            key={index}
            className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{card.title}</p>
                <p className={`text-2xl font-bold mt-1 ${colors.text}`}>{card.value}</p>
                <p className="text-xs text-gray-400 mt-1">{card.subtitle}</p>
              </div>
              <div className={`p-3 rounded-lg ${colors.bg}`}>
                <Icon className={`w-5 h-5 ${colors.icon}`} />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
