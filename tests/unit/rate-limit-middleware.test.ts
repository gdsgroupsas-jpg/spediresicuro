/**
 * Test Rate Limit Middleware
 *
 * Verifica che il middleware wrapper sia correttamente integrato
 * e che le route critiche lo utilizzino.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const rootDir = resolve(__dirname, '../../');

function readSource(relativePath: string): string {
  return readFileSync(resolve(rootDir, relativePath), 'utf-8');
}

describe('Rate Limit Middleware - Struttura', () => {
  const source = readSource('lib/security/rate-limit-middleware.ts');

  it('importa rateLimit da rate-limit.ts', () => {
    expect(source).toContain("from '@/lib/security/rate-limit'");
  });

  it('importa auth da auth-config', () => {
    expect(source).toContain("from '@/lib/auth-config'");
  });

  it('esporta funzione withRateLimit', () => {
    expect(source).toContain('export async function withRateLimit');
  });

  it('supporta feature flag RATE_LIMIT_ENABLED', () => {
    expect(source).toContain('RATE_LIMIT_ENABLED');
    expect(source).toContain("=== 'false'");
  });

  it('ritorna 429 con headers corretti quando rate limit superato', () => {
    expect(source).toContain('status: 429');
    expect(source).toContain('Retry-After');
    expect(source).toContain('X-RateLimit-Remaining');
  });

  it('e fail-open: non blocca mai per errori interni', () => {
    expect(source).toContain('catch (error)');
    expect(source).toContain('return null');
  });

  it('identifica utente da session con fallback su x-forwarded-for', () => {
    expect(source).toContain('x-forwarded-for');
    expect(source).toContain("'anonymous'");
  });
});

describe('Rate Limit - Applicazione Route Critiche', () => {
  it('POST /api/spedizioni ha rate limit (60/min)', () => {
    const source = readSource('app/api/spedizioni/route.ts');
    expect(source).toContain("withRateLimit(request, 'spedizioni-create'");
    expect(source).toContain('limit: 60');
  });

  it('POST /api/quotes/db ha rate limit (120/min)', () => {
    const source = readSource('app/api/quotes/db/route.ts');
    expect(source).toContain("withRateLimit(request, 'quotes-db'");
    expect(source).toContain('limit: 120');
  });

  it('POST /api/auth/register ha rate limit (5/min)', () => {
    const source = readSource('app/api/auth/register/route.ts');
    expect(source).toContain("withRateLimit(request, 'auth-register'");
    expect(source).toContain('limit: 5');
  });

  it('POST /api/ai/agent-chat ha rate limit (gia implementato inline)', () => {
    const source = readSource('app/api/ai/agent-chat/route.ts');
    expect(source).toContain("rateLimit('agent-chat'");
  });
});
