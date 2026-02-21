/**
 * API Route: Cron Job - Expire Overdue Holds
 *
 * Endpoint: POST /api/cron/expire-holds
 *
 * Marks shipment holds past their deadline as expired.
 * Should be called daily by cron (e.g., every 6 hours).
 *
 * Security: Requires CRON_SECRET header for authentication.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  try {
    const cronSecret =
      request.headers.get('x-cron-secret') ||
      request.headers.get('authorization')?.replace('Bearer ', '');

    if (!CRON_SECRET) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }

    if (cronSecret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabaseAdmin.rpc('expire_overdue_shipment_holds');

    if (error) {
      console.error('[CRON] expire-holds error:', error);
      return NextResponse.json(
        { error: 'Errore durante scadenza hold spedizioni' },
        { status: 500 }
      );
    }

    const expiredCount = data || 0;
    console.log(`[CRON] expire-holds: ${expiredCount} holds expired`);

    return NextResponse.json({
      success: true,
      expired_count: expiredCount,
    });
  } catch (error: any) {
    console.error('[CRON] expire-holds exception:', error);
    return NextResponse.json({ error: 'Errore durante scadenza hold spedizioni' }, { status: 500 });
  }
}
