/**
 * Business Metrics API Endpoint
 *
 * Returns business metrics in JSON format for internal admin dashboards.
 *
 * Security:
 * - Requires authenticated session with Admin or SuperAdmin role
 *
 * Query Parameters:
 * - period: 'today' | 'week' | 'month' | 'all' (default: 'all')
 * - quick: 'true' for quick stats only (faster response)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import {
  getBusinessMetrics,
  getQuickStats,
} from '@/lib/metrics/business-metrics';
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
    const cookieStore = await cookies();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return { authorized: false, error: 'Missing Supabase configuration' };
    }

    // Get session from cookie
    const accessToken = cookieStore.get('sb-access-token')?.value;
    const refreshToken = cookieStore.get('sb-refresh-token')?.value;

    if (!accessToken) {
      return { authorized: false, error: 'No session found' };
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false },
    });

    // Set session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || '',
    });

    if (authError || !user) {
      return { authorized: false, error: 'Invalid session' };
    }

    // Get user role from users table
    const supabaseAdmin = createClient(
      supabaseUrl,
      process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      { auth: { persistSession: false } }
    );

    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role, account_type')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return { authorized: false, error: 'User not found' };
    }

    const role = userData.role || userData.account_type;
    if (!ALLOWED_ROLES.includes(role)) {
      return {
        authorized: false,
        userId: user.id,
        role,
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
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    logger.error('Business metrics error', { error: errorMessage });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch metrics',
        message:
          process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
