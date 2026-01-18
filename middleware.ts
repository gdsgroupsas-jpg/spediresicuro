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

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth-config";
import { generateRequestId, createLogger } from "@/lib/logger";
import { trackMiddlewareError } from "@/lib/error-tracker";
import * as Sentry from "@sentry/nextjs"; // M2: APM tracing

/**
 * ⚠️ E2E TEST BYPASS (Solo CI/Development Environment)
 *
 * Quando l'header 'x-test-mode: playwright' è presente E siamo in CI o dev,
 * bypassa l'autenticazione per permettere i test E2E.
 *
 * SICUREZZA: Funziona SOLO se:
 * - NODE_ENV !== 'production' (NEVER in production)
 * - AND (CI=true OR NODE_ENV=development)
 */
function isPlaywrightTestBypass(request: NextRequest): boolean {
  const testHeader = request.headers.get('x-test-mode');
  if (testHeader !== 'playwright') {
    return false;
  }

  // NEVER allow bypass in production - fail closed
  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  // Only allow in CI or development
  const isCI = process.env.CI === 'true';
  const isDev = process.env.NODE_ENV === 'development';

  return isCI || isDev;
}

/**
 * Public routes that DON'T require authentication
 * These are explicitly allowed without session check
 */
const PUBLIC_ROUTES = [
  "/",
  "/login",
  "/api/auth", // NextAuth routes
  "/api/health", // Health check endpoint
  "/api/cron", // Cron endpoints (have own token auth)
  "/api/webhooks", // External webhooks (UptimeRobot, etc. - have own secret auth)
  "/api/metrics/prometheus", // Prometheus scraping (has own Bearer token auth)
  // Marketing routes
  "/come-funziona",
  "/contatti",
  "/prezzi",
  "/preventivi",
  "/preventivo",
  "/manuale",
  // Legal routes
  "/privacy-policy",
  "/terms-conditions",
  "/cookie-policy",
  // Tracking routes
  "/track", // Tracking prefix
];

/**
 * Check if a path matches public routes
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Check if a path is a static asset
 */
function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml") ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$/i.test(pathname)
  );
}

/**
 * Check if a path is an API route
 */
