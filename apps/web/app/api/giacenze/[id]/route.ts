import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-middleware';
import { getUserByEmail } from '@/lib/db/user-helpers';
import { handleApiError, ApiErrors } from '@/lib/api-responses';
import { getHoldById } from '@/lib/services/giacenze/giacenze-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/giacenze/[id]
 * Dettaglio singola giacenza
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const { context } = authResult;

    const { id } = await params;

    const user = await getUserByEmail(context!.actor.email!, 'id');
    if (!user) return ApiErrors.NOT_FOUND('Utente');

    const hold = await getHoldById(id, user.id);
    if (!hold) return ApiErrors.NOT_FOUND('Giacenza');

    return NextResponse.json({
      success: true,
      hold,
    });
  } catch (error: any) {
    return handleApiError(error, 'GET /api/giacenze/[id]');
  }
}
