/**
 * Notification Dispatcher per Webhook Tracking
 *
 * Decide QUALI notifiche inviare e su QUALI canali quando arriva
 * un evento tracking via webhook.
 *
 * Regole "smart, non spammy":
 * - tracking.delivered → notifica alta priorita
 * - tracking.exception (giacenza) → notifica critica
 * - out_for_delivery → "Il tuo pacco e' in consegna oggi!"
 * - in_transit → NESSUNA notifica (troppo frequente)
 *
 * Deduplicazione: no duplicati per stesso (user_id, type, shipment_id) in 1 ora.
 * Reseller: notifica anche il parent workspace owner.
 *
 * Riusa pattern di app/api/cron/support-alerts/route.ts
 */

import { createClient } from '@supabase/supabase-js';
import type { SpedisciWebhookPayload } from './webhook-processor';
import { normalizeStatus } from './tracking-service';

// ═══════════════════════════════════════════════════════════════════════════
// TIPI
// ═══════════════════════════════════════════════════════════════════════════

interface NotificationRule {
  type: string;
  message: (data: SpedisciWebhookPayload['data']) => string;
  shouldNotify: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// REGOLE NOTIFICA
// ═══════════════════════════════════════════════════════════════════════════

function getNotificationRule(
  event: SpedisciWebhookPayload['event'],
  normalizedStatus: string
): NotificationRule | null {
  // tracking.delivered → sempre notifica
  if (event === 'tracking.delivered' || normalizedStatus === 'delivered') {
    return {
      type: 'shipment_delivered',
      message: (data) =>
        `Spedizione ${data.tracking_number} consegnata! ` +
        `Corriere: ${data.carrier?.toUpperCase() || 'N/A'}. ` +
        `${data.status_description || ''}`.trim(),
      shouldNotify: true,
    };
  }

  // tracking.exception con giacenza → critico
  if (event === 'tracking.exception' || normalizedStatus === 'in_giacenza') {
    return {
      type: 'giacenza_detected',
      message: (data) =>
        `Spedizione ${data.tracking_number} in giacenza. ` +
        `Corriere: ${data.carrier?.toUpperCase() || 'N/A'}. ` +
        `${data.status_description || 'Verifica la situazione nella dashboard.'}`,
      shouldNotify: true,
    };
  }

  // exception generica (non giacenza)
  if (normalizedStatus === 'exception') {
    return {
      type: 'delivery_failed',
      message: (data) =>
        `Problema con spedizione ${data.tracking_number}. ` +
        `${data.status_description || 'Controlla i dettagli nella dashboard.'}`,
      shouldNotify: true,
    };
  }

  // out_for_delivery → "in consegna oggi!"
  if (normalizedStatus === 'out_for_delivery') {
    return {
      type: 'tracking_out_for_delivery',
      message: (data) =>
        `Il pacco ${data.tracking_number} e' in consegna oggi! ` +
        `Corriere: ${data.carrier?.toUpperCase() || 'N/A'}.`,
      shouldNotify: true,
    };
  }

  // in_transit, created, picked_up, ecc. → NESSUNA notifica (troppo frequente)
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DISPATCHER PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Dispatch notifica per un evento tracking webhook.
 * Non-bloccante: chiamato con .catch() dal route handler.
 */
export async function dispatchTrackingNotification(
  payload: SpedisciWebhookPayload,
  shipmentId: string
): Promise<void> {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Determina lo stato normalizzato
  const normalizedStatus = normalizeStatus(payload.data.status);

  // Applica regole
  const rule = getNotificationRule(payload.event, normalizedStatus);
  if (!rule || !rule.shouldNotify) return;

  // Lookup spedizione per ottenere user_id e workspace_id
  const { data: shipment } = await supabaseAdmin
    .from('shipments')
    .select('user_id, workspace_id')
    .eq('id', shipmentId)
    .single();

  if (!shipment?.user_id) return;

  const message = rule.message(payload.data);

  // Deduplicazione: controlla se esiste gia' una notifica identica nell'ultima ora
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabaseAdmin
    .from('support_notifications')
    .select('id')
    .eq('user_id', shipment.user_id)
    .eq('type', rule.type)
    .eq('shipment_id', shipmentId)
    .gte('created_at', oneHourAgo)
    .limit(1);

  if (existing && existing.length > 0) {
    // Gia' notificato — skip
    return;
  }

  // Crea notifica per il proprietario della spedizione
  await createTrackingNotification(
    supabaseAdmin,
    shipment.user_id,
    rule.type,
    shipmentId,
    message,
    {
      tracking_number: payload.data.tracking_number,
      carrier: payload.data.carrier,
      status: normalizedStatus,
      webhook_event: payload.event,
    }
  );

  // Notifica anche il reseller parent se la spedizione e' in un child workspace
  if (shipment.workspace_id) {
    await notifyResellerParent(
      supabaseAdmin,
      shipment.workspace_id,
      shipment.user_id,
      rule.type,
      shipmentId,
      message,
      payload.data
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Crea una notifica tracking in support_notifications.
 * Pattern identico a createNotification() in support-alerts/route.ts
 * ma senza invio email/telegram/whatsapp per ora (solo in-app).
 * I canali esterni verranno aggiunti in un secondo momento.
 */
async function createTrackingNotification(
  supabase: any,
  userId: string,
  type: string,
  shipmentId: string,
  message: string,
  metadata: Record<string, unknown>
): Promise<void> {
  const channels: string[] = ['in_app'];

  // Leggi preferenze notifica utente per canali aggiuntivi
  const { data: memory } = await supabase
    .from('anne_user_memory')
    .select('preferences')
    .eq('user_id', userId)
    .single();

  const prefs = (memory?.preferences as Record<string, unknown>) || {};
  const preferredChannels = (prefs.notification_channels as string[]) || ['in_app'];

  // Email per notifiche critiche (giacenza, exception)
  if (
    preferredChannels.includes('email') &&
    (type === 'giacenza_detected' || type === 'delivery_failed')
  ) {
    // Import dinamico per evitare problemi di circolarita'
    try {
      const { sendEmail } = await import('@/lib/email/resend');
      const { data: user } = await supabase.from('users').select('email').eq('id', userId).single();

      if (user?.email) {
        const result = await sendEmail({
          to: user.email,
          subject: `SpedireSicuro — ${notificationSubject(type)}`,
          html: trackingNotificationEmailHtml(message, type, metadata),
        });
        if (result.success) channels.push('email');
      }
    } catch (err) {
      console.error('[TRACKING_NOTIFY] Errore invio email:', err);
    }
  }

  // Salva notifica in DB
  const { error } = await supabase.from('support_notifications').insert({
    user_id: userId,
    type,
    shipment_id: shipmentId,
    message,
    metadata,
    channels_delivered: channels,
  });

  if (error) {
    console.error(`[TRACKING_NOTIFY] Errore creazione notifica ${type}:`, error.message);
  }
}

/**
 * Notifica il reseller parent se la spedizione e' in un child workspace.
 * Cerca il workspace parent e il suo owner.
 */
async function notifyResellerParent(
  supabase: any,
  workspaceId: string,
  originalUserId: string,
  type: string,
  shipmentId: string,
  message: string,
  data: SpedisciWebhookPayload['data']
): Promise<void> {
  // Trova workspace parent
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('parent_workspace_id')
    .eq('id', workspaceId)
    .single();

  if (!workspace?.parent_workspace_id) return;

  // Trova owner del parent workspace
  const { data: parentOwner } = await supabase
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspace.parent_workspace_id)
    .eq('role', 'owner')
    .eq('status', 'active')
    .single();

  if (!parentOwner?.user_id || parentOwner.user_id === originalUserId) return;

  // Solo giacenze e eccezioni per il reseller (evita spam)
  if (type !== 'giacenza_detected' && type !== 'delivery_failed') return;

  await createTrackingNotification(
    supabase,
    parentOwner.user_id,
    type,
    shipmentId,
    `[Cliente] ${message}`,
    {
      tracking_number: data.tracking_number,
      carrier: data.carrier,
      webhook_event: type,
      is_reseller_alert: true,
    }
  );
}

function notificationSubject(type: string): string {
  const subjects: Record<string, string> = {
    shipment_delivered: 'Spedizione consegnata',
    giacenza_detected: 'Nuova giacenza rilevata',
    delivery_failed: 'Problema con spedizione',
    tracking_out_for_delivery: 'Pacco in consegna oggi',
  };
  return subjects[type] || 'Aggiornamento tracking';
}

function trackingNotificationEmailHtml(
  message: string,
  type: string,
  metadata: Record<string, unknown>
): string {
  const colors: Record<string, string> = {
    shipment_delivered: '#10b981',
    giacenza_detected: '#f59e0b',
    delivery_failed: '#ef4444',
    tracking_out_for_delivery: '#3b82f6',
  };
  const color = colors[type] || '#3b82f6';
  const trackingNumber = (metadata.tracking_number as string) || '';
  const carrier = ((metadata.carrier as string) || '').toUpperCase();

  const escapedMessage = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: ${color}; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 22px;">${notificationSubject(type)}</h1>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
        <div style="background: white; padding: 16px; border-radius: 8px; border-left: 4px solid ${color}; margin-bottom: 16px;">
          <p style="color: #0f172a; font-size: 14px; margin: 0 0 8px 0; font-weight: 600;">
            Tracking: <span style="font-family: monospace;">${trackingNumber}</span>
          </p>
          ${carrier ? `<p style="color: #64748b; font-size: 13px; margin: 0;">Corriere: ${carrier}</p>` : ''}
        </div>
        <p style="color: #334155; font-size: 15px; line-height: 1.6;">${escapedMessage}</p>
        <a href="https://spediresicuro.it/dashboard/spedizioni"
           style="display: inline-block; margin-top: 16px; padding: 10px 24px; background: ${color}; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">
          Vai alla Dashboard
        </a>
      </div>
      <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
        SpedireSicuro — Spedizioni semplici e sicure
      </div>
    </div>
  `;
}
