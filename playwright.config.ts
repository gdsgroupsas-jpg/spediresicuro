import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import { config as loadEnv } from 'dotenv';

// Carica .env.local per rendere disponibili le variabili E2E_RESELLER_EMAIL, ecc.
loadEnv({ path: path.join(__dirname, '.env.local'), override: false });

/**
 * Configurazione Playwright
 *
 * - globalSetup: login reale una volta → storageState riusato da tutti i test
 * - Progetto 'setup': esegue il login e salva la sessione
 * - Progetto 'chromium': usa la sessione salvata (storageState)
 * - CI=true: bypassa webServer, usa server esterno
 */

const AUTH_FILE = path.join(__dirname, 'e2e/auth/.auth/reseller.json');

export default defineConfig({
  testDir: './e2e',

  // Global setup: login reale prima di tutti i test
  globalSetup: './e2e/auth/global-setup.ts',

  // Timeout per ogni test
  timeout: 60 * 1000,

  expect: {
    timeout: 10 * 1000,
  },

  fullyParallel: false,
  workers: 1,

  retries: process.env.CI ? 2 : 0,

  reporter: process.env.CI ? [['html'], ['list']] : [['html'], ['list'], ['line']],

  use: {
    baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    navigationTimeout: 20 * 1000,
    actionTimeout: 10 * 1000,
    // x-test-mode mantenuto per i test che usano ancora il mock
    extraHTTPHeaders: {
      'x-test-mode': 'playwright',
    },
  },

  projects: [
    {
      // Progetto con sessione reseller reale
      name: 'chromium-reseller',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        // Usa la sessione salvata dal global setup
        storageState: AUTH_FILE,
      },
      // Solo i test che richiedono sessione reseller reale
      testMatch: [
        '**/reseller-price-lists.spec.ts',
        '**/sync-price-lists-optimized.spec.ts',
        '**/shipments-list.spec.ts',
        '**/shipment-detail.spec.ts',
      ],
    },
    {
      // Progetto standard (test con mock auth o pubblici)
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      // Tutti i test esclusi quelli del progetto reseller
      testIgnore: [
        '**/reseller-price-lists.spec.ts',
        '**/sync-price-lists-optimized.spec.ts',
        '**/shipments-list.spec.ts',
        '**/shipment-detail.spec.ts',
      ],
    },
  ],

  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000/api/health',
        reuseExistingServer: true,
        timeout: 120 * 1000,
        env: {
          PLAYWRIGHT_TEST_MODE: 'true',
          // Per i test chromium-reseller: l'utente test mock deve corrispondere al reseller reale
          TEST_USER_EMAIL:
            process.env.E2E_RESELLER_EMAIL || 'testspediresicuro+postaexpress@gmail.com',
        },
      },
});
