import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-middleware';
import { getUserByEmail } from '@/lib/db/user-helpers';
import { handleApiError, ApiErrors } from '@/lib/api-responses';
import { getAvailableActions, executeAction } from '@/lib/services/giacenze/giacenze-service';
import type { HoldActionType } from '@/types/giacenze';

export const dynamic = 'force-dynamic';

/**
 * GET /api/giacenze/[id]/actions
 * Azioni disponibili con costi calcolati dal listino
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const { context } = authResult;

    const user = await getUserByEmail(context!.actor.email!, 'id');
    if (!user) return ApiErrors.NOT_FOUND('Utente');

    const actions = await getAvailableActions(params.id, user.id);

    return NextResponse.json({
      success: true,
      actions,
    });
  } catch (error: any) {
    return handleApiError(error, 'GET /api/giacenze/[id]/actions');
  }
}

/**
 * POST /api/giacenze/[id]/actions
 * Esegui azione giacenza con addebito wallet
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const { context } = authResult;

    const user = await getUserByEmail(context!.actor.email!, 'id');
    if (!user) return ApiErrors.NOT_FOUND('Utente');

    const body = await request.json();
    const { action_type, new_address } = body as {
      action_type: HoldActionType;
      new_address?: {
        name: string;
        address: string;
        city: string;
        zip: string;
        province: string;
        phone: string;
      };
    };

    if (!action_type) {
      return NextResponse.json({ error: 'Campo action_type obbligatorio' }, { status: 400 });
    }

    const result = await executeAction(params.id, user.id, action_type, new_address);

    return NextResponse.json({
      success: true,
      hold: result.hold,
      wallet_transaction_id: result.walletTransactionId,
    });
  } catch (error: any) {
    // Handle insufficient balance specifically
    if (error.message?.includes('Credito insufficiente')) {
      return NextResponse.json(
        { error: error.message, code: 'INSUFFICIENT_BALANCE' },
        { status: 402 }
      );
    }
    return handleApiError(error, 'POST /api/giacenze/[id]/actions');
  }
}
