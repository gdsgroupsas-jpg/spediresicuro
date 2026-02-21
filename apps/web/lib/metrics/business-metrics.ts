/**
 * Business Metrics Queries
 *
 * Centralized queries for fetching business metrics from Supabase.
 * Used by both /api/metrics/business and /api/metrics/prometheus endpoints.
 */

import { createClient } from '@supabase/supabase-js';

// Shipment statuses to exclude from metrics
const EXCLUDED_STATUSES = ['draft', 'cancelled'];

// Business metrics response interface
export interface BusinessMetrics {
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

// Create supabase admin client
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });
}

/**
 * Get date boundaries for metrics queries
 */
function getDateBoundaries() {
  const now = new Date();

  // Today: start of current day
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);

  // This week: 7 days ago
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 7);

  // This month: 30 days ago
  const monthStart = new Date(now);
  monthStart.setDate(monthStart.getDate() - 30);

  // 30 days ago for active users
  const active30dStart = new Date(now);
  active30dStart.setDate(active30dStart.getDate() - 30);

  return {
    now: now.toISOString(),
    todayStart: todayStart.toISOString(),
    weekStart: weekStart.toISOString(),
    monthStart: monthStart.toISOString(),
    active30dStart: active30dStart.toISOString(),
  };
}

/**
 * Fetch shipment metrics using SQL aggregations
 * Optimized: Uses COUNT/SUM instead of loading full tables
 */
async function getShipmentMetrics(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const dates = getDateBoundaries();

  // Use RPC for efficient aggregation, or multiple count queries
  const [
    totalResult,
    todayResult,
    weekResult,
    monthResult,
    statusResult,
    deliveredResult,
    costResult,
  ] = await Promise.all([
    // Total count
    supabase
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .eq('deleted', false)
      .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`),

    // Today count
    supabase
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .eq('deleted', false)
      .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`)
      .gte('created_at', dates.todayStart),

    // This week count
    supabase
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .eq('deleted', false)
      .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`)
      .gte('created_at', dates.weekStart),

    // This month count
    supabase
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .eq('deleted', false)
      .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`)
      .gte('created_at', dates.monthStart),

    // Status breakdown - need to fetch distinct statuses and count each
    supabase
      .from('shipments')
      .select('status')
      .eq('deleted', false)
      .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`),

    // Delivered count for success rate
    supabase
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .eq('deleted', false)
      .eq('status', 'delivered'),

    // Sum of prices for average cost - still need to fetch but only prices
    supabase
      .from('shipments')
      .select('final_price')
      .eq('deleted', false)
      .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`)
      .not('final_price', 'is', null),
  ]);

  const total = totalResult.count || 0;
  const today = todayResult.count || 0;
  const thisWeek = weekResult.count || 0;
  const thisMonth = monthResult.count || 0;
  const deliveredCount = deliveredResult.count || 0;

  // Count by status from minimal data
  const byStatus: Record<string, number> = {};
  for (const row of statusResult.data || []) {
    const status = row.status || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;
  }

  // Calculate success rate and average cost
  const successRate = total > 0 ? deliveredCount / total : 0;
  const totalCost = (costResult.data || []).reduce((sum, s) => sum + (s.final_price || 0), 0);
  const averageCost = total > 0 ? totalCost / total : 0;

  return {
    total,
    today,
    thisWeek,
    thisMonth,
    byStatus,
    successRate: Math.round(successRate * 1000) / 1000,
    averageCost: Math.round(averageCost * 100) / 100,
  };
}

/**
 * Fetch revenue metrics using SQL aggregations
 * Optimized: Fetches only price columns, grouped by period
 */
