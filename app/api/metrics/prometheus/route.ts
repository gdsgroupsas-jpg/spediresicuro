/**
 * Prometheus Metrics Endpoint
 *
 * Exposes application metrics in Prometheus exposition format for Grafana Cloud scraping.
 *
 * Security:
 * - Requires Bearer token authentication (METRICS_API_TOKEN)
 * - Rate limited to prevent abuse
 *
 * Usage:
 * - Configure Grafana Cloud to scrape: https://spediresicuro.it/api/metrics/prometheus
 * - Set Authorization header: Bearer <METRICS_API_TOKEN>
 */

import { NextRequest, NextResponse } from 'next/server';
import { getBusinessMetrics } from '@/lib/metrics/business-metrics';
import {
  formatMetrics,
  buildShipmentMetrics,
  buildRevenueMetrics,
  buildUserMetrics,
  buildWalletMetrics,
  buildSystemMetrics,
  MetricDefinition,
} from '@/lib/metrics/prometheus';
import { createLogger } from '@/lib/logger';

// Rate limiting: Track requests per IP
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 60; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);

  if (!record || now > record.resetAt) {
    requestCounts.set(ip, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return request.headers.get('x-real-ip') || 'unknown';
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const logger = createLogger(requestId, undefined);
  const startTime = Date.now();

  try {
    // Check authentication - FAIL CLOSED in production
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.METRICS_API_TOKEN;
    const isProduction = process.env.NODE_ENV === 'production';

    // In production, token MUST be configured - fail closed
    if (isProduction && (!expectedToken || expectedToken.length === 0)) {
      logger.error('Prometheus metrics: METRICS_API_TOKEN not configured in production');
      return new NextResponse('Service Unavailable - Metrics not configured', { status: 503 });
    }

    // Require token authentication if configured (always in prod, optional in dev)
    if (expectedToken && expectedToken.length > 0) {
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        logger.warn('Prometheus metrics: missing auth header');
        return new NextResponse('Unauthorized', { status: 401 });
      }

      const token = authHeader.substring(7);
      if (token !== expectedToken) {
        logger.warn('Prometheus metrics: invalid token');
        return new NextResponse('Unauthorized', { status: 401 });
      }
    }

    // Check rate limit
    const clientIP = getClientIP(request);
    if (!checkRateLimit(clientIP)) {
      logger.warn('Prometheus metrics: rate limit exceeded', { ip: clientIP });
      return new NextResponse('Too Many Requests', { status: 429 });
    }

    // Fetch business metrics
    const metrics = await getBusinessMetrics();

    // Build all Prometheus metrics
    const allMetrics: MetricDefinition[] = [
      ...buildShipmentMetrics(metrics.shipments),
      ...buildRevenueMetrics(metrics.revenue),
      ...buildUserMetrics(metrics.users),
      ...buildWalletMetrics(metrics.wallet),
      ...buildSystemMetrics({
        healthStatus: 'ok', // Could be fetched from /api/health
        dependenciesHealthy: 4, // Placeholder
        dependenciesTotal: 4,
        apiLatencyMs: Date.now() - startTime,
      }),
    ];

    // Format as Prometheus exposition
    const output = formatMetrics(allMetrics);

    logger.info('Prometheus metrics served', {
      metricsCount: allMetrics.length,
      latencyMs: Date.now() - startTime,
    });

    // Return with correct content type for Prometheus
    return new NextResponse(output, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('Prometheus metrics error', { error: errorMessage });

    // Return minimal error metric
    const errorOutput = `# HELP spedire_scrape_error Indicates a scrape error occurred
# TYPE spedire_scrape_error gauge
spedire_scrape_error 1
`;

    return new NextResponse(errorOutput, {
      status: 500,
      headers: {
        'Content-Type': 'text/plain; version=0.0.4; charset=utf-8',
      },
    });
  }
}

// HEAD request for health checks
export async function HEAD() {
  return new NextResponse(null, { status: 200 });
}
