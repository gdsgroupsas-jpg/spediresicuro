/**
 * Prometheus Exposition Format Helpers
 *
 * Converts metrics to Prometheus text format for Grafana Cloud scraping.
 * Reference: https://prometheus.io/docs/instrumenting/exposition_formats/
 */

// Metric types
export type MetricType = 'counter' | 'gauge' | 'histogram' | 'summary';

// Single metric definition
export interface MetricDefinition {
  name: string;
  help: string;
  type: MetricType;
  values: MetricValue[];
}

// Metric value with optional labels
export interface MetricValue {
  value: number;
  labels?: Record<string, string>;
}

/**
 * Format a single metric line with labels
 */
function formatMetricLine(
  name: string,
  value: number,
  labels?: Record<string, string>
): string {
  if (!labels || Object.keys(labels).length === 0) {
    return `${name} ${value}`;
  }

  const labelParts = Object.entries(labels)
    .map(([key, val]) => `${key}="${escapeLabel(val)}"`)
    .join(',');

  return `${name}{${labelParts}} ${value}`;
}

/**
 * Escape special characters in label values
 */
function escapeLabel(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n');
}

/**
 * Format a complete metric (with HELP and TYPE comments)
 */
export function formatMetric(metric: MetricDefinition): string {
  const lines: string[] = [];

  // Add HELP comment
  lines.push(`# HELP ${metric.name} ${metric.help}`);

  // Add TYPE comment
  lines.push(`# TYPE ${metric.name} ${metric.type}`);

  // Add metric values
  for (const mv of metric.values) {
    lines.push(formatMetricLine(metric.name, mv.value, mv.labels));
  }

  return lines.join('\n');
}

/**
 * Format multiple metrics into a single Prometheus exposition
 */
export function formatMetrics(metrics: MetricDefinition[]): string {
  return metrics.map(formatMetric).join('\n\n') + '\n';
}

// ============================================================
// Pre-defined metric builders for SpediReSicuro
// ============================================================

/**
 * Build shipment metrics
 */
export function buildShipmentMetrics(data: {
  total: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
  byStatus: Record<string, number>;
  successRate: number;
  averageCost: number;
}): MetricDefinition[] {
  const metrics: MetricDefinition[] = [];

  // Total shipments by status
  metrics.push({
    name: 'spedire_shipments_total',
    help: 'Total number of shipments by status',
    type: 'gauge',
    values: Object.entries(data.byStatus).map(([status, count]) => ({
      value: count,
      labels: { status },
    })),
  });

  // Shipments created in time periods
  metrics.push({
    name: 'spedire_shipments_created',
    help: 'Number of shipments created in time period',
    type: 'gauge',
    values: [
      { value: data.today, labels: { period: 'today' } },
      { value: data.thisWeek, labels: { period: 'week' } },
      { value: data.thisMonth, labels: { period: 'month' } },
      { value: data.total, labels: { period: 'all' } },
    ],
  });

  // Success rate
  metrics.push({
    name: 'spedire_shipments_success_rate',
    help: 'Shipment delivery success rate (0-1)',
    type: 'gauge',
    values: [{ value: data.successRate }],
  });

  // Average cost
  metrics.push({
    name: 'spedire_shipments_average_cost_eur',
    help: 'Average shipment cost in EUR',
    type: 'gauge',
    values: [{ value: data.averageCost }],
  });

  return metrics;
}

/**
 * Build revenue metrics
 */
export function buildRevenueMetrics(data: {
  total: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
  averageMargin: number;
}): MetricDefinition[] {
  return [
    {
      name: 'spedire_revenue_eur',
      help: 'Total revenue in EUR by time period',
      type: 'gauge',
      values: [
        { value: data.today, labels: { period: 'today' } },
        { value: data.thisWeek, labels: { period: 'week' } },
        { value: data.thisMonth, labels: { period: 'month' } },
        { value: data.total, labels: { period: 'all' } },
      ],
    },
    {
      name: 'spedire_revenue_margin_rate',
      help: 'Average revenue margin rate (0-1)',
      type: 'gauge',
      values: [{ value: data.averageMargin }],
    },
  ];
}

