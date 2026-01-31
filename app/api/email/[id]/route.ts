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
import { getSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';

async function requireSuperadmin() {
  const context = await getSafeAuth();
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

  const { data, error } = await supabaseAdmin.from('emails').select('*').eq('id', id).single();

  if (error || !data) {
    return NextResponse.json({ error: 'Email non trovata' }, { status: 404 });
  }

  // Auto-mark as read
  if (!data.read) {
    await supabaseAdmin.from('emails').update({ read: true }).eq('id', id);
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

  const { data, error } = await supabaseAdmin
    .from('emails')
    .update(updates)
    .eq('id', id)
    .select('id, read, starred, folder')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
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

  // Check if already in trash
  const { data: email } = await supabaseAdmin.from('emails').select('folder').eq('id', id).single();

  if (!email) {
    return NextResponse.json({ error: 'Email non trovata' }, { status: 404 });
  }

  if (email.folder === 'trash') {
    // Hard delete
    const { error } = await supabaseAdmin.from('emails').delete().eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ deleted: true });
  }

  // Move to trash
  const { error } = await supabaseAdmin.from('emails').update({ folder: 'trash' }).eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ trashed: true });
}
