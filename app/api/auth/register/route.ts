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

    console.log('📝 [REGISTER] Tentativo registrazione:', { email, hasPassword: !!password, hasName: !!name });

    // Validazione input
    if (!email || !password || !name) {
      console.log('❌ [REGISTER] Dati mancanti');
      return NextResponse.json(
        { error: 'Email, password e nome sono obbligatori' },
        { status: 400 }
      );
    }

    // Validazione email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.log('❌ [REGISTER] Email non valida:', email);
      return NextResponse.json(
        { error: 'Email non valida' },
        { status: 400 }
      );
    }

    // Validazione password (minimo 6 caratteri)
    if (password.length < 6) {
      console.log('❌ [REGISTER] Password troppo corta');
      return NextResponse.json(
        { error: 'La password deve essere di almeno 6 caratteri' },
        { status: 400 }
      );
    }

    // Verifica se l'utente esiste già
    console.log('🔍 [REGISTER] Verifica se utente esiste già...');
    try {
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        console.log('⚠️ [REGISTER] Utente già esistente:', email);
        return NextResponse.json(
          { error: 'Questa email è già registrata. Usa il login invece della registrazione.' },
          { status: 409 }
        );
      }
    } catch (checkError: any) {
      console.error('❌ [REGISTER] Errore verifica utente esistente:', checkError.message);
      // Continua comunque, potrebbe essere un errore temporaneo
    }

    // Crea nuovo utente
    console.log('➕ [REGISTER] Creazione nuovo utente...');
    const newUser = await createUser({
      email,
      password, // TODO: Hash con bcrypt in produzione
      name,
      role: 'user',
    });

    console.log('✅ [REGISTER] Utente creato con successo:', newUser.email);

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
    console.error('❌ [REGISTER] Errore registrazione:', error);
    console.error('❌ [REGISTER] Stack:', error.stack);
    console.error('❌ [REGISTER] Dettagli:', {
      message: error.message,
      name: error.name,
      code: error.code,
    });
    
    if (error.message === 'Email già registrata' || error.message?.includes('già registrata')) {
      return NextResponse.json(
        { error: 'Questa email è già registrata. Usa il login invece della registrazione.' },
        { status: 409 }
      );
    }

    // Messaggio errore più dettagliato per debug
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `Errore durante la registrazione: ${error.message || 'Errore sconosciuto'}`
      : 'Errore durante la registrazione. Riprova.';

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}


