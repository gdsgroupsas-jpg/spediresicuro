/**
 * API Route per Callback Supabase Auth
 *
 * Gestisce auto-login dopo conferma email.
 * Sincronizza sessione Supabase con NextAuth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, refreshToken, email } = body;

    console.log('🔐 [SUPABASE CALLBACK] Richiesta auto-login:', {
      hasAccessToken: !!accessToken,
      hasRefreshToken: !!refreshToken,
      email,
    });

    // Validazione input
    if (!accessToken || !refreshToken || !email) {
      return NextResponse.json({ error: 'Token o email mancanti' }, { status: 400 });
    }

    // ⚠️ CRITICO: Verifica che Supabase sia configurato
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: 'Supabase non configurato' }, { status: 503 });
    }

    // Verifica token Supabase e ottieni utente
    console.log('🔍 [SUPABASE CALLBACK] Verifica token Supabase...');
    const {
      data: { user: supabaseUser },
      error: userError,
    } = await supabaseAdmin.auth.getUser(accessToken);

    if (userError || !supabaseUser) {
      console.error('❌ [SUPABASE CALLBACK] Errore verifica token:', userError?.message);
      return NextResponse.json({ error: 'Token non valido' }, { status: 401 });
    }

    // Verifica che email corrisponda
    if (supabaseUser.email?.toLowerCase() !== email.toLowerCase()) {
      console.error('❌ [SUPABASE CALLBACK] Email non corrisponde');
      return NextResponse.json({ error: 'Email non corrisponde' }, { status: 400 });
    }

    // Verifica che email sia confermata
    if (!supabaseUser.email_confirmed_at) {
      console.error('❌ [SUPABASE CALLBACK] Email non confermata');
      return NextResponse.json({ error: 'Email non confermata' }, { status: 403 });
    }

    console.log('✅ [SUPABASE CALLBACK] Token verificato, utente:', supabaseUser.email);

    // Ottieni dati utente dal database
    const { data: dbUser, error: dbError } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (dbError || !dbUser) {
      console.warn('⚠️ [SUPABASE CALLBACK] Utente non trovato in tabella users, creo record...');

      // Crea record in users se non esiste
      const { data: newDbUser, error: createError } = await supabaseAdmin
        .from('users')
        .upsert(
          {
            id: supabaseUser.id,
            email: supabaseUser.email,
            password: null, // Password gestita da Supabase Auth
            name:
              supabaseUser.user_metadata?.name ||
              supabaseUser.user_metadata?.full_name ||
              email.split('@')[0],
            role: supabaseUser.app_metadata?.role || 'user',
            account_type: supabaseUser.app_metadata?.account_type || 'user',
            provider: 'email',
            provider_id: null,
            image: null,
            admin_level: supabaseUser.app_metadata?.account_type === 'admin' ? 1 : 0,
          },
          { onConflict: 'id' }
        )
        .select()
        .single();

      if (createError) {
        console.error('❌ [SUPABASE CALLBACK] Errore creazione record users:', createError.message);
        return NextResponse.json({ error: 'Errore creazione utente' }, { status: 500 });
      }

      console.log('✅ [SUPABASE CALLBACK] Record users creato');
    }

    // ⚠️ CRITICO: Genera token temporaneo per auto-login NextAuth
    // Il token viene usato come "password" speciale che verifyUserCredentials riconosce
    // Formato: SUPABASE_TOKEN:{accessToken}:{timestamp}
    const timestamp = Date.now();
    const tempToken = `SUPABASE_TOKEN:${accessToken}:${timestamp}`;

    // Salva token temporaneo in memoria (in produzione usare Redis o DB)
    // Per ora usiamo un approccio semplice: il token viene verificato immediatamente
    // Il token è valido solo per 60 secondi

    console.log('✅ [SUPABASE CALLBACK] Token temporaneo generato per auto-login');

    // Determina redirect (dashboard o dati-cliente se onboarding necessario)
    // ⚠️ P0 FIX: Default fail-safe a /dashboard/dati-cliente (evita flash di dashboard)
    let redirectTo = '/dashboard/dati-cliente';

    // Verifica dati cliente per determinare redirect
    const { data: userData, error: userDataError } = await supabaseAdmin
      .from('users')
      .select('dati_cliente')
      .eq('email', email)
      .single();

    // ⚠️ P0 FIX: Verifica esplicita che dati_cliente esista e datiCompletati sia true
    // Solo se dati sono completati → redirect a /dashboard
    if (!userDataError && userData?.dati_cliente) {
      const hasDatiCliente = userData.dati_cliente && typeof userData.dati_cliente === 'object';
      const datiCompletati = hasDatiCliente && userData.dati_cliente.datiCompletati === true;

      if (datiCompletati) {
        redirectTo = '/dashboard';
      }
    }

    // ⚠️ IMPORTANTE: Restituisci token temporaneo e redirect
    // Il client userà il token per fare signIn con NextAuth
    return NextResponse.json({
      success: true,
      email: supabaseUser.email,
      tempToken, // Token da usare come password per signIn
      redirectTo,
      expiresAt: timestamp + 60000, // Valido per 60 secondi
    });
  } catch (error: any) {
    console.error('❌ [SUPABASE CALLBACK] Errore:', error);
    return NextResponse.json(
      {
        error: 'Errore durante auto-login',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
