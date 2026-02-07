'use client';

/**
 * Dashboard Analytics per preventivi commerciali.
 *
 * KPI, funnel conversione, analisi margini, performance corriere/settore, timeline.
 * Pattern: isMounted guard per SSR + Recharts.
 */

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getQuoteAnalyticsAction } from '@/actions/commercial-quotes';
import { formatCurrency } from '@/lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';
import { TrendingUp, Percent, Clock, DollarSign, Loader2, AlertTriangle } from 'lucide-react';
import type { QuoteAnalyticsData } from '@/types/commercial-quotes';

// ============================================
// COLORI CHART
// ============================================

const CHART_COLORS = {
  primary: '#6366f1', // indigo
  success: '#10b981', // emerald
  warning: '#f59e0b', // amber
  danger: '#ef4444', // red
  info: '#3b82f6', // blue
  muted: '#9ca3af', // gray
};

const PIE_COLORS = [
  '#6366f1',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#64748b',
];

// ============================================
// COMPONENTE PRINCIPALE
// ============================================

interface QuoteAnalyticsProps {
  refreshTrigger?: number;
}

export function QuoteAnalytics({ refreshTrigger }: QuoteAnalyticsProps) {
  const [data, setData] = useState<QuoteAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getQuoteAnalyticsAction();
    if (result.success && result.data) {
      setData(result.data);
    } else {
      setError(result.error || 'Errore caricamento analytics');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, refreshTrigger]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-20 text-red-600 gap-2">
        <AlertTriangle className="h-5 w-5" />
        <span>{error}</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <KPICards kpi={data.kpi} />

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Funnel */}
        <Card hover={false}>
          <CardHeader>
            <CardTitle>Funnel Conversione</CardTitle>
          </CardHeader>
          <CardContent>
            {isMounted ? <FunnelChart funnel={data.funnel} /> : <ChartSkeleton />}
          </CardContent>
        </Card>

        {/* Margini */}
        <Card hover={false}>
          <CardHeader>
            <CardTitle>Analisi Margini</CardTitle>
          </CardHeader>
          <CardContent>
            {isMounted ? <MarginChart margin={data.margin_analysis} /> : <ChartSkeleton />}
          </CardContent>
        </Card>

        {/* Performance Corrieri */}
        <Card hover={false}>
          <CardHeader>
            <CardTitle>Performance per Corriere</CardTitle>
          </CardHeader>
          <CardContent>
            {isMounted ? <CarrierChart carriers={data.carrier_performance} /> : <ChartSkeleton />}
          </CardContent>
        </Card>

        {/* Performance Settori */}
        <Card hover={false}>
          <CardHeader>
            <CardTitle>Performance per Settore</CardTitle>
          </CardHeader>
          <CardContent>
            {isMounted ? <SectorChart sectors={data.sector_performance} /> : <ChartSkeleton />}
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card hover={false}>
        <CardHeader>
          <CardTitle>Trend Preventivi</CardTitle>
        </CardHeader>
        <CardContent>
          {isMounted ? <TimelineChart timeline={data.timeline} /> : <ChartSkeleton height={200} />}
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================
// KPI STAT CARDS
// ============================================

