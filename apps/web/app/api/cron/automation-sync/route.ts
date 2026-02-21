/**
 * API Route: Cron Job Automation Sync
 *
 * Endpoint: GET /api/cron/automation-sync
 *
 * Esegue sync automatico per tutte le configurazioni con automation abilitata
 *
 * ⚠️ PROTETTO: Richiede secret token per sicurezza
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncAllEnabledConfigs } from '@/lib/automation/spedisci-online-agent';

// Forza rendering dinamico (usa request.headers)
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // FIX F2: Autenticazione cron fail-closed
    const authHeader = request.headers.get('authorization');
    const secretToken = process.env.CRON_SECRET_TOKEN || process.env.CRON_SECRET;
    const isVercelCron = request.headers.get('x-vercel-cron') === '1';

    if (!isVercelCron) {
      if (!secretToken) {
        return NextResponse.json(
          { success: false, error: 'CRON_SECRET not configured' },
          { status: 503 }
        );
      }
      if (authHeader !== `Bearer ${secretToken}`) {
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
      }
    }

    console.log('🔄 [CRON] Avvio sync automatico automation...');

    await syncAllEnabledConfigs();

    return NextResponse.json({
      success: true,
      message: 'Sync automatico completata',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [CRON] Errore sync automatico:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Errore durante sync automatico automazioni',
      },
      { status: 500 }
    );
  }
}
