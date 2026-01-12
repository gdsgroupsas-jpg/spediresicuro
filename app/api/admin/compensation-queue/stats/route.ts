/**
 * API Route: Compensation Queue Stats
 *
 * Fornisce metriche real-time per compensation queue monitoring.
 *
 * CRITICAL (P0 AUDIT FIX):
 * - Observability per orphan financial records
 * - Alerting data per pending > X giorni
 * - SLA tracking per resolution time
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // ============================================
    // AUTHORIZATION: Admin/SuperAdmin only
    // ============================================
    const context = await requireSafeAuth();

    // Check if user is admin/superadmin
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('account_type')
      .eq('id', context.actor.id)
      .single();

    const isAdmin = user?.account_type === 'admin' || user?.account_type === 'superadmin';

    if (!isAdmin) {
      return NextResponse.json(
        { success: false, error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // ============================================
    // STATS QUERIES
    // ============================================

    // 1. Total counts by status
    const { data: countsByStatus } = await supabaseAdmin
      .from('compensation_queue')
      .select('status')
      .then(({ data, error }) => {
        if (error) throw error;

        const counts = {
          pending: 0,
          expired: 0,
          resolved: 0,
          total: data?.length || 0,
        };

        data?.forEach((record: any) => {
          if (record.status === 'pending') counts.pending++;
          else if (record.status === 'expired') counts.expired++;
          else if (record.status === 'resolved') counts.resolved++;
        });

        return { data: counts, error: null };
      });

    // 2. Pending by age (SLA tracking)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const { data: pendingRecords } = await supabaseAdmin
      .from('compensation_queue')
      .select('id, created_at, original_cost, action')
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    const pendingByAge = {
      critical_over_7_days: 0,      // SLA breach
      warning_24h_to_7d: 0,          // Warning zone
      ok_under_24h: 0,               // Healthy
      oldest_pending_hours: 0,
      total_pending_amount: 0,
    };

    pendingRecords?.forEach((record: any) => {
      const createdAt = new Date(record.created_at);
      const ageHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

      if (ageHours > 7 * 24) {
        pendingByAge.critical_over_7_days++;
      } else if (ageHours > 24) {
        pendingByAge.warning_24h_to_7d++;
      } else {
        pendingByAge.ok_under_24h++;
      }

      pendingByAge.total_pending_amount += parseFloat(record.original_cost || '0');
      pendingByAge.oldest_pending_hours = Math.max(pendingByAge.oldest_pending_hours, ageHours);
    });

    // 3. Resolution time stats (last 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const { data: resolvedRecords } = await supabaseAdmin
      .from('compensation_queue')
      .select('created_at, resolved_at')
      .eq('status', 'resolved')
      .gte('resolved_at', thirtyDaysAgo.toISOString())
      .not('resolved_at', 'is', null);

    const resolutionTimes: number[] = [];

    resolvedRecords?.forEach((record: any) => {
      const createdAt = new Date(record.created_at);
      const resolvedAt = new Date(record.resolved_at);
      const resolutionHours = (resolvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      resolutionTimes.push(resolutionHours);
    });

    const avgResolutionHours = resolutionTimes.length > 0
      ? resolutionTimes.reduce((sum, t) => sum + t, 0) / resolutionTimes.length
      : 0;

    const medianResolutionHours = resolutionTimes.length > 0
      ? resolutionTimes.sort((a, b) => a - b)[Math.floor(resolutionTimes.length / 2)]
      : 0;

    // 4. By action type
    const { data: byAction } = await supabaseAdmin
      .from('compensation_queue')
      .select('action, original_cost')
      .eq('status', 'pending')
      .then(({ data, error }) => {
        if (error) throw error;

        const actionStats: Record<string, { count: number; total_amount: number }> = {};

        data?.forEach((record: any) => {
          const action = record.action || 'unknown';
          if (!actionStats[action]) {
            actionStats[action] = { count: 0, total_amount: 0 };
          }
          actionStats[action].count++;
          actionStats[action].total_amount += parseFloat(record.original_cost || '0');
        });

        return { data: actionStats, error: null };
      });

    // 5. Recent activity (last 10 records)
    const { data: recentActivity } = await supabaseAdmin
      .from('compensation_queue')
      .select('id, user_id, action, original_cost, status, created_at, error_context')
      .order('created_at', { ascending: false })
      .limit(10);

    // ============================================
    // ALERTING STATUS
    // ============================================
    const alerts = [];

    if (pendingByAge.critical_over_7_days > 0) {
      alerts.push({
        severity: 'CRITICAL',
        message: `${pendingByAge.critical_over_7_days} record(s) pending da oltre 7 giorni (SLA breach)`,
        count: pendingByAge.critical_over_7_days,
      });
    }

    if (pendingByAge.warning_24h_to_7d > 5) {
      alerts.push({
        severity: 'WARNING',
        message: `${pendingByAge.warning_24h_to_7d} record(s) pending da 24h-7d (approaching SLA)`,
        count: pendingByAge.warning_24h_to_7d,
      });
    }

    if (pendingByAge.total_pending_amount > 1000) {
      alerts.push({
        severity: 'WARNING',
        message: `€${pendingByAge.total_pending_amount.toFixed(2)} in pending compensation (high exposure)`,
        amount: pendingByAge.total_pending_amount,
      });
    }

    // ============================================
    // RESPONSE
    // ============================================
    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      stats: {
        counts_by_status: countsByStatus,
        pending_by_age: pendingByAge,
        resolution_time: {
          avg_hours: Math.round(avgResolutionHours * 10) / 10,
          median_hours: Math.round(medianResolutionHours * 10) / 10,
          sample_size: resolutionTimes.length,
          period_days: 30,
        },
        by_action: byAction,
      },
      recent_activity: recentActivity,
      alerts,
      health_status: alerts.some(a => a.severity === 'CRITICAL') ? 'CRITICAL' :
                     alerts.length > 0 ? 'WARNING' : 'HEALTHY',
    });
  } catch (error: any) {
    console.error('❌ [COMPENSATION_STATS] Error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error',
      },
      { status: 500 }
    );
  }
}
