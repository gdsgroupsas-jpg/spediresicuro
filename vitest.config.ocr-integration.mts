/**
 * Vitest Config: OCR Vision Integration Tests
 * 
 * Configurazione per integration test OCR che:
 * - Richiedono GOOGLE_API_KEY reale
 * - Usano immagini fixture
 * - NON dipendono da Supabase
 * 
 * Uso: npm run test:ocr:integration
 * 
 * ⚠️ Se GOOGLE_API_KEY manca: test skipped con messaggio esplicito
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
    // Setup specifico per integration (mocka Supabase ma non Vision)
    setupFiles: ['./tests/setup-ocr-integration.ts'],
    // Include SOLO file integration
    include: ['tests/integration/ocr-vision.integration.test.ts'],
    // Timeout lungo per chiamate API reali
    testTimeout: 60000,
    // Hook timeout per setup/teardown
    hookTimeout: 30000,
    // Isolamento
    isolate: true,
    // Disabilita parallelismo (chiamate API sequenziali per evitare rate limit)
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});

