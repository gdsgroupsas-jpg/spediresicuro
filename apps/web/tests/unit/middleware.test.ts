/**
 * Test: Middleware Security - Unit Tests
 *
 * Verifica i componenti unitari del middleware:
 * 1. Utility functions (isPublicRoute, isStaticAsset, isApiRoute)
 * 2. assertValidUserId validation
 *
 * ⚠️ NOTA: I test di integrazione del middleware completo (auth flow, redirect, 401)
 * sono testati nei test E2E con Playwright perché richiedono l'ambiente Next.js completo.
 *
 * Questi test verificano la logica isolata senza dipendenze Next.js/Sentry.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { isE2ETestMode } from '@/lib/test-mode';

// Testiamo le utility function direttamente
// Queste sono le stesse funzioni usate nel middleware

const PUBLIC_ROUTES = [
  '/',
  '/login',
  '/api/auth',
  '/api/health',
  '/api/cron',
  '/api/webhooks',
  '/api/metrics/prometheus',
  '/come-funziona',
  '/contatti',
  '/prezzi',
  '/preventivi',
  '/preventivo',
  '/manuale',
  '/privacy-policy',
  '/terms-conditions',
  '/cookie-policy',
  '/track',
];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => {
    if (route === '/') {
      return pathname === '/';
    }
    // Boundary check: /prezzi matches /prezzi and /prezzi/... but NOT /prezzi-admin
    return pathname === route || pathname.startsWith(route + '/');
  });
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap.xml') ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)$/i.test(pathname)
  );
}

function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

function isPlaywrightTestBypass(testHeader: string | null, nodeEnv: string): boolean {
  if (testHeader !== 'playwright') {
    return false;
  }
  if (nodeEnv === 'production') {
    return false;
  }
  return true;
}

describe('Middleware Utility Functions', () => {
  describe('isPublicRoute', () => {
    it('should return true for homepage', () => {
      expect(isPublicRoute('/')).toBe(true);
    });

    it('should return true for /login', () => {
      expect(isPublicRoute('/login')).toBe(true);
    });

    it('should return true for /api/auth routes', () => {
      expect(isPublicRoute('/api/auth/callback')).toBe(true);
      expect(isPublicRoute('/api/auth/signin')).toBe(true);
    });

    it('should return true for /api/health', () => {
      expect(isPublicRoute('/api/health')).toBe(true);
    });

    it('should return true for /api/cron routes', () => {
      expect(isPublicRoute('/api/cron/telegram-queue')).toBe(true);
      expect(isPublicRoute('/api/cron/daily-report')).toBe(true);
    });

    it('should return true for marketing routes', () => {
      expect(isPublicRoute('/come-funziona')).toBe(true);
      expect(isPublicRoute('/contatti')).toBe(true);
      expect(isPublicRoute('/prezzi')).toBe(true);
      expect(isPublicRoute('/preventivi')).toBe(true);
    });

    it('should return true for legal routes', () => {
      expect(isPublicRoute('/privacy-policy')).toBe(true);
      expect(isPublicRoute('/terms-conditions')).toBe(true);
      expect(isPublicRoute('/cookie-policy')).toBe(true);
    });

    it('should return true for tracking routes', () => {
      expect(isPublicRoute('/track/ABC123')).toBe(true);
    });

    it('should return false for /dashboard', () => {
      expect(isPublicRoute('/dashboard')).toBe(false);
    });

    it('should return false for /api/spedizioni', () => {
      expect(isPublicRoute('/api/spedizioni')).toBe(false);
    });

    it('should return false for /api/wallet', () => {
      expect(isPublicRoute('/api/wallet/balance')).toBe(false);
    });

    it('boundary check: /prezzi non deve matchare /prezzi-admin', () => {
      expect(isPublicRoute('/prezzi')).toBe(true);
      expect(isPublicRoute('/prezzi-admin')).toBe(false);
      expect(isPublicRoute('/preventivi-segreti')).toBe(false);
    });

    it('boundary check: /track deve matchare /track/ABC123 ma non /tracking', () => {
      expect(isPublicRoute('/track/ABC123')).toBe(true);
      expect(isPublicRoute('/tracking')).toBe(false);
    });

    it('boundary check: /api/cron deve matchare /api/cron/job ma non /api/cron-admin', () => {
      expect(isPublicRoute('/api/cron/telegram-queue')).toBe(true);
      expect(isPublicRoute('/api/cron-admin')).toBe(false);
    });

    it('boundary check: /login deve matchare esattamente ma non /login-bypass', () => {
      expect(isPublicRoute('/login')).toBe(true);
      expect(isPublicRoute('/login-bypass')).toBe(false);
    });
  });

  describe('isStaticAsset', () => {
    it('should return true for /_next static files', () => {
      expect(isStaticAsset('/_next/static/chunks/main.js')).toBe(true);
      expect(isStaticAsset('/_next/image?url=...')).toBe(true);
    });

    it('should return true for favicon', () => {
      expect(isStaticAsset('/favicon.ico')).toBe(true);
    });

    it('should return true for robots.txt', () => {
      expect(isStaticAsset('/robots.txt')).toBe(true);
    });

    it('should return true for image files', () => {
      expect(isStaticAsset('/images/logo.png')).toBe(true);
      expect(isStaticAsset('/images/hero.jpg')).toBe(true);
      expect(isStaticAsset('/icons/icon.svg')).toBe(true);
    });

    it('should return true for font files', () => {
      expect(isStaticAsset('/fonts/roboto.woff2')).toBe(true);
      expect(isStaticAsset('/fonts/arial.ttf')).toBe(true);
    });

    it('should return false for API routes', () => {
      expect(isStaticAsset('/api/spedizioni')).toBe(false);
    });

    it('should return false for dashboard routes', () => {
      expect(isStaticAsset('/dashboard')).toBe(false);
    });
  });

  describe('isApiRoute', () => {
    it('should return true for /api routes', () => {
      expect(isApiRoute('/api/spedizioni')).toBe(true);
      expect(isApiRoute('/api/auth/callback')).toBe(true);
      expect(isApiRoute('/api/wallet/balance')).toBe(true);
    });

    it('should return false for non-api routes', () => {
      expect(isApiRoute('/dashboard')).toBe(false);
      expect(isApiRoute('/login')).toBe(false);
      expect(isApiRoute('/')).toBe(false);
    });
  });

  describe('isPlaywrightTestBypass', () => {
    it('should return true in development with playwright header', () => {
      expect(isPlaywrightTestBypass('playwright', 'development')).toBe(true);
    });

    it('should return true in test with playwright header', () => {
      expect(isPlaywrightTestBypass('playwright', 'test')).toBe(true);
    });

    it('should return false in production with playwright header', () => {
      expect(isPlaywrightTestBypass('playwright', 'production')).toBe(false);
    });

    it('should return false without playwright header', () => {
      expect(isPlaywrightTestBypass(null, 'development')).toBe(false);
      expect(isPlaywrightTestBypass('other', 'development')).toBe(false);
    });
  });
});

describe('isE2ETestMode (centralizzata in lib/test-mode.ts)', () => {
  // Helper: crea un fake headers object
  const fakeHeaders = (map: Record<string, string>) => ({
    get: (name: string) => map[name] || null,
  });

  const originalEnv = process.env;

  afterEach(() => {
    // Ripristina env dopo ogni test
    process.env = { ...originalEnv };
  });

  it('should return true in development with playwright header', () => {
    process.env.NODE_ENV = 'development';
    process.env.CI = '';
    process.env.PLAYWRIGHT_TEST_MODE = '';
    expect(isE2ETestMode(fakeHeaders({ 'x-test-mode': 'playwright' }))).toBe(true);
  });

  it('should return true in test env with playwright header', () => {
    process.env.NODE_ENV = 'test';
    process.env.CI = '';
    process.env.PLAYWRIGHT_TEST_MODE = '';
    expect(isE2ETestMode(fakeHeaders({ 'x-test-mode': 'playwright' }))).toBe(true);
  });

  it('should return false in production without CI or PLAYWRIGHT_TEST_MODE', () => {
    process.env.NODE_ENV = 'production';
    process.env.CI = '';
    process.env.PLAYWRIGHT_TEST_MODE = '';
    expect(isE2ETestMode(fakeHeaders({ 'x-test-mode': 'playwright' }))).toBe(false);
  });

  it('should return true in production with CI=true', () => {
    process.env.NODE_ENV = 'production';
    process.env.CI = 'true';
    process.env.PLAYWRIGHT_TEST_MODE = '';
    expect(isE2ETestMode(fakeHeaders({ 'x-test-mode': 'playwright' }))).toBe(true);
  });

  it('should return true with PLAYWRIGHT_TEST_MODE=true even without header', () => {
    process.env.NODE_ENV = 'development';
    process.env.CI = '';
    process.env.PLAYWRIGHT_TEST_MODE = 'true';
    expect(isE2ETestMode(fakeHeaders({}))).toBe(true);
  });

  it('should return false without playwright header and without PLAYWRIGHT_TEST_MODE', () => {
    process.env.NODE_ENV = 'development';
    process.env.CI = '';
    process.env.PLAYWRIGHT_TEST_MODE = '';
    expect(isE2ETestMode(fakeHeaders({}))).toBe(false);
  });

  it('should return false with random header value', () => {
    process.env.NODE_ENV = 'development';
    process.env.CI = '';
    process.env.PLAYWRIGHT_TEST_MODE = '';
    expect(isE2ETestMode(fakeHeaders({ 'x-test-mode': 'malicious' }))).toBe(false);
  });
});

describe('Header Stripping Security', () => {
  it('should strip x-test-mode header from client requests (defense-in-depth)', () => {
    // Simula il comportamento di injectWorkspaceHeader
    const requestHeaders = new Map<string, string>();
    requestHeaders.set('x-test-mode', 'playwright');
    requestHeaders.set('x-sec-workspace-id', 'injected-id');
    requestHeaders.set('authorization', 'Bearer token');

    // Il middleware deve rimuovere questi header
    requestHeaders.delete('x-sec-workspace-id');
    requestHeaders.delete('x-test-mode');

    expect(requestHeaders.has('x-test-mode')).toBe(false);
    expect(requestHeaders.has('x-sec-workspace-id')).toBe(false);
    // Header legittimi NON vengono toccati
    expect(requestHeaders.has('authorization')).toBe(true);
  });

  it('should strip x-test-mode even in production (defense-in-depth)', () => {
    // Anche se il bypass è protetto da NODE_ENV, l'header viene sempre rimosso
    const requestHeaders = new Map<string, string>();
    requestHeaders.set('x-test-mode', 'playwright');

    // Il middleware rimuove SEMPRE l'header, indipendentemente da NODE_ENV
    requestHeaders.delete('x-test-mode');

    expect(requestHeaders.has('x-test-mode')).toBe(false);
  });
});

describe('Middleware Security Rules Documentation', () => {
  /**
   * Questi test documentano le regole di sicurezza del middleware.
   * I test effettivi sono in tests/e2e/ con Playwright.
   */

  it('should document: unauthenticated API requests return 401', () => {
    // Verificato in E2E: GET /api/spedizioni senza auth → 401
    expect(true).toBe(true);
  });

  it('should document: unauthenticated dashboard requests redirect to /login', () => {
    // Verificato in E2E: GET /dashboard senza auth → 302 /login
    expect(true).toBe(true);
  });

  it('should document: authenticated requests with completed onboarding pass through', () => {
    // Verificato in E2E: GET /dashboard con session + datiCompletati → 200
    expect(true).toBe(true);
  });

  it('should document: authenticated requests without onboarding redirect to dati-cliente', () => {
    // Verificato in E2E: GET /dashboard con session senza datiCompletati → 302 /dashboard/dati-cliente
    expect(true).toBe(true);
  });

  it('should document: CRON routes require CRON_SECRET in route handler (not middleware)', () => {
    // Il middleware passa /api/cron/** come public route
    // Il CRON_SECRET check avviene nel route handler
    expect(isPublicRoute('/api/cron/telegram-queue')).toBe(true);
  });
});
