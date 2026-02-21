'use server';

/**
 * Server Actions: CRM Analytics
 *
 * Fornisce dati analytics per lead (admin) e prospect (reseller).
 * Mappa le entita DB in CrmAnalyticsEntity e chiama computeCrmAnalytics().
 *
 * Le funzioni di mapping pure sono in lib/crm/analytics-mapping.ts
 * (in un file 'use server' tutte le export devono essere async).
 *
 * @module app/actions/crm-analytics
 */

import { requireSafeAuth } from '@/lib/safe-auth';
import { getWorkspaceAuth, isSuperAdmin } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { computeCrmAnalytics } from '@/lib/crm/analytics';
import type { CrmAnalyticsData } from '@/lib/crm/analytics';
import { mapLeadsToCrmEntities, mapProspectsToCrmEntities } from '@/lib/crm/analytics-mapping';
import type { LeadRow, ProspectRow } from '@/lib/crm/analytics-mapping';

// ============================================
// TYPES
// ============================================

interface ActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================
// SERVER ACTIONS
// ============================================

/**
 * Analytics per Lead platform (admin/superadmin)
 */
export async function getLeadAnalytics(): Promise<ActionResult<CrmAnalyticsData>> {
  try {
    const session = await requireSafeAuth();
    if (!isSuperAdmin(session)) {
      return { success: false, error: 'Accesso negato — solo admin' };
    }

    const { data: rows, error } = await supabaseAdmin
      .from('leads')
      .select(
        'id, status, lead_score, lead_source, source, sector, geographic_zone, estimated_monthly_volume, created_at, updated_at, converted_at, last_contact_at'
      );

    if (error) {
      console.error('[crm-analytics] errore query leads:', error);
      return { success: false, error: 'Errore caricamento dati lead' };
    }

    const entities = mapLeadsToCrmEntities((rows || []) as LeadRow[]);
    const analytics = computeCrmAnalytics(entities);

    return { success: true, data: analytics };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
    console.error('[crm-analytics] getLeadAnalytics:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Analytics per Prospect reseller (workspace-scoped)
 */
export async function getProspectAnalytics(): Promise<ActionResult<CrmAnalyticsData>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autorizzato' };

    const workspaceId = wsAuth.workspace.id;

    const { data: rows, error } = await supabaseAdmin
      .from('reseller_prospects')
      .select(
        'id, status, lead_score, sector, estimated_monthly_volume, estimated_monthly_value, created_at, updated_at, converted_at, last_contact_at'
      )
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('[crm-analytics] errore query prospects:', error);
      return { success: false, error: 'Errore caricamento dati prospect' };
    }

    const entities = mapProspectsToCrmEntities((rows || []) as ProspectRow[]);
    const analytics = computeCrmAnalytics(entities);

    return { success: true, data: analytics };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
    console.error('[crm-analytics] getProspectAnalytics:', msg);
    return { success: false, error: msg };
  }
}
