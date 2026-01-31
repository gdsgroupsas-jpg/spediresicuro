import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-middleware';
import { getUserByEmail } from '@/lib/db/user-helpers';
import { handleApiError, ApiErrors } from '@/lib/api-responses';
import { getHoldsForUser } from '@/lib/services/giacenze/giacenze-service';
import type { HoldStatus } from '@/types/giacenze';

export const dynamic = 'force-dynamic';

/**
 * GET /api/giacenze
 * Lista giacenze dell'utente con filtri opzionali
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const { context } = authResult;

    const user = await getUserByEmail(context!.actor.email!, 'id');
    if (!user) return ApiErrors.NOT_FOUND('Utente');

    const { searchParams } = new URL(request.url);
    const status = (searchParams.get('status') || 'all') as HoldStatus | 'all';
    const search = searchParams.get('search') || undefined;

    const holds = await getHoldsForUser(user.id, { status, search });

    return NextResponse.json({
      success: true,
      holds,
      count: holds.length,
    });
  } catch (error: any) {
    return handleApiError(error, 'GET /api/giacenze');
  }
}
