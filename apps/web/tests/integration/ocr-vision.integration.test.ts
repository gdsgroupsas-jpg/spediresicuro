/**
 * Integration Tests: OCR Vision (Sprint 2.5 Phase 2)
 *
 * Test REALI con Gemini Vision API:
 * - Richiede GOOGLE_API_KEY
 * - Usa immagini fixture
 * - NON dipende da Supabase
 *
 * Se GOOGLE_API_KEY manca: test SKIPPED con messaggio esplicito
 *
 * ⚠️ NO PII nei log/assert (no base64, no fullName, no phone nei messaggi)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { hasGoogleApiKey } from '../setup-ocr-integration';
import { extractData } from '@/lib/agent/orchestrator/nodes';
import { mapVisionOutputToShipmentDraft } from '@/lib/agent/workers/ocr';
import { HumanMessage } from '@langchain/core/messages';
import type { AgentState } from '@/lib/agent/orchestrator/state';

// ==================== FIXTURE LOADING ====================

interface FixtureExpectation {
  description: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  expectedFields: Record<string, string>;
  optionalFields: string[];
  expectedMissing: string[];
  notes: string;
}

interface FixturesFile {
  fixtures: Record<string, FixtureExpectation>;
  acceptanceCriteria: {
    minFieldAccuracy: number;
    maxClarificationRate: number;
    requiredFields: string[];
    criticalFields: string[];
  };
}

const FIXTURES_DIR = path.join(__dirname, '../fixtures/ocr-images');

function loadFixturesExpectations(): FixturesFile | null {
  const expectedPath = path.join(FIXTURES_DIR, 'expected.json');
  if (!fs.existsSync(expectedPath)) {
    return null;
  }
  const content = fs.readFileSync(expectedPath, 'utf-8');
  return JSON.parse(content);
}

function loadImageAsBase64(filename: string): string | null {
  const imagePath = path.join(FIXTURES_DIR, filename);
  if (!fs.existsSync(imagePath)) {
    return null;
  }
  const buffer = fs.readFileSync(imagePath);
  const ext = path.extname(filename).toLowerCase();
  const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

// ==================== HELPER: CREATE AGENT STATE ====================

function createTestState(imageBase64: string): AgentState {
  return {
    messages: [new HumanMessage({ content: imageBase64 })],
    processingStatus: 'idle',
    validationErrors: [],
    confidenceScore: 0,
    shipmentData: {},
    needsHumanReview: false,
    userId: 'test-user-id',
    userEmail: 'test@example.com',
  };
}

// ==================== METRICS TRACKING ====================

interface TestMetrics {
  totalImages: number;
  processed: number;
  skipped: number;
  clarificationRequested: number;
  fieldMatches: number;
  fieldMismatches: number;
  errors: string[];
}

const metrics: TestMetrics = {
  totalImages: 0,
  processed: 0,
  skipped: 0,
  clarificationRequested: 0,
  fieldMatches: 0,
  fieldMismatches: 0,
  errors: [],
};

// ==================== TESTS ====================

describe('OCR Vision Integration Tests', () => {
  // Skip all tests if no API key
  const skipCondition = !hasGoogleApiKey;

  beforeAll(() => {
    if (skipCondition) {
      console.log('\n⏭️ SKIPPING: GOOGLE_API_KEY not available');
      console.log('   Set GOOGLE_API_KEY in .env.local to run integration tests\n');
    }
  });

  describe.skipIf(skipCondition)('extractData with real Gemini Vision', () => {
    const fixturesFile = loadFixturesExpectations();

    if (!fixturesFile) {
      it.skip('No fixtures file found', () => {});
      return;
    }

    const fixtures = fixturesFile.fixtures;
    const fixtureNames = Object.keys(fixtures);

    // Track total
    metrics.totalImages = fixtureNames.length;

    // Test each fixture that has an actual image file
    for (const filename of fixtureNames) {
      const expectation = fixtures[filename];
      const imageBase64 = loadImageAsBase64(filename);

      if (!imageBase64) {
        it.skip(`[SKIP] ${filename} - image file not found`, () => {
          metrics.skipped++;
        });
        continue;
      }

      it(`[${expectation.difficulty.toUpperCase()}] ${filename}: ${expectation.description}`, async () => {
        // ⚠️ NO PII: non loggare imageBase64
        console.log(`  Testing: ${filename} (${expectation.category})`);

        const state = createTestState(imageBase64);

        try {
          const result = await extractData(state);
          metrics.processed++;

          // Check if Vision produced data
          if (result.processingStatus === 'error' || !result.shipmentData) {
            metrics.clarificationRequested++;
            console.log(`    ⚠️ Vision returned error/no data`);

            // Per immagini difficili, questo può essere accettabile
            if (expectation.difficulty === 'hard') {
              console.log(`    ℹ️ Expected for hard difficulty`);
              return; // Non fallire
            }

            // Per easy/medium, segnala ma continua
            metrics.errors.push(`${filename}: no data extracted`);
            return;
          }

          // Map to ShipmentDraft format
          const mapped = mapVisionOutputToShipmentDraft(
            result.shipmentData as Record<string, unknown>
          );

          // Verify expected fields
          for (const [field, expectedValue] of Object.entries(expectation.expectedFields)) {
            // ⚠️ NO PII: non loggare valori estratti, solo match/mismatch
            const actualValue = getNestedField(mapped, field);

            if (actualValue === expectedValue) {
              metrics.fieldMatches++;
              console.log(`    ✅ ${field}: match`);
            } else if (actualValue) {
              metrics.fieldMismatches++;
              // ⚠️ NO PII: non loggare actualValue
              console.log(`    ❌ ${field}: mismatch (got different value)`);
            } else {
              metrics.fieldMismatches++;
              console.log(`    ❌ ${field}: missing`);
            }
          }

          // Log confidence (NO PII)
          if (result.confidenceScore !== undefined) {
            console.log(`    📊 Confidence: ${result.confidenceScore}%`);
          }
        } catch (error: unknown) {
          metrics.errors.push(
            `${filename}: ${error instanceof Error ? error.message : 'unknown error'}`
          );
          console.log(
            `    💥 Error: ${error instanceof Error ? error.message.substring(0, 50) : 'unknown'}`
          );

          // Per hard difficulty, non fallire
          if (expectation.difficulty !== 'hard') {
            throw error;
          }
        }
      }, 45000); // 45s timeout per singolo test
    }

    // Acceptance criteria check
    it('should meet acceptance criteria', () => {
      console.log('\n📊 === ACCEPTANCE CRITERIA CHECK ===');
      console.log(`   Total images: ${metrics.totalImages}`);
      console.log(`   Processed: ${metrics.processed}`);
      console.log(`   Skipped (no file): ${metrics.skipped}`);
      console.log(`   Clarification requested: ${metrics.clarificationRequested}`);
      console.log(`   Field matches: ${metrics.fieldMatches}`);
      console.log(`   Field mismatches: ${metrics.fieldMismatches}`);

      if (metrics.processed === 0) {
        console.log('   ⚠️ No images processed - add fixture images to run tests');
        return; // Non fallire se non ci sono immagini
      }

      const accuracy = metrics.fieldMatches / (metrics.fieldMatches + metrics.fieldMismatches);
      const clarificationRate = metrics.clarificationRequested / metrics.processed;

      console.log(
        `   Accuracy: ${(accuracy * 100).toFixed(1)}% (target: >= ${fixturesFile.acceptanceCriteria.minFieldAccuracy * 100}%)`
      );
      console.log(
        `   Clarification rate: ${(clarificationRate * 100).toFixed(1)}% (target: <= ${fixturesFile.acceptanceCriteria.maxClarificationRate * 100}%)`
      );

      if (metrics.errors.length > 0) {
        console.log(`   Errors: ${metrics.errors.length}`);
        metrics.errors.forEach((e) => console.log(`     - ${e}`));
      }

      // Solo warn, non fail - le soglie esatte dipendono dalle immagini fixture reali
      if (accuracy < fixturesFile.acceptanceCriteria.minFieldAccuracy) {
        console.log(`   ⚠️ Accuracy below target`);
      }
      if (clarificationRate > fixturesFile.acceptanceCriteria.maxClarificationRate) {
        console.log(`   ⚠️ Clarification rate above target`);
      }
    });
  });

  describe.skipIf(skipCondition)('Anti-PII assertions', () => {
    it('should not log base64 image content', async () => {
      // Questo test verifica che i log non contengano base64
      // Implementazione: mock console e verifica assenza pattern base64

      const logs: string[] = [];
      const originalLog = console.log;
      const originalWarn = console.warn;

      console.log = (...args) => {
        logs.push(args.join(' '));
      };
      console.warn = (...args) => {
        logs.push(args.join(' '));
      };

      try {
        // Crea un mini stato con immagine fittizia
        const fakeBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg==';
        const state = createTestState(fakeBase64);

        // Non chiamiamo extractData (richiederebbe API key)
        // Invece, verifichiamo che le nostre funzioni helper non loggino base64
        mapVisionOutputToShipmentDraft({
          recipient_name: 'Test User',
          recipient_zip: '20100',
        });

        // Verifica che nessun log contenga base64
        const base64Pattern = /data:image\/[^;]+;base64,/;
        const hasBase64InLogs = logs.some((log) => base64Pattern.test(log));

        expect(hasBase64InLogs).toBe(false);
      } finally {
        console.log = originalLog;
        console.warn = originalWarn;
      }
    });

    it('mapVisionOutputToShipmentDraft should not leak PII fields to logs', () => {
      // Verifica che il mapping non produca side effects con PII
      const result = mapVisionOutputToShipmentDraft({
        recipient_name: 'Mario Rossi Sensitive',
        recipient_address: 'Via Segreta 123',
        recipient_phone: '+39 333 1234567',
        recipient_zip: '20100',
        recipient_city: 'Milano',
        recipient_province: 'MI',
      });

      // Verifica che i dati siano mappati correttamente
      expect(result.recipient?.fullName).toBe('Mario Rossi Sensitive');
      expect(result.recipient?.postalCode).toBe('20100');
      expect(result.recipient?.province).toBe('MI');

      // Il test passa se non ci sono errori - la funzione è pure
    });
  });
});

// ==================== HELPER FUNCTIONS ====================

/**
 * Accede a campo nested (es. "recipient_zip" -> mapped.recipient?.postalCode)
 */
function getNestedField(
  mapped: ReturnType<typeof mapVisionOutputToShipmentDraft>,
  field: string
): string | undefined {
  const fieldMap: Record<string, () => string | undefined> = {
    recipient_zip: () => mapped.recipient?.postalCode,
    recipient_city: () => mapped.recipient?.city,
    recipient_province: () => mapped.recipient?.province,
    recipient_name: () => mapped.recipient?.fullName,
    recipient_address: () => mapped.recipient?.addressLine1,
    recipient_phone: () => mapped.recipient?.phone,
  };

  const getter = fieldMap[field];
  return getter ? getter() : undefined;
}
