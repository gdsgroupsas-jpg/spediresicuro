/**
 * API: /api/auth/reset-password
 *
 * POST: Reimposta la password con token valido
 *
 * Flusso:
 * 1. Utente clicca link email → /reset-password?token=xxx&email=xxx
 * 2. Inserisce nuova password
 * 3. Sistema verifica token e aggiorna password
 * 4. Invia email conferma cambio password
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPasswordChangedEmail } from '@/lib/email/resend';
import { withRateLimit } from '@/lib/security/rate-limit-middleware';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  // Rate limit: 5 req/min per IP (prevenzione brute force token)
  const rl = await withRateLimit(request, 'auth-reset-password', { limit: 5, windowSeconds: 60 });
  if (rl) return rl;

  try {
    const { token, email, newPassword } = await request.json();

    // Validazione input
    if (!token || !email || !newPassword) {
      return NextResponse.json(
        { error: 'Token, email e nuova password sono obbligatori' },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: 'La password deve essere di almeno 8 caratteri' },
        { status: 400 }
      );
    }

    const emailLower = email.toLowerCase().trim();
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    // Verifica token
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, name, email, reset_token_hash, reset_token_expires')
      .eq('email', emailLower)
      .single();

    if (userError || !user) {
      console.log(`⚠️ [RESET PASSWORD] Utente non trovato per richiesta reset password`);
      return NextResponse.json(
        { error: 'Link non valido o scaduto. Richiedi un nuovo reset.' },
        { status: 400 }
      );
    }

    // Verifica che il token corrisponda
    if (user.reset_token_hash !== tokenHash) {
      console.log(`⚠️ [RESET PASSWORD] Token non valido per utente ${user.id.substring(0, 8)}...`);
      return NextResponse.json(
        { error: 'Link non valido o scaduto. Richiedi un nuovo reset.' },
        { status: 400 }
      );
    }

    // Verifica che il token non sia scaduto
    if (!user.reset_token_expires || new Date(user.reset_token_expires) < new Date()) {
      console.log(`⚠️ [RESET PASSWORD] Token scaduto per utente ${user.id.substring(0, 8)}...`);
      return NextResponse.json(
        { error: 'Il link è scaduto. Richiedi un nuovo reset della password.' },
        { status: 400 }
      );
    }

    // Aggiorna password in Supabase Auth
    // Prima trova l'utente in auth.users
    const {
      data: { users: authUsers },
      error: listError,
    } = await supabaseAdmin.auth.admin.listUsers();

    if (listError) {
      console.error('❌ [RESET PASSWORD] Errore listUsers:', listError);
      return NextResponse.json({ error: 'Errore durante il reset. Riprova.' }, { status: 500 });
    }

    const authUser = authUsers?.find((u: any) => u.email?.toLowerCase() === emailLower);

    if (authUser) {
      // Aggiorna password in auth.users
      const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
        authUser.id,
        { password: newPassword }
      );

      if (updateAuthError) {
        console.error('❌ [RESET PASSWORD] Errore update auth.users:', updateAuthError);
        return NextResponse.json({ error: 'Errore durante il reset. Riprova.' }, { status: 500 });
      }
    }

    // Invalida il token e aggiorna timestamp
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        reset_token_hash: null,
        reset_token_expires: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ [RESET PASSWORD] Errore invalidazione token:', updateError);
      // Non blocchiamo, la password è già stata cambiata
    }

    // Invia email di conferma
    await sendPasswordChangedEmail({
      to: emailLower,
      userName: user.name || emailLower.split('@')[0],
      changedAt: new Date(),
    });

    console.log(
      `✅ [RESET PASSWORD] Password reimpostata per utente ${user.id.substring(0, 8)}...`
    );

    return NextResponse.json({
      success: true,
      message: 'Password reimpostata con successo! Ora puoi accedere con la nuova password.',
    });
  } catch (error: any) {
    console.error('❌ [RESET PASSWORD] Errore:', error);
    return NextResponse.json({ error: 'Errore durante il reset. Riprova.' }, { status: 500 });
  }
}
