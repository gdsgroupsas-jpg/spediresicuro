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
import { getSafeAuth } from '@/lib/safe-auth';
import { setParentImposedFee, getSubUsersWithFees } from '@/lib/services/pricing/platform-fee';

/**
 * GET /api/reseller/sub-user-fee
 *
 * Ritorna lista sub-user con fee configurate.
 * Solo per RESELLER/SUPERADMIN.
 */
export async function GET() {
  try {
    const context = await getSafeAuth();

    if (!context?.actor?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const subUsers = await getSubUsersWithFees(context.actor.id);

    return NextResponse.json({
      success: true,
      subUsers,
      count: subUsers.length,
    });
  } catch (error: any) {
    console.error('[API] GET /reseller/sub-user-fee error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
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
    const context = await getSafeAuth();

    if (!context?.actor?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

    const result = await setParentImposedFee({ childUserId, fee, notes }, context.actor.id);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[API] PUT /reseller/sub-user-fee error:', error);

    // Errori noti
    if (error.message?.includes('not a sub-user')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error.message?.includes('Only RESELLER or SUPERADMIN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
