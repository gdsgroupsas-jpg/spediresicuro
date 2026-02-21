'use client';

/**
 * Pannello Analytics CRM — Componente condiviso tra admin leads e reseller prospects
 *
 * Visualizza 7 sezioni: KPI, Funnel, Score Distribution, Source, Sector, Zone, Time to Conversion
 * Accetta CrmAnalyticsData e un variant per colori/label differenti.
 */

import { useState, useEffect } from 'react';
import type { CrmAnalyticsData } from '@/lib/crm/analytics';
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
} from 'recharts';
import { TrendingUp, Target, Clock, BarChart3, Users, Percent } from 'lucide-react';

// ============================================
// COLORI
// ============================================

const FUNNEL_COLORS: Record<string, string> = {
  new: '#3b82f6',
  contacted: '#6366f1',
  qualified: '#f97316',
  negotiation: '#8b5cf6',
  won: '#22c55e',
  lost: '#6b7280',
};

const SCORE_COLORS = ['#ef4444', '#f97316', '#eab308', '#6b7280'];

const KPI_GRADIENTS = {
  admin: {
    conversion: 'bg-gradient-to-r from-purple-500 to-purple-600',
    pipeline: 'bg-gradient-to-r from-green-500 to-emerald-600',
    time: 'bg-gradient-to-r from-orange-500 to-amber-600',
    score: 'bg-gradient-to-r from-blue-500 to-indigo-600',
  },
  reseller: {
    conversion: 'bg-gradient-to-r from-indigo-500 to-indigo-600',
    pipeline: 'bg-gradient-to-r from-green-500 to-emerald-600',
    time: 'bg-gradient-to-r from-orange-500 to-amber-600',
    score: 'bg-gradient-to-r from-blue-500 to-cyan-600',
  },
};

// ============================================
// TIPI
// ============================================

interface CrmAnalyticsPanelProps {
  data: CrmAnalyticsData;
  variant: 'admin' | 'reseller';
}

// ============================================
// COMPONENTE PRINCIPALE
// ============================================

export default function CrmAnalyticsPanel({ data, variant }: CrmAnalyticsPanelProps) {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => setIsMounted(true), []);

  const gradients = KPI_GRADIENTS[variant];

  const formatPercent = (v: number) => `${(v * 100).toFixed(1)}%`;
  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    }).format(v);

  // Filtra sezioni vuote per prospect (senza source/zone)
  const hasSourceData = data.source_analysis.some((s) => s.source !== 'unknown');
  const hasZoneData = data.zone_analysis.some((z) => z.zone !== 'unknown');

  return (
    <div className="space-y-6">
      {/* SEZIONE 1: KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Tasso Conversione"
          value={formatPercent(data.kpi.conversion_rate)}
          subtitle={`${data.kpi.won} vinti / ${data.kpi.won + data.kpi.lost} decisi`}
          icon={<Percent className="w-5 h-5" />}
          gradient={gradients.conversion}
        />
        <KpiCard
          title="Valore Pipeline"
          value={formatCurrency(data.kpi.total_pipeline_value)}
          subtitle={`${data.kpi.active} entita attive`}
          icon={<TrendingUp className="w-5 h-5" />}
          gradient={gradients.pipeline}
        />
        <KpiCard
          title="Tempo Medio Conversione"
          value={
            data.kpi.avg_days_to_conversion > 0 ? `${data.kpi.avg_days_to_conversion} gg` : '-'
          }
          subtitle={data.kpi.won > 0 ? `Da ${data.kpi.won} conversioni` : 'Nessuna conversione'}
          icon={<Clock className="w-5 h-5" />}
          gradient={gradients.time}
        />
        <KpiCard
          title="Score Medio"
          value={data.kpi.avg_score > 0 ? data.kpi.avg_score.toFixed(1) : '-'}
          subtitle={`${data.kpi.total} entita totali`}
          icon={<Target className="w-5 h-5" />}
          gradient={gradients.score}
        />
      </div>

      {/* SEZIONE 2: Funnel Conversione */}
      <ChartCard
        title="Funnel Conversione"
        icon={<BarChart3 className="w-5 h-5 text-indigo-500" />}
      >
        <FunnelVisualization funnel={data.funnel} />
      </ChartCard>

      {/* SEZIONE 3 + 4: Score Distribution + Source (griglia 2 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Distribuzione Score"
          icon={<Target className="w-5 h-5 text-orange-500" />}
        >
          {isMounted ? (
            <ScoreDistributionChart distribution={data.score_distribution} />
          ) : (
            <ChartPlaceholder />
          )}
        </ChartCard>

        {hasSourceData ? (
          <ChartCard
            title="Performance per Fonte"
            icon={<Users className="w-5 h-5 text-blue-500" />}
          >
            {isMounted ? (
              <SourcePerformanceChart sources={data.source_analysis} />
            ) : (
              <ChartPlaceholder />
            )}
          </ChartCard>
        ) : (
          <ChartCard
            title="Performance per Fonte"
            icon={<Users className="w-5 h-5 text-blue-500" />}
          >
            <EmptySection message="Dati fonte non disponibili per i prospect" />
          </ChartCard>
        )}
      </div>

      {/* SEZIONE 5 + 6: Sector + Zone (griglia 2 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard
          title="Analisi per Settore"
          icon={<BarChart3 className="w-5 h-5 text-purple-500" />}
        >
          {data.sector_analysis.length > 0 &&
          data.sector_analysis.some((s) => s.sector !== 'unknown') ? (
            <SectorTable sectors={data.sector_analysis} />
          ) : (
            <EmptySection message="Nessun dato settore" />
          )}
        </ChartCard>

        {hasZoneData ? (
          <ChartCard
            title="Analisi per Zona"
            icon={<BarChart3 className="w-5 h-5 text-teal-500" />}
          >
            <ZoneTable zones={data.zone_analysis} />
          </ChartCard>
        ) : (
          <ChartCard
            title="Analisi per Zona"
            icon={<BarChart3 className="w-5 h-5 text-teal-500" />}
          >
            <EmptySection message="Dati zona non disponibili per i prospect" />
          </ChartCard>
        )}
      </div>

      {/* SEZIONE 7: Time to Conversion */}
      {data.time_to_conversion.avg_days > 0 && (
        <ChartCard title="Tempo a Conversione" icon={<Clock className="w-5 h-5 text-orange-500" />}>
          <TimeToConversionSection ttc={data.time_to_conversion} isMounted={isMounted} />
        </ChartCard>
      )}
    </div>
  );
}

