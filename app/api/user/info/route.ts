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

    // 3. Restituisci informazioni (senza password)
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
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

