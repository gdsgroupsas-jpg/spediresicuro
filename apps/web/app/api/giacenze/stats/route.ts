import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-middleware';
import { getUserByEmail } from '@/lib/db/user-helpers';
import { handleApiError, ApiErrors } from '@/lib/api-responses';
import { getOpenCount } from '@/lib/services/giacenze/giacenze-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/giacenze/stats
 * Conteggio giacenze aperte per badge navigazione
 */
export async function GET() {
  try {
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const { context } = authResult;

    const user = await getUserByEmail(context!.actor.email!, 'id');
    if (!user) return ApiErrors.NOT_FOUND('Utente');

    const openCount = await getOpenCount(user.id);

    return NextResponse.json({
      success: true,
      open_count: openCount,
    });
  } catch (error: any) {
    return handleApiError(error, 'GET /api/giacenze/stats');
  }
}
