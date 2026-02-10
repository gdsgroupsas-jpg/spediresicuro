/**
 * WMS: Verifica accesso workspace con permessi granulari
 *
 * Helper condiviso usato da tutte le route API WMS
 * Evita duplicazione della logica auth in ogni file route
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

  const { data: membership } = await supabaseAdmin
    .from('workspace_members')
    .select('role, permissions, status')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  if (!membership || membership.status !== 'active') {
    return { allowed: false, reason: 'Non sei membro di questo workspace' };
  }

  const hasPermission = memberHasPermission(
    { role: membership.role as WorkspaceMemberRole, permissions: membership.permissions || [] },
    permission
  );

  if (!hasPermission) {
    return { allowed: false, reason: `Permesso '${permission}' richiesto` };
  }

  return { allowed: true };
}
