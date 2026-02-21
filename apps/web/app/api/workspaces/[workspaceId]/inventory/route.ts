/**
 * API: Workspace Inventory (Giacenze)
 *
 * GET  /api/workspaces/[workspaceId]/inventory — Lista giacenze
 * POST /api/workspaces/[workspaceId]/inventory — Aggiorna stock (carico/scarico)
 *
 * Sicurezza:
 * - Auth obbligatoria + membership attiva
 * - warehouse:view per leggere, warehouse:inventory per movimenti stock
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth, isSuperAdmin } from '@/lib/workspace-auth';
import { isValidUUID } from '@/lib/workspace-constants';
import { rateLimit } from '@/lib/security/rate-limit';
import {
  listInventory,
  updateStock,
  getWarehouseMovements,
  getStockValue,
  getLowStockProducts,
} from '@/lib/db/warehouses';
import { verifyWmsAccess } from '@/lib/wms/verify-access';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

// ─── GET: Lista giacenze / movimenti / valore stock / sotto-scorta ───

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

    const rl = await rateLimit('inventory-list', context.target.id, {
      limit: 60,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const view = searchParams.get('view'); // inventory | movements | value | low-stock

    const rawWarehouseId = searchParams.get('warehouse_id') || undefined;
    const rawProductId = searchParams.get('product_id') || undefined;

    // Valida UUID opzionali — ritorna 400 invece di 500 per input malformati
    if (rawWarehouseId && !isValidUUID(rawWarehouseId)) {
      return NextResponse.json({ error: 'warehouse_id non valido' }, { status: 400 });
    }
    if (rawProductId && !isValidUUID(rawProductId)) {
      return NextResponse.json({ error: 'product_id non valido' }, { status: 400 });
    }

    const warehouseId = rawWarehouseId;
    const productId = rawProductId;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 100);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

    // Sotto-vista: movimenti
    if (view === 'movements') {
      const result = await getWarehouseMovements(workspaceId, {
        productId,
        warehouseId,
        limit,
        offset,
      });
      return NextResponse.json(result);
    }

    // Sotto-vista: valore stock
    if (view === 'value') {
      const result = await getStockValue(workspaceId, warehouseId);
      return NextResponse.json(result);
    }

    // Sotto-vista: prodotti sotto-scorta
    if (view === 'low-stock') {
      const result = await getLowStockProducts(workspaceId);
      return NextResponse.json({ products: result, total: result.length });
    }

    // Default: lista giacenze
    const lowStockOnly = searchParams.get('low_stock') === 'true';
    const result = await listInventory(workspaceId, warehouseId, {
      lowStockOnly,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[INVENTORY] GET error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

// ─── POST: Aggiorna stock (carico/scarico/rettifica) ───

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
      'warehouse:inventory',
      isSuperAdmin(context)
    );
    if (!access.allowed) {
      return NextResponse.json({ error: access.reason || 'Access denied' }, { status: 403 });
    }

    const rl = await rateLimit('inventory-update', context.target.id, {
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

    if (!body.warehouse_id || !isValidUUID(body.warehouse_id)) {
      return NextResponse.json({ error: 'warehouse_id obbligatorio e valido' }, { status: 400 });
    }

    if (typeof body.quantity !== 'number' || body.quantity === 0) {
      return NextResponse.json({ error: 'quantity obbligatoria (diversa da 0)' }, { status: 400 });
    }

    const validTypes = ['inbound', 'outbound', 'adjustment'];
    if (!body.type || !validTypes.includes(body.type)) {
      return NextResponse.json(
        { error: 'type obbligatorio (inbound, outbound, adjustment)' },
        { status: 400 }
      );
    }

    // Valida UUID opzionale — ritorna 400 invece di 500 per input malformati
    if (body.reference_id && !isValidUUID(body.reference_id)) {
      return NextResponse.json({ error: 'reference_id non valido' }, { status: 400 });
    }

    // Per outbound, la quantita' deve essere negativa
    const quantity = body.type === 'outbound' && body.quantity > 0 ? -body.quantity : body.quantity;

    await updateStock(
      workspaceId,
      {
        product_id: body.product_id,
        warehouse_id: body.warehouse_id,
        quantity,
        type: body.type,
        notes: body.notes?.trim() || undefined,
        reference_type: body.reference_type || undefined,
        reference_id: body.reference_id || undefined,
      },
      context.target.id
    );

    return NextResponse.json({ success: true, message: 'Stock aggiornato' }, { status: 201 });
  } catch (err: any) {
    console.error('[INVENTORY] POST error:', err.message);

    if (err.message === 'Stock insufficiente') {
      return NextResponse.json({ error: 'Stock insufficiente' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
