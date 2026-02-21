/**
 * M4 Metrics Test Endpoint
 *
 * Tests all M4 business metrics and audit trail functionality.
 * Used for verifying the integration is working correctly.
 *
 * GET /api/test/m4-metrics - Run all tests
 */

import { NextRequest, NextResponse } from 'next/server';
import { createLogger } from '@/lib/logger';
import { getBusinessMetrics, getQuickStats } from '@/lib/metrics/business-metrics';
import { formatMetrics, buildShipmentMetrics, MetricDefinition } from '@/lib/metrics/prometheus';
import { AUDIT_ACTIONS, logAuditEvent, getRecentAuditLogs } from '@/lib/services/audit-service';

interface TestResult {
  name: string;
  success: boolean;
  duration: number;
  details?: unknown;
  error?: string;
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const logger = createLogger(requestId, undefined);
  const startTime = Date.now();

  // Only allow in development or with test token
  const isDevMode = process.env.NODE_ENV === 'development';
  const testToken = request.headers.get('x-test-token');
  const expectedToken = process.env.TEST_API_TOKEN;

  if (!isDevMode && testToken !== expectedToken) {
    return NextResponse.json(
      { error: 'Test endpoint only available in development' },
      { status: 403 }
    );
  }

  const results: TestResult[] = [];

  // Test 1: Business Metrics Query
  try {
    const testStart = Date.now();
    const metrics = await getBusinessMetrics();
    const duration = Date.now() - testStart;

    results.push({
      name: 'Business Metrics Query',
      success: true,
      duration,
      details: {
        shipmentsTotal: metrics.shipments.total,
        usersTotal: metrics.users.total,
        revenueTotal: metrics.revenue.total,
        walletBalance: metrics.wallet.totalBalance,
      },
    });
  } catch (error) {
    results.push({
      name: 'Business Metrics Query',
      success: false,
      duration: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Test 2: Quick Stats Query
  try {
    const testStart = Date.now();
    const quickStats = await getQuickStats();
    const duration = Date.now() - testStart;

    results.push({
      name: 'Quick Stats Query',
      success: true,
      duration,
      details: quickStats,
    });
  } catch (error) {
    results.push({
      name: 'Quick Stats Query',
      success: false,
      duration: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Test 3: Prometheus Format Generation
  try {
    const testStart = Date.now();
    const testData = {
      total: 100,
      today: 10,
      thisWeek: 50,
      thisMonth: 80,
      byStatus: { delivered: 70, pending: 20, failed: 10 },
      successRate: 0.7,
      averageCost: 8.5,
    };
    const metrics = buildShipmentMetrics(testData);
    const output = formatMetrics(metrics);
    const duration = Date.now() - testStart;

    const isValidFormat =
      output.includes('# HELP') &&
      output.includes('# TYPE') &&
      output.includes('spedire_shipments');

    results.push({
      name: 'Prometheus Format Generation',
      success: isValidFormat,
      duration,
      details: {
        outputLength: output.length,
        metricsCount: metrics.length,
        sampleOutput: output.substring(0, 200) + '...',
      },
    });
  } catch (error) {
    results.push({
      name: 'Prometheus Format Generation',
      success: false,
      duration: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Test 4: Audit Log Write (only if explicitly enabled)
  const runAuditTest = request.nextUrl.searchParams.get('audit') === 'true';
  if (runAuditTest) {
    try {
      const testStart = Date.now();
      const result = await logAuditEvent(
        {
          action: AUDIT_ACTIONS.USER_LOGIN,
          resource_type: 'user',
          resource_id: 'test-user-id',
          actor_id: 'test-user-id',
          actor_email: 'test@example.com',
          metadata: {
            test: true,
            source: 'm4-metrics-test',
          },
        },
        requestId
      );
      const duration = Date.now() - testStart;

      results.push({
        name: 'Audit Log Write',
        success: result.success,
        duration,
        details: {
          auditLogId: result.id,
        },
        error: result.error,
      });
    } catch (error) {
      results.push({
        name: 'Audit Log Write',
        success: false,
        duration: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Test 5: Audit Log Read
  try {
    const testStart = Date.now();
    const logs = await getRecentAuditLogs(5);
    const duration = Date.now() - testStart;

    results.push({
      name: 'Audit Log Read',
      success: true,
      duration,
      details: {
        logsCount: logs.length,
        latestAction: logs[0]?.action || 'none',
      },
    });
  } catch (error) {
    results.push({
      name: 'Audit Log Read',
      success: false,
      duration: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Calculate summary
  const totalTests = results.length;
  const passedTests = results.filter((r) => r.success).length;
  const failedTests = totalTests - passedTests;
  const totalDuration = Date.now() - startTime;

  logger.info('M4 metrics tests completed', {
    totalTests,
    passedTests,
    failedTests,
    totalDuration,
  });

  return NextResponse.json(
    {
      success: failedTests === 0,
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        duration: totalDuration,
      },
      tests: results,
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
      },
    },
    { status: failedTests === 0 ? 200 : 500 }
  );
}
