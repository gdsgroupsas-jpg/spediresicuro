/**
 * API Route: Informazioni Utente Corrente
 * 
 * GET /api/user/info
 * Restituisce informazioni dell'utente corrente autenticato
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { findUserByEmail } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // 1. Verifica autenticazione
    const session = await auth();
    
    if (!session || !session.user?.email) {
      return NextResponse.json(
        { error: 'Non autenticato' },
        { status: 401 }
      );
    }

    // 2. Recupera informazioni utente
    const user = await findUserByEmail(session.user.email);
    
    if (!user) {
      return NextResponse.json(
        { error: 'Utente non trovato' },
        { status: 404 }
      );
    }

    // 3. Recupera anche account_type da Supabase se disponibile
    let accountType = user.role; // Fallback a role
    try {
      const { supabaseAdmin } = await import('@/lib/db/client');
      const { data: supabaseUser } = await supabaseAdmin
        .from('users')
        .select('account_type, role')
        .eq('email', session.user.email)
        .single();
      
      if (supabaseUser) {
        accountType = supabaseUser.account_type || supabaseUser.role || user.role;
      }
    } catch (error) {
      // Ignora errori, usa role come fallback
      console.warn('Errore recupero account_type:', error);
    }

    // 4. Restituisci informazioni (senza password)
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        account_type: accountType, // Aggiunto per compatibilità
        provider: user.provider,
        image: user.image,
        datiCliente: user.datiCliente,
        defaultSender: user.defaultSender,
        integrazioni: user.integrazioni,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });

  } catch (error: any) {
    console.error('Errore API user/info:', error);
    return NextResponse.json(
      { error: 'Errore durante il recupero delle informazioni utente' },
      { status: 500 }
    );
  }
}

