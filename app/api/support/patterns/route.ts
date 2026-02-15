/**
 * API: Support Case Patterns (Admin)
 *
 * GET - Lista pattern appresi da Anne (filtri, paginazione)
 * PATCH - Aggiorna pattern (toggle attivo, validato, modifica campi)
 * DELETE - Elimina pattern
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { rateLimit } from '@/lib/security/rate-limit';

async function requireAdmin() {
  const auth = await getWorkspaceAuth();
  if (!auth) return null;
  const role = auth.target.role;
  if (role !== 'admin' && role !== 'superadmin') return null;
  return auth;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const rl = await rateLimit('support-patterns', auth.actor.id, {
    limit: 60,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  const url = new URL(request.url);
  const category = url.searchParams.get('category');
  const carrier = url.searchParams.get('carrier');
  const activeOnly = url.searchParams.get('active') === 'true';
  const search = url.searchParams.get('search');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);

  let query = supabaseAdmin
    .from('support_case_patterns')
    .select('*', { count: 'exact' })
    .order('confidence_score', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) query = query.eq('category', category);
  if (carrier) query = query.eq('carrier', carrier);
  if (activeOnly) query = query.eq('is_active', true);
  if (search) {
    query = query.or(`resolution_action.ilike.%${search}%,category.ilike.%${search}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    patterns: data || [],
    total: count || 0,
  });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const rl = await rateLimit('support-patterns-patch', auth.actor.id, {
    limit: 20,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  const body = await request.json();
  const { id, is_active, human_validated, carrier, resolution_action, resolution_params } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID pattern richiesto' }, { status: 400 });
  }

  const updates: Record<string, any> = {};
  if (is_active !== undefined) updates.is_active = is_active;
  if (human_validated !== undefined) updates.human_validated = human_validated;
  if (carrier !== undefined) updates.carrier = carrier;
  if (resolution_action !== undefined) updates.resolution_action = resolution_action;
  if (resolution_params !== undefined) updates.resolution_params = resolution_params;
  updates.updated_at = new Date().toISOString();

  if (Object.keys(updates).length <= 1) {
    return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('support_case_patterns').update(updates).eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const rl = await rateLimit('support-patterns-delete', auth.actor.id, {
    limit: 20,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'ID pattern richiesto' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('support_case_patterns').delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
