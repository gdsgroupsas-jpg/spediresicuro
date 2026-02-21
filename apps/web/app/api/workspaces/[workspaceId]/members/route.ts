/**
 * API: Workspace Members Management
 *
 * GET /api/workspaces/[workspaceId]/members
 * - Lista tutti i membri del workspace
 * - Richiede permesso members:view
 *
 * DELETE /api/workspaces/[workspaceId]/members?userId=xxx
 * - Rimuove un membro dal workspace
 * - Richiede permesso members:remove
 * - Non può rimuovere l'owner o se stesso
 *
 * PATCH /api/workspaces/[workspaceId]/members
 * - Modifica ruolo/permessi di un membro
 * - Richiede permesso members:edit_role
 *
 * SECURITY:
 * - Autenticazione obbligatoria
 * - Verifica membership attiva
 * - Verifica permessi granulari
 * - Audit log per ogni operazione
 * - NESSUNA email nei log (GDPR)
 *
 * @module api/workspaces/[workspaceId]/members
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth, isSuperAdmin } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { isValidUUID } from '@/lib/workspace-constants';
import {
  memberHasPermission,
  type WorkspaceMemberRole,
  type WorkspacePermission,
} from '@/types/workspace';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

/**
 * GET: Lista membri del workspace
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await params;

    // 1. Validazione UUID
    if (!isValidUUID(workspaceId)) {
      return NextResponse.json({ error: 'Invalid workspace ID format' }, { status: 400 });
    }

    // 2. Autenticazione
    const context = await getWorkspaceAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Verifica accesso al workspace
    const hasAccess = await verifyWorkspaceAccess(
      context.target.id,
      workspaceId,
      'members:view',
      isSuperAdmin(context)
    );

    if (!hasAccess.allowed) {
      return NextResponse.json({ error: hasAccess.reason || 'Access denied' }, { status: 403 });
    }

    // 4. Fetch membri con dati utente (senza email per privacy)
    const { data: members, error } = await supabaseAdmin
      .from('workspace_members')
      .select(
        `
        id,
        workspace_id,
        user_id,
        role,
        permissions,
        status,
        invited_by,
        accepted_at,
        created_at,
        updated_at,
        users:user_id (
          id,
          name,
          email,
          avatar_url
        )
      `
      )
      .eq('workspace_id', workspaceId)
      .neq('status', 'removed')
      .order('role', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching workspace members:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // 5. Mappa risultati (maschera email parzialmente per privacy)
    const mappedMembers = (members || []).map((m: any) => ({
      id: m.id,
      workspace_id: m.workspace_id,
      user_id: m.user_id,
      role: m.role,
      permissions: m.permissions || [],
      status: m.status,
      invited_by: m.invited_by,
      accepted_at: m.accepted_at,
      created_at: m.created_at,
      updated_at: m.updated_at,
      user: m.users
        ? {
            id: m.users.id,
            name: m.users.name || 'Utente',
            // Email mascherata: m***@domain.com
            email: maskEmail(m.users.email),
            avatar_url: m.users.avatar_url,
          }
        : null,
    }));

    return NextResponse.json({
      members: mappedMembers,
      count: mappedMembers.length,
    });
  } catch (error: any) {
    console.error('GET /api/workspaces/[id]/members error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE: Rimuovi membro dal workspace
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await params;
    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    // 1. Validazioni
    if (!isValidUUID(workspaceId)) {
      return NextResponse.json({ error: 'Invalid workspace ID format' }, { status: 400 });
    }

    if (!targetUserId || !isValidUUID(targetUserId)) {
      return NextResponse.json({ error: 'Invalid or missing userId parameter' }, { status: 400 });
    }

    // 2. Autenticazione
    const context = await getWorkspaceAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isSuperAdminUser = isSuperAdmin(context);

    // 3. Verifica accesso
    const hasAccess = await verifyWorkspaceAccess(
      context.target.id,
      workspaceId,
      'members:remove',
      isSuperAdminUser
    );

    if (!hasAccess.allowed) {
      return NextResponse.json({ error: hasAccess.reason || 'Access denied' }, { status: 403 });
    }

    // 4. Non può rimuovere se stesso (a meno che non sia superadmin)
    if (targetUserId === context.target.id && !isSuperAdminUser) {
      return NextResponse.json(
        { error: 'Non puoi rimuovere te stesso dal workspace' },
        { status: 400 }
      );
    }

    // 5. Verifica che il target esista e non sia owner
    const { data: targetMember, error: targetError } = await supabaseAdmin
      .from('workspace_members')
      .select('id, role, status')
      .eq('workspace_id', workspaceId)
      .eq('user_id', targetUserId)
      .single();

    if (targetError || !targetMember) {
      return NextResponse.json({ error: 'Membro non trovato' }, { status: 404 });
    }

    // Non può rimuovere owner (tranne superadmin)
    if (targetMember.role === 'owner' && !isSuperAdminUser) {
      return NextResponse.json(
        { error: 'Non puoi rimuovere il proprietario del workspace' },
        { status: 403 }
      );
    }

    // 6. ATOMICITY: Soft delete (imposta status = 'removed')
    const { error: updateError } = await supabaseAdmin
      .from('workspace_members')
      .update({
        status: 'removed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetMember.id);

    if (updateError) {
      console.error('Error removing member:', updateError);
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
    }

    // 7. Audit log (NO EMAIL per GDPR)
    await workspaceQuery(workspaceId)
      .from('audit_logs')
      .insert({
        action: 'WORKSPACE_MEMBER_REMOVED',
        resource_type: 'workspace_member',
        resource_id: targetMember.id,
        user_id: context.target.id,
        workspace_id: workspaceId,
        audit_metadata: {
          target_user_id: targetUserId, // Solo ID, no email
          previous_role: targetMember.role,
          removed_by: context.actor.id,
          is_impersonating: context.isImpersonating,
        },
      });

    return NextResponse.json({
      success: true,
      message: 'Membro rimosso con successo',
    });
  } catch (error: any) {
    console.error('DELETE /api/workspaces/[id]/members error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH: Modifica ruolo/permessi di un membro
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await params;
    const body = await request.json();
    const { userId, role, permissions } = body as {
      userId?: string;
      role?: WorkspaceMemberRole;
      permissions?: WorkspacePermission[];
    };

    // 1. Validazioni
    if (!isValidUUID(workspaceId)) {
      return NextResponse.json({ error: 'Invalid workspace ID format' }, { status: 400 });
    }

    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json({ error: 'Invalid or missing userId' }, { status: 400 });
    }

    // Validazione ruolo
    const validRoles: WorkspaceMemberRole[] = ['owner', 'admin', 'operator', 'viewer'];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be: owner, admin, operator, or viewer' },
        { status: 400 }
      );
    }

    // 2. Autenticazione
    const context = await getWorkspaceAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isSuperAdminUser = isSuperAdmin(context);

    // 3. Verifica accesso
    const hasAccess = await verifyWorkspaceAccess(
      context.target.id,
      workspaceId,
      'members:edit_role',
      isSuperAdminUser
    );

    if (!hasAccess.allowed) {
      return NextResponse.json({ error: hasAccess.reason || 'Access denied' }, { status: 403 });
    }

    // 4. Fetch membro target
    const { data: targetMember, error: targetError } = await supabaseAdmin
      .from('workspace_members')
      .select('id, role, permissions, status')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    if (targetError || !targetMember) {
      return NextResponse.json({ error: 'Membro non trovato' }, { status: 404 });
    }

    // 5. Non può modificare owner a meno che non sia superadmin
    if (targetMember.role === 'owner' && role !== 'owner' && !isSuperAdminUser) {
      return NextResponse.json(
        { error: 'Non puoi modificare il ruolo del proprietario' },
        { status: 403 }
      );
    }

    // 6. Non può promuovere a owner se non è già owner o superadmin
    if (role === 'owner' && !isSuperAdminUser) {
      // Verifica che chi modifica sia owner
      const { data: actorMember } = await supabaseAdmin
        .from('workspace_members')
        .select('role')
        .eq('workspace_id', workspaceId)
        .eq('user_id', context.target.id)
        .single();

      if (actorMember?.role !== 'owner') {
        return NextResponse.json(
          { error: 'Solo il proprietario può trasferire la proprietà' },
          { status: 403 }
        );
      }
    }

    // 7. ATOMICITY: Update
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (role) updateData.role = role;
    if (permissions) updateData.permissions = permissions;

    const { error: updateError } = await supabaseAdmin
      .from('workspace_members')
      .update(updateData)
      .eq('id', targetMember.id);

    if (updateError) {
      console.error('Error updating member:', updateError);
      return NextResponse.json({ error: 'Failed to update member' }, { status: 500 });
    }

    // 8. Audit log (NO EMAIL per GDPR)
    await workspaceQuery(workspaceId)
      .from('audit_logs')
      .insert({
        action: 'WORKSPACE_MEMBER_UPDATED',
        resource_type: 'workspace_member',
        resource_id: targetMember.id,
        user_id: context.target.id,
        workspace_id: workspaceId,
        audit_metadata: {
          target_user_id: userId,
          old_role: targetMember.role,
          new_role: role || targetMember.role,
          old_permissions: targetMember.permissions,
          new_permissions: permissions || targetMember.permissions,
          updated_by: context.actor.id,
          is_impersonating: context.isImpersonating,
        },
      });

    return NextResponse.json({
      success: true,
      message: 'Membro aggiornato con successo',
    });
  } catch (error: any) {
    console.error('PATCH /api/workspaces/[id]/members error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Verifica accesso al workspace con permesso specifico
 */
