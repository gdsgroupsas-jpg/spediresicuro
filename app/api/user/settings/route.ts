/**
 * API: User Settings
 *
 * GET  /api/user/settings - Recupera impostazioni utente corrente
 * PUT  /api/user/settings - Aggiorna impostazioni utente
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { findUserByEmail, updateUser } from '@/lib/database';

// ⚠️ IMPORTANTE: Questa route usa headers() per l'autenticazione, quindi deve essere dinamica
export const dynamic = 'force-dynamic';

/**
 * GET - Recupera impostazioni utente
 * ⚠️ CRITICO: Usa SOLO Supabase - nessun fallback JSON
 */
export async function GET(request: NextRequest) {
  try {
    // Autenticazione
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // Trova utente in Supabase
    const user = await findUserByEmail(session.user.email);

    if (!user) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
    }

    // Restituisci impostazioni (senza password)
    return NextResponse.json({
      defaultSender: user.defaultSender || null,
      email: user.email,
      name: user.name,
      role: user.role,
      provider: user.provider,
      image: user.image,
    });
  } catch (error: any) {
    console.error('❌ [API] Errore GET /api/user/settings:', error);
    return NextResponse.json(
      { 
        error: 'Errore server',
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT - Aggiorna impostazioni utente
 * ⚠️ CRITICO: Usa SOLO Supabase - nessun fallback JSON
 */
export async function PUT(request: NextRequest) {
  try {
    // Autenticazione
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // Parse body
    const body = await request.json();
    const { defaultSender } = body;

    // Validazione mittente predefinito
    if (defaultSender) {
      if (!defaultSender.nome || !defaultSender.indirizzo || !defaultSender.citta || !defaultSender.cap) {
        return NextResponse.json(
          { error: 'Dati mittente incompleti. Campi obbligatori: nome, indirizzo, città, CAP' },
          { status: 400 }
        );
      }

      // Valida CAP italiano (5 cifre)
      if (!/^\d{5}$/.test(defaultSender.cap)) {
        return NextResponse.json({ error: 'CAP non valido. Deve essere 5 cifre.' }, { status: 400 });
      }

      // Valida provincia (2 lettere)
      if (defaultSender.provincia && !/^[A-Z]{2}$/.test(defaultSender.provincia)) {
        return NextResponse.json(
          { error: 'Provincia non valida. Deve essere 2 lettere (es: MI, RM)' },
          { status: 400 }
        );
      }
    }

    // Trova utente in Supabase
    const user = await findUserByEmail(session.user.email);

    if (!user) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
    }

    // Aggiorna impostazioni in Supabase
    const updatedUser = await updateUser(user.id, {
      defaultSender: defaultSender || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Impostazioni salvate con successo',
      defaultSender: updatedUser.defaultSender || null,
    });
  } catch (error: any) {
    console.error('❌ [API] Errore PUT /api/user/settings:', error);
    return NextResponse.json(
      { 
        error: 'Errore server',
        message: error instanceof Error ? error.message : 'Errore sconosciuto',
      },
      { status: 500 }
    );
  }
}
