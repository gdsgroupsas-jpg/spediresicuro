/**
 * API: COD Distinte - CRUD distinte contrassegni
 *
 * POST /api/cod/distinte  - Crea distinte da selezione items (raggruppa per client_id)
 * GET  /api/cod/distinte  - Lista distinte con filtri
 * PATCH /api/cod/distinte - Segna distinta come pagata
 * DELETE /api/cod/distinte - Elimina distinta
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
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

/** POST - Crea distinte raggruppate per cliente */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const rl = await rateLimit('cod-distinte-create', auth.actor.id, {
    limit: 20,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { itemIds } = body as { itemIds: string[] };

    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: 'Seleziona almeno un contrassegno' }, { status: 400 });
    }

    // Isolamento multi-tenant: filtro diretto workspace_id
    const workspaceId = auth.workspace?.id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace non trovato' }, { status: 403 });
    }

    // Fetch items selezionati — solo quelli del workspace corrente
    const { data: items, error: fetchError } = await supabaseAdmin
      .from('cod_items')
      .select('id, client_id, pagato, ldv')
      .in('id', itemIds)
      .eq('workspace_id', workspaceId)
      .is('distinta_id', null);

    if (fetchError || !items) {
      return NextResponse.json({ error: 'Errore caricamento contrassegni' }, { status: 500 });
    }

    if (items.length === 0) {
      return NextResponse.json(
        { error: 'Nessun contrassegno valido (gia assegnati a distinta?)' },
        { status: 400 }
      );
    }

    // Raggruppa per client_id
    const grouped = new Map<string, typeof items>();
    for (const item of items) {
      const key = item.client_id || 'sconosciuto';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(item);
    }

    const createdDistinte: Array<{ id: string; clientId: string; total: number; count: number }> =
      [];

    for (const [clientId, clientItems] of grouped) {
      const totalInitial = clientItems.reduce((sum, i) => sum + (i.pagato || 0), 0);

      // Recupera nome cliente
      let clientName = 'Cliente sconosciuto';
      if (clientId !== 'sconosciuto') {
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('full_name, email')
          .eq('id', clientId)
          .single();
        if (user) {
          clientName = user.full_name || user.email || clientName;
        }
      }

      // Crea distinta (con workspace_id per isolamento multi-tenant)
      const { data: distinta, error: createError } = await supabaseAdmin
        .from('cod_distinte')
        .insert({
          client_id: clientId !== 'sconosciuto' ? clientId : auth.actor.id,
          client_name: clientName,
          total_initial: Math.round(totalInitial * 100) / 100,
          created_by: auth.actor.id,
          workspace_id: workspaceId,
        })
        .select('id')
        .single();

      if (createError || !distinta) {
        console.error('[COD Distinte] Errore creazione:', createError);
        continue;
      }

      // Aggiorna items con distinta_id
      const clientItemIds = clientItems.map((i) => i.id);
      await supabaseAdmin
        .from('cod_items')
        .update({ distinta_id: distinta.id, status: 'assegnato' })
        .in('id', clientItemIds);

      createdDistinte.push({
        id: distinta.id,
        clientId,
        total: Math.round(totalInitial * 100) / 100,
        count: clientItems.length,
      });
    }

    // Audit log per ogni distinta creata
    for (const d of createdDistinte) {
      await writeAuditLog({
        context: auth,
        action: AUDIT_ACTIONS.COD_DISTINTA_CREATED,
        resourceType: AUDIT_RESOURCE_TYPES.COD_DISTINTA,
        resourceId: d.id,
        metadata: { clientId: d.clientId, total: d.total, itemCount: d.count },
      });
    }

    return NextResponse.json({
      success: true,
      distinte: createdDistinte,
      totalCreated: createdDistinte.length,
    });
  } catch (error: any) {
    console.error('[COD Distinte] Error:', error.message);
    return NextResponse.json({ error: 'Errore durante la gestione distinte COD' }, { status: 500 });
  }
}

