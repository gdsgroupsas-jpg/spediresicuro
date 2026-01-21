/**
 * Cron Job: Trigger Sync Spedizioni
 *
 * Endpoint chiamato automaticamente da Vercel Cron ogni ora.
 * Chiama il servizio Railway per sincronizzare le spedizioni da Spedisci.Online.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minuti max

export async function GET(request: NextRequest) {
  try {
    // Verifica secret token (protezione cron job)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
    const automationServiceUrl = process.env.AUTOMATION_SERVICE_URL;
    const automationServiceToken = process.env.AUTOMATION_SERVICE_TOKEN;

    // Verifica configurazione
    if (!automationServiceUrl) {
      console.error('❌ [CRON SYNC] AUTOMATION_SERVICE_URL non configurato');
      return NextResponse.json(
        {
          success: false,
          error: 'AUTOMATION_SERVICE_URL non configurato',
        },
        { status: 500 }
      );
    }

    if (!automationServiceToken) {
      console.error('❌ [CRON SYNC] AUTOMATION_SERVICE_TOKEN non configurato');
      return NextResponse.json(
        {
          success: false,
          error: 'AUTOMATION_SERVICE_TOKEN non configurato',
        },
        { status: 500 }
      );
    }

    // Verifica autenticazione cron (se configurato)
    if (cronSecret) {
      if (authHeader !== `Bearer ${cronSecret}`) {
        console.warn('⚠️ [CRON SYNC] Tentativo accesso non autorizzato');
        return NextResponse.json(
          {
            success: false,
            error: 'Unauthorized',
          },
          { status: 401 }
        );
      }
    }

    console.log('🔄 [CRON SYNC] Avvio sync automatico spedizioni...');

    // Recupera configurazioni attive con automation abilitata
    const { data: configs, error: configsError } = await supabaseAdmin
      .from('courier_configs')
      .select('id')
      .eq('automation_enabled', true)
      .eq('is_active', true);

    if (configsError) {
      console.error('❌ [CRON SYNC] Errore recupero configurazioni:', configsError);
      return NextResponse.json(
        {
          success: false,
          error: 'Errore recupero configurazioni',
          details: configsError.message,
        },
        { status: 500 }
      );
    }

    if (!configs || configs.length === 0) {
      console.log('ℹ️ [CRON SYNC] Nessuna configurazione con automation abilitata');
      return NextResponse.json({
        success: true,
        message: 'Nessuna configurazione da sincronizzare',
        configs_processed: 0,
        timestamp: new Date().toISOString(),
      });
    }

    console.log(`📊 [CRON SYNC] Trovate ${configs.length} configurazioni da sincronizzare`);

    // Risultati aggregati
    const results: Array<{
      configId: string;
      success: boolean;
      shipments_synced?: number;
      error?: string;
    }> = [];

    // Processa ogni configurazione
    for (const config of configs) {
      try {
        console.log(`🔄 [CRON SYNC] Sync config ${config.id.substring(0, 8)}...`);

        // Chiama endpoint Railway
        const response = await fetch(`${automationServiceUrl}/api/sync-shipments`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${automationServiceToken}`,
          },
          body: JSON.stringify({ configId: config.id }),
          // Timeout 4 minuti (lasciamo margine per il maxDuration)
          signal: AbortSignal.timeout(240000),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Errore sconosciuto' }));
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data = await response.json();

        results.push({
          configId: config.id,
          success: data.success || false,
          shipments_synced: data.shipments_synced || 0,
          error: data.error,
        });

        console.log(
          `✅ [CRON SYNC] Config ${config.id.substring(0, 8)}: ${data.shipments_synced || 0} spedizioni sincronizzate`
        );

        // Pausa tra le chiamate per non sovraccaricare (1 secondo)
        await new Promise((resolve) => setTimeout(resolve, 1000));
      } catch (error: any) {
        console.error(`❌ [CRON SYNC] Errore sync config ${config.id.substring(0, 8)}:`, error);

        results.push({
          configId: config.id,
          success: false,
          error: error.message || 'Errore sconosciuto',
        });

        // Continua con le altre configurazioni anche se una fallisce
      }
    }

    // Calcola statistiche
    const successful = results.filter((r) => r.success).length;
    const totalShipments = results.reduce((sum, r) => sum + (r.shipments_synced || 0), 0);

    console.log(
      `✅ [CRON SYNC] Completato: ${successful}/${configs.length} config sincronizzate, ${totalShipments} spedizioni totali`
    );

    return NextResponse.json({
      success: true,
      message: `Sync completato: ${successful}/${configs.length} configurazioni, ${totalShipments} spedizioni`,
      configs_processed: configs.length,
      configs_successful: successful,
      total_shipments_synced: totalShipments,
      results: results.map((r) => ({
        configId: r.configId.substring(0, 8) + '...',
        success: r.success,
        shipments_synced: r.shipments_synced,
      })),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('❌ [CRON SYNC] Errore generale:', error);

    return NextResponse.json(
      {
        success: false,
        error: 'Errore durante sync automatico',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
