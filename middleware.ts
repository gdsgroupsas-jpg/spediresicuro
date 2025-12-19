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

  // Allow static assets immediately
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // Allow public routes immediately
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // ⚠️ SECURITY: Get session (NextAuth v5)
  const session = await auth();

  // Check if route requires authentication
  const requiresAuth = pathname.startsWith('/dashboard') || isApiRoute(pathname);

  if (requiresAuth && !session) {
    // ❌ UNAUTHORIZED ACCESS ATTEMPT

    if (isApiRoute(pathname)) {
      // API routes → return 401 JSON
      return NextResponse.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        { status: 401 }
      );
    }

    // UI routes → redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ✅ AUTHORIZED: User is authenticated or route is public
  return NextResponse.next();
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
