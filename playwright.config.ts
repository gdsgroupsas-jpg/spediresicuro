import { defineConfig, devices } from '@playwright/test';
import * as path from 'path';
import { config as loadEnv } from 'dotenv';

// Carica .env.local per rendere disponibili le variabili E2E_RESELLER_EMAIL, ecc.
loadEnv({ path: path.join(__dirname, '.env.local'), override: false });

/**
 * Configurazione Playwright
 *
 * - globalSetup: login reale una volta per ogni account → storageState riusato da tutti i test
 * - Progetto 'chromium-reseller': sessione reseller (listini, spedizioni reseller)
 * - Progetto 'chromium-user': sessione utente normale (spedizioni, wallet)
 * - Progetto 'chromium-admin': sessione admin (gestione utenti, wallet admin)
 * - Progetto 'chromium': test con mock auth o pubblici
 * - CI=true: bypassa webServer, usa server esterno
 */

const AUTH_DIR = path.join(__dirname, 'e2e/auth/.auth');

export default defineConfig({
  testDir: './e2e',

  // Global setup: login reale prima di tutti i test (reseller + user + admin)
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
        storageState: path.join(AUTH_DIR, 'reseller.json'),
      },
      testMatch: [
        '**/reseller-price-lists.spec.ts',
        '**/sync-price-lists-optimized.spec.ts',
        '**/shipments-list.spec.ts',
        '**/shipment-detail.spec.ts',
      ],
    },
    {
      // Progetto con sessione utente normale reale (test E2E reali)
      name: 'chromium-user',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        storageState: path.join(AUTH_DIR, 'user.json'),
      },
      testMatch: ['**/e2e/real/shipment-create.spec.ts', '**/e2e/real/shipments-list-real.spec.ts'],
    },
    {
      // Progetto con sessione admin base (test wallet/accesso)
      name: 'chromium-admin',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        storageState: path.join(AUTH_DIR, 'admin.json'),
      },
      testMatch: ['**/e2e/real/wallet-topup.spec.ts'],
    },
    {
      // Progetto con sessione superadmin reale (admin@spediresicuro.it)
      // Accesso completo: gestione utenti, listini master, wallet admin, ecc.
      name: 'chromium-superadmin',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
        storageState: path.join(AUTH_DIR, 'superadmin.json'),
      },
      testMatch: ['**/e2e/real/admin-user-management.spec.ts'],
    },
    {
      // Progetto standard (test con mock auth o pubblici)
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1280, height: 720 },
      },
      // Tutti i test esclusi quelli dei progetti con sessione reale
      testIgnore: [
        '**/reseller-price-lists.spec.ts',
        '**/sync-price-lists-optimized.spec.ts',
        '**/shipments-list.spec.ts',
        '**/shipment-detail.spec.ts',
        '**/e2e/real/**',
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
