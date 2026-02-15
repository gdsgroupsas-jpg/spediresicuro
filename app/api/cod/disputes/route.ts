/**
 * API: COD Disputes - Gestione discrepanze contrassegni
 *
 * GET   /api/cod/disputes        - Lista disputes con filtri
 * POST  /api/cod/disputes        - Crea dispute manuale
 * PATCH /api/cod/disputes        - Risolvi/ignora dispute
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { rateLimit } from '@/lib/security/rate-limit';
import { writeAuditLog } from '@/lib/security/audit-log';
import { AUDIT_ACTIONS, AUDIT_RESOURCE_TYPES } from '@/lib/security/audit-actions';

async function requireAdmin() {
  const auth = await getWorkspaceAuth();
  if (!auth) return null;
  const role = auth.target.role;
  if (role !== 'admin' && role !== 'superadmin') return null;
  return auth;
}

/** GET - Lista disputes */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const rl = await rateLimit('cod-disputes-list', auth.actor.id, {
    limit: 60,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('cod_disputes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }
    if (type) {
      query = query.eq('type', type);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[COD Disputes] Error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Stats aggregate
    const { data: stats } = await supabaseAdmin.from('cod_disputes').select('status, difference');
    const openCount = (stats || []).filter((s) => s.status === 'aperta').length;
    const resolvedCount = (stats || []).filter((s) => s.status === 'risolta').length;
    const ignoredCount = (stats || []).filter((s) => s.status === 'ignorata').length;
    const totalDifference = (stats || [])
      .filter((s) => s.status === 'aperta')
      .reduce((sum, s) => sum + Math.abs(Number(s.difference) || 0), 0);

    return NextResponse.json({
      success: true,
      disputes: data || [],
      total: count || 0,
      page,
      limit,
      stats: {
        open: openCount,
        resolved: resolvedCount,
        ignored: ignoredCount,
        totalDifference: Math.round(totalDifference * 100) / 100,
      },
    });
  } catch (error: any) {
    console.error('[COD Disputes] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** POST - Crea dispute manuale */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const rl = await rateLimit('cod-disputes-create', auth.actor.id, {
    limit: 30,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { cod_item_id, cod_file_id, type, expected_amount, actual_amount, ldv, description } =
      body as {
        cod_item_id?: string;
        cod_file_id?: string;
        type: string;
        expected_amount?: number;
        actual_amount?: number;
        ldv?: string;
        description?: string;
      };

    if (!type || !['importo_diverso', 'non_trovato', 'duplicato', 'altro'].includes(type)) {
      return NextResponse.json({ error: 'Tipo dispute non valido' }, { status: 400 });
    }

    const difference =
      expected_amount != null && actual_amount != null
        ? Math.round((actual_amount - expected_amount) * 100) / 100
        : null;

    const { data, error } = await supabaseAdmin
      .from('cod_disputes')
      .insert({
        cod_item_id: cod_item_id || null,
        cod_file_id: cod_file_id || null,
        type,
        expected_amount: expected_amount ?? null,
        actual_amount: actual_amount ?? null,
        difference,
        ldv: ldv || null,
        description: description || null,
      })
      .select()
      .single();

    if (error) {
      console.error('[COD Disputes] Errore creazione:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await writeAuditLog({
      context: auth,
      action: AUDIT_ACTIONS.COD_FILE_UPLOADED,
      resourceType: AUDIT_RESOURCE_TYPES.COD_FILE,
      resourceId: data.id,
      metadata: { type, ldv, difference, manual: true },
    });

    return NextResponse.json({ success: true, dispute: data });
  } catch (error: any) {
    console.error('[COD Disputes] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** PATCH - Risolvi o ignora dispute */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const rl = await rateLimit('cod-disputes-resolve', auth.actor.id, {
    limit: 30,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { id, status, resolution_note } = body as {
      id: string;
      status: 'risolta' | 'ignorata';
      resolution_note?: string;
    };

    if (!id) {
      return NextResponse.json({ error: 'ID dispute richiesto' }, { status: 400 });
    }
    if (!status || !['risolta', 'ignorata'].includes(status)) {
      return NextResponse.json({ error: 'Stato non valido' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('cod_disputes')
      .update({
        status,
        resolution_note: resolution_note || null,
        resolved_by: auth.actor.id,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[COD Disputes] Errore risoluzione:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, dispute: data });
  } catch (error: any) {
    console.error('[COD Disputes] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
