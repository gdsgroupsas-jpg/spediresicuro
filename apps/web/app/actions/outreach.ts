'use server';

/**
 * Server Actions: Outreach Dashboard
 *
 * Fornisce dati per la dashboard outreach (admin e reseller).
 * Admin vede tutto, reseller solo il proprio workspace.
 *
 * Riusa: outreach-data-service, outreach-analytics, enrollment-service.
 *
 * @module app/actions/outreach
 */

import { requireSafeAuth } from '@/lib/safe-auth';
import { getWorkspaceAuth, isSuperAdmin } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { getOutreachMetrics } from '@/lib/outreach/outreach-analytics';
import { getSequences } from '@/lib/outreach/outreach-data-service';
import type {
  OutreachMetrics,
  OutreachSequence,
  Enrollment,
  EnrollmentStatus,
} from '@/types/outreach';

// ============================================
// TYPES
// ============================================

interface ActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface OutreachOverview {
  metrics: OutreachMetrics;
  activeEnrollments: number;
  totalSequences: number;
  activeSequences: number;
}

export interface EnrollmentWithMeta extends Enrollment {
  sequence_name?: string;
  entity_name?: string;
}

interface EnrollmentFilters {
  status?: EnrollmentStatus;
  sequenceId?: string;
}

// ============================================
// HELPER: Recupera workspace admin o reseller
// ============================================

async function getAdminWorkspaceIds(): Promise<string[]> {
  // Admin vede tutti i workspace
  const { data } = await supabaseAdmin.from('workspaces').select('id');
  return (data || []).map((w) => w.id);
}

// ============================================
// SERVER ACTIONS
// ============================================

/**
 * Panoramica outreach per admin (tutti i workspace)
 */
export async function getOutreachOverviewAdmin(): Promise<ActionResult<OutreachOverview>> {
  try {
    const session = await requireSafeAuth();
    if (!isSuperAdmin(session)) {
      return { success: false, error: 'Accesso negato — solo admin' };
    }

    // Metriche aggregate: query diretta senza filtro workspace
    const { data: execRows } = await supabaseAdmin
      .from('outreach_executions')
      .select('channel, status');

    // Conta enrollment attivi globali
    const { count: activeEnrollments } = await supabaseAdmin
      .from('outreach_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active');

    // Conta sequenze
    const { data: seqData } = await supabaseAdmin
      .from('outreach_sequences')
      .select('id, is_active');

    const totalSequences = seqData?.length ?? 0;
    const activeSequences = seqData?.filter((s) => s.is_active).length ?? 0;

    // Costruisci metriche dalle execution
    const metrics = buildMetricsFromRows(execRows || []);

    return {
      success: true,
      data: {
        metrics,
        activeEnrollments: activeEnrollments ?? 0,
        totalSequences,
        activeSequences,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
    return { success: false, error: msg };
  }
}

/**
 * Panoramica outreach per reseller (workspace-scoped)
 */
export async function getOutreachOverviewReseller(): Promise<ActionResult<OutreachOverview>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autorizzato' };

    const workspaceId = wsAuth.workspace.id;
    const metrics = await getOutreachMetrics(workspaceId);

    // Conta enrollment attivi
    const { count: activeEnrollments } = await supabaseAdmin
      .from('outreach_enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'active');

    // Sequenze workspace
    const sequences = await getSequences(workspaceId);

    return {
      success: true,
      data: {
        metrics,
        activeEnrollments: activeEnrollments ?? 0,
        totalSequences: sequences.length,
        activeSequences: sequences.filter((s) => s.is_active).length,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
    return { success: false, error: msg };
  }
}

/**
 * Lista enrollment per admin
 */
export async function getEnrollmentsAdmin(
  filters?: EnrollmentFilters
): Promise<ActionResult<EnrollmentWithMeta[]>> {
  try {
    const session = await requireSafeAuth();
    if (!isSuperAdmin(session)) {
      return { success: false, error: 'Accesso negato — solo admin' };
    }

    let query = supabaseAdmin
      .from('outreach_enrollments')
      .select('*, sequence:outreach_sequences(name)')
      .order('updated_at', { ascending: false })
      .limit(100);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.sequenceId) {
      query = query.eq('sequence_id', filters.sequenceId);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    const enrollments: EnrollmentWithMeta[] = (data || []).map((row: Record<string, unknown>) => {
      const seq = row.sequence as { name?: string } | null;
      return {
        ...(row as unknown as Enrollment),
        sequence_name: seq?.name ?? undefined,
      };
    });

    return { success: true, data: enrollments };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
    return { success: false, error: msg };
  }
}

/**
 * Lista enrollment per reseller (workspace-scoped)
 */
export async function getEnrollmentsReseller(
  filters?: EnrollmentFilters
): Promise<ActionResult<EnrollmentWithMeta[]>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autorizzato' };

    const workspaceId = wsAuth.workspace.id;

    let query = supabaseAdmin
      .from('outreach_enrollments')
      .select('*, sequence:outreach_sequences(name)')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(100);

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.sequenceId) {
      query = query.eq('sequence_id', filters.sequenceId);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    const enrollments: EnrollmentWithMeta[] = (data || []).map((row: Record<string, unknown>) => {
      const seq = row.sequence as { name?: string } | null;
      return {
        ...(row as unknown as Enrollment),
        sequence_name: seq?.name ?? undefined,
      };
    });

    return { success: true, data: enrollments };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
    return { success: false, error: msg };
  }
}

/**
 * Lista sequenze per admin
 */
export async function getSequencesAdmin(): Promise<ActionResult<OutreachSequence[]>> {
  try {
    const session = await requireSafeAuth();
    if (!isSuperAdmin(session)) {
      return { success: false, error: 'Accesso negato — solo admin' };
    }

    const { data, error } = await supabaseAdmin
      .from('outreach_sequences')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data: data || [] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
    return { success: false, error: msg };
  }
}

/**
 * Lista sequenze per reseller (workspace-scoped)
 */
export async function getSequencesReseller(): Promise<ActionResult<OutreachSequence[]>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autorizzato' };

    const sequences = await getSequences(wsAuth.workspace.id);
    return { success: true, data: sequences };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
    return { success: false, error: msg };
  }
}

