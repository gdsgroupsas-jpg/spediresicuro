/**
 * Centralizzazione logica E2E Test Mode
 *
 * Unico punto di verifica per il bypass E2E.
 * Usato da: auth-config.ts, workspace-auth.ts, api-middleware.ts, layout.tsx
 *
 * SICUREZZA:
 * - In produzione (NODE_ENV=production) il bypass è SEMPRE disabilitato
 * - Eccezione: CI=true o PLAYWRIGHT_TEST_MODE=true (ambienti controllati)
 * - L'header x-test-mode viene strippato dal middleware (defense-in-depth)
 */

/**
 * Verifica se siamo in modalità test E2E.
 *
 * Condizioni (tutte devono essere soddisfatte):
 * 1. Ambiente non-production OPPURE CI OPPURE PLAYWRIGHT_TEST_MODE
 * 2. Header x-test-mode=playwright OPPURE PLAYWRIGHT_TEST_MODE=true
 *
 * @param headers - Headers object (da next/headers o ReadonlyHeaders)
 * @returns true se il bypass E2E è attivo
 */
export function isE2ETestMode(headers: { get(name: string): string | null }): boolean {
  const isCI = process.env.CI === 'true';
  const isPlaywrightMode = process.env.PLAYWRIGHT_TEST_MODE === 'true';

  // Gate 1: solo ambienti non-production (o CI/Playwright espliciti)
  if (process.env.NODE_ENV === 'production' && !isCI && !isPlaywrightMode) {
    return false;
  }

  // Gate 2: header x-test-mode=playwright o env PLAYWRIGHT_TEST_MODE
  const testHeader = headers.get('x-test-mode');
  return testHeader === 'playwright' || isPlaywrightMode;
}
