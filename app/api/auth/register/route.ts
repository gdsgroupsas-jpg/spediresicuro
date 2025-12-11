/**
 * API Route per Registrazione Utenti
 * 
 * Gestisce la registrazione di nuovi utenti.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createUser, findUserByEmail } from '@/lib/database';
import { validateEmail, validatePassword } from '@/lib/validators';
import { ApiErrors, handleApiError } from '@/lib/api-responses';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name, accountType } = body;

    console.log('📝 [REGISTER] Tentativo registrazione:', { email, hasPassword: !!password, hasName: !!name });

    // Validazione input
    if (!email || !password || !name) {
      console.log('❌ [REGISTER] Dati mancanti');
      return ApiErrors.BAD_REQUEST('Email, password e nome sono obbligatori');
    }

    // Validazione email
    if (!validateEmail(email)) {
      console.log('❌ [REGISTER] Email non valida:', email);
      return ApiErrors.VALIDATION_ERROR('Email non valida');
    }

    // Validazione password (minimo 6 caratteri)
    if (!validatePassword(password, 6)) {
      console.log('❌ [REGISTER] Password troppo corta');
      return ApiErrors.VALIDATION_ERROR('La password deve essere di almeno 6 caratteri');
    }

    // Verifica se l'utente esiste già
    console.log('🔍 [REGISTER] Verifica se utente esiste già...');
    try {
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        console.log('⚠️ [REGISTER] Utente già esistente:', email);
        return ApiErrors.CONFLICT('Questa email è già registrata. Usa il login invece della registrazione.');
      }
    } catch (checkError: any) {
      console.error('❌ [REGISTER] Errore verifica utente esistente:', checkError.message);
      // Continua comunque, potrebbe essere un errore temporaneo
    }

    // Validazione accountType
    const validAccountType = accountType === 'admin' ? 'admin' : 'user';
    const role = validAccountType === 'admin' ? 'admin' : 'user';

    // Crea nuovo utente
    console.log('➕ [REGISTER] Creazione nuovo utente...', { email, accountType: validAccountType });
    const newUser = await createUser({
      email,
      password, // TODO: Hash con bcrypt in produzione
      name,
      role,
      accountType: validAccountType,
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
    // Log dettagliato per debug
    console.error('❌ [REGISTER] Errore registrazione:', error);
    console.error('❌ [REGISTER] Stack:', error.stack);
    console.error('❌ [REGISTER] Dettagli completi:', {
      message: error.message,
      name: error.name,
      code: error.code,
      cause: error.cause,
      originalError: error.originalError,
    });
    
    // Gestione errori specifici
    if (error.message === 'Email già registrata' || error.message?.includes('già registrata')) {
      return NextResponse.json(
        { error: 'Questa email è già registrata. Usa il login invece della registrazione.' },
        { status: 409 }
      );
    }

    // Errore Supabase - violazione constraint unique
    if (error.message?.includes('duplicate key') || error.message?.includes('unique constraint') || error.code === '23505') {
      return NextResponse.json(
        { error: 'Questa email è già registrata. Usa il login invece della registrazione.' },
        { status: 409 }
      );
    }

    // Errore database non disponibile o Supabase non configurato
    if (error.message?.includes('EROFS') || error.message?.includes('read-only') || error.message?.includes('Supabase non configurato')) {
      return NextResponse.json(
        { 
          error: error.message?.includes('Supabase non configurato') 
            ? 'Database non configurato. Contatta il supporto tecnico.'
            : 'Database temporaneamente non disponibile. Riprova tra qualche istante.',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        },
        { status: 503 }
      );
    }

    // Messaggio errore più dettagliato per debug (solo in sviluppo)
    const errorMessage = process.env.NODE_ENV === 'development' 
      ? `Errore durante la registrazione: ${error.message || 'Errore sconosciuto'}`
      : 'Errore durante la registrazione. Riprova.';

    return NextResponse.json(
      { 
        error: errorMessage,
        // In sviluppo, aggiungi dettagli per debug
        ...(process.env.NODE_ENV === 'development' && {
          details: {
            message: error.message,
            code: error.code,
            name: error.name,
          }
        })
      },
      { status: 500 }
    );
  }
}


