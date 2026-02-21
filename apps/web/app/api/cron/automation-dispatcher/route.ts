export const dynamic = 'force-dynamic';

/**
 * API Route: Automation Dispatcher Cron
 *
 * Endpoint chiamato ogni 5 minuti da Vercel Cron.
 * Esegue il ciclo di dispatch: verifica automazioni attive,
 * controlla schedule, e avvia esecuzione con lock distribuito.
 *
 * @route GET /api/cron/automation-dispatcher
 */

import { NextResponse } from 'next/server';
import { runDispatcher } from '@/lib/automations/dispatcher';

// Auth: CRON_SECRET Bearer token
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  try {
    // Verifica autorizzazione (Vercel cron header o Bearer token)
    const authHeader = request.headers.get('authorization');
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';

    if (!isVercelCron) {
      // Se CRON_SECRET non configurato, rifiuta sempre le chiamate non-Vercel
      if (!CRON_SECRET) {
        console.warn('[CRON] CRON_SECRET non configurato — rifiuto richiesta esterna');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log('[CRON] Automation dispatcher starting...');

    const result = await runDispatcher(5);

    console.log(
      `[CRON] Dispatcher completato: ${result.checked} checked, ` +
        `${result.executed} executed, ${result.skipped} skipped`
    );

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[CRON] Automation dispatcher error:', error);
    return NextResponse.json(
      { success: false, error: 'Errore durante dispatch automazioni' },
      { status: 500 }
    );
  }
}

// Vercel config
export const runtime = 'nodejs';
export const maxDuration = 300;
