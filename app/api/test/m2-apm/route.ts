/**
 * M2 Test Endpoint: Distributed Tracing (APM)
 *
 * Testa che Sentry Performance Monitoring funzioni correttamente:
 * - Root span HTTP creato dal middleware
 * - Child span database query (via instrumentedClient)
 * - Child span external API call (via instrumentedFetch)
 * - Trace context propagation nei logs
 *
 * Test:
 * curl http://localhost:3000/api/test/m2-apm
 *
 * Verifica in Sentry:
 * Performance → Transactions → Cerca "GET /api/test/m2-apm"
 * Dovresti vedere:
 * - Root span: http.server
 * - Child span: db.query.users
 * - Child span: http.client (httpbin.org)
 * - Tutti collegati con stesso traceId
 */

import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { createLogger } from '@/lib/logger';
import { instrumentSupabaseClient } from '@/lib/db/instrumented-client';
import { instrumentedFetch } from '@/lib/services/instrumented-fetch';
import { supabaseAdmin } from '@/lib/supabase';
import * as Sentry from '@sentry/nextjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const headersList = headers();
  const requestId = headersList.get('x-request-id') || 'test-unknown';
  const logger = createLogger(requestId);

  try {
    logger.info('M2 APM Test started');

    // Test 1: Database query (con instrumented client)
    const db = instrumentSupabaseClient(supabaseAdmin, requestId);

    const dbStart = Date.now();
    const { data: users, error: dbError } = await db
      .from('users')
      .select('id, email')
      .limit(3);
    const dbDuration = Date.now() - dbStart;

    if (dbError) {
      logger.error('Database query failed', dbError);
    } else {
      logger.info('Database query succeeded', {
        count: users?.length || 0,
        duration: dbDuration,
      });
    }

    // Test 2: External API call (con instrumented fetch)
    const apiStart = Date.now();
    const apiResponse = await instrumentedFetch('https://httpbin.org/json', {
      serviceName: 'httpbin',
      requestId,
    });
    const apiData = await apiResponse.json();
    const apiDuration = Date.now() - apiStart;

    logger.info('External API call succeeded', {
      status: apiResponse.status,
      duration: apiDuration,
    });

    // Test 3: Manual span creation
    await Sentry.startSpan(
      {
        op: 'custom.operation',
        name: 'test-manual-span',
      },
      async () => {
        // Simula operazione complessa
        await new Promise((resolve) => setTimeout(resolve, 100));
        logger.info('Manual span test completed');
      }
    );

    // Estrai trace context per risposta
    const span = Sentry.getActiveSpan();
    const traceContext = span?.spanContext();

    return NextResponse.json({
      success: true,
      message: 'M2 APM Test completed successfully',
      tests: {
        database: {
          success: !dbError,
          duration: dbDuration,
          rowsReturned: users?.length || 0,
        },
        externalApi: {
          success: apiResponse.ok,
          duration: apiDuration,
          status: apiResponse.status,
        },
        manualSpan: {
          success: true,
        },
      },
      tracing: {
        requestId,
        traceId: traceContext?.traceId || 'unknown',
        spanId: traceContext?.spanId || 'unknown',
      },
      instructions: {
        verifySentry: 'Go to Sentry → Performance → Transactions → Search for "GET /api/test/m2-apm"',
        expectedSpans: [
          'http.server (root span from middleware)',
          'db.query.users (database query)',
          'http.client httpbin (external API)',
          'custom.operation test-manual-span (manual span)',
        ],
        verifyLogs: 'Check Better Stack → Search by requestId or traceId',
      },
    });
  } catch (error: any) {
    logger.error('M2 APM Test failed', error);

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