/**
 * Build user metrics
 */
export function buildUserMetrics(data: {
  total: number;
  active30d: number;
  newToday: number;
  newThisWeek: number;
  newThisMonth: number;
}): MetricDefinition[] {
  return [
    {
      name: 'spedire_users_total',
      help: 'Total number of registered users',
      type: 'gauge',
      values: [{ value: data.total }],
    },
    {
      name: 'spedire_users_active',
      help: 'Number of active users in time period',
      type: 'gauge',
      values: [{ value: data.active30d, labels: { period: '30d' } }],
    },
    {
      name: 'spedire_users_registered',
      help: 'Number of new user registrations by time period',
      type: 'gauge',
      values: [
        { value: data.newToday, labels: { period: 'today' } },
        { value: data.newThisWeek, labels: { period: 'week' } },
        { value: data.newThisMonth, labels: { period: 'month' } },
      ],
    },
  ];
}

/**
 * Build wallet metrics
 */
export function buildWalletMetrics(data: {
  totalBalance: number;
  transactionsToday: number;
  topupsPending: number;
  topupsApprovedToday: number;
  averageTopupAmount: number;
  byType: Record<string, number>;
}): MetricDefinition[] {
  const metrics: MetricDefinition[] = [];

  // Total balance across all wallets
  metrics.push({
    name: 'spedire_wallet_balance_total_eur',
    help: 'Total wallet balance across all users in EUR',
    type: 'gauge',
    values: [{ value: data.totalBalance }],
  });

  // Transactions by type
  metrics.push({
    name: 'spedire_wallet_transactions_total',
    help: 'Total wallet transactions by type',
    type: 'gauge',
    values: Object.entries(data.byType).map(([type, count]) => ({
      value: count,
      labels: { type },
    })),
  });

  // Today's transactions
  metrics.push({
    name: 'spedire_wallet_transactions_today',
    help: 'Number of wallet transactions today',
    type: 'gauge',
    values: [{ value: data.transactionsToday }],
  });

  // Top-up metrics
  metrics.push({
    name: 'spedire_topups_pending',
    help: 'Number of pending top-up requests',
    type: 'gauge',
    values: [{ value: data.topupsPending }],
  });

  metrics.push({
    name: 'spedire_topups_approved_today',
    help: 'Number of top-ups approved today',
    type: 'gauge',
    values: [{ value: data.topupsApprovedToday }],
  });

  metrics.push({
    name: 'spedire_topups_average_amount_eur',
    help: 'Average top-up request amount in EUR',
    type: 'gauge',
    values: [{ value: data.averageTopupAmount }],
  });

  return metrics;
}

/**
 * Build system health metrics
 */
export function buildSystemMetrics(data: {
  healthStatus: 'ok' | 'degraded' | 'unhealthy';
  dependenciesHealthy: number;
  dependenciesTotal: number;
  apiLatencyMs: number;
}): MetricDefinition[] {
  // Convert health status to numeric
  const healthValue =
    data.healthStatus === 'ok' ? 1 : data.healthStatus === 'degraded' ? 0.5 : 0;

  return [
    {
      name: 'spedire_health_status',
      help: 'Application health status (1=ok, 0.5=degraded, 0=unhealthy)',
      type: 'gauge',
      values: [{ value: healthValue }],
    },
    {
      name: 'spedire_dependencies_healthy',
      help: 'Number of healthy dependencies',
      type: 'gauge',
      values: [{ value: data.dependenciesHealthy }],
    },
    {
      name: 'spedire_dependencies_total',
      help: 'Total number of monitored dependencies',
      type: 'gauge',
      values: [{ value: data.dependenciesTotal }],
    },
    {
      name: 'spedire_api_latency_ms',
      help: 'API response latency in milliseconds',
      type: 'gauge',
      values: [{ value: data.apiLatencyMs }],
    },
  ];
}
