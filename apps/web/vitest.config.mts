import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // Silenzio i log durante i test per output pulito
    silent: false,
    // Reporter più pulito
    reporters: ['default'],
    // Timeout ragionevole per test
    testTimeout: 10000,
    hookTimeout: 10000,
    // Escludi test e2e (sono per Playwright) e middleware.test.ts (problemi con next-auth in vitest)
    exclude: [
      '**/node_modules/**',
      '**/e2e/**',
      '**/dist/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'middleware.test.ts', // Escluso: problemi con next-auth in vitest, testato con e2e
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.test.ts',
        '**/*.spec.ts',
        '**/*.config.ts',
        'e2e/',
        'scripts/',
      ],
      // Coverage thresholds (enforced in CI)
      thresholds: {
        lines: 70,
        functions: 65,
        branches: 60,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
  // Evita warning CJS deprecated
  esbuild: {
    target: 'node18',
  },
});

