"use client";

import { TrendingDown, TrendingUp, Truck } from "lucide-react";
import { useMemo } from "react";

interface CourierMarginData {
  courier_code: string;
  total_shipments: number;
  total_revenue: number;
  total_cost: number;
  gross_margin: number;
  avg_margin_percent: number;
}

interface MarginByCourierChartProps {
  data: CourierMarginData[];
  isLoading: boolean;
}

export function MarginByCourierChart({
  data,
  isLoading,
}: MarginByCourierChartProps) {
  // Ordina per margine assoluto
  // IMPORTANTE: useMemo deve essere chiamato PRIMA degli early returns
  // per rispettare le regole di React Hooks
  const sortedData = useMemo(
    () =>
      data.length > 0
        ? [...data].sort((a, b) => b.gross_margin - a.gross_margin)
        : [],
    [data]
  );

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="h-6 bg-gray-200 rounded w-48 animate-pulse"></div>
        </div>
        <div className="p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-12 bg-gray-100 rounded animate-pulse"
            ></div>
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
            <Truck className="w-5 h-5 text-blue-500" />
            Margine per Corriere
          </h3>
        </div>
        <div className="p-12 text-center">
          <p className="text-gray-500">Nessun dato disponibile</p>
        </div>
      </div>
    );
  }

  const maxMargin = Math.max(...data.map((d) => Math.abs(d.gross_margin)));
  const totalMargin = data.reduce((sum, d) => sum + d.gross_margin, 0);

  // Mappa nomi corrieri per visualizzazione
  const courierNames: Record<string, string> = {
    brt: "BRT",
    gls: "GLS",
    dhl: "DHL",
    ups: "UPS",
    fedex: "FedEx",
    sda: "SDA",
    poste: "Poste Italiane",
    tnt: "TNT",
    nexive: "Nexive",
  };

  const getCourierName = (code: string) => {
    return courierNames[code.toLowerCase()] || code.toUpperCase();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Truck className="w-5 h-5 text-blue-500" />
            Margine per Corriere
          </h3>
          <div className="text-right">
            <p className="text-xs text-gray-400">Totale</p>
            <p
              className={`text-lg font-bold ${
                totalMargin >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              €
              {totalMargin.toLocaleString("it-IT", {
                minimumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
        {sortedData.map((courier) => {
          const isPositive = courier.gross_margin >= 0;
          const barWidth =
            maxMargin > 0
              ? (Math.abs(courier.gross_margin) / maxMargin) * 100
              : 0;

          return (
            <div key={courier.courier_code} className="group">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">
                    {getCourierName(courier.courier_code)}
                  </span>
                  <span className="text-xs text-gray-400">
                    {courier.total_shipments.toLocaleString("it-IT")} spedizioni
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
                      isPositive ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    €
                    {courier.gross_margin.toLocaleString("it-IT", {
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
                      ? "bg-gradient-to-r from-green-400 to-green-500"
                      : "bg-gradient-to-r from-red-400 to-red-500"
                  }`}
                  style={{ width: `${Math.max(barWidth, 3)}%` }}
                />
                <div className="absolute inset-0 flex items-center justify-between px-2 text-xs">
                  <span
                    className={`font-medium ${
                      barWidth > 30 ? "text-white" : "text-gray-600"
                    }`}
                  >
                    {courier.avg_margin_percent.toFixed(1)}%
                  </span>
                  <span
                    className={`font-medium ${
                      barWidth > 70 ? "text-white" : "text-gray-500"
                    }`}
                  >
                    €{courier.total_revenue.toLocaleString("it-IT")} ricavi
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
