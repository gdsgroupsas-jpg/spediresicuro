/**
 * API Route: Cron Job - Outreach Sequence Executor
 *
 * Endpoint: POST /api/cron/outreach-executor
 *
 * Processa la coda outreach: enrollment attivi con step pronti.
 * Invia messaggi via Email/WhatsApp/Telegram, avanza step, gestisce retry/bounce.
 *
 * Security: Requires CRON_SECRET header for authentication.
 * Schedule: Ogni 5 minuti (vercel.json)
 *
 * @module api/cron/outreach-executor
 */

import { NextRequest, NextResponse } from 'next/server';
import { processOutreachQueue } from '@/lib/outreach/sequence-executor';
import { isOutreachKillSwitchActive } from '@/lib/outreach/outreach-feature-flags';
import { outreachLogger } from '@/lib/outreach/outreach-logger';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: NextRequest) {
  try {
    // 1. Verifica cron secret
    const cronSecret =
      request.headers.get('x-cron-secret') ||
      request.headers.get('authorization')?.replace('Bearer ', '');

    if (!CRON_SECRET) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }

    if (cronSecret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1.5 Kill switch check (early exit)
    if (isOutreachKillSwitchActive()) {
      outreachLogger.warn('cron', 'Kill switch attivo — cron skip');
      return NextResponse.json({
        success: true,
        killSwitch: true,
        processed: 0,
        sent: 0,
        skipped: 0,
        failed: 0,
        completed: 0,
        timestamp: new Date().toISOString(),
      });
    }

    // 2. Processa la coda outreach
    const result = await processOutreachQueue();

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CRON] outreach-executor exception:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET per health check
export async function GET() {
  return NextResponse.json({
    name: 'outreach-executor',
    description: 'Processa coda outreach: invio messaggi multi-canale (email, whatsapp, telegram)',
    method: 'POST',
    auth: 'x-cron-secret or Bearer token',
    schedule: 'every 5 minutes',
    killSwitch: isOutreachKillSwitchActive(),
  });
}