// ============================================
// HELPER: Costruisci metriche dalle execution rows
// ============================================

function buildMetricsFromRows(rows: Array<{ channel: string; status: string }>): OutreachMetrics {
  const metrics: OutreachMetrics = {
    totalSent: 0,
    totalDelivered: 0,
    totalOpened: 0,
    totalReplied: 0,
    totalFailed: 0,
    deliveryRate: 0,
    openRate: 0,
    replyRate: 0,
    byChannel: {
      email: { sent: 0, delivered: 0, opened: 0, replied: 0, failed: 0 },
      whatsapp: { sent: 0, delivered: 0, opened: 0, replied: 0, failed: 0 },
      telegram: { sent: 0, delivered: 0, opened: 0, replied: 0, failed: 0 },
    },
  };

  for (const row of rows) {
    const ch = row.channel as 'email' | 'whatsapp' | 'telegram';
    const channelData = metrics.byChannel[ch];
    if (!channelData) continue;

    switch (row.status) {
      case 'sent':
        channelData.sent++;
        metrics.totalSent++;
        break;
      case 'delivered':
        channelData.sent++;
        channelData.delivered++;
        metrics.totalSent++;
        metrics.totalDelivered++;
        break;
      case 'opened':
        channelData.sent++;
        channelData.delivered++;
        channelData.opened++;
        metrics.totalSent++;
        metrics.totalDelivered++;
        metrics.totalOpened++;
        break;
      case 'replied':
        channelData.sent++;
        channelData.delivered++;
        channelData.opened++;
        channelData.replied++;
        metrics.totalSent++;
        metrics.totalDelivered++;
        metrics.totalOpened++;
        metrics.totalReplied++;
        break;
      case 'failed':
      case 'bounced':
        channelData.failed++;
        metrics.totalFailed++;
        break;
    }
  }

  if (metrics.totalSent > 0) {
    metrics.deliveryRate = metrics.totalDelivered / metrics.totalSent;
    metrics.openRate = metrics.totalOpened / metrics.totalSent;
    metrics.replyRate = metrics.totalReplied / metrics.totalSent;
  }

  return metrics;
}
