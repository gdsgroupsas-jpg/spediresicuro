/**
 * API: Support Escalations (Admin)
 *
 * GET - Lista escalation (solo admin/superadmin)
 * PATCH - Aggiorna escalation (assegna, risolvi)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { rateLimit } from '@/lib/security/rate-limit';
import { isAdminOrAbove } from '@/lib/auth-helpers';

async function requireAdmin() {
  const auth = await getWorkspaceAuth();
  if (!auth) return null;
  if (!isAdminOrAbove(auth.target)) return null;
  return auth;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const rl = await rateLimit('support-escalations', auth.actor.id, {
    limit: 60,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  const url = new URL(request.url);
  const status = url.searchParams.get('status');
  const search = url.searchParams.get('search');

  let query = supabaseAdmin
    .from('support_escalations')
    .select('*, users!support_escalations_user_id_fkey(email, name)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (status) {
    query = query.eq('status', status);
  }

  if (search) {
    query = query.or(`reason.ilike.%${search}%,anne_summary.ilike.%${search}%`);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, escalations: data || [] });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const rl = await rateLimit('support-escalations-patch', auth.actor.id, {
    limit: 20,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  const body = await request.json();
  const { id, status, resolution } = body;

  if (!id) {
    return NextResponse.json({ error: 'ID escalation richiesto' }, { status: 400 });
  }

  const updates: Record<string, any> = {};

  if (status === 'assigned') {
    updates.status = 'assigned';
    updates.assigned_to = auth.actor.id;
    updates.assigned_at = new Date().toISOString();
  } else if (status === 'resolved') {
    updates.status = 'resolved';
    updates.resolution = resolution || '';
    updates.resolved_at = new Date().toISOString();
  } else if (status === 'closed') {
    updates.status = 'closed';
  }

  const { error } = await supabaseAdmin.from('support_escalations').update(updates).eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
