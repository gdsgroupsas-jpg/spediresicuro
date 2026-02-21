/**
 * API: Workspace Products (Prodotti)
 *
 * GET  /api/workspaces/[workspaceId]/products — Lista prodotti
 * POST /api/workspaces/[workspaceId]/products — Crea prodotto
 *
 * Sicurezza:
 * - Auth obbligatoria + membership attiva
 * - warehouse:view per leggere, warehouse:manage per creare
 * - Workspace isolation via service layer
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth, isSuperAdmin } from '@/lib/workspace-auth';
import { isValidUUID } from '@/lib/workspace-constants';
import { rateLimit } from '@/lib/security/rate-limit';
import { listProducts, createProduct } from '@/lib/db/products';
import { verifyWmsAccess } from '@/lib/wms/verify-access';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

// ─── GET: Lista prodotti ───

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

    const rl = await rateLimit('products-list', context.target.id, {
      limit: 60,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 });
    }

    const { searchParams } = new URL(request.url);
    const filters = {
      category: searchParams.get('category') || undefined,
      type: (searchParams.get('type') as any) || undefined,
      active: searchParams.has('active') ? searchParams.get('active') === 'true' : undefined,
      search: searchParams.get('search') || undefined,
      order_by: searchParams.get('order_by') || undefined,
      order_dir: (searchParams.get('order_dir') as 'asc' | 'desc') || undefined,
      limit: Math.min(parseInt(searchParams.get('limit') || '50', 10) || 50, 100),
      offset: Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0),
    };

    const result = await listProducts(workspaceId, filters);

    return NextResponse.json({
      products: result.products,
      total: result.total,
    });
  } catch (err: any) {
    console.error('[PRODUCTS] GET error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

// ─── POST: Crea prodotto ───

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

    const rl = await rateLimit('products-create', context.target.id, {
      limit: 30,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 });
    }

    const body = await request.json();

    // Validazione campi obbligatori
    if (!body.sku || !body.sku.trim()) {
      return NextResponse.json({ error: 'SKU obbligatorio' }, { status: 400 });
    }

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Nome obbligatorio' }, { status: 400 });
    }

    const validTypes = ['physical', 'digital', 'service', 'dropshipping'];
    if (body.type && !validTypes.includes(body.type)) {
      return NextResponse.json({ error: 'Tipo prodotto non valido' }, { status: 400 });
    }

    const product = await createProduct(workspaceId, {
      sku: body.sku.trim(),
      barcode: body.barcode?.trim() || undefined,
      name: body.name.trim(),
      description: body.description?.trim() || undefined,
      category: body.category?.trim() || undefined,
      subcategory: body.subcategory?.trim() || undefined,
      tags: Array.isArray(body.tags) ? body.tags : undefined,
      type: body.type || 'physical',
      weight: body.weight ? Number(body.weight) : undefined,
      length: body.length ? Number(body.length) : undefined,
      width: body.width ? Number(body.width) : undefined,
      height: body.height ? Number(body.height) : undefined,
      cost_price: body.cost_price ? Number(body.cost_price) : undefined,
      sale_price: body.sale_price ? Number(body.sale_price) : undefined,
      suggested_retail_price: body.suggested_retail_price
        ? Number(body.suggested_retail_price)
        : undefined,
      raee_amount: body.raee_amount ? Number(body.raee_amount) : undefined,
      eco_contribution: body.eco_contribution ? Number(body.eco_contribution) : undefined,
      image_url: body.image_url || undefined,
      active: body.active !== false,
    });

    return NextResponse.json({ product }, { status: 201 });
  } catch (err: any) {
    console.error('[PRODUCTS] POST error:', err.message);

    // SKU duplicato
    if (err.message.includes("gia' esistente")) {
      return NextResponse.json({ error: err.message }, { status: 409 });
    }

    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
