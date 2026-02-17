/**
 * API: COD Forecast - Previsione rimborsi contrassegni
 *
 * GET /api/cod/forecast
 *
 * Calcola per ogni cliente con items "assegnato" (non ancora rimborsato):
 * - Totale in attesa di rimborso
 * - Data prevista di rimborso (basata sulla media storica dei tempi di pagamento)
 * - Prossima scadenza
 *
 * Fornisce anche un riepilogo globale.
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

  const rl = await rateLimit('cod-forecast', auth.actor.id, {
    limit: 30,
    windowSeconds: 60,
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Troppe richieste' }, { status: 429 });
  }

  try {
    // 1. Calcola tempo medio di pagamento dalle distinte storiche pagate
    const { data: paidDistinte } = await supabaseAdmin
      .from('cod_distinte')
      .select('created_at, payment_date')
      .eq('status', 'pagata')
      .not('payment_date', 'is', null);

    let avgPaymentDays = 7; // default 7 giorni
    if (paidDistinte && paidDistinte.length > 0) {
      const totalDays = paidDistinte.reduce((sum, d) => {
        const created = new Date(d.created_at).getTime();
        const paid = new Date(d.payment_date!).getTime();
        return sum + (paid - created) / (1000 * 60 * 60 * 24);
      }, 0);
      avgPaymentDays = Math.round(totalDays / paidDistinte.length);
      if (avgPaymentDays < 1) avgPaymentDays = 1;
    }

    // 2. Items in attesa di rimborso (assegnato, non rimborsato)
    const { data: pendingItems } = await supabaseAdmin
      .from('cod_items')
      .select('client_id, pagato, created_at, distinta_id')
      .in('status', ['in_attesa', 'assegnato']);

    // 3. Distinte in lavorazione
    const { data: pendingDistinte } = await supabaseAdmin
      .from('cod_distinte')
      .select('id, client_id, client_name, total_initial, created_at')
      .eq('status', 'in_lavorazione');

    // 4. Raggruppa per cliente
    const clientMap = new Map<
      string,
      {
        clientId: string;
        clientName: string;
        totalPending: number;
        itemCount: number;
        distinteCount: number;
        oldestItemDate: string;
        estimatedPaymentDate: string;
      }
    >();

    // Da distinte in lavorazione
    for (const d of pendingDistinte || []) {
      const existing = clientMap.get(d.client_id);
      const estimatedDate = new Date(d.created_at);
      estimatedDate.setDate(estimatedDate.getDate() + avgPaymentDays);

      if (existing) {
        existing.totalPending += Number(d.total_initial);
        existing.distinteCount++;
        if (d.created_at < existing.oldestItemDate) {
          existing.oldestItemDate = d.created_at;
          existing.estimatedPaymentDate = estimatedDate.toISOString();
        }
      } else {
        clientMap.set(d.client_id, {
          clientId: d.client_id,
          clientName: d.client_name,
          totalPending: Number(d.total_initial),
          itemCount: 0,
          distinteCount: 1,
          oldestItemDate: d.created_at,
          estimatedPaymentDate: estimatedDate.toISOString(),
        });
      }
    }

    // Items senza distinta (ancora da raggruppare)
    const loosePending = (pendingItems || []).filter((i) => !i.distinta_id && i.client_id);
    const looseByClient = new Map<string, { total: number; count: number; oldest: string }>();
    for (const item of loosePending) {
      const existing = looseByClient.get(item.client_id!);
      if (existing) {
        existing.total += Number(item.pagato);
        existing.count++;
        if (item.created_at < existing.oldest) existing.oldest = item.created_at;
      } else {
        looseByClient.set(item.client_id!, {
          total: Number(item.pagato),
          count: 1,
          oldest: item.created_at,
        });
      }
    }

    // Merge loose items con client names
    if (looseByClient.size > 0) {
      const clientIds = [...looseByClient.keys()];
      const { data: users } = await supabaseAdmin
        .from('users')
        .select('id, full_name, email')
        .in('id', clientIds);

      for (const [clientId, data] of looseByClient) {
        const user = (users || []).find((u) => u.id === clientId);
        const clientName = user?.full_name || user?.email || 'Sconosciuto';
        const estimatedDate = new Date(data.oldest);
        estimatedDate.setDate(estimatedDate.getDate() + avgPaymentDays);

        const existing = clientMap.get(clientId);
        if (existing) {
          existing.totalPending += data.total;
          existing.itemCount += data.count;
        } else {
          clientMap.set(clientId, {
            clientId,
            clientName,
            totalPending: data.total,
            itemCount: data.count,
            distinteCount: 0,
            oldestItemDate: data.oldest,
            estimatedPaymentDate: estimatedDate.toISOString(),
          });
        }
      }
    }

    const forecasts = [...clientMap.values()]
      .map((f) => ({
        ...f,
        totalPending: Math.round(f.totalPending * 100) / 100,
      }))
      .sort((a, b) => b.totalPending - a.totalPending);

    const globalTotal = forecasts.reduce((sum, f) => sum + f.totalPending, 0);
    const nearestDate =
      forecasts.length > 0
        ? forecasts.reduce(
            (nearest, f) => (f.estimatedPaymentDate < nearest ? f.estimatedPaymentDate : nearest),
            forecasts[0].estimatedPaymentDate
          )
        : null;

    return NextResponse.json({
      success: true,
      avgPaymentDays,
      historicalSample: paidDistinte?.length || 0,
      globalTotal: Math.round(globalTotal * 100) / 100,
      nearestPaymentDate: nearestDate,
      clientCount: forecasts.length,
      forecasts,
    });
  } catch (error: any) {
    console.error('[COD Forecast] Error:', error.message);
    return NextResponse.json(
      { error: 'Errore durante il calcolo previsioni COD' },
      { status: 500 }
    );
  }
}
