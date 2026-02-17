'use server';

/**
 * Server Actions per Automation Engine (Piattaforma)
 *
 * 5 azioni admin per governare le automazioni:
 * - Lista automazioni con ultimo run
 * - Toggle on/off
 * - Modifica config
 * - Esegui manualmente
 * - Storico esecuzioni
 */

import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { executeAutomation } from '@/lib/automations/dispatcher';
import type { Automation, AutomationRun, AutomationWithLastRun } from '@/types/automations';

// ─── HELPER: Validazione UUID v4 ───

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

// ─── HELPER: Validazione config vs config_schema ───

function validateConfigAgainstSchema(
  config: Record<string, unknown>,
  schema: Record<string, unknown> | null
): string | null {
  if (!schema || typeof schema !== 'object') return null;

  const properties = schema.properties as Record<string, { type?: string }> | undefined;
  if (!properties) return null;

  for (const [key, prop] of Object.entries(properties)) {
    if (key in config && prop?.type) {
      const value = config[key];
      const expectedType = prop.type;

      if (expectedType === 'boolean' && typeof value !== 'boolean') {
        return `Campo "${key}" deve essere boolean`;
      }
      if (expectedType === 'number' && typeof value !== 'number') {
        return `Campo "${key}" deve essere number`;
      }
      if (expectedType === 'string' && typeof value !== 'string') {
        return `Campo "${key}" deve essere string`;
      }
    }
  }

  // Rifiuta chiavi non presenti nello schema
  for (const key of Object.keys(config)) {
    if (!(key in properties)) {
      return `Campo "${key}" non ammesso nello schema`;
    }
  }

  return null;
}

// ─── HELPER: Verifica accesso admin ───

async function requireAdmin(): Promise<{ userId: string } | { error: string }> {
  try {
    const context = await getWorkspaceAuth();
    if (!context?.actor?.email) {
      return { error: 'Non autenticato' };
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, account_type, role')
      .eq('email', context.actor.email)
      .single();

    if (error || !user) {
      return { error: 'Utente non trovato' };
    }

    const isAdmin =
      user.account_type === 'superadmin' ||
      user.account_type === 'admin' ||
      user.role === 'admin' ||
      user.role === 'superadmin';

    if (!isAdmin) {
      return { error: 'Solo admin può gestire automazioni piattaforma' };
    }

    return { userId: user.id };
  } catch (err: any) {
    return { error: err.message || 'Errore verifica permessi' };
  }
}

// ─── 1. Lista automazioni con ultimo run ───

export async function getAutomations(): Promise<{
  success: boolean;
  automations?: AutomationWithLastRun[];
  error?: string;
}> {
  const auth = await requireAdmin();
  if ('error' in auth) return { success: false, error: auth.error };

  const { data: automations, error } = await supabaseAdmin
    .from('automations')
    .select('*')
    .order('category', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    return { success: false, error: error.message };
  }

  // Per ogni automazione, carica ultimo run
  const result: AutomationWithLastRun[] = [];
  for (const auto of automations || []) {
    const { data: lastRuns } = await supabaseAdmin
      .from('automation_runs')
      .select('*')
      .eq('automation_id', auto.id)
      .order('started_at', { ascending: false })
      .limit(1);

    result.push({
      ...auto,
      lastRun: lastRuns && lastRuns.length > 0 ? (lastRuns[0] as AutomationRun) : null,
    });
  }

  return { success: true, automations: result };
}

// ─── 2. Toggle on/off ───

export async function toggleAutomationEnabled(
  automationId: string,
  enabled: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!isValidUUID(automationId)) return { success: false, error: 'ID automazione non valido' };
  if (typeof enabled !== 'boolean') return { success: false, error: 'Valore enabled non valido' };

  const auth = await requireAdmin();
  if ('error' in auth) return { success: false, error: auth.error };

  const { error } = await supabaseAdmin
    .from('automations')
    .update({ enabled })
    .eq('id', automationId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ─── 3. Modifica config ───

export async function updateAutomationConfig(
  automationId: string,
  config: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  if (!isValidUUID(automationId)) return { success: false, error: 'ID automazione non valido' };
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return { success: false, error: 'Config non valida' };
  }

  const auth = await requireAdmin();
  if ('error' in auth) return { success: false, error: auth.error };

  // Carica config_schema per validazione
  const { data: automation } = await supabaseAdmin
    .from('automations')
    .select('config_schema')
    .eq('id', automationId)
    .single();

  if (!automation) {
    return { success: false, error: 'Automazione non trovata' };
  }

  // Valida config contro schema
  const validationError = validateConfigAgainstSchema(
    config,
    automation.config_schema as Record<string, unknown> | null
  );
  if (validationError) {
    return { success: false, error: validationError };
  }

  const { error } = await supabaseAdmin
    .from('automations')
    .update({ config })
    .eq('id', automationId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}

// ─── 4. Esegui manualmente ───

export async function runAutomationManually(automationId: string): Promise<{
  success: boolean;
  run?: AutomationRun;
  error?: string;
}> {
  if (!isValidUUID(automationId)) return { success: false, error: 'ID automazione non valido' };

  const auth = await requireAdmin();
  if ('error' in auth) return { success: false, error: auth.error };

  // Recupera automazione
  const { data: automation, error: fetchError } = await supabaseAdmin
    .from('automations')
    .select('*')
    .eq('id', automationId)
    .single();

  if (fetchError || !automation) {
    return { success: false, error: 'Automazione non trovata' };
  }

  // Esegui (trigger: manual)
  const run = await executeAutomation(automation as Automation, 'manual', auth.userId);

  return {
    success: run.status !== 'failure',
    run,
  };
}

// ─── 5. Storico esecuzioni ───

export async function getAutomationRuns(
  automationId: string,
  limit: number = 20
): Promise<{
  success: boolean;
  runs?: AutomationRun[];
  error?: string;
}> {
  if (!isValidUUID(automationId)) return { success: false, error: 'ID automazione non valido' };
  if (typeof limit !== 'number' || limit < 1 || limit > 100) {
    limit = 20;
  }

  const auth = await requireAdmin();
  if ('error' in auth) return { success: false, error: auth.error };

  const { data: runs, error } = await supabaseAdmin
    .from('automation_runs')
    .select('*')
    .eq('automation_id', automationId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, runs: (runs || []) as AutomationRun[] };
}
