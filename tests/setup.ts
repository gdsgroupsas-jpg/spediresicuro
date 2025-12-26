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

// Esempio: Mock variabili d'ambiente se necessario
// process.env.NODE_ENV = 'test';

import { vi } from 'vitest';

/**
 * Mock globale di `next/server` per eseguire le route handler Next.js in Vitest (environment: node)
 * senza dipendere dal runtime Next.
 *
 * Requisiti:
 * - NextResponse.json(body, init) deve ritornare una Response reale (supporta await response.json()).
 * - NextResponse.next() deve ritornare Response status 200.
 * - Non deve crashare in import-time.
 */
vi.mock('next/server', () => {
  class NextRequest extends Request {}

  const NextResponse = {
    json: (body: unknown, init?: ResponseInit) => {
      const headers = new Headers(init?.headers);
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json; charset=utf-8');
      }
      return new Response(JSON.stringify(body), {
        ...init,
        status: init?.status ?? 200,
        headers,
      });
    },
    next: () => new Response(null, { status: 200 }),
  };

  return { NextRequest, NextResponse };
});

