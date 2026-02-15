/**
 * API Route: GET /api/spedizioni/cancellate
 *
 * Recupera tutte le spedizioni cancellate (soft delete)
 *
 * Filtri:
 * - User normale: vede solo le proprie spedizioni cancellate
 * - Reseller: vede le proprie + quelle dei suoi user
 * - Admin: vede tutte
 */

import { NextRequest, NextResponse } from 'next/server';
import { getWorkspaceAuth } from '@/lib/workspace-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { getRequestId, createApiLogger } from '@/lib/api-helpers';
import { handleApiError } from '@/lib/api-responses';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const requestId = getRequestId(request);
  const logger = await createApiLogger(request);
  let session: any = null;

  try {
    logger.info('GET /api/spedizioni/cancellate - Richiesta spedizioni cancellate');

    // Autenticazione
    session = await getWorkspaceAuth();

    if (!session?.actor?.email) {
      logger.warn('GET /api/spedizioni/cancellate - Non autenticato');
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // Ottieni parametri query
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = (page - 1) * limit;

    // Verifica se è reseller
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('id, email, is_reseller, role')
      .eq('email', session.actor.email)
      .single();

    const isReseller = userData?.is_reseller === true;
    const isAdmin = userData?.role === 'admin' || userData?.role === 'superadmin';
    const userId = userData?.id;

    console.log('📋 [CANCELLATE] Filtro per:', {
      email: session.actor.email,
      isReseller,
      isAdmin,
      userId: userId?.substring(0, 8) + '...',
    });

    // Query base: solo spedizioni cancellate
    let query = supabaseAdmin
      .from('shipments')
      .select('*', { count: 'exact' })
      .eq('deleted', true)
      .order('deleted_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filtri RBAC
    if (isAdmin) {
      // Admin: vede tutte le spedizioni cancellate
      console.log('✅ [CANCELLATE] Admin: vedo tutte le spedizioni cancellate');
    } else if (isReseller && userId) {
      // Reseller: vede le proprie + quelle dei suoi user
      // Recupera tutti gli user_id dei suoi user (parent_id = reseller_id)
      const { data: resellerUsers } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('parent_id', userId);

      const resellerUserIds = resellerUsers?.map((u) => u.id) || [];
      const allUserIds = [userId, ...resellerUserIds];

      console.log('✅ [CANCELLATE] Reseller: vedo spedizioni di', allUserIds.length, 'user');

      query = query.in('user_id', allUserIds);
    } else if (userId) {
      // User normale: vede solo le proprie
      query = query.eq('user_id', userId);
      console.log('✅ [CANCELLATE] User: vedo solo le mie spedizioni cancellate');
    } else {
      return NextResponse.json({ error: 'Impossibile determinare user_id' }, { status: 403 });
    }

    // Esegui query
    const { data: shipments, error, count } = await query;

    if (error) {
      console.error('❌ [CANCELLATE] Errore query:', error);
      throw error;
    }

    console.log(
      '✅ [CANCELLATE] Recuperate',
      shipments?.length || 0,
      'spedizioni cancellate su',
      count || 0,
      'totali'
    );

    return NextResponse.json({
      success: true,
      data: shipments || [],
      count: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    const userId = session?.user?.id;
    return handleApiError(error, 'GET /api/spedizioni/cancellate', requestId, userId);
  }
}
