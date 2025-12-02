/**
 * API: User Settings
 *
 * GET  /api/user/settings - Recupera impostazioni utente corrente
 * PUT  /api/user/settings - Aggiorna impostazioni utente
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth-config';
import { readDatabase, writeDatabase, type DefaultSender } from '@/lib/database';

// ⚠️ IMPORTANTE: Questa route usa headers() per l'autenticazione, quindi deve essere dinamica
export const dynamic = 'force-dynamic';

/**
 * GET - Recupera impostazioni utente
 */
export async function GET(request: NextRequest) {
  try {
    // Autenticazione
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    // Carica database
    const db = readDatabase();

    // Trova utente
    const user = db.utenti.find((u) => u.email === session.user?.email);

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
  } catch (error) {
    console.error('Errore GET /api/user/settings:', error);
    return NextResponse.json({ error: 'Errore server' }, { status: 500 });
  }
}

/**
 * PUT - Aggiorna impostazioni utente
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

    // Carica database
    const db = readDatabase();

    // Trova utente
    const userIndex = db.utenti.findIndex((u) => u.email === session.user?.email);

    if (userIndex === -1) {
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
    }

    // Aggiorna impostazioni
    db.utenti[userIndex] = {
      ...db.utenti[userIndex],
      defaultSender: defaultSender || undefined,
      updatedAt: new Date().toISOString(),
    };

    // Salva database
    writeDatabase(db);

    return NextResponse.json({
      success: true,
      message: 'Impostazioni salvate con successo',
      defaultSender: db.utenti[userIndex].defaultSender,
    });
  } catch (error) {
    console.error('Errore PUT /api/user/settings:', error);
    return NextResponse.json({ error: 'Errore server' }, { status: 500 });
  }
}
