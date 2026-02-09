/**
 * API: Workspace Email Addresses
 *
 * GET /api/workspaces/[workspaceId]/email-addresses — Lista indirizzi email
 *
 * Sicurezza:
 * - Auth obbligatoria + membership attiva
 * - Solo indirizzi del workspace (filtro server-side)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth, isSuperAdmin } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { isValidUUID } from '@/lib/workspace-constants';

export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ workspaceId: string }>;
}

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

    // Verifica membership
    const isSuperAdminUser = isSuperAdmin(context);
    if (!isSuperAdminUser) {
      const { data: membership } = await supabaseAdmin
        .from('workspace_members')
        .select('status')
        .eq('workspace_id', workspaceId)
        .eq('user_id', context.target.id)
        .eq('status', 'active')
        .single();

      if (!membership) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
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
  } catch (err: any) {
    console.error('[WS-EMAIL-ADDR] Error:', err.message);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
