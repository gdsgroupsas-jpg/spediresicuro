/**
 * Test Log Levels - FASE 1.2 Audit Enterprise
 *
 * Verifica che i file critici usano console.debug per dettagli tecnici
 * e non console.log per informazioni di routine.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const rootDir = resolve(__dirname, '../../');

function readSource(relativePath: string): string {
  return readFileSync(resolve(rootDir, relativePath), 'utf-8');
}

describe('Log Levels - factory.ts', () => {
  const source = readSource('lib/couriers/factory.ts');

  it('usa console.debug per dettagli tecnici (config loaded, mapping, decrypt)', () => {
    // Tutti i log informativi di routine devono essere debug
    // Nota: alcuni sono multilinea (console.debug(\n  `...`))
    expect(source).toContain('🔍 [FACTORY] Fallback query');
    expect(source).toContain('console.debug(`✅ [FACTORY] Trovata config personale');
    expect(source).toContain('console.debug(`✅ [FACTORY] Trovata config assegnata');
    expect(source).toContain('console.debug(`ℹ️ [FACTORY] Nessuna config personale');
    expect(source).toContain("console.debug('🔐 [FACTORY] API key");
    expect(source).toContain('console.debug(`🔑 [FACTORY] Spedisci.Online config loaded');

    // Verifica che la Fallback query usi console.debug (multilinea)
    const fallbackIdx = source.indexOf('🔍 [FACTORY] Fallback query');
    const precedingChunk = source.substring(Math.max(0, fallbackIdx - 50), fallbackIdx);
    expect(precedingChunk).toContain('console.debug');
  });

  it('mantiene console.warn per anomalie (accesso negato, config non trovata)', () => {
    expect(source).toContain('console.warn(');
  });

  it('mantiene console.error per errori critici', () => {
    expect(source).toContain('console.error(');
  });

  it('non ha console.log per dettagli tecnici di routine', () => {
    // Verifica che non ci siano console.log con i pattern di routine
    const lines = source.split('\n');
    const routineLogPatterns = [
      /console\.log.*\[FACTORY\].*Fallback query/,
      /console\.log.*\[FACTORY\].*Trovata config/,
      /console\.log.*\[FACTORY\].*config loaded/,
      /console\.log.*\[FACTORY\].*criptata/,
      /console\.log.*\[FACTORY\].*Contract mapping/,
    ];

    for (const pattern of routineLogPatterns) {
      const matchingLines = lines.filter((line) => pattern.test(line));
      expect(matchingLines).toHaveLength(0);
    }
  });
});

describe('Log Levels - encryption.ts', () => {
  const source = readSource('lib/security/encryption.ts');

  it('usa console.debug per decrypt riuscito', () => {
    expect(source).toContain('console.debug(`✅ [ENCRYPTION] Decrypt riuscito (chiave corrente)');
    expect(source).toContain('console.debug(`✅ [ENCRYPTION] Decrypt riuscito (chiave legacy)');
  });

  it('mantiene console.warn per credenziali non criptate e legacy warning', () => {
    expect(source).toContain('console.warn(');
  });

  it('mantiene console.error per errori di decriptazione', () => {
    expect(source).toContain('console.error(');
  });

  it('non ha console.log per decrypt success di routine', () => {
    const lines = source.split('\n');
    const routineLogPatterns = [/console\.log.*\[ENCRYPTION\].*Decrypt riuscito/];

    for (const pattern of routineLogPatterns) {
      const matchingLines = lines.filter((line) => pattern.test(line));
      expect(matchingLines).toHaveLength(0);
    }
  });
});
