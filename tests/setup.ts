/**
 * Vitest Setup File
 *
 * File di setup globale per i test Vitest.
 * Viene eseguito prima di ogni test suite.
 *
 * Usa questo file per:
 * - Configurare variabili d'ambiente di test
 * - Mockare moduli globali
 * - Setup/teardown globale
 */

// ⚠️ IMPORTANTE: Carica variabili d'ambiente PRIMA di qualsiasi import
// Questo assicura che i moduli che leggono process.env abbiano i valori corretti
import * as dotenv from 'dotenv';
import { resolve } from 'node:path';

// Silenzio log verbosi durante i test (solo in CI o se esplicito)
const SILENT_TEST_LOGS = process.env.CI === 'true' || process.env.VITEST_SILENT === 'true';

// Carica .env.local se esiste
try {
  const envPath = resolve(process.cwd(), '.env.local');
  dotenv.config({ path: envPath });
  if (!SILENT_TEST_LOGS) {
    console.log("✅ Variabili d'ambiente caricate da .env.local");
  }
} catch (error) {
  // Ignora errori, le variabili potrebbero essere già configurate
}

// Mock console per silenziare warning attesi durante i test
if (SILENT_TEST_LOGS) {
  const originalWarn = console.warn;
  const originalError = console.error;

  console.warn = (...args: unknown[]) => {
    const msg = String(args[0] || '');
    // Silenzio warning attesi durante i test
    if (
      msg.includes('[RATE-LIMIT]') ||
      msg.includes('[Booking]') ||
      msg.includes('[PlatformFee]') ||
      msg.includes('[Value Stats]') ||
      msg.includes('[Pricing Graph]')
    ) {
      return;
    }
    originalWarn.apply(console, args);
  };

  console.error = (...args: unknown[]) => {
    const msg = String(args[0] || '');
    // Silenzio errori attesi durante i test (mock/fallback)
    if (
      msg.includes('PGRST202') ||
      msg.includes('PGRST205') ||
      msg.includes('get_platform_fee') ||
      msg.includes('Errore recupero corrieri')
    ) {
      return;
    }
    originalError.apply(console, args);
  };
}

import { vi } from 'vitest';

/**
 * Mock globale di `next/server` per eseguire le route handler Next.js in Vitest (environment: node)
 * senza dipendere dal runtime Next.
 *
 * Requisiti:
 * - NextResponse.json(body, init) deve ritornare una Response reale (supporta await response.json()).
 * - NextResponse.next() deve ritornare Response status 200.
 * - Non deve crashare in import-time.
 * - Deve gestire anche l'import da next-auth che cerca next/server
 */
vi.mock('next/server', async () => {
  class NextRequest extends Request {}

  class NextResponse extends Response {
    static json(body: unknown, init?: ResponseInit) {
      const headers = new Headers(init?.headers);
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json; charset=utf-8');
      }
      return new Response(JSON.stringify(body), {
        ...init,
        status: init?.status ?? 200,
        headers,
      });
    }
    static next() {
      return new Response(null, { status: 200 });
    }
    static redirect(url: string | URL) {
      return new Response(null, { status: 307, headers: { Location: String(url) } });
    }
  }

  return { NextRequest, NextResponse };
});

/**
 * Mock anche per next/server.js (variante che next-auth potrebbe cercare)
 */
vi.mock('next/server.js', async () => {
  class NextRequest extends Request {}

  class NextResponse extends Response {
    static json(body: unknown, init?: ResponseInit) {
      const headers = new Headers(init?.headers);
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json; charset=utf-8');
      }
      return new Response(JSON.stringify(body), {
        ...init,
        status: init?.status ?? 200,
        headers,
      });
    }
    static next() {
      return new Response(null, { status: 200 });
    }
    static redirect(url: string | URL) {
      return new Response(null, { status: 307, headers: { Location: String(url) } });
    }
  }

  return { NextRequest, NextResponse };
});

/**
 * Mock di next-auth per evitare problemi con next/server durante i test
 * Questo previene l'import di next/server da parte di next-auth/lib/env.js
 */
vi.mock('next-auth', () => {
  return {
    default: vi.fn(() => ({
      auth: vi.fn(),
      handlers: {
        GET: vi.fn(),
        POST: vi.fn(),
      },
    })),
  };
});
