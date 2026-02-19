/**
 * API Debug: Verifica Account Type Utente Corrente
 *
 * GET /api/debug/check-my-account-type
 * Restituisce informazioni dettagliate sull'account_type dell'utente corrente
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';

// Forza rendering dinamico (usa headers())
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // 1. Verifica autenticazione
    const context = await getSafeAuth();

    if (!context || !context.actor?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const email = context.actor.email;

    // 2. Recupera da Supabase
    const { data: supabaseUser, error: supabaseError } = await supabaseAdmin
      .from('users')
      .select('id, email, name, account_type, role, admin_level')
      .eq('email', email)
      .single();

    if (supabaseError) {
      return NextResponse.json({
        success: false,
        error: 'Utente non trovato in Supabase',
        supabaseError: supabaseError.message,
        email,
      });
    }

    // 3. Verifica anche da findUserByEmail (fallback)
    let jsonUser = null;
    try {
      const { findUserByEmail } = await import('@/lib/database');
      jsonUser = await findUserByEmail(email);
    } catch (error) {
      // Ignora
    }

    // 4. Restituisci informazioni dettagliate
    return NextResponse.json({
      success: true,
      email,
      sessionEmail: context.actor.email,
      supabase: {
        found: !!supabaseUser,
        account_type: supabaseUser?.account_type || null,
        role: supabaseUser?.role || null,
        admin_level: supabaseUser?.admin_level ?? null,
        name: supabaseUser?.name || null,
      },
      json: {
        found: !!jsonUser,
        role: jsonUser?.role || null,
      },
      isSuperAdmin: supabaseUser?.account_type === 'superadmin',
      isAdmin:
        supabaseUser?.account_type === 'admin' || supabaseUser?.account_type === 'superadmin',
      canAccessAdmin:
        supabaseUser?.account_type === 'superadmin' || supabaseUser?.account_type === 'admin',
      recommendation: supabaseUser?.account_type
        ? `Account type: ${supabaseUser.account_type} - ${supabaseUser.account_type === 'superadmin' ? 'Dovresti vedere il badge 👑 SUPERADMIN' : supabaseUser.account_type === 'admin' ? 'Dovresti vedere il badge ⭐ ADMIN' : 'Dovresti vedere il badge 👤 USER'}`
        : 'Account type non trovato - esegui lo script SQL per fixare',
    });
  } catch (error: any) {
    console.error('Errore API debug account type:', error);
    return NextResponse.json(
      {
        error: 'Errore durante la verifica',
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
      },
      { status: 500 }
    );
  }
}
