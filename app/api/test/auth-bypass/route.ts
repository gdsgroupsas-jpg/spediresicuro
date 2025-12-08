/**
 * API Route: Test Auth Bypass
 * 
 * ⚠️ SOLO PER TEST E2E - NON USARE IN PRODUZIONE
 * 
 * Questo endpoint permette di bypassare l'autenticazione nei test
 * creando una sessione valida per l'utente di test.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  // ⚠️ SOLO IN SVILUPPO/TEST
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }

  // Verifica che sia una richiesta da test (puoi aggiungere un header di sicurezza)
  const testHeader = request.headers.get('x-test-mode');
  if (testHeader !== 'playwright') {
    return NextResponse.json({ error: 'Test mode required' }, { status: 403 });
  }

  try {
    // Crea un cookie di sessione per l'utente di test
    // NOTA: Questo è un workaround - in produzione usa sempre NextAuth
    const cookieStore = await cookies();
    cookieStore.set('next-auth.session-token', 'test-session-token', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 giorni
    });

    return NextResponse.json({
      success: true,
      message: 'Test session created',
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Failed to create test session' },
      { status: 500 }
    );
  }
}

