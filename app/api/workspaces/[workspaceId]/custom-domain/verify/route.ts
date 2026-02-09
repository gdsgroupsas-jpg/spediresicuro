/**
 * API: Workspace Custom Domain — Verifica DNS
 *
 * POST /api/workspaces/[workspaceId]/custom-domain/verify — Triggera verifica DNS
 *
 * Sicurezza:
 * - Auth obbligatoria + membership attiva
 * - Solo owner può triggerare verifica
 * - SuperAdmin bypass membership
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth, isSuperAdmin } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { isValidUUID } from '@/lib/workspace-constants';
import { rateLimit } from '@/lib/security/rate-limit';
import { verifyCustomDomain } from '@/lib/email/domain-management-service';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await params;

    if (!isValidUUID(workspaceId)) {
      return NextResponse.json({ error: 'Invalid workspace ID' }, { status: 400 });
    }

    const context = await getSafeAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verifica membership: solo owner
    const isSuperAdminUser = isSuperAdmin(context);
    if (!isSuperAdminUser) {
      const { data: membership } = await supabaseAdmin
        .from('workspace_members')
        .select('role, status')
        .eq('workspace_id', workspaceId)
        .eq('user_id', context.target.id)
        .eq('status', 'active')
        .single();

      if (!membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      if (membership.role !== 'owner') {
        return NextResponse.json(
          { error: 'Solo il proprietario può verificare il dominio' },
          { status: 403 }
        );
      }
    }

    const rl = await rateLimit('custom-domain-verify', context.target.id, {
      limit: 5,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova tra poco.' }, { status: 429 });
    }

    const result = await verifyCustomDomain(workspaceId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      status: result.status,
      dns_records: result.dns_records,
    });
  } catch (err: unknown) {
    console.error('[CUSTOM-DOMAIN-VERIFY] Error:', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
