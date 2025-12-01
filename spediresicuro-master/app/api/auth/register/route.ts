/**
 * API Route per Registrazione Utenti
 * 
 * Gestisce la registrazione di nuovi utenti.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUser, findUserByEmail } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // Validazione input
    if (!email || !password || !name) {
      return NextResponse.json(
        { error: 'Email, password e nome sono obbligatori' },
        { status: 400 }
      );
    }

    // Validazione email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Email non valida' },
        { status: 400 }
      );
    }

    // Validazione password (minimo 6 caratteri)
    if (password.length < 6) {
      return NextResponse.json(
        { error: 'La password deve essere di almeno 6 caratteri' },
        { status: 400 }
      );
    }

    // Verifica se l'utente esiste già
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return NextResponse.json(
        { error: 'Email già registrata' },
        { status: 409 }
      );
    }

    // Crea nuovo utente
    const newUser = await createUser({
      email,
      password, // TODO: Hash con bcrypt in produzione
      name,
      role: 'user',
    });

    // Rimuovi password dalla risposta
    const { password: _, ...userWithoutPassword } = newUser;

    return NextResponse.json(
      {
        success: true,
        user: userWithoutPassword,
        message: 'Registrazione completata con successo',
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Errore registrazione:', error);
    
    if (error.message === 'Email già registrata') {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Errore durante la registrazione. Riprova.' },
      { status: 500 }
    );
  }
}

