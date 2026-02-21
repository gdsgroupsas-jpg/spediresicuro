/**
 * API: Single Contact operations
 *
 * GET    /api/contacts/[id]  - Get contact details
 * PATCH  /api/contacts/[id]  - Update contact
 * DELETE /api/contacts/[id]  - Delete contact
 *
 * Superadmin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { isSuperAdminCheck } from '@/lib/auth-helpers';

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PHONE_REGEX = /^\+?[0-9\s\-()]{6,20}$/;
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sanitizeString(s: string | undefined | null, maxLen: number): string {
  if (!s) return '';
  return s.trim().slice(0, maxLen);
}

async function requireSuperadmin() {
  const context = await getWorkspaceAuth();
  if (!context) return { error: 'Unauthorized', status: 401 };
  if (!isSuperAdminCheck(context.actor)) return { error: 'Forbidden', status: 403 };
  return { context };
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSuperadmin();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'ID non valido' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin.from('contacts').select('*').eq('id', id).single();

    if (error || !data) {
      return NextResponse.json({ error: 'Contatto non trovato' }, { status: 404 });
    }

    return NextResponse.json({ contact: data });
  } catch (err: any) {
    console.error('[CONTACT-GET] Error:', err.message);
    return NextResponse.json(
      { error: 'Errore durante il caricamento del contatto' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireSuperadmin();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'ID non valido' }, { status: 400 });
    }

    const body = await request.json();
    const updates: Record<string, any> = {};

    if (body.first_name !== undefined) {
      const v = sanitizeString(body.first_name, 100);
      if (!v) return NextResponse.json({ error: 'Nome obbligatorio' }, { status: 400 });
      updates.first_name = v;
    }
    if (body.last_name !== undefined) {
      const v = sanitizeString(body.last_name, 100);
      if (!v) return NextResponse.json({ error: 'Cognome obbligatorio' }, { status: 400 });
      updates.last_name = v;
    }
    if (body.email !== undefined) {
      const v = sanitizeString(body.email, 254)?.toLowerCase();
      if (!v || !EMAIL_REGEX.test(v))
        return NextResponse.json({ error: 'Email non valida' }, { status: 400 });
      updates.email = v;
    }
    if (body.phone !== undefined) {
      const v = sanitizeString(body.phone, 20);
      if (v && !PHONE_REGEX.test(v))
        return NextResponse.json({ error: 'Telefono non valido' }, { status: 400 });
      updates.phone = v || null;
    }
    if (body.company !== undefined) {
      updates.company = sanitizeString(body.company, 200) || null;
    }
    if (body.tags !== undefined) {
      updates.tags = Array.isArray(body.tags)
        ? body.tags
            .filter((t: string) => typeof t === 'string')
            .slice(0, 20)
            .map((t: string) => t.trim().slice(0, 50))
        : [];
    }
    if (body.notes !== undefined) {
      updates.notes = sanitizeString(body.notes, 2000) || null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('contacts')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Esiste già un contatto con questa email' },
          { status: 409 }
        );
      }
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Contatto non trovato' }, { status: 404 });
      }
      return NextResponse.json(
        { error: "Errore durante l'aggiornamento del contatto" },
        { status: 500 }
      );
    }

    return NextResponse.json({ contact: data });
  } catch (err: any) {
    console.error('[CONTACT-UPDATE] Error:', err.message);
    return NextResponse.json(
      { error: "Errore durante l'aggiornamento del contatto" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireSuperadmin();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { id } = await params;
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'ID non valido' }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from('contacts').delete().eq('id', id);

    if (error) {
      return NextResponse.json(
        { error: "Errore durante l'eliminazione del contatto" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[CONTACT-DELETE] Error:', err.message);
    return NextResponse.json(
      { error: "Errore durante l'eliminazione del contatto" },
      { status: 500 }
    );
  }
}
