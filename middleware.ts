/**
 * Middleware Next.js 14
 * 
 * Questo file viene eseguito prima di ogni richiesta.
 * Puoi usarlo per:
 * - Redirect
 * - Autenticazione
 * - Logging
 * - Modifiche header
 */
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Esempio: log delle richieste (solo in sviluppo)
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Middleware] ${request.method} ${request.nextUrl.pathname}`);
  }

  // Aggiungi qui altre logiche se necessario
  // Esempio: redirect, controllo autenticazione, ecc.

  return NextResponse.next();
}

// Configurazione: su quali percorsi eseguire il middleware
export const config = {
  matcher: [
    /*
     * Match tutti i percorsi tranne:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

