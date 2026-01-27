'use server';

/**
 * API: /api/superadmin/resellers
 *
 * GET: Lista tutti i reseller (solo superadmin)
 * POST: Crea un nuovo reseller (via server action)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { createReseller } from '@/actions/super-admin';

/**
 * Verifica che l'utente sia superadmin
 */
async function verifySuperAdmin(): Promise<{
  authorized: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    const context = await getSafeAuth();

    if (!context?.actor?.email) {
      return { authorized: false, error: 'Non autenticato' };
    }

    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('id, account_type')
      .eq('email', context.actor.email)
      .single();

    if (error || !user) {
      return { authorized: false, error: 'Utente non trovato' };
    }

    if (user.account_type !== 'superadmin') {
      return { authorized: false, error: 'Accesso non autorizzato' };
    }

    return { authorized: true, userId: user.id };
  } catch (error: any) {
    console.error('Errore verifica superadmin:', error);
    return { authorized: false, error: error.message };
  }
}

/**
 * GET /api/superadmin/resellers
 * Lista tutti i reseller per il dropdown di selezione nel wizard
 */
export async function GET() {
  try {
    const authCheck = await verifySuperAdmin();
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: 403 });
    }

    // Ottieni tutti i reseller (is_reseller = true OR account_type = 'reseller')
    const { data: resellers, error } = await supabaseAdmin
      .from('users')
      .select('id, email, name, company_name, wallet_balance, created_at')
      .or('is_reseller.eq.true,account_type.eq.reseller')
      .order('name', { ascending: true });

    if (error) {
      console.error('Errore caricamento reseller:', error);
      return NextResponse.json({ error: 'Errore caricamento reseller' }, { status: 500 });
    }

    return NextResponse.json({
      resellers: resellers || [],
      count: resellers?.length || 0,
    });
  } catch (error: any) {
    console.error('Errore API GET resellers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/superadmin/resellers
 * Crea un nuovo reseller (usa la server action esistente)
 */
export async function POST(request: NextRequest) {
  try {
    const authCheck = await verifySuperAdmin();
    if (!authCheck.authorized) {
      return NextResponse.json({ error: authCheck.error }, { status: 403 });
    }

    const body = await request.json();

    // Supporta sia il vecchio formato (name) che il nuovo (anagrafica.nome + cognome)
    const hasNewFormat = body.anagrafica?.nome && body.anagrafica?.cognome;
    const hasOldFormat = body.name;

    // Valida input
    if (!body.email || (!hasNewFormat && !hasOldFormat) || !body.password) {
      return NextResponse.json(
        { error: 'Email, nome e password sono obbligatori' },
        { status: 400 }
      );
    }

    // Usa la server action esistente
    const result = await createReseller({
      email: body.email,
      password: body.password,
      initialCredit: body.initialCredit || 0,
      notes: body.notes,
      // Nuovi campi per dati completi (se presenti)
      tipoCliente: body.tipoCliente,
      anagrafica: body.anagrafica,
      indirizzo: body.indirizzo,
      azienda: body.azienda,
      bancari: body.bancari,
      // Listino iniziale (opzionale)
      priceListId: body.priceListId,
      // Mantieni name per backwards compatibility
      name: body.name,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      userId: result.userId,
    });
  } catch (error: any) {
    console.error('Errore API POST resellers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
