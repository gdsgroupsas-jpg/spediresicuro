/**
 * Workspace Injection Helpers
 *
 * Funzioni per iniettare workspace_id nelle operazioni database.
 *
 * STRATEGIA:
 * 1. Per INSERT: Aggiunge workspace_id al payload se disponibile
 * 2. Per SELECT/UPDATE/DELETE: Aggiunge filtro workspace_id alla query
 * 3. Backward-compatible: Se workspace_id non disponibile, operazioni continuano (nullable)
 *
 * SECURITY:
 * - workspace_id viene dal cookie httpOnly (impostato da API)
 * - Validato come UUID prima dell'uso
 * - Superadmin può accedere a tutti i workspace (bypass filter)
 *
 * @module lib/workspace-injection
 */

import { headers, cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================
// CONSTANTS
// ============================================

/** Header iniettato dal middleware */
const WORKSPACE_HEADER = 'x-sec-workspace-id';

/** Cookie per workspace ID */
const WORKSPACE_COOKIE = 'sec-workspace-id';

/** UUID regex per validazione */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ============================================
// WORKSPACE ID RETRIEVAL
// ============================================

/**
 * Ottiene workspace_id corrente (server-side)
 *
 * PRIORITÀ:
 * 1. Header x-sec-workspace-id (iniettato da middleware)
 * 2. Cookie sec-workspace-id (fallback)
 *
 * @returns workspace_id o null se non disponibile/invalido
 */
export async function getCurrentWorkspaceId(): Promise<string | null> {
  try {
    // 1. Prova header (iniettato da middleware - più sicuro)
    const hdrs = await headers();
    let workspaceId = hdrs.get(WORKSPACE_HEADER);

    // 2. Fallback a cookie
    if (!workspaceId) {
      const cookieStore = await cookies();
      workspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value || null;
    }

    // 3. Valida formato UUID
    if (!workspaceId || !UUID_REGEX.test(workspaceId)) {
      return null;
    }

    return workspaceId;
  } catch (error) {
    // In contesto non-request (es. cron jobs), ritorna null
    console.warn('⚠️ [WORKSPACE-INJECTION] Cannot get workspace_id (non-request context)');
    return null;
  }
}

/**
 * Versione sincrona per contesti dove headers() non è disponibile
 * NOTA: Richiede che workspaceId sia passato esplicitamente
 */
export function validateWorkspaceId(workspaceId: string | null | undefined): string | null {
  if (!workspaceId || !UUID_REGEX.test(workspaceId)) {
    return null;
  }
  return workspaceId;
}

// ============================================
// PAYLOAD INJECTION
// ============================================

/**
 * Inietta workspace_id in un payload per INSERT
 *
 * COMPORTAMENTO:
 * - Se workspace_id disponibile, lo aggiunge al payload
 * - Se già presente nel payload, NON sovrascrive (rispetta esplicito)
 * - Se non disponibile, payload rimane invariato (backward-compatible)
 *
 * @param payload - Payload originale
 * @param explicitWorkspaceId - Workspace ID esplicito (opzionale)
 * @returns Payload con workspace_id (se disponibile)
 */
export async function injectWorkspaceId<T extends Record<string, any>>(
  payload: T,
  explicitWorkspaceId?: string | null
): Promise<T & { workspace_id?: string }> {
  // Se workspace_id già nel payload, non sovrascrivere
  if ('workspace_id' in payload && payload.workspace_id) {
    return payload as T & { workspace_id?: string };
  }

  // Usa esplicito se fornito, altrimenti recupera da context
  const workspaceId = explicitWorkspaceId
    ? validateWorkspaceId(explicitWorkspaceId)
    : await getCurrentWorkspaceId();

  if (workspaceId) {
    return {
      ...payload,
      workspace_id: workspaceId,
    };
  }

  // Nessun workspace_id disponibile - ritorna payload originale
  return payload as T & { workspace_id?: string };
}

/**
 * Versione sincrona di injectWorkspaceId
 * NOTA: Richiede workspaceId esplicito
 */
export function injectWorkspaceIdSync<T extends Record<string, any>>(
  payload: T,
  workspaceId: string | null | undefined
): T & { workspace_id?: string } {
  // Se workspace_id già nel payload, non sovrascrivere
  if ('workspace_id' in payload && payload.workspace_id) {
    return payload as T & { workspace_id?: string };
  }

  const validatedId = validateWorkspaceId(workspaceId);

  if (validatedId) {
    return {
      ...payload,
      workspace_id: validatedId,
    };
  }

  return payload as T & { workspace_id?: string };
}

// ============================================
// QUERY FILTERING
// ============================================

/**
 * Aggiunge filtro workspace_id a una query Supabase
 *
 * COMPORTAMENTO:
 * - Se workspace_id disponibile, aggiunge .eq('workspace_id', id)
 * - Se bypassFilter=true, non aggiunge filtro (per superadmin)
 * - Se non disponibile, ritorna query originale (backward-compatible)
 *
 * NOTA: Questa funzione è type-safe ma richiede che la query sia già iniziata
 *
 * @param query - Query Supabase builder
 * @param workspaceId - Workspace ID (opzionale, recupera da context se non fornito)
 * @param bypassFilter - Se true, non aggiunge filtro (default: false)
 * @returns Query con filtro workspace_id (se applicabile)
 */
export async function addWorkspaceFilter<T>(
  query: T,
  workspaceId?: string | null,
  bypassFilter: boolean = false
): Promise<T> {
  if (bypassFilter) {
    return query;
  }

  const resolvedId = workspaceId ? validateWorkspaceId(workspaceId) : await getCurrentWorkspaceId();

  if (resolvedId && typeof (query as any).eq === 'function') {
    return (query as any).eq('workspace_id', resolvedId) as T;
  }

  return query;
}

/**
 * Versione sincrona di addWorkspaceFilter
 */
export function addWorkspaceFilterSync<T>(
  query: T,
  workspaceId: string | null | undefined,
  bypassFilter: boolean = false
): T {
  if (bypassFilter) {
    return query;
  }

  const resolvedId = validateWorkspaceId(workspaceId);

  if (resolvedId && typeof (query as any).eq === 'function') {
    return (query as any).eq('workspace_id', resolvedId) as T;
  }

  return query;
}

// ============================================
// BULK OPERATIONS
// ============================================

/**
 * Inietta workspace_id in un array di payload
 *
 * @param payloads - Array di payload
 * @param workspaceId - Workspace ID (opzionale)
 * @returns Array di payload con workspace_id
 */
export async function injectWorkspaceIdBulk<T extends Record<string, any>>(
  payloads: T[],
  workspaceId?: string | null
): Promise<(T & { workspace_id?: string })[]> {
  const resolvedId = workspaceId ? validateWorkspaceId(workspaceId) : await getCurrentWorkspaceId();

  if (!resolvedId) {
    return payloads as (T & { workspace_id?: string })[];
  }

  return payloads.map((payload) => {
    if ('workspace_id' in payload && payload.workspace_id) {
      return payload as T & { workspace_id?: string };
    }
    return {
      ...payload,
      workspace_id: resolvedId,
    };
  });
}

// ============================================
// CONTEXT HELPERS
// ============================================

/**
 * Crea contesto workspace per operazioni batch
 *
 * Utile quando si devono eseguire multiple operazioni
 * e si vuole evitare di chiamare getCurrentWorkspaceId() ogni volta.
 *
 * @returns WorkspaceContext con helpers pre-bound
 */
export async function createWorkspaceContext() {
  const workspaceId = await getCurrentWorkspaceId();

  return {
    workspaceId,
    hasWorkspace: !!workspaceId,

    /** Inietta workspace_id in payload (sync) */
    inject: <T extends Record<string, any>>(payload: T) =>
      injectWorkspaceIdSync(payload, workspaceId),

    /** Inietta workspace_id in array di payload (sync) */
    injectBulk: <T extends Record<string, any>>(payloads: T[]) =>
      payloads.map((p) => injectWorkspaceIdSync(p, workspaceId)),

    /** Aggiunge filtro workspace_id a query (sync) */
    filter: <T>(query: T, bypass: boolean = false) =>
      addWorkspaceFilterSync(query, workspaceId, bypass),
  };
}

// ============================================
// AUDIT HELPERS
// ============================================

/**
 * Crea metadata audit con workspace context
 *
 * @param action - Azione eseguita
 * @param resourceType - Tipo risorsa
 * @param resourceId - ID risorsa
 * @param additionalMetadata - Metadata aggiuntivo
 * @returns Payload per audit_logs
 */
export async function createAuditPayload(
  action: string,
  resourceType: string,
  resourceId: string,
  additionalMetadata: Record<string, any> = {}
) {
  const workspaceId = await getCurrentWorkspaceId();

  return {
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    workspace_id: workspaceId,
    metadata: additionalMetadata,
    created_at: new Date().toISOString(),
  };
}

// ============================================
// EXPORTS
// ============================================

const workspaceInjection = {
  getCurrentWorkspaceId,
  validateWorkspaceId,
  injectWorkspaceId,
  injectWorkspaceIdSync,
  addWorkspaceFilter,
  addWorkspaceFilterSync,
  injectWorkspaceIdBulk,
  createWorkspaceContext,
  createAuditPayload,
};

export default workspaceInjection;
