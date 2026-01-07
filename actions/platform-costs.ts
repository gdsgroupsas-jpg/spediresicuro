/**
 * Server Actions: Platform Costs Management
 * 
 * Azioni per gestione costi piattaforma - Solo SuperAdmin
 * 
 * @module actions/platform-costs
 * @since Sprint 1 - Financial Tracking
 */

'use server';

import { auth } from '@/lib/auth-config';
import { supabaseAdmin } from '@/lib/db/client';

// ============================================
// TYPES
// ============================================

export interface PlatformDailyPnL {
  date: string;
  courier_code: string;
  shipments_count: number;
  total_billed: number;
  total_provider_cost: number;
  total_margin: number;
  avg_margin_percent: number;
  negative_margin_count: number;
  discrepancy_count: number;
}

export interface PlatformMonthlyPnL {
  month: string;
  total_shipments: number;
  unique_users: number;
  total_revenue: number;
  total_cost: number;
  gross_margin: number;
  margin_percent_of_revenue: number;
  negative_margin_count: number;
}

export interface ResellerPlatformUsage {
  month: string;
  billed_user_id: string;
  user_email: string;
  user_name: string | null;
  user_type: string;
  shipments_count: number;
  total_spent: number;
  margin_generated: number;
  avg_margin_percent: number;
}

export interface MarginAlert {
  id: string;
  shipment_id: string;
  shipment_tracking_number: string;
  created_at: string;
  user_email: string;
  courier_code: string;
  billed_amount: number;
  provider_cost: number;
  platform_margin: number;
  platform_margin_percent: number;
  alert_type: string;
  reconciliation_status: string;
}

export interface ReconciliationPending {
  id: string;
  shipment_id: string;
  shipment_tracking_number: string;
  created_at: string;
  courier_code: string;
  billed_amount: number;
  provider_cost: number;
  platform_margin: number;
  reconciliation_status: string;
  age_days: number;
  user_email: string;
}

// ============================================
// HELPER: Verifica SuperAdmin
// ============================================

async function verifySuperAdmin(): Promise<{ 
  success: boolean; 
  userId?: string; 
  error?: string 
}> {
  const session = await auth();
  
  if (!session?.user?.email) {
    return { success: false, error: 'Non autenticato' };
  }

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, account_type')
    .eq('email', session.user.email)
    .single();

  if (error || !user) {
    return { success: false, error: 'Utente non trovato' };
  }

  if (user.account_type !== 'superadmin') {
    return { success: false, error: 'Accesso non autorizzato: solo SuperAdmin' };
  }

  return { success: true, userId: user.id };
}

// ============================================
// ACTIONS: P&L Dashboard
// ============================================

/**
 * Ottiene P&L giornaliero degli ultimi N giorni
 */
