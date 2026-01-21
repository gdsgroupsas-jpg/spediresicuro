/**
 * Cron Job: Auto-Sync Automation Spedisci.Online
 *
 * Esegue sync automatico per tutte le configurazioni con automation abilitata
 *
 * USO:
 * - Esegui ogni X ore (configurabile in automation_settings)
 * - Può essere eseguito via Vercel Cron Jobs o sistema esterno
 *
 * ESEMPIO VERCEL CRON:
 * Aggiungi a vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/automation-sync",
 *     "schedule": "0 0,6,12,18 * * *"  // Ogni 6 ore
 *   }]
 * }
 */

import { syncAllEnabledConfigs } from '@/lib/automation/spedisci-online-agent';

async function main() {
  console.log('🔄 [CRON] Avvio sync automatico automation...');
  console.log(`⏰ [CRON] Timestamp: ${new Date().toISOString()}`);

  try {
    await syncAllEnabledConfigs();
    console.log('✅ [CRON] Sync automatico completato');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ [CRON] Errore sync automatico:', error);
    process.exit(1);
  }
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
  main();
}

export { main as automationCronJob };
