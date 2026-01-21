/**
 * Business Metrics API Endpoint
 *
 * Returns business metrics in JSON format for internal admin dashboards.
 *
 * Security:
 * - Requires authenticated session with Admin or SuperAdmin role (via NextAuth)
 *
 * Query Parameters:
 * - period: 'today' | 'week' | 'month' | 'all' (default: 'all')
 * - quick: 'true' for quick stats only (faster response)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth } from '@/lib/safe-auth';
import { findUserByEmail } from '@/lib/database';
import { getBusinessMetrics, getQuickStats } from '@/lib/metrics/business-metrics';
import { createLogger } from '@/lib/logger';

// Allowed roles for metrics access
const ALLOWED_ROLES = ['admin', 'superadmin', 'SUPERADMIN'];

async function verifyAdminAccess(): Promise<{
  authorized: boolean;
  userId?: string;
  role?: string;
  error?: string;
}> {
  try {
    // Use getSafeAuth for authentication (supports impersonation)
    const context = await getSafeAuth();

    if (!context?.actor?.email) {
      return { authorized: false, error: 'No session found' };
    }

    // Get user from database to verify role
    const user = await findUserByEmail(context.actor.email);

    if (!user) {
      return { authorized: false, error: 'User not found' };
    }

    // User type has role, but extended properties may include account_type for superadmin
    const extendedUser = user as typeof user & { account_type?: string };
    const role = extendedUser.account_type || user.role;

    if (!role || !ALLOWED_ROLES.includes(role)) {
      return {
        authorized: false,
        userId: user.id,
        role: role || 'unknown',
        error: 'Insufficient permissions',
      };
    }

    return { authorized: true, userId: user.id, role };
  } catch (error) {
    return {
      authorized: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function GET(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const logger = createLogger(requestId, undefined);
  const startTime = Date.now();

  try {
    // Verify admin access
    const authResult = await verifyAdminAccess();

    if (!authResult.authorized) {
      logger.warn('Business metrics: unauthorized access', {
        error: authResult.error,
        role: authResult.role,
      });

      return NextResponse.json(
        { error: authResult.error || 'Unauthorized' },
        { status: authResult.error === 'Insufficient permissions' ? 403 : 401 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const quick = searchParams.get('quick') === 'true';
    const period = searchParams.get('period') || 'all';

    logger.info('Business metrics requested', {
      userId: authResult.userId,
      quick,
      period,
    });

    // Fetch metrics
    let data;
    if (quick) {
      data = await getQuickStats();
    } else {
      data = await getBusinessMetrics();
    }

    const latencyMs = Date.now() - startTime;

    logger.info('Business metrics served', {
      userId: authResult.userId,
      latencyMs,
      quick,
    });

    return NextResponse.json(
      {
        success: true,
        data,
        meta: {
          requestId,
          latencyMs,
          generatedAt: new Date().toISOString(),
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, max-age=30', // Cache for 30 seconds
        },
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Business metrics error', { error: errorMessage });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch metrics',
        message: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
