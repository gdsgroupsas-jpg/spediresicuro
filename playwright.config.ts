import { defineConfig, devices } from '@playwright/test';

/**
 * Configurazione Playwright ottimizzata per CI (headless)
 *
 * Questa configurazione è pensata per:
 * - Eseguire test in modalità headless (CI/CD)
 * - Timeout generosi per gestire Next.js SSR/hydration
 * - Retry automatico per flaky tests
 * - Screenshot e video su failure
 */
export default defineConfig({
  // Directory dove sono i test
  testDir: './e2e',

  // Timeout per ogni test (60 secondi - aumentato per gestire login e form complesso)
  timeout: 60 * 1000,

  // Timeout per le assertion (10 secondi)
  expect: {
    timeout: 10 * 1000,
  },

  // Esegui test in parallelo (massimo 1 worker per evitare conflitti con DB)
  fullyParallel: false,
  workers: 1,

  // Retry automatico su failure (massimo 2 retry)
  retries: process.env.CI ? 2 : 0,

  // Reporter per CI
  reporter: process.env.CI ? [['html'], ['list']] : [['html'], ['list'], ['line']],

  // Configurazione condivisa per tutti i progetti
  use: {
    // Base URL dell'applicazione (usa variabile d'ambiente o default)
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',

    // Headless mode (sempre in CI, opzionale in locale)
    headless: process.env.CI ? true : true,

    // Screenshot su failure
    screenshot: 'only-on-failure',

    // Video su failure
    video: 'retain-on-failure',

    // Trace su failure (utile per debug)
    trace: 'retain-on-failure',

    // Timeout per navigazione (20 secondi)
    navigationTimeout: 20 * 1000,

    // Timeout per azioni (10 secondi)
    actionTimeout: 10 * 1000,

    // Imposta variabile d'ambiente per bypassare autenticazione in test
    extraHTTPHeaders: {
      'x-test-mode': 'playwright',
    },
  },

  // Configurazione progetti (browser)
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Viewport realistico
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  // Server di sviluppo Next.js (se necessario)
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000, // 2 minuti per avviare il server
        env: {
          PLAYWRIGHT_TEST_MODE: 'true', // Bypassa autenticazione in test
        },
      },
});
