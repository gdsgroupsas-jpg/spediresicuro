'use client';

import { TrendingDown, TrendingUp, Server } from 'lucide-react';
import { useMemo } from 'react';

import type { ResellerProviderMarginData } from '@/types/reseller-fiscal';

interface ResellerProviderChartProps {
  data: ResellerProviderMarginData[];
  isLoading: boolean;
}

export function ResellerProviderChart({ data, isLoading }: ResellerProviderChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="p-6 space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse"></div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Server className="w-5 h-5 text-orange-500" />
            Margine per Fornitore
          </h3>
        </div>
        <div className="p-12 text-center">
          <p className="text-gray-500">Nessun dato per-fornitore disponibile per questo periodo.</p>
          <p className="text-xs text-gray-400 mt-1">
            I dati appariranno dopo le prime spedizioni dei tuoi clienti con tracking config.
          </p>
        </div>
      </div>
    );
  }

  const maxMargin = Math.max(...data.map((d) => Math.abs(d.gross_margin)), 1);
  const totalMargin = data.reduce((sum, d) => sum + d.gross_margin, 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Server className="w-5 h-5 text-orange-500" />
            Margine per Fornitore
          </h3>
          <div className="text-right">
            <p className="text-xs text-gray-400">Totale</p>
            <p
              className={`text-lg font-bold ${
                totalMargin >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              €
              {totalMargin.toLocaleString('it-IT', {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
        {data.map((provider) => {
          const isPositive = provider.gross_margin >= 0;
          const barWidth = maxMargin > 0 ? (Math.abs(provider.gross_margin) / maxMargin) * 100 : 0;

          return (
            <div key={provider.config_id} className="group">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    {provider.provider_name}
                  </span>
                  <span className="text-xs text-gray-400">
                    {provider.total_shipments.toLocaleString('it-IT')} spedizioni
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isPositive ? (
                    <TrendingUp className="w-4 h-4 text-green-500" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  )}
                  <span
                    className={`text-sm font-bold ${
                      isPositive ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    €
                    {provider.gross_margin.toLocaleString('it-IT', {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>

              <div className="h-5 bg-gray-100 rounded-md overflow-hidden relative">
                <div
                  className={`h-full rounded-md transition-all duration-500 ${
                    isPositive
                      ? 'bg-gradient-to-r from-orange-400 to-orange-500'
                      : 'bg-gradient-to-r from-red-400 to-red-500'
                  }`}
                  style={{ width: `${Math.max(barWidth, 3)}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-2 text-xs">
                  <span className={`font-medium ${barWidth > 30 ? 'text-white' : 'text-gray-600'}`}>
                    {provider.avg_margin_percent.toFixed(1)}%
                  </span>
                  <span className={`font-medium ${barWidth > 70 ? 'text-white' : 'text-gray-500'}`}>
                    €{provider.total_revenue.toLocaleString('it-IT')} ricavi
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