/** GET - Lista distinte — filtrate per workspace corrente */
export async function GET(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const rl = await rateLimit('cod-distinte-list', auth.actor.id, {
    limit: 60,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  try {
    // Isolamento multi-tenant: filtro diretto workspace_id
    const workspaceId = auth.workspace?.id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace non trovato' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('cod_distinte')
      .select('*', { count: 'exact' })
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('[COD Distinte] Error:', error.message);
      return NextResponse.json(
        { error: 'Errore durante la gestione distinte COD' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      distinte: data || [],
      total: count || 0,
      page,
      limit,
    });
  } catch (error: any) {
    console.error('[COD Distinte] Error:', error.message);
    return NextResponse.json({ error: 'Errore durante la gestione distinte COD' }, { status: 500 });
  }
}

/** PATCH - Segna distinta come pagata */
export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const rl = await rateLimit('cod-distinte-pay', auth.actor.id, {
    limit: 30,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  try {
    const body = await request.json();
    const { id, payment_method } = body as { id: string; payment_method: string };

    if (!id) {
      return NextResponse.json({ error: 'ID distinta richiesto' }, { status: 400 });
    }
    if (
      !payment_method ||
      !['assegno', 'sepa', 'contanti', 'compensata'].includes(payment_method)
    ) {
      return NextResponse.json({ error: 'Metodo pagamento non valido' }, { status: 400 });
    }

    // Isolamento multi-tenant: filtro workspace_id
    const workspaceId = auth.workspace?.id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace non trovato' }, { status: 403 });
    }

    // Aggiorna distinta (filtro workspace_id per isolamento)
    const { data, error } = await supabaseAdmin
      .from('cod_distinte')
      .update({
        status: 'pagata',
        payment_method,
        payment_date: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('workspace_id', workspaceId)
      .select()
      .single();

    if (error) {
      console.error('[COD Distinte] Errore aggiornamento:', error.message);
      return NextResponse.json(
        { error: 'Errore durante la gestione distinte COD' },
        { status: 500 }
      );
    }

    // Aggiorna items della distinta come rimborsati
    const wq = workspaceQuery(workspaceId);
    await wq.from('cod_items').update({ status: 'rimborsato' }).eq('distinta_id', id);

    // Aggiorna totale pagato nel cod_file corrispondente
    const { data: distinctItems } = await supabaseAdmin
      .from('cod_items')
      .select('cod_file_id, pagato')
      .eq('distinta_id', id);

    if (distinctItems && distinctItems.length > 0) {
      const totalPaid = distinctItems.reduce((sum, i) => sum + (i.pagato || 0), 0);
      const fileIds = [...new Set(distinctItems.map((i) => i.cod_file_id))];
      for (const fileId of fileIds) {
        // Ricalcola totale pagato per questo file
        const { data: fileItems } = await supabaseAdmin
          .from('cod_items')
          .select('pagato, status')
          .eq('cod_file_id', fileId)
          .eq('status', 'rimborsato');
        const fileTotalPaid = (fileItems || []).reduce((sum, i) => sum + (i.pagato || 0), 0);
        await supabaseAdmin
          .from('cod_files')
          .update({ total_cod_paid: Math.round(fileTotalPaid * 100) / 100 })
          .eq('id', fileId);
      }
    }

    // Audit log
    await writeAuditLog({
      context: auth,
      action: AUDIT_ACTIONS.COD_DISTINTA_PAID,
      resourceType: AUDIT_RESOURCE_TYPES.COD_DISTINTA,
      resourceId: id,
      metadata: {
        payment_method,
        clientId: data.client_id,
        clientName: data.client_name,
        totalInitial: data.total_initial,
      },
    });

    // Notifica cliente (in-app) — fail-open
    try {
      await supabaseAdmin.from('support_notifications').insert({
        user_id: data.client_id,
        type: 'refund_processed',
        message: `La distinta contrassegni #${data.number} è stata pagata: €${Number(data.total_initial).toFixed(2)} tramite ${payment_method}`,
        metadata: {
          distinta_id: id,
          distinta_number: data.number,
          total: data.total_initial,
          payment_method,
        },
        channels_delivered: ['in_app'],
      });
    } catch (notifErr: any) {
      console.error('[COD Distinte] Notifica fallita (fail-open):', notifErr.message);
    }

    return NextResponse.json({
      success: true,
      distinta: data,
    });
  } catch (error: any) {
    console.error('[COD Distinte] Error:', error.message);
    return NextResponse.json({ error: 'Errore durante la gestione distinte COD' }, { status: 500 });
  }
}

/** DELETE - Elimina distinta */
export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
  }

  const rl = await rateLimit('cod-distinte-delete', auth.actor.id, {
    limit: 20,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID distinta richiesto' }, { status: 400 });
    }

    // Isolamento multi-tenant: filtro workspace_id
    const workspaceId = auth.workspace?.id;
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace non trovato' }, { status: 403 });
    }

    // Scollega items dalla distinta (filtro workspace per sicurezza)
    await supabaseAdmin
      .from('cod_items')
      .update({ distinta_id: null, status: 'in_attesa' })
      .eq('distinta_id', id)
      .eq('workspace_id', workspaceId);

    // Elimina distinta (filtro workspace per isolamento)
    const { error } = await supabaseAdmin
      .from('cod_distinte')
      .delete()
      .eq('id', id)
      .eq('workspace_id', workspaceId);

    if (error) {
      console.error('[COD Distinte] Errore eliminazione:', error.message);
      return NextResponse.json(
        { error: 'Errore durante la gestione distinte COD' },
        { status: 500 }
      );
    }

    // Audit log
    await writeAuditLog({
      context: auth,
      action: AUDIT_ACTIONS.COD_DISTINTA_DELETED,
      resourceType: AUDIT_RESOURCE_TYPES.COD_DISTINTA,
      resourceId: id,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[COD Distinte] Error:', error.message);
    return NextResponse.json({ error: 'Errore durante la gestione distinte COD' }, { status: 500 });
  }
}
