'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { FiscalContext } from '@/lib/agent/fiscal-data.types';

interface RevenueChartProps {
  fiscalContext?: FiscalContext;
  isLoading?: boolean;
}

interface ChartDataPoint {
  day: string;
  revenue: number;
  costs: number;
  margin: number;
}

export function RevenueChart({ fiscalContext, isLoading }: RevenueChartProps) {
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!fiscalContext?.shipmentsSummary) {
      // Mock data for loading state
      return generateMockData();
    }

    // In a real implementation, we'd fetch daily breakdown data
    // For now, we'll generate realistic data based on totals
    return generateDataFromContext(fiscalContext);
  }, [fiscalContext]);

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-48 w-full bg-slate-700/30 rounded"></div>
          <div className="flex gap-4">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="h-3 w-12 bg-slate-700/30 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.3} />
          <XAxis
            dataKey="day"
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
          />
          <YAxis
            stroke="#94a3b8"
            tick={{ fill: '#94a3b8', fontSize: 12 }}
            tickFormatter={(value) => `€${value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1e293b',
              border: '1px solid #334155',
              borderRadius: '8px',
              color: '#f1f5f9',
            }}
            formatter={(value: number) => [`€${value.toFixed(2)}`, '']}
            labelStyle={{ color: '#cbd5e1' }}
          />
          <Legend
            wrapperStyle={{ color: '#cbd5e1' }}
            iconType="circle"
            formatter={(value) => {
              const labels: Record<string, string> = {
                revenue: 'Ricavi',
                costs: 'Costi',
                margin: 'Margine',
              };
              return labels[value] || value;
            }}
          />
          <Bar dataKey="revenue" fill="#6366f1" radius={[8, 8, 0, 0]} />
          <Bar dataKey="costs" fill="#ef4444" radius={[8, 8, 0, 0]} />
          <Bar dataKey="margin" fill="#10b981" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function generateMockData(): ChartDataPoint[] {
  const days = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  return days.map((day) => {
    const revenue = Math.random() * 2000 + 500;
    const costs = revenue * (0.6 + Math.random() * 0.2); // 60-80% of revenue
    return {
      day,
      revenue: Math.round(revenue * 100) / 100,
      costs: Math.round(costs * 100) / 100,
      margin: Math.round((revenue - costs) * 100) / 100,
    };
  });
}

function generateDataFromContext(context: FiscalContext): ChartDataPoint[] {
  const days = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
  const totalRevenue = context.shipmentsSummary.total_revenue;
  const totalMargin = context.shipmentsSummary.total_margin;
  const totalCosts = totalRevenue - totalMargin;

  // Distribute data across 7 days with realistic variance
  const avgRevenue = totalRevenue / 7;
  const avgCosts = totalCosts / 7;
  const avgMargin = totalMargin / 7;

  return days.map((day, index) => {
    // Add variance based on day (weekends lower, weekdays higher)
    const isWeekend = index >= 5;
    const variance = isWeekend ? 0.7 : 1.0 + (Math.random() * 0.4 - 0.2);

    const revenue = avgRevenue * variance;
    const costs = avgCosts * variance;
    const margin = avgMargin * variance;

    return {
      day,
      revenue: Math.round(revenue * 100) / 100,
      costs: Math.round(costs * 100) / 100,
      margin: Math.round(margin * 100) / 100,
    };
  });
}
