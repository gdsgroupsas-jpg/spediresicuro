'use client';

import { Users, Wallet, Package, TrendingUp } from 'lucide-react';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';

interface TeamStats {
  totalSubUsers: number;
  totalWalletBalance: number;
  totalShipments: number;
  totalRevenue: number;
  activeSubUsers: number;
}

interface TeamStatsCardsProps {
  stats: TeamStats;
  isLoading?: boolean;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: {
    value: number;
    label: string;
  };
  gradient: string;
  isLoading?: boolean;
}

function StatCard({ title, value, icon, trend, gradient, isLoading }: StatCardProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-12 w-12 bg-gray-200 rounded-xl" />
          <div className="h-6 w-16 bg-gray-200 rounded-full" />
        </div>
        <div className="h-4 w-24 bg-gray-200 rounded mb-2" />
        <div className="h-8 w-20 bg-gray-200 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300 overflow-hidden group">
      <div className={cn('h-1', gradient)} />
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div
            className={cn(
              'p-3 rounded-xl',
              gradient.replace('bg-gradient-to-r', 'bg-gradient-to-br'),
              'bg-opacity-10'
            )}
          >
            {icon}
          </div>
          {trend && (
            <span
              className={cn(
                'text-xs font-medium px-2.5 py-1 rounded-full',
                trend.value >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              )}
            >
              {trend.value >= 0 ? '+' : ''}
              {trend.value}% {trend.label}
            </span>
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function TeamStatsCards({ stats, isLoading }: TeamStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <StatCard
        title="Clienti Totali"
        value={formatNumber(stats.totalSubUsers)}
        icon={<Users className="h-6 w-6 text-blue-600" />}
        trend={{
          value:
            stats.activeSubUsers > 0
              ? Math.round((stats.activeSubUsers / stats.totalSubUsers) * 100)
              : 0,
          label: 'attivi',
        }}
        gradient="bg-gradient-to-r from-blue-500 to-indigo-500"
        isLoading={isLoading}
      />

      <StatCard
        title="Saldo Wallet Totale"
        value={formatCurrency(stats.totalWalletBalance || 0)}
        icon={<Wallet className="h-6 w-6 text-green-600" />}
        gradient="bg-gradient-to-r from-green-500 to-emerald-500"
        isLoading={isLoading}
      />

      <StatCard
        title="Spedizioni Totali"
        value={formatNumber(stats.totalShipments)}
        icon={<Package className="h-6 w-6 text-amber-600" />}
        gradient="bg-gradient-to-r from-amber-500 to-orange-500"
        isLoading={isLoading}
      />

      <StatCard
        title="Fatturato Totale"
        value={formatCurrency(stats.totalRevenue)}
        icon={<TrendingUp className="h-6 w-6 text-purple-600" />}
        gradient="bg-gradient-to-r from-purple-500 to-pink-500"
        isLoading={isLoading}
      />
    </div>
  );
}
