/**
 * WMS: Verifica accesso workspace con permessi granulari
 *
 * Helper condiviso usato da tutte le route API WMS
 * Evita duplicazione della logica auth in ogni file route
 *
 * Supporta:
 * - Membership diretta (membro del workspace)
 * - Accesso reseller parent → child workspace (solo lettura warehouse:view)
 */

import { supabaseAdmin } from '@/lib/db/client';
import { memberHasPermission, type WorkspaceMemberRole } from '@/types/workspace';

export type WmsPermission = 'warehouse:view' | 'warehouse:manage' | 'warehouse:inventory';

export async function verifyWmsAccess(
  userId: string,
  workspaceId: string,
  permission: WmsPermission,
  isSuperAdminUser: boolean
): Promise<{ allowed: boolean; reason?: string }> {
  if (isSuperAdminUser) return { allowed: true };

  // 1. Verifica membership diretta
  const { data: membership } = await supabaseAdmin
    .from('workspace_members')
    .select('role, permissions, status')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  if (membership && membership.status === 'active') {
    const hasPermission = memberHasPermission(
      { role: membership.role as WorkspaceMemberRole, permissions: membership.permissions || [] },
      permission
    );

    if (!hasPermission) {
      return { allowed: false, reason: `Permesso '${permission}' richiesto` };
    }

    return { allowed: true };
  }

  // 2. Fallback: verifica accesso reseller parent → child workspace
  // Il reseller (parent) puo' visualizzare (solo warehouse:view) il magazzino
  // dei workspace figli di cui e' owner/admin
  if (permission === 'warehouse:view') {
    const { data: parentAccess } = await supabaseAdmin
      .from('workspace_members')
      .select('role, status, workspaces!inner(id)')
      .eq('user_id', userId)
      .eq('status', 'active')
      .in('role', ['owner', 'admin']);

    if (parentAccess && parentAccess.length > 0) {
      // Verifica se il workspaceId richiesto e' figlio di uno dei workspace dell'utente
      const parentWorkspaceIds = parentAccess.map((m: any) => m.workspaces?.id).filter(Boolean);

      if (parentWorkspaceIds.length > 0) {
        const { data: childWs } = await supabaseAdmin
          .from('workspaces')
          .select('id')
          .eq('id', workspaceId)
          .in('parent_workspace_id', parentWorkspaceIds)
          .single();

        if (childWs) {
          return { allowed: true };
        }
      }
    }
  }

  return { allowed: false, reason: 'Non sei membro di questo workspace' };
}
