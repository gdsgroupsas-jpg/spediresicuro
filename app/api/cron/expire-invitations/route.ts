/**
 * API Route: Cron Job - Expire Workspace Invitations
 *
 * Endpoint: POST /api/cron/expire-invitations
 *
 * Marks workspace invitations past their expiry date as expired.
 * Should be called periodically (e.g., every hour or daily).
 *
 * Security: Requires CRON_SECRET header for authentication.
 *
 * @module api/cron/expire-invitations
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  try {
    // 1. Verify cron secret
    const cronSecret =
      request.headers.get('x-cron-secret') ||
      request.headers.get('authorization')?.replace('Bearer ', '');

    if (!CRON_SECRET) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }

    if (cronSecret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Call the DB function to expire old invitations
    // This function was created in the migration
    const { data, error } = await supabaseAdmin.rpc('expire_old_invitations');

    if (error) {
      console.error('[CRON] expire-invitations error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const expiredCount = data || 0;
    console.log(`[CRON] expire-invitations: ${expiredCount} invitations expired`);

    return NextResponse.json({
      success: true,
      expired_count: expiredCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[CRON] expire-invitations exception:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET method for health checks
export async function GET() {
  return NextResponse.json({
    name: 'expire-invitations',
    description: 'Expires workspace invitations past their deadline',
    method: 'POST',
    auth: 'x-cron-secret or Bearer token',
  });
}
