/**
 * API Route per Registrazione Utenti
 *
 * Gestisce la registrazione di nuovi utenti usando Supabase Auth
 * con conferma email obbligatoria.
 */

import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmail } from '@/lib/database';
import { validateEmail, validatePassword } from '@/lib/validators';
import { ApiErrors, handleApiError } from '@/lib/api-responses';
import { supabase, supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { withRateLimit } from '@/lib/security/rate-limit-middleware';

export async function POST(request: NextRequest) {
  // Rate limit: 5 req/min per IP (spam/abuse protection)
  const rl = await withRateLimit(request, 'auth-register', { limit: 5, windowSeconds: 60 });
  if (rl) return rl;

  try {
    const body = await request.json();
    const { email, password, name, accountType } = body;

    console.log('📝 [REGISTER] Tentativo registrazione:', {
      email,
      hasPassword: !!password,
      hasName: !!name,
    });

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

    // Validazione password (minimo 8 caratteri)
    if (!validatePassword(password, 8)) {
      console.log('❌ [REGISTER] Password troppo corta');
      return ApiErrors.VALIDATION_ERROR('La password deve essere di almeno 8 caratteri');
    }

    // ⚠️ CRITICO: Verifica che Supabase sia configurato
    if (!isSupabaseConfigured()) {
      console.error('❌ [REGISTER] Supabase non configurato');
      return NextResponse.json(
        {
          error: 'Sistema di registrazione temporaneamente non disponibile. Contatta il supporto.',
        },
        { status: 503 }
      );
    }

    // Verifica se l'utente esiste già (verifica rapida, auth.signUp gestirà già registrato)
    console.log('🔍 [REGISTER] Verifica rapida se utente esiste già...');
    try {
      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        console.log('⚠️ [REGISTER] Utente già esistente nella tabella users:', email);
        return ApiErrors.CONFLICT(
          'Questa email è già registrata. Usa il login invece della registrazione.'
        );
      }
    } catch (checkError: any) {
      console.warn(
        '⚠️ [REGISTER] Errore verifica utente esistente (non critico):',
        checkError.message
      );
      // Continua, auth.signUp gestirà il caso "already registered"
    }

    // Validazione accountType
    const validAccountType = ['admin', 'reseller'].includes(accountType) ? accountType : 'user';
    const role = validAccountType === 'admin' ? 'admin' : 'user';
    const isReseller = validAccountType === 'reseller';

    // ⚠️ CRITICO: Usa auth.signUp() (flusso reale) invece di admin.createUser()
    // auth.signUp() invia automaticamente email di conferma se "Enable email confirmations" è ON
    console.log(
      '➕ [REGISTER] Creazione utente con auth.signUp() (flusso reale, email confirmation automatica)...',
      {
        email,
        accountType: validAccountType,
      }
    );

    // ⚠️ CRITICO: emailRedirectTo deve puntare a /auth/callback per pulire URL
    // ⚠️ P0 FIX: Forza dominio canonico (produzione) anche in preview per garantire redirect corretto
    // NON usare VERCEL_URL (preview domain) per emailRedirectTo - causa redirect a root invece che callback
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.NODE_ENV === 'production'
        ? 'https://spediresicuro.vercel.app'
        : 'http://localhost:3000');
    const callbackUrl = `${baseUrl}/auth/callback`;

    console.log('🔗 [REGISTER] emailRedirectTo configurato:', {
      baseUrl,
      callbackUrl,
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
      NODE_ENV: process.env.NODE_ENV,
    });

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: email.toLowerCase().trim(),
      password: password,
      options: {
        data: {
          name: name.trim(),
          full_name: name.trim(),
        },
        emailRedirectTo: callbackUrl, // Redirect a /auth/callback per pulire URL
      },
    });

    if (signUpError) {
      console.error('❌ [REGISTER] Errore signUp:', {
        message: signUpError.message,
        status: signUpError.status,
      });

      // Gestione errori specifici Supabase
      if (
        signUpError.message?.includes('already registered') ||
        signUpError.message?.includes('already exists') ||
        signUpError.message?.includes('User already registered')
      ) {
        return ApiErrors.CONFLICT(
          'Questa email è già registrata. Usa il login invece della registrazione.'
        );
      }

      return NextResponse.json(
        {
          error: 'Errore durante la registrazione. Riprova più tardi.',
          details: process.env.NODE_ENV === 'development' ? signUpError.message : undefined,
        },
        { status: 500 }
      );
    }

    if (!signUpData?.user) {
      console.error('❌ [REGISTER] Utente creato ma dati non disponibili');
      return NextResponse.json(
        { error: 'Errore durante la registrazione. Riprova più tardi.' },
        { status: 500 }
      );
    }

    const supabaseUserId = signUpData.user.id;
    console.log('✅ [REGISTER] Utente creato con auth.signUp():', {
      id: supabaseUserId,
      email: signUpData.user.email,
      email_confirmed_at: signUpData.user.email_confirmed_at, // DEVE essere null
      confirmation_sent_at: signUpData.user.confirmation_sent_at, // DEVE essere valorizzato
    });

    // ⚠️ CRITICO: Verifica che confirmation_sent_at sia valorizzato
    if (!signUpData.user.confirmation_sent_at) {
      console.error('❌ [REGISTER] confirmation_sent_at NON valorizzato dopo signUp!');
      console.error(
        '   Questo significa che "Enable email confirmations" è OFF o SMTP non configurato'
      );
      // Non blocchiamo la registrazione, ma loggiamo l'errore
    } else {
      console.log(
        '✅ [REGISTER] confirmation_sent_at valorizzato:',
        signUpData.user.confirmation_sent_at
      );
    }

    // Verifica che email_confirmed_at sia NULL (email non confermata)
    if (signUpData.user.email_confirmed_at) {
      console.warn('⚠️ [REGISTER] ATTENZIONE: email_confirmed_at non è NULL dopo signUp!', {
        email_confirmed_at: signUpData.user.email_confirmed_at,
      });
    }

    // Aggiorna app_metadata con role e account_type usando admin API
    try {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(supabaseUserId, {
        app_metadata: {
          provider: 'email',
          role: role,
          account_type: validAccountType,
          ...(isReseller && { is_reseller: true, reseller_role: 'admin' }),
        },
      });

      if (updateError) {
        console.warn(
          '⚠️ [REGISTER] Errore aggiornamento app_metadata (non critico):',
          updateError.message
        );
      } else {
        console.log('✅ [REGISTER] app_metadata aggiornato con role e account_type');
      }
    } catch (updateError: any) {
      console.warn(
        '⚠️ [REGISTER] Errore aggiornamento app_metadata (non critico):',
        updateError.message
      );
    }

    // Sincronizza con la tabella users (idempotente - upsert)
    try {
      const { data: dbUser, error: dbError } = await supabaseAdmin
        .from('users')
        .upsert(
          {
            id: supabaseUserId, // Usa l'ID di Supabase Auth
            email: email.toLowerCase().trim(),
            password: null, // Password gestita da Supabase Auth
            name: name.trim(),
            role: role,
            account_type: validAccountType,
            is_reseller: isReseller,
            ...(isReseller && { reseller_role: 'admin' }),
            provider: 'email',
            provider_id: null,
            image: null,
            admin_level: validAccountType === 'admin' ? 1 : 0,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'id', // Idempotente: se esiste già, aggiorna
          }
        )
        .select()
        .single();

      if (dbError) {
        console.warn(
          '⚠️ [REGISTER] Errore sincronizzazione tabella users (non critico):',
          dbError.message
        );
        // Non blocchiamo la registrazione se la sincronizzazione fallisce
      } else if (dbUser) {
        console.log('✅ [REGISTER] Utente sincronizzato nella tabella users (idempotente)');
      }
    } catch (syncError: any) {
      console.warn(
        '⚠️ [REGISTER] Errore sincronizzazione tabella users (non critico):',
        syncError.message
      );
      // Non blocchiamo la registrazione se la sincronizzazione fallisce
    }

    console.log('✅ [REGISTER] Registrazione completata - email di conferma inviata');

    // ⚠️ IMPORTANTE: Non restituire dati sensibili, solo conferma che email è stata inviata
    return NextResponse.json(
      {
        success: true,
        message: 'email_confirmation_required', // Flag per UI
        email: email.toLowerCase().trim(), // Solo per mostrare all'utente
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
    if (
      error.message?.includes('duplicate key') ||
      error.message?.includes('unique constraint') ||
      error.code === '23505'
    ) {
      return NextResponse.json(
        { error: 'Questa email è già registrata. Usa il login invece della registrazione.' },
        { status: 409 }
      );
    }

    // Errore database non disponibile o Supabase non configurato
    if (
      error.message?.includes('EROFS') ||
      error.message?.includes('read-only') ||
      error.message?.includes('Supabase non configurato')
    ) {
      return NextResponse.json(
        {
          error: error.message?.includes('Supabase non configurato')
            ? 'Database non configurato. Contatta il supporto tecnico.'
            : 'Database temporaneamente non disponibile. Riprova tra qualche istante.',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        },
        { status: 503 }
      );
    }

    // Messaggio errore più dettagliato per debug (solo in sviluppo)
    const errorMessage =
      process.env.NODE_ENV === 'development'
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
          },
        }),
      },
      { status: 500 }
    );
  }
}