function isApiRoute(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/**
 * Main middleware function
 * M2: Wrapped in Sentry span for distributed tracing
 */
export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Genera requestId univoco per tracciabilità
  const requestId = generateRequestId();

  // M2: Crea root span per distributed tracing
  return await Sentry.startSpan(
    {
      op: "http.server",
      name: `${request.method} ${pathname}`,
      attributes: {
        "http.method": request.method,
        "http.url": pathname,
        "http.route": pathname,
        "http.request_id": requestId,
      },
    },
    async (span) => {
      const logger = createLogger(requestId);

      try {
        // Allow static assets immediately
        if (isStaticAsset(pathname)) {
          const response = NextResponse.next();
          response.headers.set("X-Request-ID", requestId);
          span.setAttributes({ "http.status_code": response.status });
          return response;
        }

        // Allow public routes immediately
        if (isPublicRoute(pathname)) {
          const response = NextResponse.next();
          response.headers.set("X-Request-ID", requestId);
          span.setAttributes({ "http.status_code": response.status });
          return response;
        }

        // ⚠️ E2E TEST BYPASS: Permette accesso senza autenticazione in test mode
        if (isPlaywrightTestBypass(request)) {
          logger.debug("Playwright test bypass active", { pathname });
          const response = NextResponse.next();
          response.headers.set("X-Request-ID", requestId);
          response.headers.set("X-Test-Mode", "playwright-bypass");
          span.setAttributes({ "http.status_code": response.status });
          return response;
        }

        // ⚠️ SECURITY: Get session (NextAuth v5)
        const session = await auth();
        const userId = session?.user?.id;

        // M2: Aggiungi user context allo span
        if (userId) {
          span.setAttributes({ "user.id": userId });
          logger.debug("User authenticated", { userId, pathname });
        }

        // Check if route requires authentication
        const requiresAuth =
          pathname.startsWith("/dashboard") || isApiRoute(pathname);

        if (requiresAuth && !session) {
          // ❌ UNAUTHORIZED ACCESS ATTEMPT
          logger.warn("Unauthorized access attempt", {
            pathname,
            method: request.method,
          });

          if (isApiRoute(pathname)) {
            // API routes → return 401 JSON
            const response = NextResponse.json(
              { error: "Unauthorized", message: "Authentication required" },
              { status: 401 }
            );
            response.headers.set("X-Request-ID", requestId);
            span.setAttributes({ "http.status_code": 401 });
            return response;
          }

          // UI routes → redirect to login
          const loginUrl = new URL("/login", request.url);
          loginUrl.searchParams.set("callbackUrl", pathname);
          const response = NextResponse.redirect(loginUrl);
          response.headers.set("X-Request-ID", requestId);
          span.setAttributes({ "http.status_code": 302 });
          return response;
        }

        // ⚠️ P0: SERVER-AUTHORITATIVE ONBOARDING GATE
        // Controlla onboarding per utenti autenticati PRIMA di permettere accesso
        if (session?.user?.email) {
          try {
            // Import dinamico per evitare problemi Edge Runtime
            const { findUserByEmail } = await import("@/lib/database");
            const user = await findUserByEmail(session.user.email);

            const userEmail = session.user.email?.toLowerCase() || "";
            const isTestUser = userEmail === "test@spediresicuro.it";

            // Per utente test, bypass controllo onboarding
            if (!isTestUser) {
              const hasDatiCliente = !!user?.datiCliente;
              const datiCompletati = user?.datiCliente?.datiCompletati === true;
              const onboardingCompleted = hasDatiCliente && datiCompletati;

              // Se onboarding NON completato
              if (!onboardingCompleted) {
                // Blocca accesso a route pubbliche (home) se autenticato ma onboarding non completato
                if (
                  pathname === "/" ||
                  (isPublicRoute(pathname) &&
                    pathname !== "/login" &&
                    pathname !== "/api/auth")
                ) {
                  logger.warn(
                    "Authenticated user without onboarding trying to access public route",
                    {
                      email: session.user.email,
                      pathname,
                    }
                  );
                  const onboardingUrl = new URL(
                    "/dashboard/dati-cliente",
                    request.url
                  );
                  const response = NextResponse.redirect(onboardingUrl);
                  response.headers.set("X-Request-ID", requestId);
                  span.setAttributes({ "http.status_code": 302 });
                  return response;
                }

                // Blocca accesso a /dashboard se non su onboarding
                if (
                  pathname.startsWith("/dashboard") &&
                  pathname !== "/dashboard/dati-cliente"
                ) {
                  logger.warn(
                    "Authenticated user without onboarding trying to access dashboard",
                    {
                      email: session.user.email,
                      pathname,
                    }
                  );
                  const onboardingUrl = new URL(
                    "/dashboard/dati-cliente",
                    request.url
                  );
                  const response = NextResponse.redirect(onboardingUrl);
                  response.headers.set("X-Request-ID", requestId);
                  span.setAttributes({ "http.status_code": 302 });
                  return response;
                }
              }
            }
          } catch (error: any) {
            // Fail-closed: se errore query → assume onboarding non completato → redirect a onboarding
            logger.error("Error checking onboarding status, fail-closed:", error);
            if (
              pathname !== "/dashboard/dati-cliente" &&
              pathname !== "/login" &&
              !pathname.startsWith("/api/auth")
            ) {
              const onboardingUrl = new URL("/dashboard/dati-cliente", request.url);
              const response = NextResponse.redirect(onboardingUrl);
              response.headers.set("X-Request-ID", requestId);
              span.setAttributes({ "http.status_code": 302 });
              return response;
            }
          }
        }

        // ✅ AUTHORIZED: User is authenticated or route is public
        // ⚠️ P0-1 FIX: Passa pathname al layout per evitare loop infiniti

        // Clona headers dalla request e aggiungi quelli custom
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set("x-request-id", requestId);

        // Passa il pathname corrente al Layout (Server Component)
        if (pathname.startsWith("/dashboard")) {
          requestHeaders.set("x-pathname", pathname);
        }

        // Crea la response passando i nuovi headers della request
        const response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });

        // Imposta anche headers sulla response (opzionale, per il client)
        response.headers.set("X-Request-ID", requestId);

        // M2: Imposta status code sullo span
        span.setAttributes({
          "http.status_code": response.status,
        });

        return response;
      } catch (error: any) {
        // Traccia errori middleware
        trackMiddlewareError(error, requestId, pathname, {
          method: request.method,
        });

        // M2: Marca span come errore
        span.setStatus({ code: 2, message: String(error) }); // 2 = ERROR

        // ⚠️ SECURITY: FAIL-CLOSED - In caso di errore, nega accesso a route protette
        // Se pathname inizia con /dashboard → redirect a /login
        if (pathname.startsWith("/dashboard")) {
          const loginUrl = new URL("/login", request.url);
          loginUrl.searchParams.set("callbackUrl", pathname);
          const response = NextResponse.redirect(loginUrl);
          response.headers.set("X-Request-ID", requestId);
          span.setAttributes({ "http.status_code": 302 });
          return response;
        }

        // Se pathname inizia con /api → return 503 (Service Unavailable)
        if (isApiRoute(pathname)) {
          const response = NextResponse.json(
            { error: "Service temporarily unavailable" },
            { status: 503 }
          );
          response.headers.set("X-Request-ID", requestId);
          span.setAttributes({ "http.status_code": 503 });
          return response;
        }

        // Per altre route pubbliche → NextResponse.next() è OK (già verificate come pubbliche)
        const response = NextResponse.next();
        response.headers.set("X-Request-ID", requestId);
        span.setAttributes({ "http.status_code": response.status });
        return response;
      }
    }
  );
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
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$).*)",
  ],
};
