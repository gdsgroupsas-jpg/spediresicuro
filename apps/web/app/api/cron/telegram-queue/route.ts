/**
 * Telegram Queue Status & Retry Endpoint
 *
 * Il sistema di coda Telegram di Dario è AUTO-GESTITO:
 * - drainQueue() viene chiamato automaticamente su enqueue
 * - Non serve un worker esterno per processare i messaggi
 *
 * Questo endpoint serve per:
 * 1. Monitorare lo stato della queue
 * 2. Forzare retry dei messaggi falliti
 *
 * Endpoint: GET /api/cron/telegram-queue
 * POST per forzare retry dei messaggi falliti
 *
 * Milestone: M5 - Telegram Notifications
 */

import { NextRequest, NextResponse } from 'next/server';
import { getQueueStats, requeueFailedMessages } from '@/lib/services/telegram-queue';

/**
 * GET - Get queue status (monitoring)
 */
export async function GET(request: NextRequest) {
  // FIX F2: Autenticazione cron fail-closed
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET_TOKEN || process.env.CRON_SECRET;
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';

  if (!isVercelCron) {
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[TELEGRAM_QUEUE] Unauthorized request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    const stats = getQueueStats();

    return NextResponse.json({
      success: true,
      queue: {
        pending: stats.pending,
        processing: stats.processing,
        lastSentAt: stats.lastSentAt,
        lastSentAtISO: stats.lastSentAt ? new Date(stats.lastSentAt).toISOString() : null,
      },
      totals: stats.totals,
      timestamp: new Date().toISOString(),
      note: 'Queue is auto-managed. Messages are processed automatically on enqueue.',
    });
  } catch (error) {
    console.error('[TELEGRAM_QUEUE] Stats error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST - Retry failed messages
 */
export async function POST(request: NextRequest) {
  // FIX F2: Autenticazione cron fail-closed
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET_TOKEN || process.env.CRON_SECRET;
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';

  if (!isVercelCron) {
    if (!cronSecret) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn('[TELEGRAM_QUEUE] Unauthorized retry request');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  console.log('[TELEGRAM_QUEUE] Manual retry of failed messages');

  try {
    const requeued = await requeueFailedMessages();
    const stats = getQueueStats();

    return NextResponse.json({
      success: true,
      requeued,
      queue: {
        pending: stats.pending,
        processing: stats.processing,
      },
      totals: stats.totals,
      timestamp: new Date().toISOString(),
      trigger: 'manual',
    });
  } catch (error) {
    console.error('[TELEGRAM_QUEUE] Retry error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
