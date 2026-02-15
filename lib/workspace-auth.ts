/**
 * Workspace Auth - Acting Context con Workspace
 *
 * Estende safe-auth.ts con il contesto workspace.
 *
 * CRITICAL SECURITY RULES:
 * 1. Workspace ID viene dal cookie/header, validato dal middleware
 * 2. Membership viene verificata a ogni richiesta
 * 3. Fail-closed: se qualcosa non e' valido, ritorna null/error
 * 4. Superadmin puo accedere a qualsiasi workspace
 *
 * FLOW:
 * 1. Middleware valida cookie sp_workspace_id + session
 * 2. Middleware inietta header x-sec-workspace-id (se valido)
 * 3. getWorkspaceAuth() legge header e costruisce WorkspaceActingContext
 * 4. Business logic usa context.workspace per operazioni
 *
 * @module lib/workspace-auth
 */

import { getSafeAuth, ActingContext, isSuperAdmin } from '@/lib/safe-auth';
import { headers, cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/db/client';
import type {
  WorkspaceActingContext,
  WorkspaceContextInfo,
  WorkspaceMemberRole,
  WorkspacePermission,
  WorkspaceType,
  WorkspaceDepth,
  OrganizationBranding,
  UserWorkspaceInfo,
} from '@/types/workspace';
import {
  WORKSPACE_HEADER,
  WORKSPACE_COOKIE,
  WORKSPACE_STORAGE_KEY,
  isValidUUID,
} from '@/lib/workspace-constants';

// Re-export constants for backward compatibility
export { WORKSPACE_COOKIE, WORKSPACE_STORAGE_KEY } from '@/lib/workspace-constants';

// Re-export auth helpers per evitare import duali da safe-auth
export { isSuperAdmin } from '@/lib/safe-auth';

// ============================================
// WORKSPACE AUTH FUNCTIONS
// ============================================

/**
 * Get Workspace Auth - Ottiene ActingContext con workspace
 *
 * Questa funzione:
 * 1. Ottiene ActingContext da getSafeAuth()
 * 2. Legge workspace ID da header/cookie
 * 3. Verifica membership (o superadmin)
 * 4. Costruisce WorkspaceActingContext
 *
 * @returns WorkspaceActingContext o null se non autorizzato
 */
export async function getWorkspaceAuth(): Promise<WorkspaceActingContext | null> {
  try {
    // 1. Ottieni ActingContext base
    const baseContext = await getSafeAuth();

    if (!baseContext) {
      console.log('🔒 [WORKSPACE-AUTH] No base context');
      return null;
    }

    // 2. Leggi workspace ID (priorita: header > cookie)
    const headersList = await headers();
    let workspaceId = headersList.get(WORKSPACE_HEADER);

    if (!workspaceId) {
      // Fallback a cookie
      const cookieStore = await cookies();
      workspaceId = cookieStore.get(WORKSPACE_COOKIE)?.value || null;
    }

    // 3. Se no workspace ID, prova a usare primary_workspace_id dell'utente
    if (!workspaceId) {
      const { data: userData } = await supabaseAdmin
        .from('users')
        .select('primary_workspace_id')
        .eq('id', baseContext.target.id)
        .single();

      workspaceId = userData?.primary_workspace_id || null;
    }

    // 4. Se ancora no workspace ID, ritorna null (utente deve selezionare)
    if (!workspaceId) {
      console.log('🔒 [WORKSPACE-AUTH] No workspace ID found');
      return null;
    }

    // 5. Valida formato UUID
    if (!isValidUUID(workspaceId)) {
      console.error('❌ [WORKSPACE-AUTH] Invalid workspace ID format:', workspaceId);
      return null;
    }

    // 6. Verifica accesso al workspace
    const workspaceInfo = await getWorkspaceAccessInfo(
      workspaceId,
      baseContext.target.id,
      isSuperAdmin(baseContext)
    );

    if (!workspaceInfo) {
      console.error('❌ [WORKSPACE-AUTH] Access denied to workspace:', {
        workspaceId,
        userId: baseContext.target.id,
      });
      return null;
    }

    // 7. Costruisci WorkspaceActingContext
    return {
      actor: {
        id: baseContext.actor.id,
        email: baseContext.actor.email,
        name: baseContext.actor.name,
        role: baseContext.actor.role,
        account_type: baseContext.actor.account_type,
        is_reseller: baseContext.actor.is_reseller,
      },
      target: {
        id: baseContext.target.id,
        email: baseContext.target.email,
        name: baseContext.target.name,
        role: baseContext.target.role,
        account_type: baseContext.target.account_type,
        is_reseller: baseContext.target.is_reseller,
      },
      workspace: workspaceInfo,
      isImpersonating: baseContext.isImpersonating,
      metadata: baseContext.metadata,
    };
  } catch (error: any) {
    console.error('❌ [WORKSPACE-AUTH] Error:', error?.message);
    return null;
  }
}

/**
 * Require Workspace Auth - Wrapper che fa throw se non autorizzato
 *
 * @throws Error se non autenticato o no workspace access
 */
export async function requireWorkspaceAuth(): Promise<WorkspaceActingContext> {
  const context = await getWorkspaceAuth();

  if (!context) {
    throw new Error('UNAUTHORIZED: Workspace access required');
  }

  return context;
}

/**
 * Require Workspace Permission - Verifica permesso specifico
 *
 * @throws Error se non ha il permesso
 */
export async function requireWorkspacePermission(
  permission: WorkspacePermission
): Promise<WorkspaceActingContext> {
  const context = await requireWorkspaceAuth();

  if (!hasWorkspacePermission(context, permission)) {
    throw new Error(`FORBIDDEN: Missing permission '${permission}'`);
  }

  return context;
}

// ============================================
// PERMISSION HELPERS
// ============================================

/**
 * Verifica se il contesto ha un permesso specifico
 */
export function hasWorkspacePermission(
  context: WorkspaceActingContext,
  permission: WorkspacePermission
): boolean {
  // Superadmin ha tutti i permessi
  const actorAccountType = context.actor.account_type?.toLowerCase();
  if (actorAccountType === 'superadmin') {
    return true;
  }

  // Owner e Admin hanno tutti i permessi
  if (context.workspace.role === 'owner' || context.workspace.role === 'admin') {
    return true;
  }

  // Verifica permessi espliciti
  if (context.workspace.permissions.includes(permission)) {
    return true;
  }

  // Permessi impliciti per Operator
  if (context.workspace.role === 'operator') {
    const operatorPermissions: WorkspacePermission[] = [
      'shipments:create',
      'shipments:view',
      'shipments:track',
      'wallet:view',
      'contacts:view',
      'contacts:create',
    ];
    return operatorPermissions.includes(permission);
  }

  // Viewer: solo :view
  if (context.workspace.role === 'viewer') {
    return permission.endsWith(':view');
  }

  return false;
}

/**
 * Verifica se l'utente e' owner del workspace
 */
export function isWorkspaceOwner(context: WorkspaceActingContext): boolean {
  return context.workspace.role === 'owner';
}

/**
 * Verifica se l'utente e' admin o owner del workspace
 */
export function isWorkspaceAdmin(context: WorkspaceActingContext): boolean {
  return context.workspace.role === 'owner' || context.workspace.role === 'admin';
}

// ============================================
// WORKSPACE ACCESS HELPERS
// ============================================

/**
 * Ottiene info accesso workspace per un utente
 *
 * @internal
 */
async function getWorkspaceAccessInfo(
  workspaceId: string,
  userId: string,
  isSuperAdmin: boolean
): Promise<WorkspaceContextInfo | null> {
  try {
    // Superadmin: accesso diretto senza membership
    if (isSuperAdmin) {
      const { data: workspace, error } = await supabaseAdmin
        .from('workspaces')
        .select(
          `
          id,
          name,
          slug,
          type,
          depth,
          organization_id,
          wallet_balance,
          organizations!inner (
            id,
            name,
            slug,
            branding
          )
        `
        )
        .eq('id', workspaceId)
        .eq('status', 'active')
        .single();

      if (error || !workspace) {
        console.error('❌ [WORKSPACE-AUTH] Workspace not found:', error?.message);
        return null;
      }

      const org = workspace.organizations as any;

      return {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        type: workspace.type as WorkspaceType,
        depth: workspace.depth as WorkspaceDepth,
        organization_id: org.id,
        organization_name: org.name,
        organization_slug: org.slug,
        wallet_balance: Number(workspace.wallet_balance),
        role: 'owner' as WorkspaceMemberRole, // Superadmin ha sempre owner-level access
        permissions: [], // Superadmin non ha bisogno di permessi espliciti
        branding: (org.branding || {}) as OrganizationBranding,
      };
    }

    // Utente normale: verifica membership diretta
    const { data: membership, error } = await supabaseAdmin
      .from('workspace_members')
      .select(
        `
        id,
        role,
        permissions,
        status,
        workspaces!inner (
          id,
          name,
          slug,
          type,
          depth,
          organization_id,
          wallet_balance,
          status,
          organizations!inner (
            id,
            name,
            slug,
            branding,
            status
          )
        )
      `
      )
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .eq('status', 'active')
      .single();

    if (!error && membership) {
      const workspace = membership.workspaces as any;
      const org = workspace.organizations as any;

      // Verifica workspace e org sono attivi
      if (workspace.status !== 'active' || org.status !== 'active') {
        console.log('🔒 [WORKSPACE-AUTH] Workspace or org not active');
        return null;
      }

      return {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        type: workspace.type as WorkspaceType,
        depth: workspace.depth as WorkspaceDepth,
        organization_id: org.id,
        organization_name: org.name,
        organization_slug: org.slug,
        wallet_balance: Number(workspace.wallet_balance),
        role: membership.role as WorkspaceMemberRole,
        permissions: (membership.permissions || []) as WorkspacePermission[],
        branding: (org.branding || {}) as OrganizationBranding,
      };
    }

    // Fallback: reseller accede a workspace figlio (parent e' un suo workspace)
    const { data: childWs, error: childErr } = await supabaseAdmin
      .from('workspaces')
      .select(
        `
        id,
        name,
        slug,
        type,
        depth,
        organization_id,
        wallet_balance,
        status,
        parent_workspace_id,
        organizations!inner (
          id,
          name,
          slug,
          branding,
          status
        )
      `
      )
      .eq('id', workspaceId)
      .eq('status', 'active')
      .single();

    if (childErr || !childWs || !childWs.parent_workspace_id) {
      console.log('🔒 [WORKSPACE-AUTH] No membership and no parent workspace:', {
        workspaceId,
        userId,
      });
      return null;
    }

    // Verifica che l'utente sia owner/admin del workspace parent
    const { data: parentMembership } = await supabaseAdmin
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', childWs.parent_workspace_id)
      .eq('user_id', userId)
      .eq('status', 'active')
      .in('role', ['owner', 'admin'])
      .single();

    if (!parentMembership) {
      console.log('🔒 [WORKSPACE-AUTH] Not owner/admin of parent workspace:', {
        workspaceId,
        parentWorkspaceId: childWs.parent_workspace_id,
        userId,
      });
      return null;
    }

    const org = (childWs as any).organizations as any;

    if (org.status !== 'active') {
      console.log('🔒 [WORKSPACE-AUTH] Org not active for child workspace');
      return null;
    }

    return {
      id: childWs.id,
      name: childWs.name,
      slug: childWs.slug,
      type: childWs.type as WorkspaceType,
      depth: childWs.depth as WorkspaceDepth,
      organization_id: org.id,
      organization_name: org.name,
      organization_slug: org.slug,
      wallet_balance: Number(childWs.wallet_balance),
      role: 'admin' as WorkspaceMemberRole, // Reseller ha accesso admin sui figli
      permissions: [] as WorkspacePermission[],
      branding: (org.branding || {}) as OrganizationBranding,
    };
  } catch (error: any) {
    console.error('❌ [WORKSPACE-AUTH] Error getting workspace access:', error?.message);
    return null;
  }
}

/**
 * Ottiene tutti i workspace accessibili da un utente
 */
export async function getUserWorkspaces(userId?: string): Promise<UserWorkspaceInfo[]> {
  try {
    // Se no userId, usa utente corrente
    if (!userId) {
      const context = await getSafeAuth();
      if (!context) {
        return [];
      }
      userId = context.target.id;
    }

    // Chiama RPC
    const { data, error } = await supabaseAdmin.rpc('get_user_workspaces', {
      p_user_id: userId,
    });

    if (error) {
      console.error('❌ [WORKSPACE-AUTH] Error getting user workspaces:', error.message);
      return [];
    }

    return (data || []).map((row: any) => ({
      workspace_id: row.workspace_id,
      workspace_name: row.workspace_name,
      workspace_slug: row.workspace_slug,
      workspace_type: row.workspace_type as WorkspaceType,
      workspace_depth: row.workspace_depth as WorkspaceDepth,
      organization_id: row.organization_id,
      organization_name: row.organization_name,
      organization_slug: row.organization_slug,
      role: row.role as WorkspaceMemberRole,
      permissions: (row.permissions || []) as WorkspacePermission[],
      wallet_balance: Number(row.wallet_balance),
      branding: (row.branding || {}) as OrganizationBranding,
      member_status: row.member_status,
    }));
  } catch (error: any) {
    console.error('❌ [WORKSPACE-AUTH] Error:', error?.message);
    return [];
  }
}

/**
 * Imposta workspace corrente per l'utente
 *
 * @returns true se successo, false se errore
 */
export async function setCurrentWorkspace(workspaceId: string): Promise<boolean> {
  try {
    const context = await getSafeAuth();
    if (!context) {
      return false;
    }

    // Verifica accesso
    const hasAccess = await getWorkspaceAccessInfo(
      workspaceId,
      context.target.id,
      isSuperAdmin(context)
    );

    if (!hasAccess) {
      console.error('❌ [WORKSPACE-AUTH] Cannot set workspace - no access');
      return false;
    }

    // Aggiorna primary_workspace_id in DB
    const { error } = await supabaseAdmin
      .from('users')
      .update({ primary_workspace_id: workspaceId })
      .eq('id', context.target.id);

    if (error) {
      console.error('❌ [WORKSPACE-AUTH] Error updating primary workspace:', error.message);
      return false;
    }

    console.log('✅ [WORKSPACE-AUTH] Current workspace set:', {
      userId: context.target.id,
      workspaceId,
    });

    return true;
  } catch (error: any) {
    console.error('❌ [WORKSPACE-AUTH] Error:', error?.message);
    return false;
  }
}

// ============================================
// API HELPERS
// ============================================

/**
 * Ottiene workspace ID da headers (iniettato dal middleware)
 *
 * Usare in API routes quando serve solo l'ID senza full context.
 * Per operazioni che richiedono permessi, usare getWorkspaceAuth().
 *
 * @param requestHeaders - Headers dalla request (opzionale, usa headers() se non fornito)
 * @returns workspace_id o null
 *
 * SECURITY:
 * - Il header x-sec-workspace-id e' impostato SOLO dal middleware
 * - Il middleware rimuove qualsiasi header client-supplied
 * - Questo e' sicuro da usare senza ulteriori validazioni
 *
 * @example
 * ```ts
 * // In API route
 * export async function GET(request: NextRequest) {
 *   const workspaceId = await getWorkspaceIdFromHeaders();
 *   if (!workspaceId) {
 *     return NextResponse.json({ error: 'No workspace selected' }, { status: 400 });
 *   }
 *   // ... use workspaceId
 * }
 * ```
 */
export async function getWorkspaceIdFromHeaders(requestHeaders?: Headers): Promise<string | null> {
  try {
    const hdrs = requestHeaders || (await headers());
    const workspaceId = hdrs.get(WORKSPACE_HEADER);

    if (!isValidUUID(workspaceId)) {
      console.error('❌ [WORKSPACE-AUTH] Invalid workspace ID in header:', workspaceId);
      return null;
    }

    return workspaceId;
  } catch (error: any) {
    console.error('❌ [WORKSPACE-AUTH] Error reading workspace header:', error?.message);
    return null;
  }
}

/**
 * Verifica se l'utente ha accesso a un workspace specifico
 *
 * @param workspaceId - ID del workspace da verificare
 * @param userId - ID dell'utente (opzionale, usa utente corrente)
 * @returns true se ha accesso, false altrimenti
 */
export async function hasWorkspaceAccess(workspaceId: string, userId?: string): Promise<boolean> {
  try {
    const context = await getSafeAuth();
    if (!context) {
      return false;
    }

    const targetUserId = userId || context.target.id;
    const workspaceInfo = await getWorkspaceAccessInfo(
      workspaceId,
      targetUserId,
      isSuperAdmin(context)
    );

    return workspaceInfo !== null;
  } catch {
    return false;
  }
}

// ============================================
// AUDIT HELPERS
// ============================================

/**
 * Log audit con workspace context
 */
export async function logWorkspaceAudit(
  context: WorkspaceActingContext,
  action: string,
  resourceType: string,
  resourceId: string,
  auditMetadata: Record<string, any> = {}
): Promise<void> {
  try {
    const { error } = await supabaseAdmin.from('audit_logs').insert({
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      user_id: context.target.id, // Legacy field
      actor_id: context.actor.id,
      target_id: context.target.id,
      workspace_id: context.workspace.id,
      impersonation_active: context.isImpersonating,
      audit_metadata: {
        ...auditMetadata,
        // PRIVACY: No email in audit logs - only IDs for GDPR compliance
        workspace_name: context.workspace.name,
        workspace_type: context.workspace.type,
        request_id: context.metadata?.requestId,
      },
    });

    if (error) {
      console.error('❌ [AUDIT] Error logging workspace audit:', error.message);
    }
  } catch (error: any) {
    console.error('❌ [AUDIT] Unexpected error:', error?.message);
  }
}
