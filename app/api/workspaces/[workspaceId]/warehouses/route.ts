/**
 * API: Workspace Warehouses (Magazzini)
 *
 * GET  /api/workspaces/[workspaceId]/warehouses — Lista magazzini
 * POST /api/workspaces/[workspaceId]/warehouses — Crea magazzino
 *
 * Sicurezza:
 * - Auth obbligatoria + membership attiva
 * - warehouse:view per leggere, warehouse:manage per creare
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth, isSuperAdmin } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { isValidUUID } from '@/lib/workspace-constants';
import { rateLimit } from '@/lib/security/rate-limit';
import { listWarehouses } from '@/lib/db/warehouses';
import { verifyWmsAccess } from '@/lib/wms/verify-access';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

// ─── GET: Lista magazzini ───

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

    const rl = await rateLimit('warehouses-list', context.target.id, {
      limit: 60,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 });
    }

    const warehouses = await listWarehouses(workspaceId);

    return NextResponse.json({ warehouses });
  } catch (err: any) {
    console.error('[WAREHOUSES] GET error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

// ─── POST: Crea magazzino ───

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

    const rl = await rateLimit('warehouses-create', context.target.id, {
      limit: 10,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 });
    }

    const body = await request.json();

    if (!body.code || !body.code.trim()) {
      return NextResponse.json({ error: 'Codice magazzino obbligatorio' }, { status: 400 });
    }

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: 'Nome magazzino obbligatorio' }, { status: 400 });
    }

    const validTypes = ['standard', 'transit', 'returns', 'dropship'];
    if (body.type && !validTypes.includes(body.type)) {
      return NextResponse.json({ error: 'Tipo magazzino non valido' }, { status: 400 });
    }

    const { data: warehouse, error } = await supabaseAdmin
      .from('warehouses')
      .insert({
        workspace_id: workspaceId,
        code: body.code.trim().toUpperCase(),
        name: body.name.trim(),
        type: body.type || 'standard',
        address: body.address?.trim() || null,
        city: body.city?.trim() || null,
        zip: body.zip?.trim() || null,
        province: body.province?.trim() || null,
        country: body.country?.trim() || 'IT',
        manager_name: body.manager_name?.trim() || null,
        phone: body.phone?.trim() || null,
        email: body.email?.trim() || null,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json(
          { error: `Codice magazzino "${body.code}" gia' esistente` },
          { status: 409 }
        );
      }
      throw new Error(error.message);
    }

    return NextResponse.json({ warehouse }, { status: 201 });
  } catch (err: any) {
    console.error('[WAREHOUSES] POST error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
