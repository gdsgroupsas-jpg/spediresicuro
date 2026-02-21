import { supabaseAdmin } from '@/lib/db/client';
import { verifySuperAdmin } from './platform-costs.shared';
import type {
  MarginAlert,
  PlatformDailyPnL,
  PlatformMonthlyPnL,
  PlatformStatsData,
  ReconciliationPending,
  ResellerPlatformUsage,
} from './platform-costs.types';

export async function getDailyPnLActionImpl(days: number = 30): Promise<{
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

export async function getMonthlyPnLActionImpl(months: number = 12): Promise<{
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

export async function getResellerUsageActionImpl(month?: string): Promise<{
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

export async function getMarginAlertsActionImpl(): Promise<{
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

export async function getReconciliationPendingActionImpl(): Promise<{
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

export async function updateReconciliationStatusActionImpl(
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

    await supabaseAdmin.rpc('log_financial_event', {
      p_event_type:
        status === 'resolved' ? 'reconciliation_completed' : 'reconciliation_discrepancy',
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

export async function getPlatformStatsActionImpl(): Promise<{
  success: boolean;
  data?: PlatformStatsData;
  error?: string;
}> {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.success) {
    return { success: false, error: authCheck.error };
  }

  try {
    console.log('[PLATFORM_COSTS] Chiamata RPC get_platform_stats()...');
    const { data: statsData, error: rpcError } = await supabaseAdmin.rpc('get_platform_stats');

    console.log('[PLATFORM_COSTS] Risposta RPC:', {
      hasData: !!statsData,
      dataLength: statsData?.length,
      error: rpcError?.message,
    });

    if (rpcError) {
      console.error(
        '[PLATFORM_COSTS] get_platform_stats RPC errore, uso fallback senza filtri:',
        rpcError.message,
        rpcError.details,
        rpcError.hint
      );
      console.error(
        '[PLATFORM_COSTS] I dati mostrati includono test e cancellate! Applica migration 104.'
      );

      const { data: totalStats, error: totalError } = await supabaseAdmin
        .from('platform_provider_costs')
        .select('billed_amount, provider_cost, platform_margin')
        .eq('api_source', 'platform');

      if (totalError) throw totalError;

      const { count: pendingCount, error: pendingError } = await supabaseAdmin
        .from('platform_provider_costs')
        .select('*', { count: 'exact', head: true })
        .eq('api_source', 'platform')
        .in('reconciliation_status', ['pending', 'discrepancy']);

      if (pendingError) throw pendingError;

      const { count: negativeCount, error: negativeError } = await supabaseAdmin
        .from('platform_provider_costs')
        .select('*', { count: 'exact', head: true })
        .eq('api_source', 'platform')
        .lt('platform_margin', 0);

      if (negativeError) throw negativeError;

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: last30Days, error: last30Error } = await supabaseAdmin
        .from('platform_provider_costs')
        .select('*', { count: 'exact', head: true })
        .eq('api_source', 'platform')
        .gte('created_at', thirtyDaysAgo);

      if (last30Error) throw last30Error;

      const stats = (totalStats || []).reduce(
        (acc, row) => ({
          totalRevenue: acc.totalRevenue + (row.billed_amount || 0),
          totalCost: acc.totalCost + (row.provider_cost || 0),
          totalMargin: acc.totalMargin + (row.platform_margin || 0),
        }),
        { totalRevenue: 0, totalCost: 0, totalMargin: 0 }
      );

      const avgMarginPercent =
        stats.totalCost > 0
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
    }

    console.log('[PLATFORM_COSTS] Processing statsData:', statsData);
    const stats = statsData?.[0];

    if (!stats) {
      console.error(
        '[PLATFORM_COSTS] get_platform_stats() restituito vuoto. statsData:',
        JSON.stringify(statsData, null, 2)
      );
      return {
        success: true,
        data: {
          totalShipments: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalMargin: 0,
          avgMarginPercent: 0,
          pendingReconciliation: 0,
          negativeMarginCount: 0,
          last30DaysShipments: 0,
        },
      };
    }

    console.log('[PLATFORM_COSTS] get_platform_stats() successo:', {
      total_shipments: stats.total_shipments,
      total_revenue: stats.total_revenue,
      total_cost: stats.total_cost,
    });

    return {
      success: true,
      data: {
        totalShipments: Number(stats.total_shipments) || 0,
        totalRevenue: Number(stats.total_revenue) || 0,
        totalCost: Number(stats.total_cost) || 0,
        totalMargin: Number(stats.total_margin) || 0,
        avgMarginPercent: Number(stats.avg_margin_percent) || 0,
        pendingReconciliation: Number(stats.pending_reconciliation) || 0,
        negativeMarginCount: Number(stats.negative_margin_count) || 0,
        last30DaysShipments: Number(stats.last_30_days_shipments) || 0,
      },
    };
  } catch (error: any) {
    console.error('[PLATFORM_COSTS] getPlatformStatsAction error:', error);
    return { success: false, error: error.message };
  }
}
