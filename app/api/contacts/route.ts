/**
 * API: Contacts CRUD
 *
 * GET  /api/contacts?search=...&tag=...&limit=50&offset=0
 * POST /api/contacts  { first_name, last_name, email, phone?, company?, tags?, notes? }
 *
 * Superadmin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';

const EMAIL_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
const PHONE_REGEX = /^\+?[0-9\s\-()]{6,20}$/;

function sanitizeString(s: string | undefined | null, maxLen: number): string {
  if (!s) return '';
  return s.trim().slice(0, maxLen);
}

async function requireSuperadmin() {
  const context = await getSafeAuth();
  if (!context) return { error: 'Unauthorized', status: 401 };
  if (context.actor.account_type !== 'superadmin') return { error: 'Forbidden', status: 403 };
  return { context };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireSuperadmin();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const tag = searchParams.get('tag');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    let query = supabaseAdmin
      .from('contacts')
      .select('*', { count: 'exact' })
      .order('last_name', { ascending: true })
      .order('first_name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(
        `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,company.ilike.%${search}%`
      );
    }

    if (tag) {
      query = query.contains('tags', [tag]);
    }

    const { data, error, count } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      contacts: data || [],
      total: count || 0,
    });
  } catch (err: any) {
    console.error('[CONTACTS-LIST] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireSuperadmin();
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const firstName = sanitizeString(body.first_name, 100);
    const lastName = sanitizeString(body.last_name, 100);
    const email = sanitizeString(body.email, 254)?.toLowerCase();
    const phone = sanitizeString(body.phone, 20) || null;
    const company = sanitizeString(body.company, 200) || null;
    const tags = Array.isArray(body.tags)
      ? body.tags
          .filter((t: string) => typeof t === 'string')
          .slice(0, 20)
          .map((t: string) => t.trim().slice(0, 50))
      : [];
    const notes = sanitizeString(body.notes, 2000) || null;

    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'Nome e cognome obbligatori' }, { status: 400 });
    }
    if (!email || !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ error: 'Email non valida' }, { status: 400 });
    }
    if (phone && !PHONE_REGEX.test(phone)) {
      return NextResponse.json({ error: 'Numero di telefono non valido' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('contacts')
      .insert({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        company,
        tags,
        notes,
        created_by: auth.context!.actor.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Esiste già un contatto con questa email' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ contact: data }, { status: 201 });
  } catch (err: any) {
    console.error('[CONTACTS-CREATE] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
