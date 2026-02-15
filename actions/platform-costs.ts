/**
 * Server Actions: Platform Costs Management
 *
 * Azioni per gestione costi piattaforma - Solo SuperAdmin
 *
 * @module actions/platform-costs
 * @since Sprint 1 - Financial Tracking
 */

'use server';

import { getWorkspaceAuth } from '@/lib/workspace-auth';
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
  error?: string;
}> {
  try {
    const wsContext = await getWorkspaceAuth();

    if (!wsContext) {
      return { success: false, error: 'Non autenticato' };
    }

    if (wsContext.actor.account_type !== 'superadmin') {
      return {
        success: false,
        error: 'Accesso non autorizzato: solo SuperAdmin',
      };
    }

    return { success: true, userId: wsContext.actor.id };
  } catch (error: any) {
    console.error('[PLATFORM_COSTS] verifySuperAdmin error:', error);
    return { success: false, error: error?.message || 'Errore di autenticazione' };
  }
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
    // Usa funzione RPC che esclude test e cancellate
    console.log('[PLATFORM_COSTS] Chiamata RPC get_platform_stats()...');
    const { data: statsData, error: rpcError } = await supabaseAdmin.rpc('get_platform_stats');

    console.log('[PLATFORM_COSTS] Risposta RPC:', {
      hasData: !!statsData,
      dataLength: statsData?.length,
      error: rpcError?.message,
    });

    if (rpcError) {
      // Fallback: se la funzione non esiste, usa query dirette (legacy)
      // ⚠️ ATTENZIONE: Il fallback NON può fare JOIN con Supabase client
      // Quindi restituisce dati SENZA filtri (include test e cancellate)
      // Questo è un problema! La RPC deve funzionare.
      console.error(
        '[PLATFORM_COSTS] ⚠️ CRITICO: get_platform_stats RPC ERRORE, uso fallback SENZA filtri:',
        rpcError.message,
        rpcError.details,
        rpcError.hint
      );
      console.error(
        '[PLATFORM_COSTS] ⚠️ I dati mostrati includono test e cancellate! Applica migration 104.'
      );

      // ⚠️ FALLBACK: Query dirette SENZA filtri (include test e cancellate)
      // Questo è temporaneo - la RPC deve funzionare!
      const { data: totalStats, error: totalError } = await supabaseAdmin
        .from('platform_provider_costs')
        .select('billed_amount, provider_cost, platform_margin')
        .eq('api_source', 'platform');

      if (totalError) throw totalError;

      // Pending reconciliation
      const { count: pendingCount, error: pendingError } = await supabaseAdmin
        .from('platform_provider_costs')
        .select('*', { count: 'exact', head: true })
        .eq('api_source', 'platform')
        .in('reconciliation_status', ['pending', 'discrepancy']);

      if (pendingError) throw pendingError;

      // Negative margins
      const { count: negativeCount, error: negativeError } = await supabaseAdmin
        .from('platform_provider_costs')
        .select('*', { count: 'exact', head: true })
        .eq('api_source', 'platform')
        .lt('platform_margin', 0);

      if (negativeError) throw negativeError;

      // Last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { count: last30Days, error: last30Error } = await supabaseAdmin
        .from('platform_provider_costs')
        .select('*', { count: 'exact', head: true })
        .eq('api_source', 'platform')
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

    // Usa dati dalla funzione RPC (corretti, escludono test e cancellate)
    console.log('[PLATFORM_COSTS] Processing statsData:', statsData);
    const stats = statsData?.[0];

    if (!stats) {
      console.error(
        '[PLATFORM_COSTS] ❌ get_platform_stats() restituito vuoto. statsData:',
        JSON.stringify(statsData, null, 2)
      );
      // Se la RPC restituisce array vuoto, significa 0 spedizioni (corretto!)
      // Non è un errore, restituiamo 0
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

// ============================================
// SPRINT 2: Additional Dashboard Features
// ============================================

export interface CourierMarginData {
  courier_code: string;
  total_shipments: number;
  total_revenue: number;
  total_cost: number;
  gross_margin: number;
  avg_margin_percent: number;
}

export interface TopResellerData {
  user_id: string;
  user_email: string;
  user_name: string | null;
  total_shipments: number;
  total_billed: number;
  margin_generated: number;
}

/**
 * Ottiene margini aggregati per corriere
 */
export async function getMarginByCourierAction(startDate?: string): Promise<{
  success: boolean;
  data?: CourierMarginData[];
  error?: string;
}> {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.success) {
    return { success: false, error: authCheck.error };
  }

  try {
    // Usa funzione RPC che esclude test e cancellate
    const { data, error } = await supabaseAdmin.rpc('get_margin_by_courier', {
      p_start_date: startDate || null,
    });

    if (error) {
      // Fallback: se la funzione non esiste, usa query dirette (legacy)
      console.warn(
        '[PLATFORM_COSTS] get_margin_by_courier RPC non disponibile, uso fallback:',
        error.message
      );

      let query = supabaseAdmin
        .from('platform_provider_costs')
        .select('courier_code, billed_amount, provider_cost, platform_margin')
        .eq('api_source', 'platform');

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      const { data: fallbackData, error: fallbackError } = await query;
      if (fallbackError) throw fallbackError;

      // Aggrega per corriere
      const courierMap = new Map<
        string,
        {
          total_shipments: number;
          total_revenue: number;
          total_cost: number;
          gross_margin: number;
        }
      >();

      (fallbackData || []).forEach((row) => {
        const existing = courierMap.get(row.courier_code) || {
          total_shipments: 0,
          total_revenue: 0,
          total_cost: 0,
          gross_margin: 0,
        };

        courierMap.set(row.courier_code, {
          total_shipments: existing.total_shipments + 1,
          total_revenue: existing.total_revenue + (row.billed_amount || 0),
          total_cost: existing.total_cost + (row.provider_cost || 0),
          gross_margin: existing.gross_margin + (row.platform_margin || 0),
        });
      });

      const result: CourierMarginData[] = Array.from(courierMap.entries()).map(
        ([courier_code, stats]) => ({
          courier_code,
          total_shipments: stats.total_shipments,
          total_revenue: Math.round(stats.total_revenue * 100) / 100,
          total_cost: Math.round(stats.total_cost * 100) / 100,
          gross_margin: Math.round(stats.gross_margin * 100) / 100,
          avg_margin_percent:
            stats.total_cost > 0
              ? Math.round((stats.gross_margin / stats.total_cost) * 100 * 100) / 100
              : 0,
        })
      );

      return { success: true, data: result };
    }

    // Usa dati dalla funzione RPC (corretti, escludono test e cancellate)
    const result: CourierMarginData[] = (data || []).map((row: any) => ({
      courier_code: row.courier_code,
      total_shipments: Number(row.total_shipments) || 0,
      total_revenue: Number(row.total_revenue) || 0,
      total_cost: Number(row.total_cost) || 0,
      gross_margin: Number(row.gross_margin) || 0,
      avg_margin_percent: Number(row.avg_margin_percent) || 0,
    }));

    return { success: true, data: result };
  } catch (error: any) {
    console.error('[PLATFORM_COSTS] getMarginByCourierAction error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Ottiene top resellers per platform usage
 */
export async function getTopResellersAction(
  limit: number = 20,
  startDate?: string
): Promise<{
  success: boolean;
  data?: TopResellerData[];
  error?: string;
}> {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.success) {
    return { success: false, error: authCheck.error };
  }

  try {
    // Usa funzione RPC che esclude test e cancellate
    const { data, error } = await supabaseAdmin.rpc('get_top_resellers', {
      p_limit: limit,
      p_start_date: startDate || null,
    });

    if (error) {
      // Fallback: se la funzione non esiste, usa query dirette (legacy)
      console.warn(
        '[PLATFORM_COSTS] get_top_resellers RPC non disponibile, uso fallback:',
        error.message
      );

      let query = supabaseAdmin
        .from('platform_provider_costs')
        .select(
          `
        billed_user_id,
        billed_amount,
        platform_margin,
        users!platform_provider_costs_billed_user_id_fkey(
          id,
          email,
          name
        )
      `
        )
        .eq('api_source', 'platform');

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      const { data: fallbackData, error: fallbackError } = await query;
      if (fallbackError) throw fallbackError;

      // Aggrega per utente
      const userMap = new Map<
        string,
        {
          user_email: string;
          user_name: string | null;
          total_shipments: number;
          total_billed: number;
          margin_generated: number;
        }
      >();

      (fallbackData || []).forEach((row) => {
        const userId = row.billed_user_id;
        // Gestisce sia array che oggetto singolo (Supabase può restituire entrambi)
        const usersData = row.users;
        const userInfo = Array.isArray(usersData)
          ? (usersData[0] as { id: string; email: string; name: string | null } | undefined) || null
          : (usersData as {
              id: string;
              email: string;
              name: string | null;
            } | null);

        const existing = userMap.get(userId) || {
          user_email: userInfo?.email || 'unknown',
          user_name: userInfo?.name || null,
          total_shipments: 0,
          total_billed: 0,
          margin_generated: 0,
        };

        userMap.set(userId, {
          user_email: existing.user_email,
          user_name: existing.user_name,
          total_shipments: existing.total_shipments + 1,
          total_billed: existing.total_billed + (row.billed_amount || 0),
          margin_generated: existing.margin_generated + (row.platform_margin || 0),
        });
      });

      const result: TopResellerData[] = Array.from(userMap.entries())
        .map(([user_id, stats]) => ({
          user_id,
          user_email: stats.user_email,
          user_name: stats.user_name,
          total_shipments: stats.total_shipments,
          total_billed: Math.round(stats.total_billed * 100) / 100,
          margin_generated: Math.round(stats.margin_generated * 100) / 100,
        }))
        .sort((a, b) => b.total_billed - a.total_billed)
        .slice(0, limit);

      return { success: true, data: result };
    }

    // Usa dati dalla funzione RPC (corretti, escludono test e cancellate)
    const result: TopResellerData[] = (data || []).map((row: any) => ({
      user_id: row.user_id,
      user_email: row.user_email || 'unknown',
      user_name: row.user_name,
      total_shipments: Number(row.total_shipments) || 0,
      total_billed: Number(row.total_billed) || 0,
      margin_generated: Number(row.margin_generated) || 0,
    }));

    return { success: true, data: result };
  } catch (error: any) {
    console.error('[PLATFORM_COSTS] getTopResellersAction error:', error);
    return { success: false, error: error.message };
  }
}

// ============================================
// SPRINT 3: Per-Provider Analytics
// ============================================

export interface ProviderMarginData {
  config_id: string;
  provider_name: string;
  owner_label: string; // "Piattaforma" | email del proprietario
  is_platform: boolean; // true = config della piattaforma (admin/default)
  total_shipments: number;
  total_revenue: number;
  total_cost: number;
  gross_margin: number;
  avg_margin_percent: number;
}

/**
 * Ottiene margini aggregati per configurazione API (fornitore)
 * Usa shipments.courier_config_id per raggruppare per provider
 */
export async function getMarginByProviderAction(startDate?: string): Promise<{
  success: boolean;
  data?: ProviderMarginData[];
  error?: string;
}> {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.success) {
    return { success: false, error: authCheck.error };
  }

  try {
    // Query shipments con courier_config_id JOIN courier_configs
    // Limit per evitare timeout su dataset grandi
    let query = supabaseAdmin
      .from('shipments')
      .select(
        `
        courier_config_id,
        base_price,
        final_price,
        courier_configs(
          id,
          name,
          config_label,
          provider_id,
          carrier,
          owner_user_id,
          is_default,
          account_type
        )
      `
      )
      .not('courier_config_id', 'is', null)
      .not('base_price', 'is', null)
      .not('final_price', 'is', null)
      .limit(50000);

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    const { data, error } = await query;
    if (error) throw error;

    // Recupera l'ID dell'admin/superadmin corrente per confronto ownership
    const { userId: currentUserId } = authCheck;

    // Aggrega per courier_config_id
    const configMap = new Map<
      string,
      {
        provider_name: string;
        owner_label: string;
        is_platform: boolean;
        total_shipments: number;
        total_revenue: number;
        total_cost: number;
        gross_margin: number;
      }
    >();

    (data || []).forEach((row: any) => {
      const configId = row.courier_config_id;
      if (!configId) return;

      const configInfo = Array.isArray(row.courier_configs)
        ? row.courier_configs[0]
        : row.courier_configs;

      // Usa name/config_label se disponibili, altrimenti fallback a provider_id
      const displayName = configInfo?.config_label || configInfo?.name || null;
      const providerName = configInfo
        ? displayName ||
          `${(configInfo.provider_id || '').replaceAll('_', ' ')} (${configInfo.carrier || 'N/A'})`
        : configId.substring(0, 8);

      // Ownership: admin/default = piattaforma, tutto il resto = reseller/BYOC
      const ownerUserId = configInfo?.owner_user_id;
      const isPlatform =
        configInfo?.is_default === true ||
        configInfo?.account_type === 'admin' ||
        ownerUserId === currentUserId;
      const ownerLabel = isPlatform ? 'Piattaforma' : ownerUserId || 'Sconosciuto';

      const existing = configMap.get(configId) || {
        provider_name: providerName,
        owner_label: ownerLabel,
        is_platform: isPlatform,
        total_shipments: 0,
        total_revenue: 0,
        total_cost: 0,
        gross_margin: 0,
      };

      const revenue = row.final_price || 0;
      const cost = row.base_price || 0;

      configMap.set(configId, {
        provider_name: existing.provider_name,
        owner_label: existing.owner_label,
        is_platform: existing.is_platform,
        total_shipments: existing.total_shipments + 1,
        total_revenue: existing.total_revenue + revenue,
        total_cost: existing.total_cost + cost,
        gross_margin: existing.gross_margin + (revenue - cost),
      });
    });

    // Risolvi owner_user_id → email per le config non-piattaforma
    const ownerIds = new Set<string>();
    configMap.forEach((stats) => {
      if (!stats.is_platform && stats.owner_label !== 'Sconosciuto') {
        ownerIds.add(stats.owner_label); // owner_label contiene l'UUID completo
      }
    });

    if (ownerIds.size > 0) {
      const { data: owners } = await supabaseAdmin
        .from('users')
        .select('id, email')
        .in('id', Array.from(ownerIds));
      const emailMap = new Map((owners || []).map((u: any) => [u.id, u.email]));

      configMap.forEach((stats) => {
        if (!stats.is_platform && emailMap.has(stats.owner_label)) {
          stats.owner_label = emailMap.get(stats.owner_label)!;
        }
      });
    }

    const result: ProviderMarginData[] = Array.from(configMap.entries())
      .map(([config_id, stats]) => ({
        config_id,
        provider_name: stats.provider_name,
        owner_label: stats.owner_label,
        is_platform: stats.is_platform,
        total_shipments: stats.total_shipments,
        total_revenue: Math.round(stats.total_revenue * 100) / 100,
        total_cost: Math.round(stats.total_cost * 100) / 100,
        gross_margin: Math.round(stats.gross_margin * 100) / 100,
        avg_margin_percent:
          stats.total_cost > 0
            ? Math.round((stats.gross_margin / stats.total_cost) * 100 * 100) / 100
            : 0,
      }))
      // Ordina: prima piattaforma, poi per margine decrescente
      .sort((a, b) => {
        if (a.is_platform !== b.is_platform) return a.is_platform ? -1 : 1;
        return b.gross_margin - a.gross_margin;
      });

    return { success: true, data: result };
  } catch (error: any) {
    console.error('[PLATFORM_COSTS] getMarginByProviderAction error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Genera CSV export dei dati finanziari
 */
export async function exportFinancialCSVAction(startDate?: string): Promise<{
  success: boolean;
  csv?: string;
  error?: string;
}> {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.success) {
    return { success: false, error: authCheck.error };
  }

  try {
    let query = supabaseAdmin
      .from('platform_provider_costs')
      .select(
        `
        id,
        created_at,
        shipment_tracking_number,
        courier_code,
        billed_amount,
        provider_cost,
        platform_margin,
        platform_margin_percent,
        reconciliation_status,
        api_source,
        cost_source,
        users!platform_provider_costs_billed_user_id_fkey(email)
      `
      )
      .eq('api_source', 'platform')
      .order('created_at', { ascending: false });

    if (startDate) {
      query = query.gte('created_at', startDate);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Genera CSV
    const headers = [
      'Data',
      'Tracking',
      'Corriere',
      'Email Cliente',
      'Importo Addebitato',
      'Costo Provider',
      'Margine',
      'Margine %',
      'Stato Riconciliazione',
      'Fonte Costo',
    ];

    const rows = (data || []).map((row) => {
      // Gestisce sia array che oggetto singolo (Supabase può restituire entrambi)
      const usersData = row.users;
      const userInfo = Array.isArray(usersData)
        ? (usersData[0] as { email: string } | undefined) || null
        : (usersData as { email: string } | null);
      return [
        new Date(row.created_at).toLocaleString('it-IT'),
        row.shipment_tracking_number || '',
        row.courier_code || '',
        userInfo?.email || '',
        row.billed_amount?.toFixed(2) || '0.00',
        row.provider_cost?.toFixed(2) || '0.00',
        row.platform_margin?.toFixed(2) || '0.00',
        row.platform_margin_percent?.toFixed(2) || '0.00',
        row.reconciliation_status || 'pending',
        row.cost_source || 'unknown',
      ].join(';');
    });

    const csv = [headers.join(';'), ...rows].join('\n');

    return { success: true, csv };
  } catch (error: any) {
    console.error('[PLATFORM_COSTS] exportFinancialCSVAction error:', error);
    return { success: false, error: error.message };
  }
}
