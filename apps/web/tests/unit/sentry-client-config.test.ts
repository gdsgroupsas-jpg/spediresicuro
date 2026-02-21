/**
 * Test Sentry Client Config - FASE 1.3 Audit Enterprise
 *
 * Verifica che instrumentation-client.ts (sostituto di sentry.client.config.ts)
 * abbia le configurazioni corrette per performance monitoring e replay.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const rootDir = resolve(__dirname, '../../');

function readSource(relativePath: string): string {
  return readFileSync(resolve(rootDir, relativePath), 'utf-8');
}

// File migrato da sentry.client.config.ts a instrumentation-client.ts (Next.js 15+)
const CLIENT_CONFIG = 'instrumentation-client.ts';

describe('Sentry Client Config - Struttura', () => {
  const configPath = resolve(rootDir, CLIENT_CONFIG);

  it('il file esiste (instrumentation-client.ts)', () => {
    expect(existsSync(configPath)).toBe(true);
  });

  it('il vecchio sentry.client.config.ts NON esiste (deprecato)', () => {
    expect(existsSync(resolve(rootDir, 'sentry.client.config.ts'))).toBe(false);
  });

  it('importa e inizializza Sentry', () => {
    const source = readSource(CLIENT_CONFIG);
    expect(source).toContain("import * as Sentry from '@sentry/nextjs'");
    expect(source).toContain('Sentry.init(');
  });

  it('usa NEXT_PUBLIC_SENTRY_DSN (client-side)', () => {
    const source = readSource(CLIENT_CONFIG);
    expect(source).toContain('NEXT_PUBLIC_SENTRY_DSN');
  });

  it('ha tracesSampleRate configurato', () => {
    const source = readSource(CLIENT_CONFIG);
    expect(source).toContain('tracesSampleRate');
  });

  it('ha replay configurato per cattura errori', () => {
    const source = readSource(CLIENT_CONFIG);
    expect(source).toContain('replaysOnErrorSampleRate');
    expect(source).toContain('replaysSessionSampleRate');
  });

  it('ha environment configurato', () => {
    const source = readSource(CLIENT_CONFIG);
    expect(source).toContain('environment');
  });

  it('ha integrations browser tracing e replay', () => {
    const source = readSource(CLIENT_CONFIG);
    expect(source).toContain('browserTracingIntegration');
    expect(source).toContain('replayIntegration');
  });

  it('ha maskAllText e blockAllMedia per privacy replay', () => {
    const source = readSource(CLIENT_CONFIG);
    expect(source).toContain('maskAllText: true');
    expect(source).toContain('blockAllMedia: true');
  });
});

describe('Sentry Config - Coerenza Server/Client', () => {
  it('sia server che client hanno environment', () => {
    const server = readSource('sentry.server.config.ts');
    const client = readSource(CLIENT_CONFIG);

    expect(server).toContain('environment');
    expect(client).toContain('environment');
  });

  it('server usa SENTRY_DSN, client usa NEXT_PUBLIC_SENTRY_DSN', () => {
    const server = readSource('sentry.server.config.ts');
    const client = readSource(CLIENT_CONFIG);

    // Server usa SENTRY_DSN (server-side only)
    expect(server).toContain('SENTRY_DSN');
    // Client usa NEXT_PUBLIC_SENTRY_DSN (esposto al browser)
    expect(client).toContain('NEXT_PUBLIC_SENTRY_DSN');
  });
});
