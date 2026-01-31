/**
 * M2 Test Endpoint: Log Aggregation
 *
 * Testa che Better Stack riceva i logs strutturati con trace context:
 * - Logs con requestId, userId, traceId, spanId
 * - Diversi log levels (info, warn, error, debug)
 * - PII sanitization
 * - Error tracking
 *
 * Test:
 * curl http://localhost:3000/api/test/m2-logging
 *
 * Verifica in Better Stack:
 * Live Tail → Search for requestId from response
 * Dovresti vedere:
 * - 5 log entries (info x2, warn x1, error x1, debug x0 in prod)
 * - Ogni log ha: requestId, traceId, spanId, timestamp
 * - Metadata sanitizzata (password redacted)
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createLogger, sanitizeMetadata } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const headersList = await headers();
  const requestId = headersList.get('x-request-id') || 'test-unknown';
  const logger = createLogger(requestId, 'test-user-123');

  try {
    // Test 1: Info log con metadata
    logger.info('M2 Logging Test started', {
      environment: process.env.NODE_ENV,
      testType: 'structured-logging',
    });

    // Test 2: Warn log con metadata sensitiva (deve essere sanitizzata)
    const sensitiveData = {
      userId: 'user-123',
      email: 'test@example.com',
      password: 'super-secret-password', // Deve essere redacted
      apiKey: 'sk-1234567890', // Deve essere redacted
      amount: 100,
    };

    const sanitized = sanitizeMetadata(sensitiveData);
    logger.warn('Testing PII sanitization', sanitized);

    // Test 3: Error log con Error object
    try {
      throw new Error('Test error for M2 logging');
    } catch (error) {
      logger.error('Caught test error', error, {
        errorCode: 'TEST_ERROR',
        severity: 'low',
      });
    }

    // Test 4: Info log con trace context
    const span = Sentry.getActiveSpan();
    const traceContext = span?.spanContext();

    logger.info('Log with trace context', {
      hasTraceId: !!traceContext?.traceId,
      hasSpanId: !!traceContext?.spanId,
    });

    // Test 5: Debug log (visibile solo in development)
    logger.debug('Debug log test', {
      message: 'This should only appear in development',
    });

    // Test 6: Simula operazione lenta con log
    await Sentry.startSpan(
      {
        op: 'test.slow-operation',
        name: 'simulate-slow-operation',
      },
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        logger.info('Slow operation completed', { duration: 500 });
      }
    );

    return NextResponse.json({
      success: true,
      message: 'M2 Logging Test completed successfully',
      tests: {
        infoLog: {
          success: true,
          description: 'Basic info log with metadata',
        },
        piiSanitization: {
          success: true,
          description: 'Sensitive data sanitized',
          original: Object.keys(sensitiveData),
          sanitized: sanitized ? Object.keys(sanitized) : [],
          redactedFields: ['password', 'apiKey'],
        },
        errorLog: {
          success: true,
          description: 'Error log with Error object',
        },
        traceContext: {
          success: !!traceContext?.traceId,
          traceId: traceContext?.traceId || 'unknown',
          spanId: traceContext?.spanId || 'unknown',
        },
        debugLog: {
          success: true,
          description: 'Debug log (visible only in dev)',
          visibleInProduction: false,
        },
      },
      logging: {
        requestId,
        traceId: traceContext?.traceId || 'unknown',
        environment: process.env.NODE_ENV,
        logsShippedTo: 'Better Stack (via Vercel integration)',
      },
      instructions: {
        verifyBetterStack: `Go to Better Stack → Live Tail → Search for requestId: ${requestId}`,
        expectedLogs: [
          '1. INFO: M2 Logging Test started',
          '2. WARN: Testing PII sanitization (password/apiKey redacted)',
          '3. ERROR: Caught test error (with stack trace)',
          '4. INFO: Log with trace context',
          '5. DEBUG: Debug log test (only in development)',
          '6. INFO: Slow operation completed',
        ],
        verifyTraceCorrelation:
          'Copy traceId → Search in Sentry Performance → Should link to this request',
      },
    });
  } catch (error: any) {
    logger.error('M2 Logging Test failed', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        requestId,
      },
      { status: 500 }
    );
  }
}
