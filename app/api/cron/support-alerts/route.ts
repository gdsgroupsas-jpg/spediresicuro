/**
 * Cron: Support Alerts
 *
 * Controlla periodicamente (ogni 30 min via Vercel Cron o manualmente):
 * - Nuove giacenze non notificate
 * - Tracking stale (>48h senza aggiornamenti)
 * - Consegne fallite
 * - Giacenze in scadenza (<3 giorni)
 *
 * Crea record in support_notifications e invia sui canali configurati.
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';

// Vercel Cron config
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(request: Request) {
  // Verifica autorizzazione: Vercel Cron invia header speciale, oppure CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';

  if (!isVercelCron) {
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const results = {
    giacenze: 0,
    trackingStale: 0,
    holdExpiring: 0,
    errors: [] as string[],
  };

  try {
    // 1. Nuove giacenze non notificate
    const { data: newHolds } = await supabaseAdmin
      .from('shipment_holds')
      .select('id, shipment_id, user_id, reason, created_at, shipments(tracking_number)')
      .eq('status', 'open')
      .gt('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Ultime 60 min
      .order('created_at', { ascending: false });

    if (newHolds?.length) {
      for (const hold of newHolds) {
        // Controlla se gia notificato
        const { data: existing } = await supabaseAdmin
          .from('support_notifications')
          .select('id')
          .eq('user_id', hold.user_id)
          .eq('type', 'giacenza_detected')
          .eq('metadata->>hold_id', hold.id)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const tracking = (hold as any).shipments?.tracking_number || 'N/A';
        await createNotification(
          hold.user_id,
          'giacenza_detected',
          hold.shipment_id,
          `La tua spedizione ${tracking} e in giacenza: ${hold.reason || 'motivo non specificato'}. Apri la chat per gestirla con Anne.`,
          { hold_id: hold.id, tracking_number: tracking }
        );
        results.giacenze++;
      }
    }

    // 2. Tracking stale (>48h senza eventi)
    const staleThreshold = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { data: staleShipments } = await supabaseAdmin
      .from('shipments')
      .select('id, user_id, tracking_number, updated_at')
      .in('status', ['in_transit', 'picked_up'])
      .lt('updated_at', staleThreshold)
      .limit(50);

    if (staleShipments?.length) {
      for (const shipment of staleShipments) {
        const { data: existing } = await supabaseAdmin
          .from('support_notifications')
          .select('id')
          .eq('user_id', shipment.user_id)
          .eq('type', 'tracking_stale')
          .eq('metadata->>shipment_id', shipment.id)
          .gt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Max 1 al giorno
          .limit(1);

        if (existing && existing.length > 0) continue;

        await createNotification(
          shipment.user_id,
          'tracking_stale',
          shipment.id,
          `Il tracking della spedizione ${shipment.tracking_number} non si aggiorna da oltre 48 ore. Anne puo verificare lo stato per te.`,
          { tracking_number: shipment.tracking_number }
        );
        results.trackingStale++;
      }
    }

    // 3. Giacenze in scadenza (<3 giorni)
    const { data: expiringHolds } = await supabaseAdmin
      .from('shipment_holds')
      .select('id, shipment_id, user_id, deadline, shipments(tracking_number)')
      .eq('status', 'open')
      .not('deadline', 'is', null)
      .lt('deadline', new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString())
      .gt('deadline', new Date().toISOString());

    if (expiringHolds?.length) {
      for (const hold of expiringHolds) {
        const { data: existing } = await supabaseAdmin
          .from('support_notifications')
          .select('id')
          .eq('user_id', hold.user_id)
          .eq('type', 'hold_expiring')
          .eq('metadata->>hold_id', hold.id)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const tracking = (hold as any).shipments?.tracking_number || 'N/A';
        const daysLeft = Math.ceil(
          (new Date(hold.deadline).getTime() - Date.now()) / (24 * 60 * 60 * 1000)
        );

        await createNotification(
          hold.user_id,
          'hold_expiring',
          hold.shipment_id,
          `Attenzione: la giacenza della spedizione ${tracking} scade tra ${daysLeft} giorni. Agisci subito per evitare il reso o la distruzione.`,
          { hold_id: hold.id, tracking_number: tracking, days_remaining: daysLeft }
        );
        results.holdExpiring++;
      }
    }
  } catch (error: any) {
    results.errors.push(error.message);
  }

  const total = results.giacenze + results.trackingStale + results.holdExpiring;
  console.log(`[Support Alerts] Inviate ${total} notifiche:`, results);

  return NextResponse.json({
    success: true,
    notificationsSent: total,
    details: results,
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function createNotification(
  userId: string,
  type: string,
  shipmentId: string | null,
  message: string,
  metadata: Record<string, any>
) {
  const { error } = await supabaseAdmin.from('support_notifications').insert({
    user_id: userId,
    type,
    shipment_id: shipmentId,
    message,
    metadata,
    channels_delivered: ['in_app'],
  });

  if (error) {
    console.error(`[Support Alerts] Errore creazione notifica ${type}:`, error.message);
  }

  // TODO: Invia su canali aggiuntivi (Telegram, email) basandosi su preferenze utente
  // const { data: memory } = await supabaseAdmin
  //   .from('anne_user_memory')
  //   .select('preferences')
  //   .eq('user_id', userId)
  //   .single();
  // const channels = memory?.preferences?.notification_channels || ['in_app'];
}
