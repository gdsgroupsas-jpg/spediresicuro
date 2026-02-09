/**
 * API: Workspace Email Addresses
 *
 * GET    /api/workspaces/[workspaceId]/email-addresses — Lista indirizzi email
 * POST   /api/workspaces/[workspaceId]/email-addresses — Crea indirizzo su dominio custom
 * DELETE /api/workspaces/[workspaceId]/email-addresses?addressId=xxx — Rimuove indirizzo
 *
 * Sicurezza:
 * - Auth obbligatoria + membership attiva
 * - GET: qualsiasi membro
 * - POST/DELETE: solo owner
 * - Solo indirizzi del workspace (filtro server-side)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth, isSuperAdmin } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { isValidUUID } from '@/lib/workspace-constants';
import { addEmailAddressOnDomain, removeEmailAddress } from '@/lib/email/domain-management-service';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

// ─── AUTH HELPER ───

async function verifyMembership(
  userId: string,
  workspaceId: string,
  isSuperAdminUser: boolean,
  requireOwner = false
): Promise<{ allowed: boolean; error?: string; status?: number }> {
  if (isSuperAdminUser) return { allowed: true };

  const { data: membership } = await supabaseAdmin
    .from('workspace_members')
    .select('role, status')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (!membership) {
    return { allowed: false, error: 'Access denied', status: 403 };
  }

  if (requireOwner && membership.role !== 'owner') {
    return {
      allowed: false,
      error: 'Solo il proprietario può eseguire questa azione',
      status: 403,
    };
  }

  return { allowed: true };
}

// ─── GET ───

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await params;

    if (!isValidUUID(workspaceId)) {
      return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 });
    }

    const context = await getSafeAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isSuperAdminUser = isSuperAdmin(context);
    const access = await verifyMembership(context.target.id, workspaceId, isSuperAdminUser);
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { data, error } = await supabaseAdmin
      .from('workspace_email_addresses')
      .select('id, workspace_id, email_address, display_name, is_primary, is_verified')
      .eq('workspace_id', workspaceId)
      .order('is_primary', { ascending: false });

    if (error) {
      console.error('[WS-EMAIL-ADDR] Error:', error.message);
      return NextResponse.json({ error: 'Errore caricamento indirizzi' }, { status: 500 });
    }

    return NextResponse.json({ addresses: data || [] });
  } catch (err: unknown) {
    console.error('[WS-EMAIL-ADDR] GET Error:', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

// ─── POST ───

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await params;

    if (!isValidUUID(workspaceId)) {
      return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 });
    }

    const context = await getSafeAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isSuperAdminUser = isSuperAdmin(context);
    const access = await verifyMembership(context.target.id, workspaceId, isSuperAdminUser, true);
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const body = await request.json().catch(() => null);
    if (!body?.emailAddress || typeof body.emailAddress !== 'string') {
      return NextResponse.json({ error: 'emailAddress obbligatorio' }, { status: 400 });
    }
    if (!body?.displayName || typeof body.displayName !== 'string') {
      return NextResponse.json({ error: 'displayName obbligatorio' }, { status: 400 });
    }

    // Lunghezza massima pre-check
    if (body.emailAddress.trim().length > 254) {
      return NextResponse.json({ error: 'Indirizzo email troppo lungo' }, { status: 400 });
    }
    if (body.displayName.trim().length > 100) {
      return NextResponse.json(
        { error: 'Nome visualizzato troppo lungo (max 100 caratteri)' },
        { status: 400 }
      );
    }

    const result = await addEmailAddressOnDomain(
      workspaceId,
      body.emailAddress,
      body.displayName,
      body.isPrimary === true
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ addressId: result.addressId }, { status: 201 });
  } catch (err: unknown) {
    console.error('[WS-EMAIL-ADDR] POST Error:', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

// ─── DELETE ───

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await params;

    if (!isValidUUID(workspaceId)) {
      return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 });
    }

    const context = await getSafeAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isSuperAdminUser = isSuperAdmin(context);
    const access = await verifyMembership(context.target.id, workspaceId, isSuperAdminUser, true);
    if (!access.allowed) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { searchParams } = new URL(request.url);
    const addressId = searchParams.get('addressId');

    if (!addressId || !isValidUUID(addressId)) {
      return NextResponse.json({ error: 'addressId valido obbligatorio' }, { status: 400 });
    }

    const result = await removeEmailAddress(workspaceId, addressId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[WS-EMAIL-ADDR] DELETE Error:', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
