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

export async function GET(request: NextRequest) {
  try {
    // Verifica secret token (protezione cron job)
    const authHeader = request.headers.get('authorization');
    const secretToken = process.env.CRON_SECRET_TOKEN;

    if (secretToken && authHeader !== `Bearer ${secretToken}`) {
      // Se non c'è secret token configurato, permettere solo da Vercel
      const vercelCron = request.headers.get('x-vercel-cron');
      if (!vercelCron) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized' },
          { status: 401 }
        );
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
        error: error.message || 'Errore durante sync',
      },
      { status: 500 }
    );
  }
}

