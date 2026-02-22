/**
 * API: /api/auth/forgot-password
 *
 * POST: Invia email per reset password
 *
 * Flusso:
 * 1. Utente inserisce email
 * 2. Sistema genera token reset (salvato in DB)
 * 3. Invia email con link reset
 * 4. Link porta a /reset-password?token=xxx
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendPasswordResetEmail } from '@/lib/email/resend';
import { withRateLimit } from '@/lib/security/rate-limit-middleware';
import crypto from 'crypto';

// Token valido per 1 ora
const TOKEN_EXPIRY_HOURS = 1;

export async function POST(request: NextRequest) {
  // Rate limit: 3 req/min per IP (prevenzione email bombing)
  const rl = await withRateLimit(request, 'auth-forgot-password', { limit: 3, windowSeconds: 60 });
  if (rl) return rl;

  try {
    const { email } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email obbligatoria' }, { status: 400 });
    }

    const emailLower = email.toLowerCase().trim();

    // Verifica che l'utente esista
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, name, email')
      .eq('email', emailLower)
      .single();

    // Non rivelare se l'email esiste o meno (sicurezza)
    if (userError || !user) {
      console.log(`⚠️ [FORGOT PASSWORD] Email non trovata per richiesta reset password`);
      // Rispondiamo comunque con successo per non rivelare info
      return NextResponse.json({
        success: true,
        message: "Se l'email è registrata, riceverai un link per reimpostare la password.",
      });
    }

    // Genera token sicuro
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000);

    // Salva token nel database (o aggiorna se esiste già)
    // Usiamo una tabella dedicata o un campo nella tabella users
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({
        reset_token_hash: tokenHash,
        reset_token_expires: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('❌ [FORGOT PASSWORD] Errore salvataggio token:', updateError);
      return NextResponse.json({ error: 'Errore durante la richiesta. Riprova.' }, { status: 500 });
    }

    // Costruisci URL reset
    const baseUrl = process.env.NEXTAUTH_URL || 'https://spediresicuro.it';
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(emailLower)}`;

    // Invia email
    const emailResult = await sendPasswordResetEmail({
      to: emailLower,
      userName: user.name || emailLower.split('@')[0],
      resetUrl,
      expiresIn: `${TOKEN_EXPIRY_HOURS} ora`,
    });

    if (!emailResult.success) {
      console.error('❌ [FORGOT PASSWORD] Errore invio email:', emailResult.error);
      // Non riveliamo l'errore specifico
    } else {
      console.log(
        `✅ [FORGOT PASSWORD] Email di reset inviata per utente ${user.id.substring(0, 8)}...`
      );
    }

    return NextResponse.json({
      success: true,
      message: "Se l'email è registrata, riceverai un link per reimpostare la password.",
    });
  } catch (error: any) {
    console.error('❌ [FORGOT PASSWORD] Errore:', error);
    return NextResponse.json({ error: 'Errore durante la richiesta. Riprova.' }, { status: 500 });
  }
}
