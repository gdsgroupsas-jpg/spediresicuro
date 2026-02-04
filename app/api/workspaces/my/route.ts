/**
 * GET /api/workspaces/my
 *
 * Restituisce tutti i workspace accessibili dall'utente corrente
 *
 * SECURITY:
 * - Richiede autenticazione
 * - RLS garantisce isolamento dati
 * - Superadmin vede tutti i workspace (ma non li "possiede")
 *
 * RESPONSE:
 * {
 *   workspaces: UserWorkspaceInfo[]
 * }
 */

import { NextResponse } from 'next/server';
import { getSafeAuth, isSuperAdmin } from '@/lib/safe-auth';
import { getUserWorkspaces } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import type { UserWorkspaceInfo } from '@/types/workspace';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // 1. Verifica autenticazione
    const context = await getSafeAuth();

    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Ottieni workspace
    let workspaces: UserWorkspaceInfo[];

    if (isSuperAdmin(context)) {
      // Superadmin: vede TUTTI i workspace (per gestione)
      // Ma li vede come "viewer" speciale, non come member
      const { data, error } = await supabaseAdmin
        .from('workspaces')
        .select(
          `
          id,
          name,
          slug,
          type,
          depth,
          organization_id,
          wallet_balance,
          organizations!inner (
            id,
            name,
            slug,
            branding
          )
        `
        )
        .eq('status', 'active')
        .order('name');

      if (error) {
        console.error('Error fetching workspaces for superadmin:', error);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
      }

      workspaces = (data || []).map((w: any) => ({
        workspace_id: w.id,
        workspace_name: w.name,
        workspace_slug: w.slug,
        workspace_type: w.type,
        workspace_depth: w.depth,
        organization_id: w.organizations.id,
        organization_name: w.organizations.name,
        organization_slug: w.organizations.slug,
        role: 'owner' as const, // Superadmin ha sempre owner-level access
        permissions: [],
        wallet_balance: Number(w.wallet_balance),
        branding: w.organizations.branding || {},
        member_status: 'active' as const,
      }));
    } else {
      // Utente normale: solo workspace dove e' membro
      workspaces = await getUserWorkspaces(context.target.id);
    }

    return NextResponse.json({
      workspaces,
      count: workspaces.length,
    });
  } catch (error: any) {
    console.error('GET /api/workspaces/my error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
