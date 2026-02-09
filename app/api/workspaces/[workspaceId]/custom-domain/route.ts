/**
 * API: Workspace Custom Domain
 *
 * GET    /api/workspaces/[workspaceId]/custom-domain — Info dominio + DNS + status
 * POST   /api/workspaces/[workspaceId]/custom-domain — Registra dominio
 * DELETE /api/workspaces/[workspaceId]/custom-domain — Rimuove dominio
 *
 * Sicurezza:
 * - Auth obbligatoria + membership attiva
 * - GET: qualsiasi membro
 * - POST/DELETE: solo owner
 * - SuperAdmin bypass membership
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth, isSuperAdmin } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { isValidUUID } from '@/lib/workspace-constants';
import {
  getWorkspaceCustomDomain,
  registerCustomDomain,
  removeCustomDomain,
} from '@/lib/email/domain-management-service';

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
): Promise<{ allowed: boolean; role?: string; error?: string; status?: number }> {
  if (isSuperAdminUser) return { allowed: true, role: 'superadmin' };

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

  return { allowed: true, role: membership.role };
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

    const domain = await getWorkspaceCustomDomain(workspaceId);

    if (!domain) {
      return NextResponse.json({ domain: null });
    }

    return NextResponse.json({ domain });
  } catch (err: unknown) {
    console.error('[CUSTOM-DOMAIN] GET Error:', err);
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
    if (!body?.domainName || typeof body.domainName !== 'string') {
      return NextResponse.json({ error: 'domainName obbligatorio' }, { status: 400 });
    }

    // Lunghezza massima pre-check (prima di arrivare al service)
    if (body.domainName.trim().length > 253) {
      return NextResponse.json(
        { error: 'Dominio troppo lungo (max 253 caratteri)' },
        { status: 400 }
      );
    }

    const result = await registerCustomDomain(workspaceId, body.domainName);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ domain: result.domain }, { status: 201 });
  } catch (err: unknown) {
    console.error('[CUSTOM-DOMAIN] POST Error:', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}

// ─── DELETE ───

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
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

    const result = await removeCustomDomain(workspaceId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[CUSTOM-DOMAIN] DELETE Error:', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
