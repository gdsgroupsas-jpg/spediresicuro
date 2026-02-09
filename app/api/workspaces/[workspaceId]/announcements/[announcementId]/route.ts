/**
 * API: Single Workspace Announcement
 *
 * GET    /api/workspaces/[workspaceId]/announcements/[announcementId] — Dettaglio
 * PATCH  /api/workspaces/[workspaceId]/announcements/[announcementId] — Aggiorna
 * DELETE /api/workspaces/[workspaceId]/announcements/[announcementId] — Elimina
 *
 * Sicurezza:
 * - Auth obbligatoria + membership attiva
 * - Double filter: eq(id) + eq(workspace_id)
 * - Solo owner/admin possono modificare/eliminare
 * - GET marca come letto automaticamente
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth, isSuperAdmin } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { isValidUUID } from '@/lib/workspace-constants';
import { rateLimit } from '@/lib/security/rate-limit';
import { sanitizeEmailHtml } from '@/lib/email/workspace-email-service';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ workspaceId: string; announcementId: string }>;
}

// ─── GET: Dettaglio annuncio + mark read ───

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId, announcementId } = await params;

    if (!isValidUUID(workspaceId) || !isValidUUID(announcementId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const context = await getSafeAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rl = await rateLimit('announcements-read', context.target.id, {
      limit: 60,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 });
    }

    // Fix #4: traccia il ruolo per filtrare target per client
    const isSuperAdminUser = isSuperAdmin(context);
    let accessRole = 'superadmin';

    if (!isSuperAdminUser) {
      // Verifica membership diretta
      const { data: membership } = await supabaseAdmin
        .from('workspace_members')
        .select('role, status')
        .eq('workspace_id', workspaceId)
        .eq('user_id', context.target.id)
        .eq('status', 'active')
        .single();

      if (membership) {
        accessRole = membership.role;
      } else {
        // Verifica accesso client via child workspace (query ottimizzata)
        const { data: childMembership } = await supabaseAdmin
          .from('workspace_members')
          .select('role, workspace_id, workspaces!inner(parent_workspace_id)')
          .eq('user_id', context.target.id)
          .eq('status', 'active')
          .eq('workspaces.parent_workspace_id', workspaceId);

        if (childMembership && childMembership.length > 0) {
          accessRole = 'client';
        } else {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    }

    // Double filter: id + workspace_id
    const { data, error } = await supabaseAdmin
      .from('workspace_announcements')
      .select('*')
      .eq('id', announcementId)
      .eq('workspace_id', workspaceId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Annuncio non trovato' }, { status: 404 });
    }

    // Fix #4: client può vedere solo annunci con target 'all' o 'clients'
    if (accessRole === 'client' && !['all', 'clients'].includes(data.target)) {
      return NextResponse.json({ error: 'Annuncio non trovato' }, { status: 404 });
    }

    // Fix #2: Auto mark-read via RPC atomica (evita race condition read-modify-write)
    // La RPC mark_announcement_read usa array_append atomico in SQL
    const readBy: string[] = data.read_by || [];
    const wasAlreadyRead = readBy.includes(context.target.id);

    if (!wasAlreadyRead) {
      // Usa RPC mark_announcement_read_admin (SECURITY DEFINER, accetta user_id esplicito)
      // Fallback: update con array completo se RPC non disponibile
      const { error: rpcError } = await supabaseAdmin.rpc('mark_announcement_read_admin', {
        p_announcement_id: announcementId,
        p_user_id: context.target.id,
      });

      if (rpcError) {
        // Fallback: update diretto (meno sicuro per race condition, ma funzionale)
        await supabaseAdmin
          .from('workspace_announcements')
          .update({
            read_by: [...readBy, context.target.id],
          })
          .eq('id', announcementId)
          .eq('workspace_id', workspaceId);
      }
    }

    // Fix #1 + #10: strip read_by dalla risposta, read_count basato su dati certi
    const { read_by: _, ...safeData } = data;
    return NextResponse.json({
      announcement: {
        ...safeData,
        is_read: true,
        read_count: wasAlreadyRead ? readBy.length : readBy.length + 1,
      },
    });
  } catch (err: any) {
    console.error('[ANNOUNCEMENT] Error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

// ─── PATCH: Aggiorna annuncio ───

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId, announcementId } = await params;

    if (!isValidUUID(workspaceId) || !isValidUUID(announcementId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const context = await getSafeAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Solo owner/admin/superadmin
    const isSuperAdminUser = isSuperAdmin(context);
    if (!isSuperAdminUser) {
      const { data: membership } = await supabaseAdmin
        .from('workspace_members')
        .select('role, status')
        .eq('workspace_id', workspaceId)
        .eq('user_id', context.target.id)
        .single();

      if (!membership || membership.status !== 'active') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      if (!['owner', 'admin'].includes(membership.role)) {
        return NextResponse.json(
          { error: 'Solo owner e admin possono modificare annunci' },
          { status: 403 }
        );
      }
    }

    const rl = await rateLimit('announcements-update', context.target.id, {
      limit: 20,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 });
    }

    const body = await request.json();
    const updates: Record<string, any> = {};

    if (body.title !== undefined) {
      if (!body.title.trim()) {
        return NextResponse.json({ error: 'Titolo non può essere vuoto' }, { status: 400 });
      }
      updates.title = body.title.trim().slice(0, 200);
    }

    if (body.bodyHtml !== undefined) {
      updates.body_html = sanitizeEmailHtml(body.bodyHtml);
    }

    if (body.bodyText !== undefined) {
      updates.body_text = body.bodyText?.trim() || null;
    }

    if (body.target !== undefined) {
      const validTargets = ['all', 'team', 'clients'];
      if (!validTargets.includes(body.target)) {
        return NextResponse.json({ error: 'Target non valido' }, { status: 400 });
      }
      updates.target = body.target;
    }

    if (body.priority !== undefined) {
      const validPriorities = ['low', 'normal', 'high', 'urgent'];
      if (!validPriorities.includes(body.priority)) {
        return NextResponse.json({ error: 'Priorità non valida' }, { status: 400 });
      }
      updates.priority = body.priority;
    }

    if (body.pinned !== undefined) {
      updates.pinned = !!body.pinned;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from('workspace_announcements')
      .update(updates)
      .eq('id', announcementId)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Annuncio non trovato' }, { status: 404 });
    }

    return NextResponse.json({ announcement: data });
  } catch (err: any) {
    console.error('[ANNOUNCEMENT] PATCH Error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

// ─── DELETE: Elimina annuncio ───

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId, announcementId } = await params;

    if (!isValidUUID(workspaceId) || !isValidUUID(announcementId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const context = await getSafeAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Solo owner/admin/superadmin
    const isSuperAdminUser = isSuperAdmin(context);
    if (!isSuperAdminUser) {
      const { data: membership } = await supabaseAdmin
        .from('workspace_members')
        .select('role, status')
        .eq('workspace_id', workspaceId)
        .eq('user_id', context.target.id)
        .single();

      if (!membership || membership.status !== 'active') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      if (!['owner', 'admin'].includes(membership.role)) {
        return NextResponse.json(
          { error: 'Solo owner e admin possono eliminare annunci' },
          { status: 403 }
        );
      }
    }

    const rl = await rateLimit('announcements-delete', context.target.id, {
      limit: 10,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 });
    }

    // Verifica esistenza + workspace isolation
    const { data: existing } = await supabaseAdmin
      .from('workspace_announcements')
      .select('id')
      .eq('id', announcementId)
      .eq('workspace_id', workspaceId)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Annuncio non trovato' }, { status: 404 });
    }

    const { error } = await supabaseAdmin
      .from('workspace_announcements')
      .delete()
      .eq('id', announcementId)
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('[ANNOUNCEMENT] Delete error:', error.message);
      return NextResponse.json({ error: 'Errore eliminazione' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[ANNOUNCEMENT] DELETE Error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
