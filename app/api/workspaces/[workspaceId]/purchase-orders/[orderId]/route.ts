/**
 * API: Single Purchase Order Operations
 *
 * GET   /api/workspaces/[workspaceId]/purchase-orders/[orderId] — Dettaglio ordine
 * PATCH /api/workspaces/[workspaceId]/purchase-orders/[orderId] — Aggiorna stato ordine
 * POST  /api/workspaces/[workspaceId]/purchase-orders/[orderId] — Aggiungi riga ordine
 *
 * Sicurezza:
 * - Auth obbligatoria + membership attiva
 * - warehouse:view per leggere, warehouse:manage per modificare
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth, isSuperAdmin } from '@/lib/safe-auth';
import { isValidUUID } from '@/lib/workspace-constants';
import { rateLimit } from '@/lib/security/rate-limit';
import {
  getPurchaseOrderById,
  updatePurchaseOrderStatus,
  addPurchaseOrderItem,
} from '@/lib/db/products';
import { verifyWmsAccess } from '@/lib/wms/verify-access';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ workspaceId: string; orderId: string }>;
}

// ─── GET: Dettaglio ordine ───

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId, orderId } = await params;

    if (!isValidUUID(workspaceId) || !isValidUUID(orderId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const context = await getSafeAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await verifyWmsAccess(
      context.target.id,
      workspaceId,
      'warehouse:view',
      isSuperAdmin(context)
    );
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason || 'Access denied' }, { status: 403 });
    }

    const rl = await rateLimit('purchase-orders-detail', context.target.id, {
      limit: 60,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 });
    }

    const order = await getPurchaseOrderById(workspaceId, orderId);

    if (!order) {
      return NextResponse.json({ error: 'Ordine non trovato' }, { status: 404 });
    }

    return NextResponse.json({ order });
  } catch (err: any) {
    console.error('[PURCHASE-ORDERS] GET detail error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

// ─── PATCH: Aggiorna stato ordine ───

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId, orderId } = await params;

    if (!isValidUUID(workspaceId) || !isValidUUID(orderId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const context = await getSafeAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await verifyWmsAccess(
      context.target.id,
      workspaceId,
      'warehouse:manage',
      isSuperAdmin(context)
    );
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason || 'Access denied' }, { status: 403 });
    }

    const rl = await rateLimit('purchase-orders-update', context.target.id, {
      limit: 20,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 });
    }

    const body = await request.json();

    const validStatuses = ['draft', 'confirmed', 'shipped', 'partial', 'received', 'cancelled'];
    if (!body.status || !validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: 'Stato non valido (draft, confirmed, shipped, partial, received, cancelled)' },
        { status: 400 }
      );
    }

    await updatePurchaseOrderStatus(workspaceId, orderId, body.status);

    return NextResponse.json({ success: true, message: `Stato aggiornato a '${body.status}'` });
  } catch (err: any) {
    console.error('[PURCHASE-ORDERS] PATCH error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

// ─── POST: Aggiungi riga all'ordine ───

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId, orderId } = await params;

    if (!isValidUUID(workspaceId) || !isValidUUID(orderId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

    const context = await getSafeAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const access = await verifyWmsAccess(
      context.target.id,
      workspaceId,
      'warehouse:manage',
      isSuperAdmin(context)
    );
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason || 'Access denied' }, { status: 403 });
    }

    const rl = await rateLimit('purchase-orders-add-item', context.target.id, {
      limit: 30,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 });
    }

    const body = await request.json();

    // Validazione
    if (!body.product_id || !isValidUUID(body.product_id)) {
      return NextResponse.json({ error: 'product_id obbligatorio e valido' }, { status: 400 });
    }

    if (!body.quantity_ordered || body.quantity_ordered <= 0) {
      return NextResponse.json({ error: 'quantity_ordered deve essere > 0' }, { status: 400 });
    }

    if (body.list_price === undefined || body.list_price < 0) {
      return NextResponse.json({ error: 'list_price obbligatorio e >= 0' }, { status: 400 });
    }

    // Verifica che l'ordine esista e appartenga al workspace
    const order = await getPurchaseOrderById(workspaceId, orderId);
    if (!order) {
      return NextResponse.json({ error: 'Ordine non trovato' }, { status: 404 });
    }

    const item = await addPurchaseOrderItem(workspaceId, orderId, {
      product_id: body.product_id,
      quantity_ordered: body.quantity_ordered,
      list_price: Number(body.list_price),
      discount_1: body.discount_1 ? Number(body.discount_1) : undefined,
      discount_2: body.discount_2 ? Number(body.discount_2) : undefined,
      discount_3: body.discount_3 ? Number(body.discount_3) : undefined,
      discount_4: body.discount_4 ? Number(body.discount_4) : undefined,
      discount_5: body.discount_5 ? Number(body.discount_5) : undefined,
      raee_amount: body.raee_amount ? Number(body.raee_amount) : undefined,
      warehouse_id: body.warehouse_id || undefined,
      notes: body.notes?.trim() || undefined,
    });

    return NextResponse.json({ item }, { status: 201 });
  } catch (err: any) {
    console.error('[PURCHASE-ORDERS] POST item error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
