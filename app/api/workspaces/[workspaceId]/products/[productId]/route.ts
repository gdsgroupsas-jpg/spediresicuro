/**
 * API: Single Product Operations
 *
 * GET    /api/workspaces/[workspaceId]/products/[productId] — Dettaglio prodotto
 * PATCH  /api/workspaces/[workspaceId]/products/[productId] — Aggiorna prodotto
 * DELETE /api/workspaces/[workspaceId]/products/[productId] — Elimina prodotto
 *
 * Sicurezza:
 * - Auth obbligatoria + membership attiva
 * - warehouse:view per leggere, warehouse:manage per modificare/eliminare
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth, isSuperAdmin } from '@/lib/safe-auth';
import { isValidUUID } from '@/lib/workspace-constants';
import { rateLimit } from '@/lib/security/rate-limit';
import {
  getProductById,
  updateProduct,
  deleteProduct,
  getProductSuppliers,
} from '@/lib/db/products';
import { verifyWmsAccess } from '@/lib/wms/verify-access';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ workspaceId: string; productId: string }>;
}

// ─── GET: Dettaglio prodotto ───

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId, productId } = await params;

    if (!isValidUUID(workspaceId) || !isValidUUID(productId)) {
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

    const rl = await rateLimit('products-detail', context.target.id, {
      limit: 60,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 });
    }

    const product = await getProductById(workspaceId, productId);

    if (!product) {
      return NextResponse.json({ error: 'Prodotto non trovato' }, { status: 404 });
    }

    // Includi fornitori associati
    const suppliers = await getProductSuppliers(workspaceId, productId);

    return NextResponse.json({ product, suppliers });
  } catch (err: any) {
    console.error('[PRODUCTS] GET detail error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

// ─── PATCH: Aggiorna prodotto ───

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId, productId } = await params;

    if (!isValidUUID(workspaceId) || !isValidUUID(productId)) {
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

    const rl = await rateLimit('products-update', context.target.id, {
      limit: 30,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 });
    }

    const body = await request.json();

    // Validazioni opzionali
    const validTypes = ['physical', 'digital', 'service', 'dropshipping'];
    if (body.type && !validTypes.includes(body.type)) {
      return NextResponse.json({ error: 'Tipo prodotto non valido' }, { status: 400 });
    }

    // Costruisci updates — solo campi presenti nel body
    const updates: Record<string, any> = {};
    const stringFields = [
      'sku',
      'barcode',
      'name',
      'description',
      'category',
      'subcategory',
      'image_url',
    ];
    for (const field of stringFields) {
      if (body[field] !== undefined) {
        updates[field] = typeof body[field] === 'string' ? body[field].trim() : body[field];
      }
    }

    const numberFields = [
      'weight',
      'length',
      'width',
      'height',
      'cost_price',
      'sale_price',
      'suggested_retail_price',
      'raee_amount',
      'eco_contribution',
    ];
    for (const field of numberFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field] === null ? null : Number(body[field]);
      }
    }

    if (body.type !== undefined) updates.type = body.type;
    if (body.active !== undefined) updates.active = !!body.active;
    if (body.tags !== undefined) updates.tags = Array.isArray(body.tags) ? body.tags : [];

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 });
    }

    const product = await updateProduct(workspaceId, productId, updates);

    return NextResponse.json({ product });
  } catch (err: any) {
    console.error('[PRODUCTS] PATCH error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

// ─── DELETE: Elimina prodotto ───

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId, productId } = await params;

    if (!isValidUUID(workspaceId) || !isValidUUID(productId)) {
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

    const rl = await rateLimit('products-delete', context.target.id, {
      limit: 10,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 });
    }

    await deleteProduct(workspaceId, productId);

    return NextResponse.json({ success: true, message: 'Prodotto eliminato' });
  } catch (err: any) {
    console.error('[PRODUCTS] DELETE error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
