/**
 * API: Support Analytics (Admin)
 *
 * GET - KPI aggregate per dashboard supporto
 */

import { NextResponse } from 'next/server';
import { getSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { rateLimit } from '@/lib/security/rate-limit';

async function requireAdmin() {
  const auth = await getSafeAuth();
  if (!auth) return null;
  const role = auth.target.role;
  if (role !== 'admin' && role !== 'superadmin') return null;
  return auth;
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const rl = await rateLimit('support-analytics', auth.actor.id, {
    limit: 30,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // Fetch all data in parallel
    const [escalationsRes, patternsRes, notificationsRes, usageRes] = await Promise.all([
      supabaseAdmin.from('support_escalations').select('status, created_at, resolved_at'),
      supabaseAdmin
        .from('support_case_patterns')
        .select(
          'id, category, carrier, confidence_score, success_count, failure_count, is_active, human_validated'
        ),
      supabaseAdmin.from('support_notifications').select('type, channels_delivered, created_at'),
      supabaseAdmin.from('support_pattern_usage').select('outcome, created_at'),
    ]);

    // Escalations stats
    const escalations = escalationsRes.data || [];
    const byStatus = { open: 0, assigned: 0, resolved: 0, closed: 0 };
    const resolutionTimes: number[] = [];

    for (const e of escalations) {
      if (e.status in byStatus) byStatus[e.status as keyof typeof byStatus]++;
      if (e.status === 'resolved' && e.resolved_at && e.created_at) {
        const hours =
          (new Date(e.resolved_at).getTime() - new Date(e.created_at).getTime()) / (1000 * 60 * 60);
        resolutionTimes.push(hours);
      }
    }

    const avgResolutionHours =
      resolutionTimes.length > 0
        ? Math.round((resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length) * 10) /
          10
        : 0;

    const escalationsLast30 = escalations.filter((e) => e.created_at >= thirtyDaysAgo).length;

    // Patterns stats
    const patterns = patternsRes.data || [];
    const activePatterns = patterns.filter((p) => p.is_active);
    const validatedPatterns = patterns.filter((p) => p.human_validated);
    const avgConfidence =
      activePatterns.length > 0
        ? Math.round(
            (activePatterns.reduce((a, p) => a + (p.confidence_score || 0), 0) /
              activePatterns.length) *
              100
          ) / 100
        : 0;

    const topPatterns = activePatterns
      .sort((a, b) => (b.success_count || 0) - (a.success_count || 0))
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        category: p.category,
        carrier: p.carrier,
        confidence: p.confidence_score,
        usageCount: (p.success_count || 0) + (p.failure_count || 0),
      }));

    // Notifications stats
    const notifications = notificationsRes.data || [];
    const notifByType: Record<string, number> = {};
    const notifByChannel: Record<string, number> = {};

    for (const n of notifications) {
      notifByType[n.type] = (notifByType[n.type] || 0) + 1;
      if (Array.isArray(n.channels_delivered)) {
        for (const ch of n.channels_delivered) {
          notifByChannel[ch] = (notifByChannel[ch] || 0) + 1;
        }
      }
    }

    const notificationsLast30 = notifications.filter((n) => n.created_at >= thirtyDaysAgo).length;

    // Pattern usage stats
    const usage = usageRes.data || [];
    const byOutcome: Record<string, number> = {};
    for (const u of usage) {
      byOutcome[u.outcome] = (byOutcome[u.outcome] || 0) + 1;
    }
    const successRate =
      usage.length > 0
        ? Math.round(
            (((byOutcome['success'] || 0) + (byOutcome['partial'] || 0)) / usage.length) * 100
          )
        : 0;

    return NextResponse.json({
      success: true,
      escalations: {
        total: escalations.length,
        byStatus,
        avgResolutionHours,
        last30Days: escalationsLast30,
      },
      patterns: {
        total: patterns.length,
        active: activePatterns.length,
        humanValidated: validatedPatterns.length,
        avgConfidence,
        topPatterns,
      },
      notifications: {
        total: notifications.length,
        byType: notifByType,
        byChannel: notifByChannel,
        last30Days: notificationsLast30,
      },
      patternUsage: {
        total: usage.length,
        successRate,
        byOutcome,
      },
    });
  } catch (error: any) {
    console.error('[Support Analytics] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
