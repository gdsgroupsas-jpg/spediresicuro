export const dynamic = 'force-dynamic';

/**
 * API Route: Auto Reconciliation Cron
 *
 * Endpoint per riconciliazione automatica:
 * - Auto-matched: spedizioni con margine positivo > 7 giorni
 * - Auto-flagged: spedizioni con margine negativo
 *
 * @route GET /api/cron/auto-reconciliation
 * @since Sprint 3 - Monitoring & Alerting
 */

import { supabaseAdmin } from '@/lib/db/client';
import { createReconciliationService } from '@/lib/services/financial';
import { NextResponse } from 'next/server';

const CRON_SECRET = process.env.CRON_SECRET;
const SYSTEM_USER_ID = process.env.SYSTEM_USER_ID || '00000000-0000-0000-0000-000000000000';

export async function GET(request: Request) {
  try {
    // Verifica autorizzazione
    const authHeader = request.headers.get('authorization');
    if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting auto-reconciliation...');

    const reconciliationService = createReconciliationService(supabaseAdmin);

    // 1. Auto-match margini positivi vecchi di 7+ giorni
    const autoMatchResult = await reconciliationService.autoReconcilePositiveMargins(
      7,
      SYSTEM_USER_ID
    );
    console.log(`[CRON] Auto-matched: ${autoMatchResult.matched}/${autoMatchResult.processed}`);

    // 2. Flag margini negativi come discrepancy
    const flaggedCount = await reconciliationService.flagNegativeMargins(SYSTEM_USER_ID);
    console.log(`[CRON] Flagged negative margins: ${flaggedCount}`);

    // 3. Ottieni stats aggiornate
    const stats = await reconciliationService.getStats();

    return NextResponse.json({
      success: true,
      autoMatch: {
        processed: autoMatchResult.processed,
        matched: autoMatchResult.matched,
        errors: autoMatchResult.errors.length,
      },
      flaggedNegative: flaggedCount,
      currentStats: stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[CRON] Auto-reconciliation error:', error);
    return NextResponse.json(
      { success: false, error: 'Errore durante riconciliazione automatica' },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const maxDuration = 60;
