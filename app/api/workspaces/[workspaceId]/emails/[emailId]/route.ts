/**
 * API: Single Workspace Email Operations
 *
 * GET    /api/workspaces/[workspaceId]/emails/[emailId] — Singola email + auto-mark read
 * PATCH  /api/workspaces/[workspaceId]/emails/[emailId] — Update read/starred/folder
 * DELETE /api/workspaces/[workspaceId]/emails/[emailId] — Trash o hard delete
 *
 * Sicurezza:
 * - Auth obbligatoria + membership attiva
 * - SEMPRE verifica che email.workspace_id == workspaceId (no cross-workspace)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth, isSuperAdmin } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { isValidUUID } from '@/lib/workspace-constants';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ workspaceId: string; emailId: string }>;
}

// ─── AUTH HELPER ───

async function verifyAccess(
  userId: string,
  workspaceId: string,
  isSuperAdminUser: boolean
): Promise<{ allowed: boolean; reason?: string }> {
  if (isSuperAdminUser) return { allowed: true };

  const { data: membership } = await supabaseAdmin
    .from('workspace_members')
    .select('status')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!membership) {
    return { allowed: false, reason: 'Non sei membro di questo workspace' };
  }

  return { allowed: true };
}

// ─── GET: Singola email ───

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId, emailId } = await params;

    if (!isValidUUID(workspaceId) || !isValidUUID(emailId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const context = await getWorkspaceAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await verifyAccess(context.target.id, workspaceId, isSuperAdmin(context));
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason || 'Access denied' }, { status: 403 });
    }

    // CRITICO: workspace_id + emailId (doppio filtro per sicurezza)
    const { data, error } = await supabaseAdmin
      .from('emails')
      .select('*')
      .eq('id', emailId)
      .eq('workspace_id', workspaceId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Email non trovata' }, { status: 404 });
    }

    // Auto-mark as read
    if (!data.read) {
      await supabaseAdmin.from('emails').update({ read: true }).eq('id', emailId);
      data.read = true;
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[WS-EMAIL-DETAIL] Error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

// ─── PATCH: Update email ───

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId, emailId } = await params;

    if (!isValidUUID(workspaceId) || !isValidUUID(emailId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const context = await getWorkspaceAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await verifyAccess(context.target.id, workspaceId, isSuperAdmin(context));
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason || 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.read === 'boolean') updates.read = body.read;
    if (typeof body.starred === 'boolean') updates.starred = body.starred;
    if (body.folder && ['inbox', 'sent', 'drafts', 'trash'].includes(body.folder)) {
      updates.folder = body.folder;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 });
    }

    // CRITICO: workspace_id nel filtro
    const { data, error } = await supabaseAdmin
      .from('emails')
      .update(updates)
      .eq('id', emailId)
      .eq('workspace_id', workspaceId)
      .select('id, read, starred, folder')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Email non trovata' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('[WS-EMAIL-PATCH] Error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

// ─── DELETE: Trash o hard delete ───

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId, emailId } = await params;

    if (!isValidUUID(workspaceId) || !isValidUUID(emailId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const context = await getWorkspaceAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await verifyAccess(context.target.id, workspaceId, isSuperAdmin(context));
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason || 'Access denied' }, { status: 403 });
    }

    // CRITICO: workspace_id nel filtro
    const { data: email } = await supabaseAdmin
      .from('emails')
      .select('folder')
      .eq('id', emailId)
      .eq('workspace_id', workspaceId)
      .single();

    if (!email) {
      return NextResponse.json({ error: 'Email non trovata' }, { status: 404 });
    }

    if (email.folder === 'trash') {
      // Hard delete
      const { error } = await supabaseAdmin
        .from('emails')
        .delete()
        .eq('id', emailId)
        .eq('workspace_id', workspaceId);

      if (error) {
        return NextResponse.json({ error: 'Errore eliminazione' }, { status: 500 });
      }
      return NextResponse.json({ deleted: true });
    }

    // Soft delete → trash
    const { error } = await supabaseAdmin
      .from('emails')
      .update({ folder: 'trash' })
      .eq('id', emailId)
      .eq('workspace_id', workspaceId);

    if (error) {
      return NextResponse.json({ error: 'Errore spostamento' }, { status: 500 });
    }

    return NextResponse.json({ trashed: true });
  } catch (err: any) {
    console.error('[WS-EMAIL-DELETE] Error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
