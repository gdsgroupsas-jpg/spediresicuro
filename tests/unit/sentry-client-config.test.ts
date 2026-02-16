/**
 * Test Sentry Client Config - FASE 1.3 Audit Enterprise
 *
 * Verifica che il file sentry.client.config.ts esista e abbia
 * le configurazioni corrette per performance monitoring e replay.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const rootDir = resolve(__dirname, '../../');

function readSource(relativePath: string): string {
  return readFileSync(resolve(rootDir, relativePath), 'utf-8');
}

describe('Sentry Client Config - Struttura', () => {
  const configPath = resolve(rootDir, 'sentry.client.config.ts');

  it('il file esiste', () => {
    expect(existsSync(configPath)).toBe(true);
  });

  it('importa e inizializza Sentry', () => {
    const source = readSource('sentry.client.config.ts');
    expect(source).toContain("import * as Sentry from '@sentry/nextjs'");
    expect(source).toContain('Sentry.init(');
  });

  it('usa NEXT_PUBLIC_SENTRY_DSN (client-side)', () => {
    const source = readSource('sentry.client.config.ts');
    expect(source).toContain('NEXT_PUBLIC_SENTRY_DSN');
  });

  it('ha tracesSampleRate configurato (< server per volume)', () => {
    const source = readSource('sentry.client.config.ts');
    expect(source).toContain('tracesSampleRate');
    // Client sample rate deve essere <= 0.1 (meno del server)
    expect(source).toContain('0.05');
  });

  it('ha replay configurato per cattura errori', () => {
    const source = readSource('sentry.client.config.ts');
    expect(source).toContain('replaysOnErrorSampleRate');
    expect(source).toContain('replaysSessionSampleRate');
  });

  it('ignora errori di browser noise', () => {
    const source = readSource('sentry.client.config.ts');
    expect(source).toContain('ignoreErrors');
    expect(source).toContain('ResizeObserver');
    expect(source).toContain('AbortError');
  });

  it('ha environment e release configurati', () => {
    const source = readSource('sentry.client.config.ts');
    expect(source).toContain('environment');
    expect(source).toContain('release');
  });
});

describe('Sentry Config - Coerenza Server/Client', () => {
  it('sia server che client hanno environment e release', () => {
    const server = readSource('sentry.server.config.ts');
    const client = readSource('sentry.client.config.ts');

    expect(server).toContain('environment');
    expect(client).toContain('environment');
    expect(server).toContain('release');
    expect(client).toContain('release');
  });

  it('server usa SENTRY_DSN, client usa NEXT_PUBLIC_SENTRY_DSN', () => {
    const server = readSource('sentry.server.config.ts');
    const client = readSource('sentry.client.config.ts');

    // Server usa SENTRY_DSN (server-side only)
    expect(server).toContain('SENTRY_DSN');
    // Client usa NEXT_PUBLIC_SENTRY_DSN (esposto al browser)
    expect(client).toContain('NEXT_PUBLIC_SENTRY_DSN');
  });
});
