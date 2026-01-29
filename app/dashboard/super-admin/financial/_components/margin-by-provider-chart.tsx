'use client';

import { TrendingDown, TrendingUp, Server } from 'lucide-react';
import { useMemo, useState } from 'react';

interface ProviderMarginData {
  config_id: string;
  provider_name: string;
  owner_label: string;
  is_platform: boolean;
  total_shipments: number;
  total_revenue: number;
  total_cost: number;
  gross_margin: number;
  avg_margin_percent: number;
}

type FilterType = 'all' | 'platform' | 'reseller';

interface MarginByProviderChartProps {
  data: ProviderMarginData[];
  isLoading: boolean;
}

export function MarginByProviderChart({ data, isLoading }: MarginByProviderChartProps) {
  const [filter, setFilter] = useState<FilterType>('all');

  const hasBothTypes = useMemo(
    () => data.some((d) => d.is_platform) && data.some((d) => !d.is_platform),
    [data]
  );

  const filteredData = useMemo(() => {
    if (filter === 'platform') return data.filter((d) => d.is_platform);
    if (filter === 'reseller') return data.filter((d) => !d.is_platform);
    return data;
  }, [data, filter]);

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
            <Server className="w-5 h-5 text-purple-500" />
            Margine per Fornitore
          </h3>
        </div>
        <div className="p-12 text-center">
          <p className="text-gray-500">Nessun dato per-fornitore disponibile.</p>
          <p className="text-xs text-gray-400 mt-1">
            I dati appariranno dopo le prime spedizioni con tracking config.
          </p>
        </div>
      </div>
    );
  }

  const maxMargin = Math.max(...filteredData.map((d) => Math.abs(d.gross_margin)), 1);
  const totalMargin = filteredData.reduce((sum, d) => sum + d.gross_margin, 0);

  const filterButtons: { key: FilterType; label: string }[] = [
    { key: 'all', label: 'Tutti' },
    { key: 'platform', label: 'Piattaforma' },
    { key: 'reseller', label: 'Reseller/BYOC' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Server className="w-5 h-5 text-purple-500" />
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

        {hasBothTypes && (
          <div className="flex gap-1 mt-3">
            {filterButtons.map((btn) => (
              <button
                key={btn.key}
                onClick={() => setFilter(btn.key)}
                className={`text-xs px-3 py-1 rounded-full transition-colors ${
                  filter === btn.key
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {btn.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
        {filteredData.map((provider) => {
          const isPositive = provider.gross_margin >= 0;
          const barWidth = maxMargin > 0 ? (Math.abs(provider.gross_margin) / maxMargin) * 100 : 0;

          return (
            <div key={provider.config_id} className="group">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    {provider.provider_name}
                  </span>
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                      provider.is_platform
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {provider.owner_label}
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

              {/* Progress bar */}
              <div className="h-5 bg-gray-100 rounded-md overflow-hidden relative">
                <div
                  className={`h-full rounded-md transition-all duration-500 ${
                    isPositive
                      ? provider.is_platform
                        ? 'bg-gradient-to-r from-purple-400 to-purple-500'
                        : 'bg-gradient-to-r from-amber-400 to-amber-500'
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
