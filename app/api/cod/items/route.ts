/**
 * API: COD Items - Lista contrassegni con filtri e paginazione
 *
 * GET /api/cod/items?client_id=&status=&shipment_status=&page=&limit=
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

  const rl = await rateLimit('cod-items', auth.actor.id, {
    limit: 60,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  try {
    // Isolamento multi-tenant: solo COD dei membri del workspace corrente
    const workspaceId = auth.workspace?.id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace non trovato' }, { status: 403 });
    }

    // Recupera user_id dei membri del workspace
    const { data: members } = await supabaseAdmin
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active');

    const memberIds = (members || []).map((m: any) => m.user_id);
    if (memberIds.length === 0) {
      return NextResponse.json({ success: true, items: [], total: 0, page: 1, limit: 50 });
    }

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('cod_items')
      .select(
        `
        id, ldv, rif_mittente, contrassegno, pagato, destinatario, note, data_ldv,
        shipment_id, client_id, distinta_id, status, created_at,
        shipments:shipment_id (tracking_number, status, recipient_name, user_id),
        cod_distinte:distinta_id (number, status)
      `,
        { count: 'exact' }
      )
      .in('client_id', memberIds)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (clientId) {
      query = query.eq('client_id', clientId);
    }
    if (status) {
      query = query.eq('status', status);
    }

    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    if (dateFrom) {
      query = query.gte('data_ldv', `${dateFrom}T00:00:00.000Z`);
    }
    if (dateTo) {
      query = query.lte('data_ldv', `${dateTo}T23:59:59.999Z`);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[COD Items] Error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      items: data || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('[COD Items] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
