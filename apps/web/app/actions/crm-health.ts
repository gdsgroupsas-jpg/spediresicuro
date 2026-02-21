'use server';

/**
 * Server Actions: CRM Health Alerts
 *
 * Valuta le health rules su lead (admin) e prospect (reseller)
 * e restituisce alert con severity per la UI.
 *
 * Pattern: requireSafeAuth() + isSuperAdmin() per admin,
 *          getWorkspaceAuth() per reseller.
 *
 * @module app/actions/crm-health
 */

import { requireSafeAuth } from '@/lib/safe-auth';
import { getWorkspaceAuth, isSuperAdmin } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { evaluateHealthRules, type CrmAlert, type HealthCheckEntity } from '@/lib/crm/health-rules';

// ============================================
// TYPES
// ============================================

interface ActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface HealthAlertsSummary {
  alerts: CrmAlert[];
  totalCritical: number;
  totalWarning: number;
  totalInfo: number;
}

// ============================================
// SERVER ACTIONS
// ============================================

/**
 * Health alerts per Lead piattaforma (admin/superadmin)
 */
export async function getCrmHealthAlerts(): Promise<ActionResult<HealthAlertsSummary>> {
  try {
    const session = await requireSafeAuth();
    if (!isSuperAdmin(session)) {
      return { success: false, error: 'Accesso negato — solo admin' };
    }

    const { data: rows, error } = await supabaseAdmin
      .from('leads')
      .select('id, company_name, status, lead_score, created_at, last_contact_at, updated_at')
      .not('status', 'eq', 'won');

    if (error) {
      console.error('[crm-health] errore query leads:', error);
      return { success: false, error: 'Errore caricamento dati lead' };
    }

    const entities = (rows || []) as HealthCheckEntity[];
    const now = new Date();
    const alerts = evaluateHealthRules(entities, 'lead', now);

    // Ordina: critical prima, poi warning, poi info
    const levelOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => (levelOrder[a.level] ?? 3) - (levelOrder[b.level] ?? 3));

    return {
      success: true,
      data: {
        alerts,
        totalCritical: alerts.filter((a) => a.level === 'critical').length,
        totalWarning: alerts.filter((a) => a.level === 'warning').length,
        totalInfo: alerts.filter((a) => a.level === 'info').length,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
    console.error('[crm-health] getCrmHealthAlerts:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Health alerts per Prospect reseller (workspace-scoped)
 */
export async function getProspectHealthAlerts(): Promise<ActionResult<HealthAlertsSummary>> {
  try {
    const wsAuth = await getWorkspaceAuth();
    if (!wsAuth) return { success: false, error: 'Non autorizzato' };

    const workspaceId = wsAuth.workspace.id;

    const { data: rows, error } = await supabaseAdmin
      .from('reseller_prospects')
      .select('id, company_name, status, lead_score, created_at, last_contact_at, updated_at')
      .eq('workspace_id', workspaceId)
      .not('status', 'eq', 'won');

    if (error) {
      console.error('[crm-health] errore query prospects:', error);
      return { success: false, error: 'Errore caricamento dati prospect' };
    }

    const entities = (rows || []) as HealthCheckEntity[];
    const now = new Date();
    const alerts = evaluateHealthRules(entities, 'prospect', now);

    // Ordina: critical prima, poi warning, poi info
    const levelOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    alerts.sort((a, b) => (levelOrder[a.level] ?? 3) - (levelOrder[b.level] ?? 3));

    return {
      success: true,
      data: {
        alerts,
        totalCritical: alerts.filter((a) => a.level === 'critical').length,
        totalWarning: alerts.filter((a) => a.level === 'warning').length,
        totalInfo: alerts.filter((a) => a.level === 'info').length,
      },
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Errore sconosciuto';
    console.error('[crm-health] getProspectHealthAlerts:', msg);
    return { success: false, error: msg };
  }
}
