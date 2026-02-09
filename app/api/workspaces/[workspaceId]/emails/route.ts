/**
 * API: Workspace Emails
 *
 * GET  /api/workspaces/[workspaceId]/emails — Lista email per workspace
 * POST /api/workspaces/[workspaceId]/emails — Invia email o salva bozza
 *
 * Sicurezza:
 * - Auth obbligatoria + membership attiva
 * - workspace_id filtrato in TUTTE le query (mai fidarsi del client)
 * - Rate limiting per invio
 * - Sanitizzazione HTML body
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth, isSuperAdmin } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { isValidUUID } from '@/lib/workspace-constants';
import { memberHasPermission, type WorkspaceMemberRole } from '@/types/workspace';
import {
  sendWorkspaceEmail,
  getWorkspaceEmailAddresses,
} from '@/lib/email/workspace-email-service';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

// ─── AUTH HELPER ───

async function verifyEmailAccess(
  userId: string,
  workspaceId: string,
  isSuperAdminUser: boolean
): Promise<{ allowed: boolean; reason?: string }> {
  if (isSuperAdminUser) return { allowed: true };

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
    return { allowed: false, reason: 'Membership non attiva' };
  }

  // Tutti i membri attivi possono leggere email; solo owner/admin/operator inviano
  return { allowed: true };
}

async function canSendEmail(
  userId: string,
  workspaceId: string,
  isSuperAdminUser: boolean
): Promise<boolean> {
  if (isSuperAdminUser) return true;

  const { data: membership } = await supabaseAdmin
    .from('workspace_members')
    .select('role, permissions, status')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .single();

  if (!membership || membership.status !== 'active') return false;

  return memberHasPermission(
    { role: membership.role as WorkspaceMemberRole, permissions: membership.permissions || [] },
    'shipments:create' // Riuso permesso: chi puo creare spedizioni puo inviare email
  );
}

// ─── GET: Lista email ───

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

    const access = await verifyEmailAccess(context.target.id, workspaceId, isSuperAdmin(context));
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason || 'Access denied' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const folder = searchParams.get('folder') || 'inbox';
    const search = searchParams.get('search');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    // CRITICO: SEMPRE filtrare per workspace_id
    let query = supabaseAdmin
      .from('emails')
      .select(
        'id, message_id, direction, from_address, to_address, cc, subject, body_text, status, read, starred, folder, created_at',
        { count: 'exact' }
      )
      .eq('workspace_id', workspaceId)
      .eq('folder', folder)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `subject.ilike.%${search}%,from_address.ilike.%${search}%,body_text.ilike.%${search}%`
      );
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[WS-EMAIL-LIST] Error:', error.message);
      return NextResponse.json({ error: 'Errore caricamento email' }, { status: 500 });
    }

    // Conteggio non lette per workspace
    const { data: unreadRows } = await supabaseAdmin
      .from('emails')
      .select('folder')
      .eq('workspace_id', workspaceId)
      .eq('read', false);

    const unreadCounts: Record<string, number> = {};
    if (unreadRows) {
      for (const row of unreadRows) {
        unreadCounts[row.folder] = (unreadCounts[row.folder] || 0) + 1;
      }
    }

    return NextResponse.json({
      emails: data || [],
      total: count || 0,
      unreadCounts,
    });
  } catch (err: any) {
    console.error('[WS-EMAIL-LIST] Error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

// ─── POST: Invia email o salva bozza ───

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

    const isSuperAdminUser = isSuperAdmin(context);
    const allowed = await canSendEmail(context.target.id, workspaceId, isSuperAdminUser);
    if (!allowed) {
      return NextResponse.json({ error: 'Non hai i permessi per inviare email' }, { status: 403 });
    }

    const body = await request.json();
    const { fromAddressId, to, cc, subject, bodyHtml, bodyText, replyToEmailId, isDraft } = body;

    if (!fromAddressId) {
      return NextResponse.json({ error: 'fromAddressId obbligatorio' }, { status: 400 });
    }

    const toArray = Array.isArray(to) ? to.filter(Boolean) : to ? [to] : [];

    if (!isDraft && (!toArray.length || !subject)) {
      return NextResponse.json({ error: 'Campi obbligatori: to, subject' }, { status: 400 });
    }

    const result = await sendWorkspaceEmail({
      workspaceId,
      fromAddressId,
      to: toArray,
      cc: Array.isArray(cc) ? cc.filter(Boolean) : undefined,
      subject: subject || '(bozza)',
      bodyHtml: bodyHtml || '<p></p>',
      bodyText: bodyText || undefined,
      replyToEmailId: replyToEmailId || undefined,
      isDraft: isDraft || false,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      emailId: result.emailId,
      resendId: result.resendId,
    });
  } catch (err: any) {
    console.error('[WS-EMAIL-SEND] Error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
