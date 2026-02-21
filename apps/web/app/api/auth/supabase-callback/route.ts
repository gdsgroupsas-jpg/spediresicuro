/**
 * API Route per Callback Supabase Auth
 *
 * Gestisce auto-login dopo conferma email.
 * Sincronizza sessione Supabase con NextAuth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase';
import { sendPremiumWelcomeEmail } from '@/lib/email/resend';

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

    // Auto-provisioning workspace per reseller senza workspace
    try {
      const { data: fullUser } = await supabaseAdmin
        .from('users')
        .select('id, is_reseller, name, primary_workspace_id')
        .eq('email', email)
        .single();

      if (fullUser?.is_reseller === true && !fullUser.primary_workspace_id) {
        console.log('🏢 [SUPABASE CALLBACK] Reseller senza workspace, auto-provisioning...');

        // Trova org default
        const { data: defaultOrg } = await supabaseAdmin
          .from('organizations')
          .select('id')
          .eq('slug', 'spediresicuro')
          .single();

        if (defaultOrg) {
          // Trova IL platform workspace canonico (SpedireSicuro Platform)
          // ⚠️ CRITICO: cerchiamo per nome esatto per evitare ambiguità
          // se esistono più workspace platform nella stessa org
          let platformWs: { id: string } | null = null;

          const { data: namedPlatform } = await supabaseAdmin
            .from('workspaces')
            .select('id')
            .eq('organization_id', defaultOrg.id)
            .eq('type', 'platform')
            .eq('depth', 0)
            .eq('status', 'active')
            .eq('name', 'SpedireSicuro Platform')
            .single();

          if (namedPlatform) {
            platformWs = namedPlatform;
          } else {
            // Fallback: prendi l'unico platform (se ce n'è uno solo)
            const { data: allPlatforms } = await supabaseAdmin
              .from('workspaces')
              .select('id, name')
              .eq('organization_id', defaultOrg.id)
              .eq('type', 'platform')
              .eq('depth', 0)
              .eq('status', 'active');

            if (allPlatforms?.length === 1) {
              platformWs = allPlatforms[0];
            } else {
              console.error(
                '❌ [SUPABASE CALLBACK] Ambiguità: trovati',
                allPlatforms?.length || 0,
                'platform workspaces. Nomi:',
                allPlatforms?.map((w) => w.name)
              );
            }
          }

          const wsName = `${fullUser.name || email.split('@')[0]} Workspace`;

          const { data: workspaceId, error: wsError } = await supabaseAdmin.rpc(
            'create_workspace_with_owner',
            {
              p_organization_id: defaultOrg.id,
              p_name: wsName,
              p_parent_workspace_id: platformWs?.id || null,
              p_owner_user_id: fullUser.id,
              p_type: 'reseller',
              p_depth: 1,
            }
          );

          if (!wsError && workspaceId) {
            await supabaseAdmin
              .from('users')
              .update({ primary_workspace_id: workspaceId })
              .eq('id', fullUser.id);
            console.log('✅ [SUPABASE CALLBACK] Workspace reseller creato:', workspaceId);
          } else if (wsError) {
            console.error('❌ [SUPABASE CALLBACK] Errore creazione workspace:', wsError.message);
          }
        }
      }
    } catch (wsProvisionError: any) {
      console.error(
        '⚠️ [SUPABASE CALLBACK] Errore auto-provisioning workspace (non blocca):',
        wsProvisionError.message
      );
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

    // ✉️ Invia welcome email premium SOLO per self-registration
    // Condizioni per NON inviare:
    // - Utente con parent_id (creato da reseller → riceve gia' email da reseller/clients)
    // - Utente con parent_admin_id (creato da superadmin → riceve gia' email da super-admin.ts)
    // - Utente creato da piu' di 5 minuti (ri-conferma, non prima registrazione)
    try {
      const { data: welcomeCheck } = await supabaseAdmin
        .from('users')
        .select('parent_id, parent_admin_id, created_at')
        .eq('email', email)
        .single();

      const isCreatedByOther = welcomeCheck?.parent_id || welcomeCheck?.parent_admin_id;
      const createdAt = welcomeCheck?.created_at ? new Date(welcomeCheck.created_at) : null;
      const isNewUser = createdAt && Date.now() - createdAt.getTime() < 5 * 60 * 1000; // 5 minuti

      if (!isCreatedByOther && isNewUser) {
        const userName =
          supabaseUser.user_metadata?.name ||
          supabaseUser.user_metadata?.full_name ||
          email.split('@')[0];
        sendPremiumWelcomeEmail({
          to: email,
          userName,
          loginUrl: `https://spediresicuro.it${redirectTo}`,
        }).catch((err) => {
          console.error('⚠️ [SUPABASE CALLBACK] Errore invio welcome email:', err);
        });
      }
    } catch (emailErr) {
      console.error('⚠️ [SUPABASE CALLBACK] Errore setup welcome email:', emailErr);
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
