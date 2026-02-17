/**
 * API: COD Clients - Lista clienti con contrassegni
 *
 * GET /api/cod/clients - Clienti distinti presenti nei cod_items
 */

import { NextResponse } from 'next/server';
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

export async function GET() {
  const auth = await requireAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const rl = await rateLimit('cod-clients', auth.actor.id, {
    limit: 60,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  try {
    // Prendi client_id distinti dai cod_items
    const { data: items, error } = await supabaseAdmin
      .from('cod_items')
      .select('client_id')
      .not('client_id', 'is', null);

    if (error) {
      return NextResponse.json(
        { error: 'Errore durante il caricamento clienti COD' },
        { status: 500 }
      );
    }

    const uniqueIds = [...new Set((items || []).map((i) => i.client_id).filter(Boolean))];

    if (uniqueIds.length === 0) {
      return NextResponse.json({ success: true, clients: [] });
    }

    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email')
      .in('id', uniqueIds);

    const clients = (users || []).map((u) => ({
      id: u.id,
      name: u.full_name || u.email || u.id,
    }));

    return NextResponse.json({ success: true, clients });
  } catch (error: any) {
    console.error('[COD Clients] Error:', error.message);
    return NextResponse.json(
      { error: 'Errore durante il caricamento clienti COD' },
      { status: 500 }
    );
  }
}
