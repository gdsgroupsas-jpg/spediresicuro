/**
 * Business Metrics Dashboard - M4 Implementation
 *
 * Visualizzazione completa delle metriche business con grafici.
 * Dati in tempo reale da /api/metrics/business
 */

'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardNav from '@/components/dashboard-nav';
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Package,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
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

interface BusinessMetrics {
  timestamp: string;
  shipments: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    byStatus: Record<string, number>;
    successRate: number;
    averageCost: number;
  };
  revenue: {
    total: number;
    today: number;
    thisWeek: number;
    thisMonth: number;
    averageMargin: number;
  };
  users: {
    total: number;
    active30d: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
  };
  wallet: {
    totalBalance: number;
    transactionsToday: number;
    topupsPending: number;
    topupsApprovedToday: number;
    averageTopupAmount: number;
    byType: Record<string, number>;
  };
}

// Colors for charts
const COLORS = {
  delivered: '#22c55e',
  pending: '#eab308',
  in_transit: '#3b82f6',
  shipped: '#3b82f6',
  failed: '#ef4444',
  cancelled: '#6b7280',
  draft: '#9ca3af',
  returned: '#f97316',
};

const PIE_COLORS = ['#22c55e', '#eab308', '#3b82f6', '#ef4444', '#6b7280', '#f97316', '#8b5cf6'];