function KPICards({ kpi }: { kpi: QuoteAnalyticsData['kpi'] }) {
  const cards = [
    {
      label: 'Tasso Conversione',
      value: `${(kpi.conversion_rate * 100).toFixed(1)}%`,
      subtitle: `${kpi.total_accepted} accettati su ${kpi.total_accepted + kpi.total_rejected} con esito`,
      icon: TrendingUp,
      gradient: 'from-emerald-500 to-green-600',
      iconBg: 'bg-emerald-100 text-emerald-600',
    },
    {
      label: 'Margine Medio Accettati',
      value: `${kpi.average_margin_accepted.toFixed(1)}%`,
      subtitle: `Su ${kpi.total_accepted} preventivi accettati`,
      icon: Percent,
      gradient: 'from-blue-500 to-indigo-600',
      iconBg: 'bg-blue-100 text-blue-600',
    },
    {
      label: 'Giorni Medi Chiusura',
      value: kpi.average_days_to_close.toFixed(1),
      subtitle: 'Dal invio alla risposta',
      icon: Clock,
      gradient: 'from-purple-500 to-violet-600',
      iconBg: 'bg-purple-100 text-purple-600',
    },
    {
      label: 'Valore Convertito',
      value: formatCurrency(kpi.total_revenue_value),
      subtitle: `${kpi.total_quotes} preventivi totali`,
      icon: DollarSign,
      gradient: 'from-amber-500 to-orange-600',
      iconBg: 'bg-amber-100 text-amber-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.label} hover={false} className="relative overflow-hidden">
          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${card.gradient}`} />
          <CardContent className="pt-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                <p className="text-xs text-gray-400 mt-1">{card.subtitle}</p>
              </div>
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${card.iconBg}`}
              >
                <card.icon className="h-5 w-5" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================
// CHART: Funnel Conversione
// ============================================

function FunnelChart({ funnel }: { funnel: QuoteAnalyticsData['funnel'] }) {
  const chartData = [
    { step: 'Creati', count: funnel.created, fill: CHART_COLORS.muted },
    { step: 'Inviati', count: funnel.sent, fill: CHART_COLORS.info },
    { step: 'In trattativa', count: funnel.negotiating, fill: CHART_COLORS.warning },
    { step: 'Accettati', count: funnel.accepted, fill: CHART_COLORS.success },
  ];

  if (funnel.created === 0) {
    return <EmptyState message="Nessun preventivo ancora creato" />;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" />
        <YAxis dataKey="step" type="category" width={100} tick={{ fontSize: 12 }} />
        <Tooltip
          formatter={(value) => [value ?? 0, 'Preventivi']}
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, idx) => (
            <Cell key={idx} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============================================
// CHART: Analisi Margini
// ============================================

function MarginChart({ margin }: { margin: QuoteAnalyticsData['margin_analysis'] }) {
  if (margin.data_points.length === 0) {
    return <EmptyState message="Nessun preventivo con esito per analisi margini" />;
  }

  const chartData = [
    {
      label: 'Accettati',
      margine: margin.avg_margin_accepted,
      fill: CHART_COLORS.success,
    },
    {
      label: 'Rifiutati',
      margine: margin.avg_margin_rejected,
      fill: CHART_COLORS.danger,
    },
  ];

  return (
    <div>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="label" />
          <YAxis tickFormatter={(v) => `${v}%`} />
          <Tooltip
            formatter={(value) => [
              `${(typeof value === 'number' ? value : 0).toFixed(1)}%`,
              'Margine medio',
            ]}
            contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
          />
          <Bar dataKey="margine" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, idx) => (
              <Cell key={idx} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center justify-center gap-6 mt-2 text-xs text-gray-500">
        <span>
          Originale medio: <strong>{margin.average_original_margin.toFixed(1)}%</strong>
        </span>
        <span>
          Finale medio: <strong>{margin.average_final_margin.toFixed(1)}%</strong>
        </span>
        <span>
          Delta:{' '}
          <strong className={margin.average_delta >= 0 ? 'text-green-600' : 'text-red-600'}>
            {margin.average_delta >= 0 ? '+' : ''}
            {margin.average_delta.toFixed(1)}%
          </strong>
        </span>
      </div>
    </div>
  );
}

// ============================================
// CHART: Performance Corrieri
// ============================================

function CarrierChart({ carriers }: { carriers: QuoteAnalyticsData['carrier_performance'] }) {
  if (carriers.length === 0) {
    return <EmptyState message="Nessun dato per corriere" />;
  }

  const chartData = carriers.map((c) => ({
    name: c.carrier_display_name,
    accettati: c.accepted,
    rifiutati: c.rejected,
    tasso: Math.round(c.acceptance_rate * 100),
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
        <YAxis />
        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
        <Legend />
        <Bar
          dataKey="accettati"
          fill={CHART_COLORS.success}
          name="Accettati"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="rifiutati"
          fill={CHART_COLORS.danger}
          name="Rifiutati"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============================================
// CHART: Performance Settori
// ============================================

function SectorChart({ sectors }: { sectors: QuoteAnalyticsData['sector_performance'] }) {
  if (sectors.length === 0) {
    return <EmptyState message="Nessun dato per settore" />;
  }

  const chartData = sectors.map((s) => ({
    name: s.sector_label,
    value: s.total_quotes,
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          outerRadius={90}
          dataKey="value"
          label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
        >
          {chartData.map((_entry, idx) => (
            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => [value ?? 0, 'Preventivi']}
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ============================================
// CHART: Timeline
// ============================================

function TimelineChart({ timeline }: { timeline: QuoteAnalyticsData['timeline'] }) {
  if (timeline.length === 0) {
    return <EmptyState message="Nessun dato temporale disponibile" />;
  }

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={timeline} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period_label" tick={{ fontSize: 11 }} />
        <YAxis />
        <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb' }} />
        <Legend />
        <Line
          type="monotone"
          dataKey="created"
          stroke={CHART_COLORS.muted}
          name="Creati"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="sent"
          stroke={CHART_COLORS.info}
          name="Inviati"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="accepted"
          stroke={CHART_COLORS.success}
          name="Accettati"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="rejected"
          stroke={CHART_COLORS.danger}
          name="Rifiutati"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ============================================
// HELPERS UI
// ============================================

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-48 text-gray-400 text-sm">{message}</div>
  );
}

function ChartSkeleton({ height = 250 }: { height?: number }) {
  return <div className="animate-pulse bg-gray-100 rounded-lg" style={{ height }} />;
}
