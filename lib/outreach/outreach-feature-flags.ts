/**
 * Outreach Feature Flags + Kill Switch — Sprint S3d Gap Fix
 *
 * Controlla l'abilitazione del sistema outreach:
 * 1. Kill Switch globale via env var (OUTREACH_KILL_SWITCH=true → blocca tutto)
 * 2. Feature flag per workspace via tabella outreach_channel_config
 * 3. Pilot workspace list via env var (OUTREACH_PILOT_WORKSPACES=ws-1,ws-2)
 *
 * Usato da:
 * - sequence-executor (pre-processing check)
 * - outreach-worker (pre-handling check)
 * - cron route (pre-execution check)
 */

import { supabaseAdmin } from '@/lib/db/client';

// ============================================
// KILL SWITCH GLOBALE
// ============================================

/**
 * Kill switch globale: se OUTREACH_KILL_SWITCH=true, blocca TUTTI gli invii.
 * Settabile senza deploy via Vercel Environment Variables.
 */
export function isOutreachKillSwitchActive(): boolean {
  return process.env.OUTREACH_KILL_SWITCH === 'true';
}

// ============================================
// PILOT WORKSPACE LIST
// ============================================

/**
 * Lista workspace abilitati per il pilot.
 * Se OUTREACH_PILOT_WORKSPACES non e' settato → tutte abilitate (post-pilot).
 * Se settato → solo i workspace nella lista.
 */
export function isWorkspaceEnabledForOutreach(workspaceId: string): boolean {
  if (isOutreachKillSwitchActive()) return false;

  const pilotList = process.env.OUTREACH_PILOT_WORKSPACES;
  if (!pilotList) return true; // Post-pilot: tutti abilitati

  const allowedWorkspaces = pilotList
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return allowedWorkspaces.includes(workspaceId);
}

// ============================================
// WORKSPACE FEATURE CHECK (DB)
// ============================================

/**
 * Verifica se un workspace ha almeno un canale outreach abilitato.
 * Combina feature flags env + configurazione DB.
 */
export async function isOutreachEnabledForWorkspace(workspaceId: string): Promise<boolean> {
  // 1. Kill switch globale
  if (isOutreachKillSwitchActive()) return false;

  // 2. Pilot workspace check
  if (!isWorkspaceEnabledForOutreach(workspaceId)) return false;

  // 3. Almeno un canale abilitato in DB
  const { data, error } = await supabaseAdmin
    .from('outreach_channel_config')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('enabled', true)
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[outreach-feature-flags] Errore check workspace:', error);
    return false;
  }

  return data !== null;
}
