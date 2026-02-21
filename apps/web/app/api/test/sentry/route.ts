import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';

/**
 * Test endpoint per verificare Sentry error tracking
 *
 * GET /api/test/sentry - Genera un errore di test
 * GET /api/test/sentry?type=error - Error classico
 * GET /api/test/sentry?type=async - Error async
 * GET /api/test/sentry?type=transaction - Test transaction tracing
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || 'error';

  try {
    switch (type) {
      case 'error':
        // Test error semplice
        throw new Error('🧪 Sentry Test Error - This is a test error from /api/test/sentry');

      case 'async':
        // Test error async
        await new Promise((resolve, reject) => {
          setTimeout(() => {
            reject(new Error('🧪 Sentry Async Test Error - This is an async test error'));
          }, 100);
        });
        break;

      case 'transaction':
        // Test transaction tracing (Sentry v8+ API)
        return await Sentry.startSpan(
          {
            op: 'test',
            name: 'Test Transaction',
          },
          async (span) => {
            // Simula operazione lenta
            await new Promise((resolve) => setTimeout(resolve, 500));

            return NextResponse.json({
              success: true,
              message: 'Transaction test completed',
              spanId: span?.spanContext().spanId,
            });
          }
        );

      case 'context':
        // Test con context aggiuntivo
        Sentry.setUser({
          id: 'test-user-123',
          email: 'test@spediresicuro.it',
          username: 'Test User',
        });

        Sentry.setContext('test_context', {
          test_type: 'context',
          timestamp: new Date().toISOString(),
        });

        Sentry.setTag('test_tag', 'sentry_test');

        throw new Error('🧪 Sentry Context Test - Error with custom context');

      default:
        throw new Error('🧪 Unknown test type');
    }
  } catch (error) {
    // Sentry catturerà automaticamente questo errore
    Sentry.captureException(error, {
      tags: {
        test: true,
        endpoint: '/api/test/sentry',
      },
      extra: {
        testType: type,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json(
      {
        error: 'Test error thrown successfully',
        message: (error as Error).message,
        type,
        note: 'Check your Sentry dashboard for this error',
      },
      { status: 500 }
    );
  }
}
