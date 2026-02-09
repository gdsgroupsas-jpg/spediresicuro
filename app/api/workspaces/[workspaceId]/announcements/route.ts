/**
 * API: Workspace Announcements (Bacheca)
 *
 * GET  /api/workspaces/[workspaceId]/announcements — Lista annunci
 * POST /api/workspaces/[workspaceId]/announcements — Crea annuncio
 *
 * Sicurezza:
 * - Auth obbligatoria + membership attiva
 * - Solo owner/admin possono creare annunci
 * - Tutti i membri possono leggere
 * - Client del reseller vedono annunci con target 'all' o 'clients'
 * - Sanitizzazione HTML body
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth, isSuperAdmin } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { isValidUUID } from '@/lib/workspace-constants';
import { sanitizeEmailHtml } from '@/lib/email/workspace-email-service';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

// ─── AUTH HELPER ───

async function verifyAnnouncementAccess(
  userId: string,
  workspaceId: string,
  isSuperAdminUser: boolean
): Promise<{ allowed: boolean; role?: string; reason?: string }> {
  if (isSuperAdminUser) return { allowed: true, role: 'superadmin' };

  // Verifica membership diretta
  const { data: membership } = await supabaseAdmin
    .from('workspace_members')
    .select('role, status')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  if (membership && membership.status === 'active') {
    return { allowed: true, role: membership.role };
  }

  // Verifica se è un client del reseller (child workspace)
  const { data: childMembership } = await supabaseAdmin
    .from('workspace_members')
    .select('role, status, workspace_id, workspaces!inner(parent_workspace_id)')
    .eq('user_id', userId)
    .eq('status', 'active')
    .not('workspaces.parent_workspace_id', 'is', null);

  if (childMembership && childMembership.length > 0) {
    const isChild = childMembership.some(
      (m: any) => m.workspaces?.parent_workspace_id === workspaceId
    );
    if (isChild) return { allowed: true, role: 'client' };
  }

  return { allowed: false, reason: 'Non sei membro di questo workspace' };
}

// ─── GET: Lista annunci ───

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await params;

    if (!isValidUUID(workspaceId)) {
      return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 });
    }

    const context = await getSafeAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await verifyAnnouncementAccess(
      context.target.id,
      workspaceId,
      isSuperAdmin(context)
    );
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason || 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const target = searchParams.get('target'); // all, team, clients
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    let query = supabaseAdmin
      .from('workspace_announcements')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtra per target
    if (target && ['all', 'team', 'clients'].includes(target)) {
      query = query.eq('target', target);
    }

    // I client vedono solo annunci con target 'all' o 'clients'
    if (access.role === 'client') {
      query = query.in('target', ['all', 'clients']);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[ANNOUNCEMENTS] Error:', error.message);
      return NextResponse.json({ error: 'Errore caricamento annunci' }, { status: 500 });
    }

    // Aggiungi flag is_read per l'utente corrente
    const announcements = (data || []).map((a: any) => ({
      ...a,
      is_read: (a.read_by || []).includes(context.target.id),
      read_count: (a.read_by || []).length,
    }));

    return NextResponse.json({
      announcements,
      total: count || 0,
      unreadCount: announcements.filter((a: any) => !a.is_read).length,
    });
  } catch (err: any) {
    console.error('[ANNOUNCEMENTS] Error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

// ─── POST: Crea annuncio ───

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await params;

    if (!isValidUUID(workspaceId)) {
      return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 });
    }

    const context = await getSafeAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await verifyAnnouncementAccess(
      context.target.id,
      workspaceId,
      isSuperAdmin(context)
    );
    if (!access.allowed) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Solo owner/admin/superadmin possono creare
    if (!['owner', 'admin', 'superadmin'].includes(access.role || '')) {
      return NextResponse.json(
        { error: 'Solo owner e admin possono creare annunci' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { title, bodyHtml, bodyText, target, priority, pinned, channels } = body;

    // Validazione
    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Titolo obbligatorio' }, { status: 400 });
    }

    if (!bodyHtml || !bodyHtml.trim()) {
      return NextResponse.json({ error: 'Contenuto obbligatorio' }, { status: 400 });
    }

    const validTargets = ['all', 'team', 'clients'];
    if (!target || !validTargets.includes(target)) {
      return NextResponse.json(
        { error: 'Target non valido (all, team, clients)' },
        { status: 400 }
      );
    }

    const validPriorities = ['low', 'normal', 'high', 'urgent'];
    const safePriority = validPriorities.includes(priority) ? priority : 'normal';

    const validChannels = ['in_app', 'email'];
    const safeChannels = Array.isArray(channels)
      ? channels.filter((c: string) => validChannels.includes(c))
      : ['in_app'];

    // Sanitizza HTML
    const sanitizedHtml = sanitizeEmailHtml(bodyHtml);

    const { data, error } = await supabaseAdmin
      .from('workspace_announcements')
      .insert({
        workspace_id: workspaceId,
        author_id: context.target.id,
        title: title.trim().slice(0, 200),
        body_html: sanitizedHtml,
        body_text: bodyText?.trim() || null,
        target,
        priority: safePriority,
        pinned: !!pinned,
        channels: safeChannels.length > 0 ? safeChannels : ['in_app'],
      })
      .select()
      .single();

    if (error) {
      console.error('[ANNOUNCEMENTS] Insert error:', error.message);
      return NextResponse.json({ error: 'Errore creazione annuncio' }, { status: 500 });
    }

    return NextResponse.json({ announcement: data }, { status: 201 });
  } catch (err: any) {
    console.error('[ANNOUNCEMENTS] Error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
