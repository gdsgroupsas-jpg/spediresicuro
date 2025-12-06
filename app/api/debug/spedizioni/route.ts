/**
 * Endpoint di Debug per Verificare Perché le Spedizioni Non Appaiono
 * 
 * GET /api/debug/spedizioni
 * 
 * Mostra informazioni dettagliate su:
 * - Email utente loggato
 * - User ID Supabase trovato
 * - Query eseguita
 * - Risultati query
 * - Spedizioni trovate
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { supabaseAdmin } from '@/lib/supabase';
import { getSupabaseUserIdFromEmail } from '@/lib/database';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Autenticazione
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      );
    }

    const userEmail = session.user.email;
    const debugInfo: any = {
      timestamp: new Date().toISOString(),
      user: {
        email: userEmail,
        name: session.user.name,
      },
      steps: [],
    };

    // Step 1: Cerca user_id Supabase
    debugInfo.steps.push({
      step: 1,
      name: 'Recupero user_id Supabase',
      status: 'in_progress',
    });

    let supabaseUserId: string | null = null;
    try {
      supabaseUserId = await getSupabaseUserIdFromEmail(userEmail);
      debugInfo.steps.push({
        step: 1,
        name: 'Recupero user_id Supabase',
        status: supabaseUserId ? 'success' : 'warning',
        result: supabaseUserId ? `Trovato: ${supabaseUserId.substring(0, 8)}...` : 'Non trovato - user_id sarà null',
        userId: supabaseUserId,
      });
    } catch (error: any) {
      debugInfo.steps.push({
        step: 1,
        name: 'Recupero user_id Supabase',
        status: 'error',
        error: error.message,
      });
    }

    // Step 2: Query senza filtri (tutte le spedizioni)
    debugInfo.steps.push({
      step: 2,
      name: 'Query tutte le spedizioni (senza filtri)',
      status: 'in_progress',
    });

    const { data: allShipments, error: allError, count: allCount } = await supabaseAdmin
      .from('shipments')
      .select('id, tracking_number, user_id, created_by_user_email, deleted, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(10);

    debugInfo.steps.push({
      step: 2,
      name: 'Query tutte le spedizioni (senza filtri)',
      status: allError ? 'error' : 'success',
      result: allError ? allError.message : `Trovate ${allCount || 0} spedizioni totali`,
      count: allCount || 0,
      error: allError?.message,
      sampleShipments: allShipments?.slice(0, 3).map((s: any) => ({
        id: s.id,
        tracking: s.tracking_number,
        user_id: s.user_id,
        email: s.created_by_user_email,
        deleted: s.deleted,
      })),
    });

    // Step 3: Query con filtro user_id (se trovato)
    if (supabaseUserId) {
      debugInfo.steps.push({
        step: 3,
        name: `Query con filtro user_id = ${supabaseUserId.substring(0, 8)}...`,
        status: 'in_progress',
      });

      const { data: userIdShipments, error: userIdError, count: userIdCount } = await supabaseAdmin
        .from('shipments')
        .select('id, tracking_number, user_id, created_by_user_email, deleted', { count: 'exact' })
        .eq('user_id', supabaseUserId)
        .eq('deleted', false)
        .order('created_at', { ascending: false })
        .limit(10);

      debugInfo.steps.push({
        step: 3,
        name: `Query con filtro user_id`,
        status: userIdError ? 'error' : 'success',
        result: userIdError ? userIdError.message : `Trovate ${userIdCount || 0} spedizioni con questo user_id`,
        count: userIdCount || 0,
        error: userIdError?.message,
        sampleShipments: userIdShipments?.slice(0, 3).map((s: any) => ({
          id: s.id,
          tracking: s.tracking_number,
          user_id: s.user_id,
          email: s.created_by_user_email,
        })),
      });
    }

    // Step 4: Query con filtro email (fallback)
    debugInfo.steps.push({
      step: 4,
      name: `Query con filtro created_by_user_email = ${userEmail}`,
      status: 'in_progress',
    });

    const { data: emailShipments, error: emailError, count: emailCount } = await supabaseAdmin
      .from('shipments')
      .select('id, tracking_number, user_id, created_by_user_email, deleted', { count: 'exact' })
      .eq('created_by_user_email', userEmail)
      .eq('deleted', false)
      .order('created_at', { ascending: false })
      .limit(10);

    debugInfo.steps.push({
      step: 4,
      name: `Query con filtro created_by_user_email`,
      status: emailError ? 'error' : 'success',
      result: emailError ? emailError.message : `Trovate ${emailCount || 0} spedizioni con questa email`,
      count: emailCount || 0,
      error: emailError?.message,
      sampleShipments: emailShipments?.slice(0, 3).map((s: any) => ({
        id: s.id,
        tracking: s.tracking_number,
        user_id: s.user_id,
        email: s.created_by_user_email,
      })),
    });

    // Step 5: Query combinata (come fa getSpedizioni)
    debugInfo.steps.push({
      step: 5,
      name: 'Query combinata (user_id OR email)',
      status: 'in_progress',
    });

    let combinedQuery = supabaseAdmin
      .from('shipments')
      .select('id, tracking_number, user_id, created_by_user_email, deleted', { count: 'exact' })
      .eq('deleted', false)
      .order('created_at', { ascending: false })
      .limit(10);

    if (supabaseUserId) {
      combinedQuery = combinedQuery.or(`user_id.eq.${supabaseUserId},and(user_id.is.null,created_by_user_email.eq.${userEmail})`);
    } else {
      combinedQuery = combinedQuery.eq('created_by_user_email', userEmail);
    }

    const { data: combinedShipments, error: combinedError, count: combinedCount } = await combinedQuery;

    debugInfo.steps.push({
      step: 5,
      name: 'Query combinata (user_id OR email)',
      status: combinedError ? 'error' : 'success',
      result: combinedError ? combinedError.message : `Trovate ${combinedCount || 0} spedizioni con query combinata`,
      count: combinedCount || 0,
      error: combinedError?.message,
      query: supabaseUserId 
        ? `user_id.eq.${supabaseUserId} OR (user_id IS NULL AND created_by_user_email.eq.${userEmail})`
        : `created_by_user_email.eq.${userEmail}`,
      sampleShipments: combinedShipments?.slice(0, 3).map((s: any) => ({
        id: s.id,
        tracking: s.tracking_number,
        user_id: s.user_id,
        email: s.created_by_user_email,
      })),
    });

    // Riepilogo
    debugInfo.summary = {
      totalShipmentsInDb: allCount || 0,
      shipmentsWithUserId: supabaseUserId ? (debugInfo.steps.find((s: any) => s.step === 3)?.count || 0) : 0,
      shipmentsWithEmail: emailCount || 0,
      shipmentsWithCombinedQuery: combinedCount || 0,
      recommendation: combinedCount === 0 
        ? 'Nessuna spedizione trovata. Verifica che le spedizioni abbiano user_id o created_by_user_email corrispondente.'
        : `Trovate ${combinedCount} spedizioni. La query combinata funziona correttamente.`,
    };

    return NextResponse.json(debugInfo, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      {
        error: 'Errore debug',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}



