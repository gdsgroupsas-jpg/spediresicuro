/**
 * API: Single Email Operations
 *
 * GET    /api/email/[id] — Get single email
 * PATCH  /api/email/[id] — Update read/starred/folder
 * DELETE /api/email/[id] — Move to trash (or hard delete if already in trash)
 *
 * Superadmin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { workspaceQuery } from '@/lib/db/workspace-query';

async function requireSuperadmin() {
  const context = await getWorkspaceAuth();
  if (!context) return { error: 'Unauthorized', status: 401 };
  if (context.actor.account_type !== 'superadmin') return { error: 'Forbidden', status: 403 };
  return { context };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperadmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const wq = workspaceQuery(auth.context.workspace!.id);

  const { data, error } = await wq.from('emails').select('*').eq('id', id).single();

  if (error || !data) {
    return NextResponse.json({ error: 'Email non trovata' }, { status: 404 });
  }

  // Auto-mark as read
  if (!data.read) {
    await wq.from('emails').update({ read: true }).eq('id', id);
    data.read = true;
  }

  return NextResponse.json(data);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperadmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const wq = workspaceQuery(auth.context.workspace!.id);

  const body = await request.json();
  const updates: Record<string, any> = {};

  if (typeof body.read === 'boolean') updates.read = body.read;
  if (typeof body.starred === 'boolean') updates.starred = body.starred;
  if (body.folder && ['inbox', 'sent', 'drafts', 'trash'].includes(body.folder)) {
    updates.folder = body.folder;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 });
  }

  const { data, error } = await wq
    .from('emails')
    .update(updates)
    .eq('id', id)
    .select('id, read, starred, folder')
    .single();

  if (error) {
    return NextResponse.json(
      { error: "Errore durante l'aggiornamento dell'email" },
      { status: 500 }
    );
  }

  return NextResponse.json(data);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadmin();
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { id } = await params;
  const wq = workspaceQuery(auth.context.workspace!.id);

  // Check if already in trash
  const { data: email } = await wq.from('emails').select('folder').eq('id', id).single();

  if (!email) {
    return NextResponse.json({ error: 'Email non trovata' }, { status: 404 });
  }

  if (email.folder === 'trash') {
    // Hard delete
    const { error } = await wq.from('emails').delete().eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: "Errore durante l'eliminazione dell'email" },
        { status: 500 }
      );
    }
    return NextResponse.json({ deleted: true });
  }

  // Move to trash
  const { error } = await wq.from('emails').update({ folder: 'trash' }).eq('id', id);

  if (error) {
    return NextResponse.json(
      { error: "Errore durante lo spostamento dell'email nel cestino" },
      { status: 500 }
    );
  }

  return NextResponse.json({ trashed: true });
}
