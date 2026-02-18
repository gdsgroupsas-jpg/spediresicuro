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
 *
 * WORKSPACE CONTEXT (Architecture V2):
 * - Reads workspace_id from cookie 'sec-workspace-id'
 * - Injects x-sec-workspace-id header for downstream use
 * - Does NOT validate membership here (done in API routes)
 * - Fail-open for workspace: missing workspace doesn't block, just no header
 */

import { auth } from '@/lib/auth-config';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Workspace cookie name (must match WorkspaceContext)
 * @security HttpOnly cookie set by /api/workspaces/switch
 */
const WORKSPACE_COOKIE_NAME = 'sec-workspace-id';

/**
 * Header name for workspace ID propagation
 * @security Only set by middleware, not trusted from client
 */
const WORKSPACE_HEADER_NAME = 'x-sec-workspace-id';

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
 * NOTE: For '/' (root), exact match. For other routes, prefix match with
 * boundary check (must be followed by '/' or end of string) to prevent
 * accidental exposure of routes like /prezzi-admin when /prezzi is public.
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => {
    if (route === '/') {
      // Root route must match exactly
      return pathname === '/';
    }
    // Prefix match with boundary: /track matches /track and /track/abc but NOT /track-anything
    return pathname === route || pathname.startsWith(route + '/');
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
 * Validate workspace ID format (UUID v4)
 * @security Prevents injection attacks via malformed workspace IDs
 */
function isValidWorkspaceId(workspaceId: string | undefined): workspaceId is string {
  if (!workspaceId) return false;
  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(workspaceId);
}

/**
 * Get workspace ID from request (cookie)
 * @security Only reads from HttpOnly cookie, never from headers/query
 */
function getWorkspaceIdFromRequest(request: NextRequest): string | null {
  const cookieValue = request.cookies.get(WORKSPACE_COOKIE_NAME)?.value;

  if (!isValidWorkspaceId(cookieValue)) {
    return null;
  }

  return cookieValue;
}

/**
 * Inject workspace ID header into request
 * @security Header is set by middleware only, never trusted from client
 * @security Membership validation happens in API routes, not here
 */
function injectWorkspaceHeader(request: NextRequest): NextResponse {
  const workspaceId = getWorkspaceIdFromRequest(request);

  // Clone headers and add workspace ID if present
  const requestHeaders = new Headers(request.headers);

  // SECURITY: Always remove any client-supplied workspace header
  // This prevents header injection attacks
  requestHeaders.delete(WORKSPACE_HEADER_NAME);

  // SECURITY: Strip x-test-mode header from client requests
  // Defense-in-depth: il bypass E2E è già protetto da NODE_ENV !== 'production',
  // ma strippare l'header impedisce qualsiasi tentativo di injection
  requestHeaders.delete('x-test-mode');

  if (workspaceId) {
    requestHeaders.set(WORKSPACE_HEADER_NAME, workspaceId);
  }

  // Return response with modified headers
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

/**
 * Main middleware function
 * Enterprise-grade: reads onboarding status from JWT session (zero DB queries)
 * Workspace context: reads from cookie, injects header for downstream use
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

    // Utente non autenticato su route protetta → fail-closed
    if (!session?.user?.email) {
      if (pathname.startsWith('/api/')) {
        // API routes: return 401 JSON
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      // Dashboard e altre route protette: redirect al login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Da qui: utente autenticato
    const userEmail = session.user.email.toLowerCase();
    const onboardingComplete = (session.user as any).onboarding_complete === true;

    // Skip onboarding check per test user
    if (userEmail === 'test@spediresicuro.it') {
      return injectWorkspaceHeader(request);
    }

    // Redirect a onboarding se non completato
    if (
      !onboardingComplete &&
      pathname.startsWith('/dashboard') &&
      pathname !== '/dashboard/dati-cliente'
    ) {
      console.log('🔒 [MIDDLEWARE] Redirect to onboarding:', userEmail);
      return NextResponse.redirect(new URL('/dashboard/dati-cliente', request.url));
    }

    // Inject workspace header per utenti autenticati
    return injectWorkspaceHeader(request);
  } catch (error) {
    console.error('🔒 [MIDDLEWARE] Error:', error);
    // Fail-closed: su errore, nega accesso alle route protette
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
    return NextResponse.redirect(new URL('/login', request.url));
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
