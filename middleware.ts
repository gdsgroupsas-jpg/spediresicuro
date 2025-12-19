/**
 * NextAuth v5 Middleware - FAIL-CLOSED Security Hardening
 *
 * SECURITY POSTURE: Deny-by-default for all private routes
 *
 * Protected areas:
 * - /dashboard/** (UI routes - redirect to /login)
 * - /api/** (API routes - return 401, except auth/health/webhooks)
 *
 * Public routes:
 * - / (homepage)
 * - /login
 * - /api/auth/** (NextAuth endpoints)
 * - /api/health (health check)
 * - /api/cron/** (webhook endpoints with token auth)
 * - Marketing: /come-funziona, /contatti, /prezzi, /preventivi, /preventivo, /manuale
 * - Legal: /privacy-policy, /terms-conditions, /cookie-policy
 * - Tracking: /track/** (tracking endpoints)
 * - Static assets (_next, favicon, images)
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth-config';
import { generateRequestId, createLogger } from '@/lib/logger';
import { trackMiddlewareError } from '@/lib/error-tracker';

/**
 * Public routes that DON'T require authentication
 * These are explicitly allowed without session check
 */
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/api/auth', // NextAuth routes
  '/api/health', // Health check endpoint
  '/api/cron', // Webhook endpoints (have own token auth)
  // Marketing routes
  '/come-funziona',
  '/contatti',
  '/prezzi',
  '/preventivi',
  '/preventivo',
  '/manuale',
  // Legal routes
  '/privacy-policy',
  '/terms-conditions',
  '/cookie-policy',
  // Tracking routes
  '/track', // Tracking prefix
];

/**
 * Check if a path matches public routes
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname.startsWith(route));
}

/**
 * Check if a path is a static asset
 */
function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap.xml') ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$/i.test(pathname)
  );
}

/**
 * Check if a path is an API route
 */
function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

/**
 * Main middleware function
 */
export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Genera requestId univoco per tracciabilità
  const requestId = generateRequestId();
  const logger = createLogger(requestId);

  try {
    // Allow static assets immediately
    if (isStaticAsset(pathname)) {
      const response = NextResponse.next();
      response.headers.set('X-Request-ID', requestId);
      return response;
    }

    // Allow public routes immediately
    if (isPublicRoute(pathname)) {
      const response = NextResponse.next();
      response.headers.set('X-Request-ID', requestId);
      return response;
    }

    // ⚠️ SECURITY: Get session (NextAuth v5)
    const session = await auth();
    const userId = session?.user?.id;

    // Aggiorna logger con userId se disponibile
    if (userId) {
      logger.debug('User authenticated', { userId, pathname });
    }

    // Check if route requires authentication
    const requiresAuth = pathname.startsWith('/dashboard') || isApiRoute(pathname);

    if (requiresAuth && !session) {
      // ❌ UNAUTHORIZED ACCESS ATTEMPT
      logger.warn('Unauthorized access attempt', { pathname, method: request.method });

      if (isApiRoute(pathname)) {
        // API routes → return 401 JSON
        const response = NextResponse.json(
          { error: 'Unauthorized', message: 'Authentication required' },
          { status: 401 }
        );
        response.headers.set('X-Request-ID', requestId);
        return response;
      }

      // UI routes → redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      const response = NextResponse.redirect(loginUrl);
      response.headers.set('X-Request-ID', requestId);
      return response;
    }

    // ✅ AUTHORIZED: User is authenticated or route is public
    const response = NextResponse.next();
    response.headers.set('X-Request-ID', requestId);
    return response;
  } catch (error: any) {
    // Traccia errori middleware
    trackMiddlewareError(error, requestId, pathname, {
      method: request.method,
    });

    // ⚠️ SECURITY: FAIL-CLOSED - In caso di errore, nega accesso a route protette
    // Se pathname inizia con /dashboard → redirect a /login
    if (pathname.startsWith('/dashboard')) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      const response = NextResponse.redirect(loginUrl);
      response.headers.set('X-Request-ID', requestId);
      return response;
    }

    // Se pathname inizia con /api → return 503 (Service Unavailable)
    if (isApiRoute(pathname)) {
      const response = NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      );
      response.headers.set('X-Request-ID', requestId);
      return response;
    }

    // Per altre route pubbliche → NextResponse.next() è OK (già verificate come pubbliche)
    const response = NextResponse.next();
    response.headers.set('X-Request-ID', requestId);
    return response;
  }
}

/**
 * Middleware matcher configuration
 *
 * Apply middleware to:
 * - All /dashboard routes
 * - All /api routes
 * - Exclude: static assets, Next.js internals
 */
export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, robots.txt, sitemap.xml
     * - static assets (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)',
  ],
};