export default function MetricsDashboardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch metrics
  async function fetchMetrics() {
    try {
      setIsRefreshing(true);
      const response = await fetch('/api/metrics/business');

      if (response.status === 401 || response.status === 403) {
        setError('Accesso negato. Solo admin possono visualizzare le metriche.');
        return;
      }

      if (!response.ok) {
        throw new Error('Errore nel caricamento delle metriche');
      }

      const data = await response.json();
      if (data.success) {
        setMetrics(data.data);
        setLastUpdated(new Date());
      } else {
        throw new Error(data.error || 'Errore sconosciuto');
      }
    } catch (err: any) {
      console.error('Error fetching metrics:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  // Initial load
  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
    fetchMetrics();
  }, [session, status, router]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const interval = setInterval(fetchMetrics, 60000);
    return () => clearInterval(interval);
  }, []);

  // Format currency
  function formatCurrency(value: number): string {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR',
    }).format(value);
  }

  // Format percentage
  function formatPercent(value: number): string {
    return `${(value * 100).toFixed(1)}%`;
  }

  // Format number
  function formatNumber(value: number): string {
    return new Intl.NumberFormat('it-IT').format(value);
  }

  // Stat Card component
  function StatCard({
    title,
    value,
    subtitle,
    icon,
    trend,
    trendLabel,
    gradient,
  }: {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    trend?: 'up' | 'down' | 'neutral';
    trendLabel?: string;
    gradient: string;
  }) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
        <div className={`${gradient} p-4`}>
          <div className="flex items-center justify-between">
            <span className="text-white/90 text-sm font-medium">{title}</span>
            <span className="text-white/80">{icon}</span>
          </div>
        </div>
        <div className="p-5">
          <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
          {subtitle && <div className="text-sm text-gray-500">{subtitle}</div>}
          {trendLabel && (
            <div
              className={`text-sm mt-2 ${
                trend === 'up'
                  ? 'text-green-600'
                  : trend === 'down'
                    ? 'text-red-600'
                    : 'text-gray-500'
              }`}
            >
              {trend === 'up' && '↑ '}
              {trend === 'down' && '↓ '}
              {trendLabel}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Loading state
  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Caricamento metriche business...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <DashboardNav title="Business Metrics" subtitle="Errore" showBackButton={true} />
          <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-8 text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Errore</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            <Link
              href="/dashboard/admin"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Torna all&apos;Admin Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  // Prepare chart data
  const statusChartData = Object.entries(metrics.shipments.byStatus).map(([status, count]) => ({
    name: status.replace('_', ' ').charAt(0).toUpperCase() + status.replace('_', ' ').slice(1),
    value: count,
    color: COLORS[status as keyof typeof COLORS] || '#6b7280',
  }));

  const revenueChartData = [
    { name: 'Oggi', revenue: metrics.revenue.today },
    { name: 'Settimana', revenue: metrics.revenue.thisWeek },
    { name: 'Mese', revenue: metrics.revenue.thisMonth },
    { name: 'Totale', revenue: metrics.revenue.total },
  ];

  const userGrowthData = [
    { name: 'Oggi', users: metrics.users.newToday },
    { name: 'Settimana', users: metrics.users.newThisWeek },
    { name: 'Mese', users: metrics.users.newThisMonth },
  ];

  const walletTypeData = Object.entries(metrics.wallet.byType).map(([type, count], index) => ({
    name: type.replace('_', ' '),
    value: count,
    color: PIE_COLORS[index % PIE_COLORS.length],
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-cyan-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Navigation */}
        <DashboardNav
          title="Business Metrics Dashboard"
          subtitle="M4 - Metriche e KPI in tempo reale"
          showBackButton={true}
        />

        {/* Header with refresh */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-xl">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Metriche Business</h1>
              {lastUpdated && (
                <p className="text-sm text-gray-500">
                  Ultimo aggiornamento: {lastUpdated.toLocaleTimeString('it-IT')}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchMetrics}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Aggiorna
            </button>
            <Link
              href="/api/metrics/prometheus"
              target="_blank"
              className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              Prometheus
            </Link>
          </div>
        </div>

        {/* Quick Stats - Row 1: Shipments */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" />
            Spedizioni
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Totale Spedizioni"
              value={formatNumber(metrics.shipments.total)}
              subtitle={`${formatNumber(metrics.shipments.today)} oggi`}
              icon={<Package className="w-5 h-5" />}
              gradient="bg-gradient-to-r from-blue-500 to-blue-600"
            />
            <StatCard
              title="Tasso di Successo"
              value={formatPercent(metrics.shipments.successRate)}
              subtitle="Spedizioni consegnate"
              icon={<CheckCircle2 className="w-5 h-5" />}
              trend={
                metrics.shipments.successRate > 0.9
                  ? 'up'
                  : metrics.shipments.successRate < 0.8
                    ? 'down'
                    : 'neutral'
              }
              gradient="bg-gradient-to-r from-green-500 to-green-600"
            />
            <StatCard
              title="Costo Medio"
              value={formatCurrency(metrics.shipments.averageCost)}
              subtitle="Per spedizione"
              icon={<DollarSign className="w-5 h-5" />}
              gradient="bg-gradient-to-r from-purple-500 to-purple-600"
            />
            <StatCard
              title="Questo Mese"
              value={formatNumber(metrics.shipments.thisMonth)}
              subtitle={`${formatNumber(metrics.shipments.thisWeek)} questa settimana`}
              icon={<TrendingUp className="w-5 h-5" />}
              gradient="bg-gradient-to-r from-cyan-500 to-cyan-600"
            />
          </div>
        </div>

        {/* Quick Stats - Row 2: Revenue */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Fatturato
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Fatturato Totale"
              value={formatCurrency(metrics.revenue.total)}
              icon={<DollarSign className="w-5 h-5" />}
              gradient="bg-gradient-to-r from-emerald-500 to-emerald-600"
            />
            <StatCard
              title="Oggi"
              value={formatCurrency(metrics.revenue.today)}
              icon={<Activity className="w-5 h-5" />}
              gradient="bg-gradient-to-r from-teal-500 to-teal-600"
            />
            <StatCard
              title="Questa Settimana"
              value={formatCurrency(metrics.revenue.thisWeek)}
              icon={<TrendingUp className="w-5 h-5" />}
              gradient="bg-gradient-to-r from-green-500 to-green-600"
            />
            <StatCard
              title="Margine Medio"
              value={formatPercent(metrics.revenue.averageMargin)}
              subtitle="Su vendite"
              icon={<BarChart3 className="w-5 h-5" />}
              gradient="bg-gradient-to-r from-lime-500 to-lime-600"
            />
          </div>
        </div>

        {/* Quick Stats - Row 3: Users & Wallet */}
        <div className="mb-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Users */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Utenti
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                title="Totale Utenti"
                value={formatNumber(metrics.users.total)}
                subtitle={`${formatNumber(metrics.users.active30d)} attivi`}
                icon={<Users className="w-5 h-5" />}
                gradient="bg-gradient-to-r from-indigo-500 to-indigo-600"
              />
              <StatCard
                title="Nuovi Oggi"
                value={formatNumber(metrics.users.newToday)}
                subtitle={`${formatNumber(metrics.users.newThisMonth)} questo mese`}
                icon={<TrendingUp className="w-5 h-5" />}
                gradient="bg-gradient-to-r from-violet-500 to-violet-600"
              />
            </div>
          </div>

          {/* Wallet */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5" />
              Wallet
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <StatCard
                title="Saldo Totale"
                value={formatCurrency(metrics.wallet.totalBalance)}
                icon={<Wallet className="w-5 h-5" />}
                gradient="bg-gradient-to-r from-amber-500 to-amber-600"
              />
              <StatCard
                title="Top-up Pendenti"
                value={formatNumber(metrics.wallet.topupsPending)}
                subtitle={`${formatNumber(metrics.wallet.topupsApprovedToday)} approvati oggi`}
                icon={<Clock className="w-5 h-5" />}
                trend={
                  metrics.wallet.topupsPending > 10
                    ? 'down'
                    : metrics.wallet.topupsPending > 5
                      ? 'neutral'
                      : 'up'
                }
                gradient="bg-gradient-to-r from-orange-500 to-orange-600"
              />
            </div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Shipments by Status Pie Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Spedizioni per Status</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [formatNumber(value as number), 'Spedizioni']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revenue Bar Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Fatturato per Periodo</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis tickFormatter={(value) => `€${value}`} />
                  <Tooltip formatter={(value) => [formatCurrency(value as number), 'Fatturato']} />
                  <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* User Growth Line Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Nuove Registrazioni</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={userGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value) => [formatNumber(value as number), 'Nuovi utenti']} />
                  <Line
                    type="monotone"
                    dataKey="users"
                    stroke="#6366f1"
                    strokeWidth={3}
                    dot={{ fill: '#6366f1', r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Wallet Transactions Pie Chart */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Transazioni Wallet per Tipo
            </h3>
            <div className="h-80">
              {walletTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={walletTypeData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    >
                      {walletTypeData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => [formatNumber(value as number), 'Transazioni']}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  Nessuna transazione
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Grafana Link */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold mb-2">Grafana Cloud Dashboard</h3>
              <p className="text-white/80">
                Per metriche avanzate, alerting e visualizzazioni personalizzate, configura Grafana
                Cloud (FREE tier).
              </p>
            </div>
            <Link
              href="/docs/7-OPERATIONS/GRAFANA_SETUP.md"
              className="flex items-center gap-2 px-6 py-3 bg-white text-orange-600 font-semibold rounded-lg hover:bg-orange-50 transition-colors"
            >
              <ExternalLink className="w-5 h-5" />
              Guida Setup
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
