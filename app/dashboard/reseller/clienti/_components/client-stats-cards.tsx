'use client';

import { Users, Wallet, Package, TrendingUp, FileText, AlertTriangle } from 'lucide-react';

interface ClientStatsCardsProps {
  stats: {
    totalClients: number;
    activeClients: number;
    totalWalletBalance: number;
    totalShipments: number;
    clientsWithListino: number;
    clientsWithoutListino: number;
    totalRevenue: number;
  } | null;
  isLoading: boolean;
}

export function ClientStatsCards({ stats, isLoading }: ClientStatsCardsProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white rounded-xl p-5 border border-gray-200 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-24 mb-3"></div>
            <div className="h-8 bg-gray-200 rounded w-20"></div>
          </div>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const cards = [
    {
      title: 'Totale Clienti',
      value: stats.totalClients.toString(),
      subtitle: `${stats.activeClients} attivi`,
      icon: Users,
      color: 'blue',
    },
    {
      title: 'Saldo Totale Wallet',
      value: `€${stats.totalWalletBalance.toLocaleString('it-IT', { minimumFractionDigits: 2 })}`,
      subtitle: 'Saldo aggregato clienti',
      icon: Wallet,
      color: 'green',
    },
    {
      title: 'Con Listino Assegnato',
      value: stats.clientsWithListino.toString(),
      subtitle:
        stats.clientsWithoutListino > 0
          ? `${stats.clientsWithoutListino} senza listino`
          : 'Tutti con listino',
      icon: FileText,
      color: stats.clientsWithoutListino > 0 ? 'amber' : 'emerald',
      alert: stats.clientsWithoutListino > 0,
    },
    {
      title: 'Spedizioni Totali',
      value: stats.totalShipments.toLocaleString('it-IT'),
      subtitle: `€${stats.totalRevenue.toLocaleString('it-IT')} fatturato`,
      icon: Package,
      color: 'purple',
    },
  ];

  const colorClasses: Record<string, { bg: string; icon: string; text: string }> = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600', text: 'text-blue-900' },
    green: { bg: 'bg-green-50', icon: 'text-green-600', text: 'text-green-900' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', text: 'text-amber-900' },
    emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', text: 'text-emerald-900' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', text: 'text-purple-900' },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, index) => {
        const colors = colorClasses[card.color];
        const Icon = card.icon;

        return (
          <div
            key={index}
            className={`bg-white rounded-xl p-5 border ${
              card.alert ? 'border-amber-300' : 'border-gray-200'
            } hover:shadow-md transition-shadow`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{card.title}</p>
                <p className={`text-2xl font-bold mt-1 ${colors.text}`}>{card.value}</p>
                <p
                  className={`text-xs mt-1 ${card.alert ? 'text-amber-600 font-medium' : 'text-gray-400'}`}
                >
                  {card.alert && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                  {card.subtitle}
                </p>
              </div>
              <div className={`p-3 rounded-lg ${colors.bg}`}>
                <Icon className={`w-5 h-5 ${colors.icon}`} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
