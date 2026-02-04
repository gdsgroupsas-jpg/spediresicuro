/**
 * POST /api/workspaces/switch
 *
 * Imposta il workspace corrente per l'utente
 *
 * SECURITY:
 * - Richiede autenticazione
 * - Verifica membership (o superadmin)
 * - Imposta cookie per middleware
 * - Aggiorna primary_workspace_id in DB
 *
 * REQUEST:
 * {
 *   workspaceId: string
 * }
 *
 * RESPONSE:
 * {
 *   success: true,
 *   workspace: UserWorkspaceInfo
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSafeAuth, isSuperAdmin } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { WORKSPACE_COOKIE } from '@/lib/workspace-auth';
import type { UserWorkspaceInfo } from '@/types/workspace';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // 1. Verifica autenticazione
    const context = await getSafeAuth();

    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse body
    const body = await request.json();
    const { workspaceId } = body;

    if (!workspaceId || typeof workspaceId !== 'string') {
      return NextResponse.json({ error: 'workspaceId required' }, { status: 400 });
    }

    // 3. Valida formato UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(workspaceId)) {
      return NextResponse.json({ error: 'Invalid workspaceId format' }, { status: 400 });
    }

    // 4. Verifica accesso al workspace
    let workspaceInfo: UserWorkspaceInfo | null = null;

    if (isSuperAdmin(context)) {
      // Superadmin: accesso diretto
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
        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
      }

      const org = workspace.organizations as any;

      workspaceInfo = {
        workspace_id: workspace.id,
        workspace_name: workspace.name,
        workspace_slug: workspace.slug,
        workspace_type: workspace.type as any,
        workspace_depth: workspace.depth as any,
        organization_id: org.id,
        organization_name: org.name,
        organization_slug: org.slug,
        role: 'owner',
        permissions: [],
        wallet_balance: Number(workspace.wallet_balance),
        branding: org.branding || {},
        member_status: 'active',
      };
    } else {
      // Utente normale: verifica membership
      const { data: membership, error } = await supabaseAdmin
        .from('workspace_members')
        .select(
          `
          id,
          role,
          permissions,
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
        .eq('user_id', context.target.id)
        .eq('status', 'active')
        .single();

      if (error || !membership) {
        return NextResponse.json(
          { error: 'Access denied: not a member of this workspace' },
          { status: 403 }
        );
      }

      const workspace = membership.workspaces as any;
      const org = workspace.organizations as any;

      // Verifica workspace e org sono attivi
      if (workspace.status !== 'active' || org.status !== 'active') {
        return NextResponse.json(
          { error: 'Workspace or organization is not active' },
          { status: 403 }
        );
      }

      workspaceInfo = {
        workspace_id: workspace.id,
        workspace_name: workspace.name,
        workspace_slug: workspace.slug,
        workspace_type: workspace.type as any,
        workspace_depth: workspace.depth as any,
        organization_id: org.id,
        organization_name: org.name,
        organization_slug: org.slug,
        role: membership.role as any,
        permissions: membership.permissions || [],
        wallet_balance: Number(workspace.wallet_balance),
        branding: org.branding || {},
        member_status: 'active',
      };
    }

    // 5. ATOMICITY: DB update PRIMA del cookie
    // Se DB fallisce, non impostiamo il cookie (stato consistente)
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ primary_workspace_id: workspaceId })
      .eq('id', context.target.id);

    if (updateError) {
      console.error('❌ [WORKSPACE-SWITCH] DB update failed:', updateError.message);
      return NextResponse.json(
        { error: 'Failed to update workspace preference. Please try again.' },
        { status: 500 }
      );
    }

    // 6. Solo dopo DB success, imposta cookie
    // SECURITY: httpOnly prevents XSS from reading workspace ID
    const cookieStore = await cookies();
    cookieStore.set(WORKSPACE_COOKIE, workspaceId, {
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 giorni
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true, // CRITICAL: prevent XSS access
    });

    // 7. Log audit (best-effort)
    await supabaseAdmin.from('audit_logs').insert({
      action: 'WORKSPACE_SWITCH',
      resource_type: 'workspace',
      resource_id: workspaceId,
      user_id: context.target.id,
      actor_id: context.actor.id,
      target_id: context.target.id,
      workspace_id: workspaceId,
      impersonation_active: context.isImpersonating,
      audit_metadata: {
        workspace_name: workspaceInfo.workspace_name,
        organization_name: workspaceInfo.organization_name,
      },
    });

    // Log senza email per privacy
    console.log('✅ [WORKSPACE-SWITCH]', {
      userId: context.target.id.substring(0, 8) + '...',
      workspaceId: workspaceId.substring(0, 8) + '...',
    });

    return NextResponse.json({
      success: true,
      workspace: workspaceInfo,
    });
  } catch (error: any) {
    console.error('POST /api/workspaces/switch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
