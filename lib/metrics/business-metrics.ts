/**
 * Business Metrics Queries
 *
 * Centralized queries for fetching business metrics from Supabase.
 * Used by both /api/metrics/business and /api/metrics/prometheus endpoints.
 */

import { createClient } from '@supabase/supabase-js';

// Test user email patterns to exclude from metrics
const TEST_USER_PATTERNS = [
  'test@%',
  'test-%@%',
  '%@test.%',
  'e2e-%@%',
  'smoke-test-%@%',
  'integration-test-%@%',
];

// Test tracking number patterns to exclude
const TEST_TRACKING_PATTERNS = ['TEST%', 'FAKE%', 'DEMO%', 'MOCK%'];

// Shipment statuses considered "successful"
const SUCCESS_STATUSES = ['delivered'];

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
 * Fetch shipment metrics
 */
async function getShipmentMetrics(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const dates = getDateBoundaries();

  // Get all shipments (excluding test users and cancelled)
  // We'll do client-side filtering for test users since LIKE patterns are complex
  const { data: shipments, error } = await supabase
    .from('shipments')
    .select('id, status, final_price, created_at, user_id, deleted')
    .eq('deleted', false)
    .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`);

  if (error) {
    console.error('Error fetching shipments:', error);
    throw new Error(`Failed to fetch shipment metrics: ${error.message}`);
  }

  // Filter out test tracking numbers (would need to add tracking_number to select)
  const validShipments = shipments || [];

  // Calculate metrics
  const total = validShipments.length;
  const today = validShipments.filter(
    (s) => s.created_at >= dates.todayStart
  ).length;
  const thisWeek = validShipments.filter(
    (s) => s.created_at >= dates.weekStart
  ).length;
  const thisMonth = validShipments.filter(
    (s) => s.created_at >= dates.monthStart
  ).length;

  // Count by status
  const byStatus: Record<string, number> = {};
  for (const shipment of validShipments) {
    const status = shipment.status || 'unknown';
    byStatus[status] = (byStatus[status] || 0) + 1;
  }

  // Success rate (delivered / total non-draft)
  const deliveredCount = byStatus['delivered'] || 0;
  const successRate = total > 0 ? deliveredCount / total : 0;

  // Average cost
  const totalCost = validShipments.reduce(
    (sum, s) => sum + (s.final_price || 0),
    0
  );
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
 * Fetch revenue metrics
 */
async function getRevenueMetrics(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const dates = getDateBoundaries();

  // Get shipments with revenue data
  const { data: shipments, error } = await supabase
    .from('shipments')
    .select('final_price, margin_percent, created_at, deleted, status')
    .eq('deleted', false)
    .not('status', 'in', `(${EXCLUDED_STATUSES.join(',')})`);

  if (error) {
    console.error('Error fetching revenue:', error);
    throw new Error(`Failed to fetch revenue metrics: ${error.message}`);
  }

  const validShipments = shipments || [];

  // Calculate revenue by period
  const total = validShipments.reduce(
    (sum, s) => sum + (s.final_price || 0),
    0
  );

  const today = validShipments
    .filter((s) => s.created_at >= dates.todayStart)
    .reduce((sum, s) => sum + (s.final_price || 0), 0);

  const thisWeek = validShipments
    .filter((s) => s.created_at >= dates.weekStart)
    .reduce((sum, s) => sum + (s.final_price || 0), 0);

  const thisMonth = validShipments
    .filter((s) => s.created_at >= dates.monthStart)
    .reduce((sum, s) => sum + (s.final_price || 0), 0);

  // Average margin
  const marginSum = validShipments.reduce(
    (sum, s) => sum + (s.margin_percent || 0),
    0
  );
  const averageMargin =
    validShipments.length > 0 ? marginSum / validShipments.length : 0;

  return {
    total: Math.round(total * 100) / 100,
    today: Math.round(today * 100) / 100,
    thisWeek: Math.round(thisWeek * 100) / 100,
    thisMonth: Math.round(thisMonth * 100) / 100,
    averageMargin: Math.round(averageMargin * 1000) / 1000,
  };
}

/**
 * Fetch user metrics
 */
async function getUserMetrics(supabase: ReturnType<typeof getSupabaseAdmin>) {
  const dates = getDateBoundaries();

  // Get all users
  const { data: users, error } = await supabase
    .from('users')
    .select('id, created_at, last_login_at, email');

  if (error) {
    console.error('Error fetching users:', error);
    throw new Error(`Failed to fetch user metrics: ${error.message}`);
  }

  // Filter out test users
  const validUsers = (users || []).filter((u) => {
    const email = (u.email || '').toLowerCase();
    return !(
      email.startsWith('test@') ||
      email.startsWith('test-') ||
      email.includes('@test.') ||
      email.startsWith('e2e-') ||
      email.startsWith('smoke-test-') ||
      email.startsWith('integration-test-')
    );
  });

  const total = validUsers.length;

  // Active users (logged in within 30 days)
  const active30d = validUsers.filter(
    (u) => u.last_login_at && u.last_login_at >= dates.active30dStart
  ).length;

  // New registrations
  const newToday = validUsers.filter(
    (u) => u.created_at >= dates.todayStart
  ).length;
  const newThisWeek = validUsers.filter(
    (u) => u.created_at >= dates.weekStart
  ).length;
  const newThisMonth = validUsers.filter(
    (u) => u.created_at >= dates.monthStart
  ).length;

  return {
    total,
    active30d,
    newToday,
    newThisWeek,
    newThisMonth,
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

  const totalBalance = (balanceData || []).reduce(
    (sum, u) => sum + (u.wallet_balance || 0),
    0
  );

  // Get wallet transactions
  const { data: transactions, error: txError } = await supabase
    .from('wallet_transactions')
    .select('type, amount, created_at, status');

  if (txError) {
    console.error('Error fetching transactions:', txError);
  }

  const validTx = (transactions || []).filter((t) => t.status === 'COMPLETED');

  // Transactions by type
  const byType: Record<string, number> = {};
  for (const tx of validTx) {
    const type = tx.type || 'unknown';
    byType[type] = (byType[type] || 0) + 1;
  }

  // Today's transactions
  const transactionsToday = validTx.filter(
    (t) => t.created_at >= dates.todayStart
  ).length;

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
      ? approvedTopups.reduce((sum, t) => sum + (t.amount || 0), 0) /
        approvedTopups.length
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
  period: 'today' | 'week' | 'month' | 'all'
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
  const [shipmentResult, revenueResult, topupResult, userResult] =
    await Promise.all([
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

  const revenueToday = (revenueResult.data || []).reduce(
    (sum, s) => sum + (s.final_price || 0),
    0
  );

  return {
    shipmentsToday: shipmentResult.count || 0,
    revenueToday: Math.round(revenueToday * 100) / 100,
    pendingTopups: topupResult.count || 0,
    activeUsers: userResult.count || 0,
  };
}
