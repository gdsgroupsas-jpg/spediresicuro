/**
 * API: Workspace Purchase Orders (Ordini Fornitore)
 *
 * GET  /api/workspaces/[workspaceId]/purchase-orders — Lista ordini
 * POST /api/workspaces/[workspaceId]/purchase-orders — Crea ordine
 *
 * Sicurezza:
 * - Auth obbligatoria + membership attiva
 * - warehouse:view per leggere, warehouse:manage per creare
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth, isSuperAdmin } from '@/lib/workspace-auth';
import { isValidUUID } from '@/lib/workspace-constants';
import { rateLimit } from '@/lib/security/rate-limit';
import { listPurchaseOrders, createPurchaseOrder } from '@/lib/db/products';
import { verifyWmsAccess } from '@/lib/wms/verify-access';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

// ─── GET: Lista ordini fornitore ───

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await params;

    if (!isValidUUID(workspaceId)) {
      return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 });
    }

    const context = await getWorkspaceAuth();
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

    const rl = await rateLimit('purchase-orders-list', context.target.id, {
      limit: 60,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const validStatuses = ['draft', 'confirmed', 'shipped', 'partial', 'received', 'cancelled'];
    const statusParam = searchParams.get('status') || undefined;
    const rawSupplierId = searchParams.get('supplier_id') || undefined;

    // Valida UUID opzionale — ritorna 400 invece di 500
    if (rawSupplierId && !isValidUUID(rawSupplierId)) {
      return NextResponse.json({ error: 'supplier_id non valido' }, { status: 400 });
    }

    const options = {
      status: statusParam && validStatuses.includes(statusParam) ? statusParam : undefined,
      supplierId: rawSupplierId,
      limit: Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 100),
      offset: Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0),
    };

    const result = await listPurchaseOrders(workspaceId, options);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[PURCHASE-ORDERS] GET error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

// ─── POST: Crea ordine fornitore ───

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await params;

    if (!isValidUUID(workspaceId)) {
      return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 });
    }

    const context = await getWorkspaceAuth();
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

    const rl = await rateLimit('purchase-orders-create', context.target.id, {
      limit: 20,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 });
    }

    const body = await request.json();

    // Validazione
    if (!body.supplier_id || !isValidUUID(body.supplier_id)) {
      return NextResponse.json({ error: 'supplier_id obbligatorio e valido' }, { status: 400 });
    }

    if (!body.order_number || !body.order_number.trim()) {
      return NextResponse.json({ error: 'Numero ordine obbligatorio' }, { status: 400 });
    }

    const order = await createPurchaseOrder(
      workspaceId,
      {
        supplier_id: body.supplier_id,
        order_number: body.order_number.trim(),
        order_date: body.order_date || new Date().toISOString().split('T')[0],
        expected_delivery_date: body.expected_delivery_date || undefined,
        external_reference: body.external_reference?.trim() || undefined,
        circular_reference: body.circular_reference?.trim() || undefined,
        notes: body.notes?.trim() || undefined,
      },
      context.target.id
    );

    return NextResponse.json({ order }, { status: 201 });
  } catch (err: any) {
    console.error('[PURCHASE-ORDERS] POST error:', err.message);

    if (err.message.includes("gia' esistente")) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }

    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