async function getRevenueMetrics(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const dates = getDateBoundaries();

  // Fetch prices and margins with period filtering in parallel
  const [totalResult, todayResult, weekResult, monthResult, marginResult] = await Promise.all([
    // Total revenue
    supabase
      .from('shipments')
      .select('final_price')
      .eq('deleted', false)
      .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`)
      .not('final_price', 'is', null),

    // Today revenue
    supabase
      .from('shipments')
      .select('final_price')
      .eq('deleted', false)
      .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`)
      .not('final_price', 'is', null)
      .gte('created_at', dates.todayStart),

    // This week revenue
    supabase
      .from('shipments')
      .select('final_price')
      .eq('deleted', false)
      .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`)
      .not('final_price', 'is', null)
      .gte('created_at', dates.weekStart),

    // This month revenue
    supabase
      .from('shipments')
      .select('final_price')
      .eq('deleted', false)
      .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`)
      .not('final_price', 'is', null)
      .gte('created_at', dates.monthStart),

    // Margin data
    supabase
      .from('shipments')
      .select('margin_percent')
      .eq('deleted', false)
      .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`)
      .not('margin_percent', 'is', null),
  ]);

  // Sum up values
  const total = (totalResult.data || []).reduce((sum, s) => sum + (s.final_price || 0), 0);
  const today = (todayResult.data || []).reduce((sum, s) => sum + (s.final_price || 0), 0);
  const thisWeek = (weekResult.data || []).reduce((sum, s) => sum + (s.final_price || 0), 0);
  const thisMonth = (monthResult.data || []).reduce((sum, s) => sum + (s.final_price || 0), 0);

  // Average margin
  const marginData = marginResult.data || [];
  const marginSum = marginData.reduce((sum, s) => sum + (s.margin_percent || 0), 0);
  const averageMargin = marginData.length > 0 ? marginSum / marginData.length : 0;

  return {
    total: Math.round(total * 100) / 100,
    today: Math.round(today * 100) / 100,
    thisWeek: Math.round(thisWeek * 100) / 100,
    thisMonth: Math.round(thisMonth * 100) / 100,
    averageMargin: Math.round(averageMargin * 1000) / 1000,
  };
}

/**
 * Fetch user metrics using SQL aggregations
 * Optimized: Uses COUNT with server-side test user filtering
 *
 * Test user exclusion patterns:
 * - test@%, test-%, %@test.%, e2e-%, smoke-test-%, integration-test-%
 */
async function getUserMetrics(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const dates = getDateBoundaries();

  const [totalResult, active30dResult, newTodayResult, newWeekResult, newMonthResult] =
    await Promise.all([
      // Total users (excluding test users)
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .not('email', 'like', 'test@%')
        .not('email', 'like', 'test-%@%')
        .not('email', 'ilike', '%@test.%')
        .not('email', 'like', 'e2e-%@%')
        .not('email', 'like', 'smoke-test-%@%')
        .not('email', 'like', 'integration-test-%@%'),

      // Active users (logged in within 30 days)
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('last_login_at', dates.active30dStart)
        .not('email', 'like', 'test@%')
        .not('email', 'like', 'test-%@%')
        .not('email', 'ilike', '%@test.%')
        .not('email', 'like', 'e2e-%@%')
        .not('email', 'like', 'smoke-test-%@%')
        .not('email', 'like', 'integration-test-%@%'),

      // New today
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dates.todayStart)
        .not('email', 'like', 'test@%')
        .not('email', 'like', 'test-%@%')
        .not('email', 'ilike', '%@test.%')
        .not('email', 'like', 'e2e-%@%')
        .not('email', 'like', 'smoke-test-%@%')
        .not('email', 'like', 'integration-test-%@%'),

      // New this week
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dates.weekStart)
        .not('email', 'like', 'test@%')
        .not('email', 'like', 'test-%@%')
        .not('email', 'ilike', '%@test.%')
        .not('email', 'like', 'e2e-%@%')
        .not('email', 'like', 'smoke-test-%@%')
        .not('email', 'like', 'integration-test-%@%'),

      // New this month
      supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', dates.monthStart)
        .not('email', 'like', 'test@%')
        .not('email', 'like', 'test-%@%')
        .not('email', 'ilike', '%@test.%')
        .not('email', 'like', 'e2e-%@%')
        .not('email', 'like', 'smoke-test-%@%')
        .not('email', 'like', 'integration-test-%@%'),
    ]);

  return {
    total: totalResult.count || 0,
    active30d: active30dResult.count || 0,
    newToday: newTodayResult.count || 0,
    newThisWeek: newWeekResult.count || 0,
    newThisMonth: newMonthResult.count || 0,
  };
}

/**
 * Fetch wallet metrics
 */
async function getWalletMetrics(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const dates = getDateBoundaries();

  // Get total wallet balance from users table
  const { data: balanceData, error: balanceError } = await supabase
    .from('users')
    .select('wallet_balance');

  if (balanceError) {
    console.error('Error fetching wallet balance:', balanceError);
  }

  const totalBalance = (balanceData || []).reduce((sum, u) => sum + (u.wallet_balance || 0), 0);

  // Get wallet transactions
  // Note: wallet_transactions has no status column - all transactions are valid
  const { data: transactions, error: txError } = await supabase
    .from('wallet_transactions')
    .select('type, amount, created_at');

  if (txError) {
    console.error('Error fetching transactions:', txError);
  }

  // All wallet transactions are valid (no pending state in this table)
  const validTx = transactions || [];

  // Transactions by type
  const byType: Record<string, number> = {};
  for (const tx of validTx) {
    const type = tx.type || 'unknown';
    byType[type] = (byType[type] || 0) + 1;
  }

  // Today's transactions
  const transactionsToday = validTx.filter((t) => t.created_at >= dates.todayStart).length;

  // Get pending top-ups
  const { data: topups, error: topupError } = await supabase
    .from('top_up_requests')
    .select('status, amount, approved_at, created_at');

  if (topupError) {
    console.error('Error fetching top-ups:', topupError);
  }

  const allTopups = topups || [];
  const topupsPending = allTopups.filter((t) => t.status === 'pending').length;

  // Top-ups approved today
  const topupsApprovedToday = allTopups.filter(
    (t) => t.status === 'approved' && t.approved_at >= dates.todayStart
  ).length;

  // Average top-up amount
  const approvedTopups = allTopups.filter((t) => t.status === 'approved');
  const avgAmount =
    approvedTopups.length > 0
      ? approvedTopups.reduce((sum, t) => sum + (t.amount || 0), 0) / approvedTopups.length
      : 0;

  return {
    totalBalance: Math.round(totalBalance * 100) / 100,
    transactionsToday,
    topupsPending,
    topupsApprovedToday,
    averageTopupAmount: Math.round(avgAmount * 100) / 100,
    byType,
  };
}

/**
 * Fetch all business metrics
 */
export async function getBusinessMetrics(): Promise<BusinessMetrics> {
  const supabase = getSupabaseAdmin();

  // Fetch all metrics in parallel
  const [shipments, revenue, users, wallet] = await Promise.all([
    getShipmentMetrics(supabase),
    getRevenueMetrics(supabase),
    getUserMetrics(supabase),
    getWalletMetrics(supabase),
  ]);

  return {
    timestamp: new Date().toISOString(),
    shipments,
    revenue,
    users,
    wallet,
  };
}

/**
 * Fetch metrics for a specific period
 */
export async function getMetricsForPeriod(
  _period: 'today' | 'week' | 'month' | 'all'
): Promise<BusinessMetrics> {
  // For now, return all metrics - period filtering can be added later
  return getBusinessMetrics();
}

/**
 * Get quick stats (optimized for dashboard)
 */
export async function getQuickStats(): Promise<{
  shipmentsToday: number;
  revenueToday: number;
  pendingTopups: number;
  activeUsers: number;
}> {
  const supabase = getSupabaseAdmin();
  const dates = getDateBoundaries();

  // Parallel queries for quick stats
  const [shipmentResult, revenueResult, topupResult, userResult] = await Promise.all([
    supabase
      .from('shipments')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', dates.todayStart)
      .eq('deleted', false),

    supabase
      .from('shipments')
      .select('final_price')
      .gte('created_at', dates.todayStart)
      .eq('deleted', false),

    supabase
      .from('top_up_requests')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),

    supabase
      .from('users')
      .select('id', { count: 'exact', head: true })
      .gte('last_login_at', dates.active30dStart),
  ]);

  const revenueToday = (revenueResult.data || []).reduce((sum, s) => sum + (s.final_price || 0), 0);

  return {
    shipmentsToday: shipmentResult.count || 0,
    revenueToday: Math.round(revenueToday * 100) / 100,
    pendingTopups: topupResult.count || 0,
    activeUsers: userResult.count || 0,
  };
}
