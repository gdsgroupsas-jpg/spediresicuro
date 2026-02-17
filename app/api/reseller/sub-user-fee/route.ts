export const dynamic = 'force-dynamic';

/**
 * API: Gestione Fee Sub-User per RESELLER
 *
 * Permette ai RESELLER di impostare fee personalizzate ai propri sub-user.
 *
 * Endpoints:
 * - GET: Lista sub-user con fee configurate
 * - PUT: Imposta fee per un sub-user
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { rateLimit } from '@/lib/security/rate-limit';
import { setParentImposedFee, getSubUsersWithFees } from '@/lib/services/pricing/platform-fee';

/**
 * GET /api/reseller/sub-user-fee
 *
 * Ritorna lista sub-user con fee configurate.
 * Solo per RESELLER/SUPERADMIN.
 */
export async function GET() {
  try {
    const context = await getWorkspaceAuth();

    if (!context?.actor?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verifica ruolo reseller
    const { data: actor } = await supabaseAdmin
      .from('users')
      .select('id, is_reseller, account_type')
      .eq('id', context.actor.id)
      .single();

    if (
      !actor ||
      (!actor.is_reseller && actor.account_type !== 'superadmin' && actor.account_type !== 'admin')
    ) {
      return NextResponse.json(
        { error: 'Solo i reseller possono gestire le fee' },
        { status: 403 }
      );
    }

    const subUsers = await getSubUsersWithFees(context.actor.id);

    return NextResponse.json({
      success: true,
      subUsers,
      count: subUsers.length,
    });
  } catch (error: any) {
    console.error('[API] GET /reseller/sub-user-fee error:', error?.message);
    return NextResponse.json({ error: 'Errore nel recupero delle fee' }, { status: 500 });
  }
}

/**
 * PUT /api/reseller/sub-user-fee
 *
 * Imposta fee per un sub-user.
 * Solo per RESELLER/SUPERADMIN.
 *
 * Body:
 * - childUserId: string (required) - ID del sub-user
 * - fee: number | null (required) - Fee da impostare (null per rimuovere)
 * - notes: string (optional) - Note sulla modifica
 */
export async function PUT(request: NextRequest) {
  try {
    const context = await getWorkspaceAuth();

    if (!context?.actor?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verifica ruolo reseller
    const { data: actor } = await supabaseAdmin
      .from('users')
      .select('id, is_reseller, account_type')
      .eq('id', context.actor.id)
      .single();

    if (
      !actor ||
      (!actor.is_reseller && actor.account_type !== 'superadmin' && actor.account_type !== 'admin')
    ) {
      return NextResponse.json(
        { error: 'Solo i reseller possono gestire le fee' },
        { status: 403 }
      );
    }

    // Rate limiting: max 30 modifiche fee/minuto per reseller
    const rl = await rateLimit('reseller-set-fee', context.actor.id, {
      limit: 30,
      windowSeconds: 60,
    });
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Troppe richieste. Riprova tra qualche secondo.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { childUserId, fee, notes } = body;

    // Validazione input
    if (!childUserId) {
      return NextResponse.json({ error: 'childUserId is required' }, { status: 400 });
    }

    if (fee !== null && typeof fee !== 'number') {
      return NextResponse.json({ error: 'fee must be a number or null' }, { status: 400 });
    }

    if (fee !== null && fee < 0) {
      return NextResponse.json({ error: 'fee cannot be negative' }, { status: 400 });
    }

    if (fee !== null && fee > 100) {
      return NextResponse.json({ error: 'La fee non può superare 100€' }, { status: 400 });
    }

    // Validazione notes
    if (notes !== undefined && notes !== null) {
      if (typeof notes !== 'string' || notes.length > 500) {
        return NextResponse.json({ error: 'Note non valide (max 500 caratteri)' }, { status: 400 });
      }
    }

    // Validazione UUID childUserId
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(childUserId)) {
      return NextResponse.json({ error: 'childUserId non valido' }, { status: 400 });
    }

    const result = await setParentImposedFee({ childUserId, fee, notes }, context.actor.id);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API] PUT /reseller/sub-user-fee error:', error?.message);

    // Errori noti
    if (error.message?.includes('not a sub-user')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error.message?.includes('Only RESELLER or SUPERADMIN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json({ error: 'Errore nell aggiornamento della fee' }, { status: 500 });
  }
}
