/**
 * API Route: Cron Job - Sync Tracking
 *
 * Endpoint: POST /api/cron/sync-tracking
 *
 * Syncs tracking data for active shipments from Spedisci.Online.
 * Called by GitHub Actions every hour or Vercel Cron.
 *
 * v2: Parallelismo (5 worker), retry con backoff, batch upsert,
 *     metriche dettagliate, limit 300.
 *
 * Security: Requires CRON_SECRET header for authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getTrackingService } from '@/lib/services/tracking';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// Vercel Pro: max 300s. Usiamo 240s come safety margin.
export const maxDuration = 240;

// Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = request.headers.get('x-cron-secret');

    const providedSecret = cronSecret || authHeader?.replace('Bearer ', '');

    // CRITICAL: Se CRON_SECRET non configurato, blocca tutte le richieste
    if (!CRON_SECRET) {
      console.error('[TrackingSync] CRON_SECRET not configured - endpoint disabled');
      return NextResponse.json({ error: 'Service not configured' }, { status: 503 });
    }

    if (providedSecret !== CRON_SECRET) {
      console.warn('[TrackingSync] Unauthorized cron request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[TrackingSync] Avvio sync job...');

    const trackingService = getTrackingService();

    // Usa i default da TRACKING_CONFIG (configurabili via env vars)
    const result = await trackingService.syncActiveShipments();

    console.log('[TrackingSync] Risultato:', JSON.stringify(result));

    return NextResponse.json({
      success: true,
      message: 'Tracking sync completed',
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[TrackingSync] Error:', error);
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

// Supporto GET per Vercel Cron
export async function GET(request: NextRequest) {
  return POST(request);
}
