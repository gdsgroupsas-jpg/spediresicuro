/**
 * API Route: Cron Job - Sync Tracking
 *
 * Endpoint: POST /api/cron/sync-tracking
 *
 * Syncs tracking data for active shipments from Spedisci.Online.
 * Should be called by GitHub Actions or Vercel Cron every 4 hours.
 *
 * Security: Requires CRON_SECRET header for authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTrackingService } from '@/lib/services/tracking';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.headers.get('x-cron-secret');

    const providedSecret = cronSecret || authHeader?.replace('Bearer ', '');

    // CRITICAL: Se CRON_SECRET non è configurato, blocca tutte le richieste
    // Questo evita che l'endpoint sia aperto in caso di env var mancante
    if (!CRON_SECRET) {
      console.error('[Tracking Sync] CRON_SECRET not configured - endpoint disabled');
      return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
    }

    if (providedSecret !== CRON_SECRET) {
      console.warn('[Tracking Sync] Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Tracking Sync] Starting tracking sync job...');

    const trackingService = getTrackingService();

    // Sync active shipments
    // - maxAge: 4 hours (only sync if last update older than this)
    // - limit: 100 shipments per run
    // - delayBetween: 500ms (rate limiting for API)
    const result = await trackingService.syncActiveShipments({
      maxAge: 4 * 60 * 60 * 1000, // 4 hours
      limit: 100,
      delayBetween: 500, // 500ms between API calls
    });

    console.log('[Tracking Sync] Completed:', result);

    return NextResponse.json({
      success: true,
      message: 'Tracking sync completed',
      synced: result.synced,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[Tracking Sync] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Tracking sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Also support GET for Vercel Cron
export async function GET(request: NextRequest) {
  return POST(request);
}
