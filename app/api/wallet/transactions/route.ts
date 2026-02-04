import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { requireAuth } from '@/lib/api-middleware';
import { getUserByEmail } from '@/lib/db/user-helpers';
import { ApiErrors, handleApiError } from '@/lib/api-responses';
import { getCurrentWorkspaceId } from '@/lib/workspace-injection';

// Forza rendering dinamico (usa headers())
export const dynamic = 'force-dynamic';

/**
 * GET /api/wallet/transactions
 * Ottiene le transazioni wallet dell'utente corrente
 */
export async function GET() {
  try {
    // Verifica autenticazione
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const { context } = authResult;

    // Ottieni ID utente
    const user = await getUserByEmail(context!.actor.email!, 'id');

    if (!user) {
      return ApiErrors.NOT_FOUND('Utente');
    }

    // ⚠️ WORKSPACE FILTER: Architecture V2
    const workspaceId = await getCurrentWorkspaceId();

    // Carica transazioni
    let query = supabaseAdmin
      .from('wallet_transactions')
      .select(
        `
        id,
        amount,
        type,
        description,
        created_at,
        created_by,
        workspace_id,
        users!wallet_transactions_created_by_fkey(name, email)
      `
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100);

    // Filtra per workspace se disponibile
    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
      console.log(`🏢 [WALLET] Filtro workspace_id: ${workspaceId.substring(0, 8)}...`);
    }

    const { data: transactions, error } = await query;

    if (error) {
      return handleApiError(error, 'GET /api/wallet/transactions - load transactions');
    }

    // Formatta transazioni
    const formattedTransactions = (transactions || []).map((tx: any) => ({
      id: tx.id,
      amount: tx.amount,
      type: tx.type,
      description: tx.description || '',
      created_at: tx.created_at,
      created_by: tx.users?.name || 'Sistema',
      balance_after: null, // Calcolato lato client se necessario
    }));

    return NextResponse.json({
      success: true,
      transactions: formattedTransactions,
    });
  } catch (error: any) {
    return handleApiError(error, 'GET /api/wallet/transactions');
  }
}
