/**
 * API: /api/auth/change-password
 *
 * POST: Cambia password per utente autenticato
 *
 * Richiede:
 * - currentPassword: password attuale
 * - newPassword: nuova password (min 8 caratteri)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPasswordChangedEmail } from '@/lib/email/resend';

export async function POST(request: NextRequest) {
  try {
    // Verifica autenticazione
    const context = await getSafeAuth();
    if (!context?.actor?.email) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const userEmail = context.actor.email;
    const userName = context.actor.name;

    const { currentPassword, newPassword } = await request.json();

    // Validazione input
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'Password attuale e nuova password sono obbligatorie' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'La nuova password deve essere di almeno 8 caratteri' },
        { status: 400 }
      );
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'La nuova password deve essere diversa da quella attuale' },
        { status: 400 }
      );
    }

    const emailLower = userEmail.toLowerCase();

    // Trova utente in auth.users
    const {
      data: { users: authUsers },
      error: listError,
    } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('❌ [CHANGE PASSWORD] Errore listUsers:', listError);
      return NextResponse.json(
        { error: 'Errore durante il cambio password. Riprova.' },
        { status: 500 }
      );
    }

    const authUser = authUsers?.find((u: any) => u.email?.toLowerCase() === emailLower);

    if (!authUser) {
      console.log(`⚠️ [CHANGE PASSWORD] Utente auth non trovato per richiesta cambio password`);
      return NextResponse.json({ error: 'Utente non trovato' }, { status: 404 });
    }

    // Verifica password attuale tentando il sign in
    const { error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: emailLower,
      password: currentPassword,
    });

    if (signInError) {
      console.log(
        `⚠️ [CHANGE PASSWORD] Password attuale errata per utente ${authUser.id.substring(0, 8)}...`
      );
      return NextResponse.json({ error: 'La password attuale non è corretta' }, { status: 400 });
    }

    // Aggiorna password
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      password: newPassword,
    });

    if (updateError) {
      console.error('❌ [CHANGE PASSWORD] Errore update password:', updateError);
      return NextResponse.json(
        { error: 'Errore durante il cambio password. Riprova.' },
        { status: 500 }
      );
    }

    // Recupera info utente per email
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('name')
      .eq('email', emailLower)
      .single();

    // Invia email di conferma
    await sendPasswordChangedEmail({
      to: emailLower,
      userName: userData?.name || userName || emailLower.split('@')[0],
      changedAt: new Date(),
    });

    console.log(
      `✅ [CHANGE PASSWORD] Password cambiata per utente ${authUser.id.substring(0, 8)}...`
    );

    return NextResponse.json({
      success: true,
      message: 'Password cambiata con successo!',
    });
  } catch (error: any) {
    console.error('❌ [CHANGE PASSWORD] Errore:', error);
    return NextResponse.json(
      { error: 'Errore durante il cambio password. Riprova.' },
      { status: 500 }
    );
  }
}
