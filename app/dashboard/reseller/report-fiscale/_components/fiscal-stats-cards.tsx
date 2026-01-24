'use client';

/**
 * Fiscal Stats Cards
 *
 * Cards riepilogo KPI per il report fiscale reseller.
 */

import { Euro, FileText, TrendingUp, Receipt } from 'lucide-react';
import type { MonthlyFiscalSummary } from '@/types/reseller-fiscal';

interface FiscalStatsCardsProps {
  data: MonthlyFiscalSummary | null;
  isLoading?: boolean;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
  }).format(value);
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  isLoading,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color: string;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className={`rounded-lg p-2.5 ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <div className="h-4 w-20 animate-pulse rounded bg-gray-200" />
            <div className="mt-2 h-6 w-24 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2.5 ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-xl font-semibold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

export function FiscalStatsCards({ data, isLoading }: FiscalStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Totale Lordo"
        value={data ? formatCurrency(data.total_gross) : '-'}
        icon={Euro}
        color="bg-blue-500"
        isLoading={isLoading}
      />
      <StatCard
        label="Imponibile (Netto)"
        value={data ? formatCurrency(data.total_net) : '-'}
        icon={Receipt}
        color="bg-green-500"
        isLoading={isLoading}
      />
      <StatCard
        label="IVA 22%"
        value={data ? formatCurrency(data.total_vat) : '-'}
        icon={FileText}
        color="bg-orange-500"
        isLoading={isLoading}
      />
      <StatCard
        label="Margine Totale"
        value={data && data.total_margin !== null ? formatCurrency(data.total_margin) : 'N/A'}
        icon={TrendingUp}
        color="bg-purple-500"
        isLoading={isLoading}
      />
    </div>
  );
}
