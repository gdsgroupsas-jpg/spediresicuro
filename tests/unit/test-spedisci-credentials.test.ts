/**
 * Test: Fix URL test credenziali Spedisci.Online
 *
 * Verifica che testSpedisciOnlineCredentials costruisca l'URL correttamente:
 * - NON usa /v1/auth/test (endpoint inesistente → 404)
 * - Usa POST /shipping/rates (endpoint reale con payload minimo)
 * - Gestisce correttamente base_url con e senza /api/v2
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const FILE_PATH = path.join(process.cwd(), 'lib/integrations/carrier-configs-compat.ts');

describe('testSpedisciOnlineCredentials URL construction', () => {
  let content: string;

  it('il file esiste', () => {
    expect(fs.existsSync(FILE_PATH)).toBe(true);
    content = fs.readFileSync(FILE_PATH, 'utf-8');
  });

  it('NON usa /v1/auth/test (endpoint inesistente)', () => {
    // Vecchio codice faceva: `${baseUrl}/v1/auth/test` → 404 con base_url che contiene /api/v2
    expect(content).not.toContain('/v1/auth/test');
  });

  it('usa /shipping/rates come endpoint di test', () => {
    // L'unico endpoint leggero disponibile nell'API Spedisci.Online
    expect(content).toContain('/shipping/rates');
  });

  it('gestisce base_url con /api/v2 senza duplicare il path', () => {
    // Se base_url include /api/v2 → aggiunge solo /shipping/rates
    // Se non lo include → aggiunge /api/v2/shipping/rates
    expect(content).toContain("rawBaseUrl.includes('/api/v2')");
    expect(content).toContain('`${rawBaseUrl}/shipping/rates`');
    expect(content).toContain('`${rawBaseUrl}/api/v2/shipping/rates`');
  });

  it('usa metodo POST (non GET)', () => {
    // /shipping/rates è un endpoint POST secondo la specifica OpenAPI
    const testFn = content.substring(
      content.indexOf('async function testSpedisciOnlineCredentials'),
      content.indexOf('async function testPosteCredentials')
    );
    expect(testFn).toContain("method: 'POST'");
    expect(testFn).not.toContain("method: 'GET'");
  });

  it('invia payload minimo per validare le credenziali', () => {
    const testFn = content.substring(
      content.indexOf('async function testSpedisciOnlineCredentials'),
      content.indexOf('async function testPosteCredentials')
    );
    expect(testFn).toContain('packages');
    expect(testFn).toContain('shipFrom');
    expect(testFn).toContain('shipTo');
    expect(testFn).toContain('JSON.stringify(testPayload)');
  });

  it('normalizza trailing slash dalla base_url', () => {
    // Rimuove trailing slash per evitare doppi slash nell'URL
    expect(content).toContain(".replace(/\\/$/, '')");
  });

  it('gestisce errore 401 (API key non valida)', () => {
    const testFn = content.substring(
      content.indexOf('async function testSpedisciOnlineCredentials'),
      content.indexOf('async function testPosteCredentials')
    );
    expect(testFn).toContain('response.status === 401');
    expect(testFn).toContain('API key non valida');
  });

  it('gestisce errore 403 (accesso negato)', () => {
    const testFn = content.substring(
      content.indexOf('async function testSpedisciOnlineCredentials'),
      content.indexOf('async function testPosteCredentials')
    );
    expect(testFn).toContain('response.status === 403');
    expect(testFn).toContain('Accesso negato');
  });

  it('verifica Content-Type JSON per evitare false positive', () => {
    // Spedisci.Online restituisce HTML 200 (pagina login) con API key invalida
    const testFn = content.substring(
      content.indexOf('async function testSpedisciOnlineCredentials'),
      content.indexOf('async function testPosteCredentials')
    );
    expect(testFn).toContain('content-type');
    expect(testFn).toContain('application/json');
    expect(testFn).toContain('Risposta non JSON');
  });
});

/**
 * Test: Fix encryption key .trim()
 *
 * Verifica che getEncryptionKey() faccia .trim() sull'env var
 * per prevenire mismatch da \r\n (Windows / copia-incolla Vercel)
 */
describe('getEncryptionKey .trim() safety', () => {
  const ENCRYPTION_FILE = path.join(process.cwd(), 'lib/security/encryption.ts');
  let encContent: string;

  it('il file encryption esiste', () => {
    expect(fs.existsSync(ENCRYPTION_FILE)).toBe(true);
    encContent = fs.readFileSync(ENCRYPTION_FILE, 'utf-8');
  });

  it('getEncryptionKey fa .trim() sulla env var', () => {
    // Previene il bug: ENCRYPTION_KEY con \r\n → 66 chars → scrypt path → chiave sbagliata
    expect(encContent).toContain('process.env.ENCRYPTION_KEY?.trim()');
  });

  it('getLegacyEncryptionKey supporta prefisso raw: per chiave master diretta', () => {
    // Permette di salvare il master key derivato direttamente, senza ri-derivazione
    expect(encContent).toContain("envKey.startsWith('raw:')");
    expect(encContent).toContain('envKey.substring(4)');
  });

  it('encryptCredential usa .trim() nel check fail-closed', () => {
    // Anche il check "ENCRYPTION_KEY non configurata" deve usare trim
    expect(encContent).toContain('!process.env.ENCRYPTION_KEY?.trim()');
  });
});
