/**
 * API Route: User Info
 * 
 * GET: Recupera informazioni utente corrente incluso account_type
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { findUserByEmail } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    // Autenticazione
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // Trova utente
    const user = await findUserByEmail(session.user.email);

    if (!user) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
    }

    // Restituisci info utente (senza password)
    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      account_type: (user as any).account_type || 'user', // account_type da Supabase
      provider: user.provider,
      image: user.image,
      company_name: user.company_name,
      vat_number: user.vat_number,
      phone: user.phone,
    });
  } catch (error: any) {
    console.error('Errore API user/info:', error);
    return NextResponse.json(
      { 
        error: 'Errore server',
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
      },
      { status: 500 }
    );
  }
}

