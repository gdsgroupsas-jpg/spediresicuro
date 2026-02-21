/**
 * API Route: Informazioni Utente Corrente
 *
 * GET /api/user/info
 * Restituisce informazioni dell'utente corrente autenticato incluso account_type
 */

import { requireAuth } from '@/lib/api-middleware';
import { ApiErrors, handleApiError } from '@/lib/api-responses';
import { findUserByEmail } from '@/lib/database';
import { NextRequest, NextResponse } from 'next/server';

// Forza rendering dinamico (usa headers())
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Verifica autenticazione
    const authResult = await requireAuth();
    if (!authResult.authorized) return authResult.response;
    const { context } = authResult;

    // 2. Recupera informazioni utente
    const user = await findUserByEmail(context!.actor.email!);

    if (!user) {
      return ApiErrors.NOT_FOUND('Utente');
    }

    // 3. Recupera anche account_type e is_reseller da Supabase se disponibile
    let accountType = user.role; // Fallback a role
    let isReseller = false;
    let resellerRole = null;
    let walletBalance = 0;
    try {
      const { supabaseAdmin } = await import('@/lib/db/client');
      const { data: supabaseUser, error: supabaseError } = await supabaseAdmin
        .from('users')
        .select('account_type, role, is_reseller, reseller_role, primary_workspace_id')
        .eq('email', context!.actor.email)
        .single();

      if (supabaseError) {
        console.warn('Errore recupero account_type da Supabase:', supabaseError);
      } else if (supabaseUser) {
        accountType = supabaseUser.account_type || supabaseUser.role || user.role;
        isReseller = supabaseUser.is_reseller === true;
        resellerRole = supabaseUser.reseller_role;

        // Leggi wallet_balance da workspaces (source of truth)
        if (supabaseUser.primary_workspace_id) {
          const { data: wsData } = await supabaseAdmin
            .from('workspaces')
            .select('wallet_balance')
            .eq('id', supabaseUser.primary_workspace_id)
            .single();
          walletBalance = parseFloat(wsData?.wallet_balance) || 0;
        }
      }
    } catch (error) {
      // Ignora errori, usa role come fallback
      console.warn('Errore recupero account_type:', error);
    }

    // 4. Prepara dati utente
    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      account_type: accountType,
      is_reseller: isReseller,
      reseller_role: resellerRole,
      provider: user.provider,
      image: user.image,
      wallet_balance: walletBalance,
      company_name: (user as any).company_name,
      vat_number: (user as any).vat_number,
      phone: (user as any).phone,
      datiCliente: (user as any).datiCliente,
      defaultSender: (user as any).defaultSender,
      integrazioni: (user as any).integrazioni,
      createdAt: (user as any).createdAt,
      updatedAt: (user as any).updatedAt,
    };

    // 5. Restituisci informazioni (senza password)
    // Formato nuovo: { success: true, user: { ... } }
    // Formato retrocompatibile: anche a livello root per compatibilità
    return NextResponse.json({
      success: true,
      user: userData,
      // Retrocompatibilità: proprietà anche a livello root
      id: userData.id,
      email: userData.email,
      name: userData.name,
      role: userData.role,
      account_type: userData.account_type,
      accountType: userData.account_type, // Alias per compatibilità
      is_reseller: userData.is_reseller,
      reseller_role: userData.reseller_role,
      provider: userData.provider,
      image: userData.image,
    });
  } catch (error: any) {
    return handleApiError(error, 'GET /api/user/info');
  }
}
