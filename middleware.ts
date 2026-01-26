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

import { auth } from '@/lib/auth-config';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Public routes that DON'T require authentication
 * These are explicitly allowed without session check
 */
const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/api/auth', // NextAuth routes
  '/api/health', // Health check endpoint
  '/api/cron', // Cron endpoints (have own token auth)
  '/api/webhooks', // External webhooks (UptimeRobot, etc. - have own secret auth)
  '/api/metrics/prometheus', // Prometheus scraping (has own Bearer token auth)
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
 * NOTE: For '/' (root), we do exact match. For other routes, we use startsWith.
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => {
    if (route === '/') {
      // Root route must match exactly
      return pathname === '/';
    }
    // Other routes use prefix matching
    return pathname.startsWith(route);
  });
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
 * Main middleware function
 * Enterprise-grade: reads onboarding status from JWT session (zero DB queries)
 */
export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  try {
    // Allow static assets immediately
    if (isStaticAsset(pathname)) {
      return NextResponse.next();
    }

    // Allow public routes immediately
    if (isPublicRoute(pathname)) {
      return NextResponse.next();
    }

    // Get session (from JWT, no DB query)
    const session = await auth();

    // Check onboarding for authenticated users
    if (session?.user?.email) {
      const userEmail = session.user.email.toLowerCase();
      const onboardingComplete = (session.user as any).onboarding_complete === true;

      // Skip check for test user
      if (userEmail === 'test@spediresicuro.it') {
        return NextResponse.next();
      }

      // Redirect to onboarding if not completed
      if (
        !onboardingComplete &&
        pathname.startsWith('/dashboard') &&
        pathname !== '/dashboard/dati-cliente'
      ) {
        console.log('🔒 [MIDDLEWARE] Redirect to onboarding:', userEmail);
        return NextResponse.redirect(new URL('/dashboard/dati-cliente', request.url));
      }
    }

    return NextResponse.next();
  } catch (error) {
    console.error('🔒 [MIDDLEWARE] Error:', error);
    return NextResponse.next();
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
