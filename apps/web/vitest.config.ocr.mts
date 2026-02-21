/**
 * Vitest Config: OCR Vision Tests (Isolati)
 * 
 * Configurazione specifica per eseguire SOLO test OCR Vision
 * in modo completamente isolato, senza dipendenze esterne.
 * 
 * Uso: npx vitest run --config vitest.config.ocr.ts
 */

import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Setup specifico per mock isolati
    setupFiles: ['./tests/setup-ocr-isolated.ts'],
    // Include SOLO il file ocr-vision.test.ts
    include: ['tests/unit/ocr-vision.test.ts'],
    // Timeout generoso per evitare flaky
    testTimeout: 10000,
    // Isolamento completo
    isolate: true,
    // Disabilita parallelismo per test deterministici (Vitest 4.x syntax)
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});

