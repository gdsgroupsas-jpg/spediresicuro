/**
 * API: Workspace Suppliers (Fornitori)
 *
 * GET  /api/workspaces/[workspaceId]/suppliers — Lista fornitori
 * POST /api/workspaces/[workspaceId]/suppliers — Crea fornitore
 *
 * Sicurezza:
 * - Auth obbligatoria + membership attiva
 * - warehouse:view per leggere, warehouse:manage per creare
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth, isSuperAdmin } from '@/lib/workspace-auth';
import { isValidUUID } from '@/lib/workspace-constants';
import { rateLimit } from '@/lib/security/rate-limit';
import { listSuppliers, createSupplier } from '@/lib/db/products';
import { verifyWmsAccess } from '@/lib/wms/verify-access';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

// ─── GET: Lista fornitori ───

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

    const rl = await rateLimit('suppliers-list', context.target.id, {
      limit: 60,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 });
    }

    const suppliers = await listSuppliers(workspaceId);

    return NextResponse.json({ suppliers });
  } catch (err: any) {
    console.error('[SUPPLIERS] GET error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

// ─── POST: Crea fornitore ───

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

    const rl = await rateLimit('suppliers-create', context.target.id, {
      limit: 20,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 });
    }

    const body = await request.json();

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Nome fornitore obbligatorio' }, { status: 400 });
    }

    const supplier = await createSupplier(workspaceId, {
      name: body.name.trim(),
      code: body.code?.trim() || undefined,
      company_name: body.company_name?.trim() || undefined,
      vat_number: body.vat_number?.trim() || undefined,
      email: body.email?.trim() || undefined,
      phone: body.phone?.trim() || undefined,
      address: body.address?.trim() || undefined,
      city: body.city?.trim() || undefined,
      zip: body.zip?.trim() || undefined,
      province: body.province?.trim() || undefined,
      country: body.country?.trim() || undefined,
      payment_terms: body.payment_terms?.trim() || undefined,
    });

    return NextResponse.json({ supplier }, { status: 201 });
  } catch (err: any) {
    console.error('[SUPPLIERS] POST error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
