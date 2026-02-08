/**
 * Outreach Analytics — Sprint S3d
 *
 * Metriche aggregate per il sistema outreach.
 * Usato dall'outreach worker per mostrare statistiche ad Anne.
 */

import { supabaseAdmin } from '@/lib/db/client';
import type { OutreachChannel, OutreachMetrics } from '@/types/outreach';

// ============================================
// METRICHE
// ============================================

/**
 * Calcola metriche outreach aggregate per workspace.
 */
export async function getOutreachMetrics(workspaceId: string): Promise<OutreachMetrics> {
  const emptyChannel = { sent: 0, delivered: 0, opened: 0, replied: 0, failed: 0 };
  const defaultMetrics: OutreachMetrics = {
    totalSent: 0,
    totalDelivered: 0,
    totalOpened: 0,
    totalReplied: 0,
    totalFailed: 0,
    deliveryRate: 0,
    openRate: 0,
    replyRate: 0,
    byChannel: {
      email: { ...emptyChannel },
      whatsapp: { ...emptyChannel },
      telegram: { ...emptyChannel },
    },
  };

  // Query tutte le execution per workspace
  const { data, error } = await supabaseAdmin
    .from('outreach_executions')
    .select('channel, status')
    .eq('workspace_id', workspaceId);

  if (error || !data || data.length === 0) {
    return defaultMetrics;
  }

  // Aggrega per canale e status
  for (const row of data) {
    const ch = row.channel as OutreachChannel;
    const channelData = defaultMetrics.byChannel[ch];
    if (!channelData) continue;

    switch (row.status) {
      case 'sent':
        channelData.sent++;
        defaultMetrics.totalSent++;
        break;
      case 'delivered':
        channelData.sent++;
        channelData.delivered++;
        defaultMetrics.totalSent++;
        defaultMetrics.totalDelivered++;
        break;
      case 'opened':
        channelData.sent++;
        channelData.delivered++;
        channelData.opened++;
        defaultMetrics.totalSent++;
        defaultMetrics.totalDelivered++;
        defaultMetrics.totalOpened++;
        break;
      case 'replied':
        channelData.sent++;
        channelData.delivered++;
        channelData.opened++;
        channelData.replied++;
        defaultMetrics.totalSent++;
        defaultMetrics.totalDelivered++;
        defaultMetrics.totalOpened++;
        defaultMetrics.totalReplied++;
        break;
      case 'failed':
      case 'bounced':
        channelData.failed++;
        defaultMetrics.totalFailed++;
        break;
      // 'pending', 'skipped' non contano nelle metriche
    }
  }

  // Calcola rate
  if (defaultMetrics.totalSent > 0) {
    defaultMetrics.deliveryRate = defaultMetrics.totalDelivered / defaultMetrics.totalSent;
    defaultMetrics.openRate = defaultMetrics.totalOpened / defaultMetrics.totalSent;
    defaultMetrics.replyRate = defaultMetrics.totalReplied / defaultMetrics.totalSent;
  }

  return defaultMetrics;
}