// ============================================
// SOTTO-COMPONENTI
// ============================================

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  gradient,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  gradient: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
      <div className={`${gradient} p-3`}>
        <div className="flex items-center justify-between">
          <span className="text-white/90 text-xs font-medium">{title}</span>
          <span className="text-white/80">{icon}</span>
        </div>
      </div>
      <div className="p-4">
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
      </div>
    </div>
  );
}

function ChartCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 p-5 border-b border-gray-100">
        {icon}
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ChartPlaceholder() {
  return (
    <div className="h-[250px] flex items-center justify-center">
      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-300" />
    </div>
  );
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="h-[100px] flex items-center justify-center text-sm text-gray-400">
      {message}
    </div>
  );
}

// ============================================
// FUNNEL
// ============================================

function FunnelVisualization({ funnel }: { funnel: CrmAnalyticsData['funnel'] }) {
  const stages = [
    { key: 'new', label: 'Nuovi', count: funnel.new, color: FUNNEL_COLORS.new },
    {
      key: 'contacted',
      label: 'Contattati',
      count: funnel.contacted,
      color: FUNNEL_COLORS.contacted,
    },
    {
      key: 'qualified',
      label: 'Qualificati',
      count: funnel.qualified,
      color: FUNNEL_COLORS.qualified,
    },
    {
      key: 'negotiation',
      label: 'In Trattativa',
      count: funnel.negotiation,
      color: FUNNEL_COLORS.negotiation,
    },
    { key: 'won', label: 'Vinti', count: funnel.won, color: FUNNEL_COLORS.won },
    { key: 'lost', label: 'Persi', count: funnel.lost, color: FUNNEL_COLORS.lost },
  ];

  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="space-y-3">
      {stages.map((stage) => {
        const widthPercent = Math.max((stage.count / maxCount) * 100, 4);
        return (
          <div key={stage.key} className="flex items-center gap-3">
            <span className="text-xs font-medium text-gray-600 w-24 text-right shrink-0">
              {stage.label}
            </span>
            <div className="flex-1 h-7 bg-gray-100 rounded-lg overflow-hidden relative">
              <div
                className="h-full rounded-lg transition-all duration-700"
                style={{ width: `${widthPercent}%`, backgroundColor: stage.color }}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-700">
                {stage.count}
              </span>
            </div>
          </div>
        );
      })}

      {/* Dropoff indicators */}
      <div className="flex gap-4 mt-2 text-xs">
        <span className="text-red-500">
          Dropoff Nuovo→Contattato: {(funnel.dropoff_new_to_contacted * 100).toFixed(0)}%
        </span>
        <span className="text-red-500">
          Dropoff Contattato→Vinto: {(funnel.dropoff_contacted_to_won * 100).toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

// ============================================
// SCORE DISTRIBUTION
// ============================================

function ScoreDistributionChart({
  distribution,
}: {
  distribution: CrmAnalyticsData['score_distribution'];
}) {
  const data = [
    { name: 'Hot (≥80)', value: distribution.hot },
    { name: 'Warm (60-79)', value: distribution.warm },
    { name: 'Cold (40-59)', value: distribution.cold },
    { name: 'Very Cold (<40)', value: distribution.very_cold },
  ];

  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <EmptySection message="Nessuna entita attiva per la distribuzione" />;

  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          dataKey="value"
          label={({ name, value }) => `${name}: ${value}`}
          labelLine={false}
        >
          {data.map((_, i) => (
            <Cell key={`cell-${i}`} fill={SCORE_COLORS[i]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [value, 'Entita']} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ============================================
// SOURCE PERFORMANCE
// ============================================

function SourcePerformanceChart({ sources }: { sources: CrmAnalyticsData['source_analysis'] }) {
  if (sources.length === 0) return <EmptySection message="Nessun dato fonte" />;

  const chartData = sources.map((s) => ({
    name: s.label,
    Totali: s.total,
    Vinti: s.won,
  }));

  return (
    <ResponsiveContainer width="100%" height={250}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey="Totali" fill="#3b82f6" radius={[4, 4, 0, 0]} />
        <Bar dataKey="Vinti" fill="#22c55e" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============================================
// SECTOR TABLE
// ============================================

function SectorTable({ sectors }: { sectors: CrmAnalyticsData['sector_analysis'] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50 text-gray-500 text-xs">
          <tr>
            <th className="px-3 py-2 font-medium">Settore</th>
            <th className="px-3 py-2 font-medium text-right">Tot.</th>
            <th className="px-3 py-2 font-medium text-right">Vinti</th>
            <th className="px-3 py-2 font-medium text-right">Conv.</th>
            <th className="px-3 py-2 font-medium text-right">Vol. medio</th>
            <th className="px-3 py-2 font-medium text-right">Score medio</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {sectors.map((s) => (
            <tr key={s.sector} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-medium text-gray-900">{s.label}</td>
              <td className="px-3 py-2 text-right text-gray-600">{s.total}</td>
              <td className="px-3 py-2 text-right text-green-600 font-medium">{s.won}</td>
              <td className="px-3 py-2 text-right text-gray-600">
                {(s.conversion_rate * 100).toFixed(0)}%
              </td>
              <td className="px-3 py-2 text-right text-gray-600">
                {s.avg_volume > 0 ? Math.round(s.avg_volume) : '-'}
              </td>
              <td className="px-3 py-2 text-right text-gray-600">{s.avg_score.toFixed(0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// ZONE TABLE
// ============================================

function ZoneTable({ zones }: { zones: CrmAnalyticsData['zone_analysis'] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50 text-gray-500 text-xs">
          <tr>
            <th className="px-3 py-2 font-medium">Zona</th>
            <th className="px-3 py-2 font-medium text-right">Totali</th>
            <th className="px-3 py-2 font-medium text-right">Vinti</th>
            <th className="px-3 py-2 font-medium text-right">Conversione</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {zones.map((z) => (
            <tr key={z.zone} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-medium text-gray-900">{z.label}</td>
              <td className="px-3 py-2 text-right text-gray-600">{z.total}</td>
              <td className="px-3 py-2 text-right text-green-600 font-medium">{z.won}</td>
              <td className="px-3 py-2 text-right text-gray-600">
                {(z.conversion_rate * 100).toFixed(0)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================
// TIME TO CONVERSION
// ============================================

function TimeToConversionSection({
  ttc,
  isMounted,
}: {
  ttc: CrmAnalyticsData['time_to_conversion'];
  isMounted: boolean;
}) {
  return (
    <div className="space-y-4">
      {/* Mini stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Media" value={`${ttc.avg_days} gg`} />
        <MiniStat label="Minimo" value={`${ttc.min_days} gg`} />
        <MiniStat label="Massimo" value={`${ttc.max_days} gg`} />
        <MiniStat label="Mediana" value={`${ttc.median_days} gg`} />
      </div>

      {/* Chart by source */}
      {isMounted && ttc.by_source.length > 0 && (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={ttc.by_source.map((s) => ({ name: s.label, 'Giorni medi': s.avg_days }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} />
            <Tooltip formatter={(value) => [`${value} giorni`, 'Tempo medio']} />
            <Bar dataKey="Giorni medi" fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-bold text-gray-900">{value}</div>
    </div>
  );
}