async function verifyWorkspaceAccess(
  userId: string,
  workspaceId: string,
  requiredPermission: WorkspacePermission,
  isSuperAdmin: boolean
): Promise<{ allowed: boolean; reason?: string }> {
  // Superadmin ha sempre accesso
  if (isSuperAdmin) {
    return { allowed: true };
  }

  // Fetch membership
  const { data: membership, error } = await supabaseAdmin
    .from('workspace_members')
    .select('role, permissions, status')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  if (error || !membership) {
    return { allowed: false, reason: 'Non sei membro di questo workspace' };
  }

  if (membership.status !== 'active') {
    return { allowed: false, reason: 'La tua membership non è attiva' };
  }

  // Verifica permesso
  const hasPermission = memberHasPermission(
    { role: membership.role as WorkspaceMemberRole, permissions: membership.permissions || [] },
    requiredPermission
  );

  if (!hasPermission) {
    return { allowed: false, reason: `Permesso '${requiredPermission}' richiesto` };
  }

  return { allowed: true };
}

/**
 * Maschera email per privacy (GDPR)
 * mario.rossi@email.com -> m***@email.com
 */
function maskEmail(email: string | null): string {
  if (!email) return '***@***.***';

  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***.***';

  const maskedLocal = local.charAt(0) + '***';
  return `${maskedLocal}@${domain}`;
}