export async function getDailyPnLAction(days: number = 30): Promise<{
  success: boolean;
  data?: PlatformDailyPnL[];
  error?: string;
}> {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.success) {
    return { success: false, error: authCheck.error };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('v_platform_daily_pnl')
      .select('*')
      .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('[PLATFORM_COSTS] getDailyPnLAction error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Ottiene P&L mensile
 */
export async function getMonthlyPnLAction(months: number = 12): Promise<{
  success: boolean;
  data?: PlatformMonthlyPnL[];
  error?: string;
}> {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.success) {
    return { success: false, error: authCheck.error };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('v_platform_monthly_pnl')
      .select('*')
      .order('month', { ascending: false })
      .limit(months);

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('[PLATFORM_COSTS] getMonthlyPnLAction error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Ottiene usage mensile per reseller
 */
export async function getResellerUsageAction(month?: string): Promise<{
  success: boolean;
  data?: ResellerPlatformUsage[];
  error?: string;
}> {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.success) {
    return { success: false, error: authCheck.error };
  }

  try {
    let query = supabaseAdmin
      .from('v_reseller_monthly_platform_usage')
      .select('*')
      .order('total_spent', { ascending: false });

    if (month) {
      query = query.eq('month', month);
    } else {
      query = query.limit(100);
    }

    const { data, error } = await query;

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('[PLATFORM_COSTS] getResellerUsageAction error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// ACTIONS: Alerts & Reconciliation
// ============================================

/**
 * Ottiene alert margini anomali
 */
export async function getMarginAlertsAction(): Promise<{
  success: boolean;
  data?: MarginAlert[];
  error?: string;
}> {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.success) {
    return { success: false, error: authCheck.error };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('v_platform_margin_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('[PLATFORM_COSTS] getMarginAlertsAction error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Ottiene spedizioni da riconciliare
 */
export async function getReconciliationPendingAction(): Promise<{
  success: boolean;
  data?: ReconciliationPending[];
  error?: string;
}> {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.success) {
    return { success: false, error: authCheck.error };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('v_reconciliation_pending')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(200);

    if (error) throw error;

    return { success: true, data: data || [] };
  } catch (error: any) {
    console.error('[PLATFORM_COSTS] getReconciliationPendingAction error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Aggiorna stato riconciliazione
 */
export async function updateReconciliationStatusAction(
  costId: string,
  status: 'matched' | 'discrepancy' | 'resolved',
  notes?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.success) {
    return { success: false, error: authCheck.error };
  }

  try {
    const { error } = await supabaseAdmin
      .from('platform_provider_costs')
      .update({
        reconciliation_status: status,
        reconciliation_notes: notes,
        reconciled_at: new Date().toISOString(),
        reconciled_by: authCheck.userId,
      })
      .eq('id', costId);

    if (error) throw error;

    // Log audit
    await supabaseAdmin.rpc('log_financial_event', {
      p_event_type: status === 'resolved' ? 'reconciliation_completed' : 'reconciliation_discrepancy',
      p_platform_cost_id: costId,
      p_message: notes || `Status changed to ${status}`,
      p_severity: status === 'discrepancy' ? 'warning' : 'info',
      p_actor_id: authCheck.userId,
    });

    return { success: true };
  } catch (error: any) {
    console.error('[PLATFORM_COSTS] updateReconciliationStatusAction error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// ACTIONS: Statistics Summary
// ============================================

/**
 * Ottiene summary statistiche per dashboard
 */
export async function getPlatformStatsAction(): Promise<{
  success: boolean;
  data?: {
    totalShipments: number;
    totalRevenue: number;
    totalCost: number;
    totalMargin: number;
    avgMarginPercent: number;
    pendingReconciliation: number;
    negativeMarginCount: number;
    last30DaysShipments: number;
  };
  error?: string;
}> {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.success) {
    return { success: false, error: authCheck.error };
  }

  try {
    // Statistiche totali
    const { data: totalStats, error: totalError } = await supabaseAdmin
      .from('platform_provider_costs')
      .select('billed_amount, provider_cost, platform_margin')
      .eq('api_source', 'platform');

    if (totalError) throw totalError;

    // Pending reconciliation
    const { count: pendingCount, error: pendingError } = await supabaseAdmin
      .from('platform_provider_costs')
      .select('*', { count: 'exact', head: true })
      .in('reconciliation_status', ['pending', 'discrepancy']);

    if (pendingError) throw pendingError;

    // Negative margins
    const { count: negativeCount, error: negativeError } = await supabaseAdmin
      .from('platform_provider_costs')
      .select('*', { count: 'exact', head: true })
      .lt('platform_margin', 0);

    if (negativeError) throw negativeError;

    // Last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { count: last30Days, error: last30Error } = await supabaseAdmin
      .from('platform_provider_costs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', thirtyDaysAgo);

    if (last30Error) throw last30Error;

    // Calculate totals
    const stats = (totalStats || []).reduce(
      (acc, row) => ({
        totalRevenue: acc.totalRevenue + (row.billed_amount || 0),
        totalCost: acc.totalCost + (row.provider_cost || 0),
        totalMargin: acc.totalMargin + (row.platform_margin || 0),
      }),
      { totalRevenue: 0, totalCost: 0, totalMargin: 0 }
    );

    const avgMarginPercent = stats.totalCost > 0
      ? Math.round((stats.totalMargin / stats.totalCost) * 100 * 100) / 100
      : 0;

    return {
      success: true,
      data: {
        totalShipments: totalStats?.length || 0,
        totalRevenue: Math.round(stats.totalRevenue * 100) / 100,
        totalCost: Math.round(stats.totalCost * 100) / 100,
        totalMargin: Math.round(stats.totalMargin * 100) / 100,
        avgMarginPercent,
        pendingReconciliation: pendingCount || 0,
        negativeMarginCount: negativeCount || 0,
        last30DaysShipments: last30Days || 0,
      },
    };
  } catch (error: any) {
    console.error('[PLATFORM_COSTS] getPlatformStatsAction error:', error);
    return { success: false, error: error.message };
  }
}
