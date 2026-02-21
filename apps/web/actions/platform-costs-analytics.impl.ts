import { supabaseAdmin } from '@/lib/db/client';
import { isAdminOrAbove } from '@/lib/auth-helpers';
import { verifySuperAdmin } from './platform-costs.shared';
import type {
  CourierMarginData,
  ProviderMarginData,
  TopResellerData,
} from './platform-costs.types';

export async function getMarginByCourierActionImpl(startDate?: string): Promise<{
  success: boolean;
  data?: CourierMarginData[];
  error?: string;
}> {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.success) {
    return { success: false, error: authCheck.error };
  }

  try {
    const { data, error } = await supabaseAdmin.rpc('get_margin_by_courier', {
      p_start_date: startDate || null,
    });

    if (error) {
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

export async function getTopResellersActionImpl(
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
    const { data, error } = await supabaseAdmin.rpc('get_top_resellers', {
      p_limit: limit,
      p_start_date: startDate || null,
    });

    if (error) {
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

export async function getMarginByProviderActionImpl(startDate?: string): Promise<{
  success: boolean;
  data?: ProviderMarginData[];
  error?: string;
}> {
  const authCheck = await verifySuperAdmin();
  if (!authCheck.success) {
    return { success: false, error: authCheck.error };
  }

  try {
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

    const { userId: currentUserId } = authCheck;

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

      const displayName = configInfo?.config_label || configInfo?.name || null;
      const providerName = configInfo
        ? displayName ||
          `${(configInfo.provider_id || '').replaceAll('_', ' ')} (${configInfo.carrier || 'N/A'})`
        : configId.substring(0, 8);

      const ownerUserId = configInfo?.owner_user_id;
      const isAdminConfig = isAdminOrAbove({
        account_type: configInfo?.account_type,
      });
      const isPlatform =
        configInfo?.is_default === true || isAdminConfig || ownerUserId === currentUserId;
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

    const ownerIds = new Set<string>();
    configMap.forEach((stats) => {
      if (!stats.is_platform && stats.owner_label !== 'Sconosciuto') {
        ownerIds.add(stats.owner_label);
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

export async function exportFinancialCSVActionImpl(startDate?: string): Promise<{
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
