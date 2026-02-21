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
import { sendEmail } from '@/lib/email/resend';
import { sendTelegramMessageDirect } from '@/lib/services/telegram-bot';
import { sendWhatsAppText, isWhatsAppConfigured } from '@/lib/services/whatsapp';
import { learnFromEscalation } from '@/lib/ai/case-learning';

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

  // 4. Learning loop: apprendi da escalation risolte (claim-then-process)
  let patternsLearned = 0;
  try {
    // Cerca escalation risolte non ancora processate (max 10 per ciclo)
    const { data: resolvedEscalations } = await supabaseAdmin
      .from('support_escalations')
      .select('id, metadata')
      .eq('status', 'resolved')
      .not('resolution', 'is', null)
      .order('updated_at', { ascending: true })
      .limit(10);

    if (resolvedEscalations?.length) {
      for (const escalation of resolvedEscalations) {
        // Claim-then-process: UPDATE atomico PRIMA del processamento
        // Evita doppio apprendimento con worker concorrenti
        const { data: claimed } = await supabaseAdmin
          .from('support_escalations')
          .update({
            metadata: { ...(escalation.metadata || {}), pattern_learned: true },
          })
          .eq('id', escalation.id)
          .eq('status', 'resolved')
          .is('metadata->pattern_learned', null) // solo non-processate
          .select('id')
          .maybeSingle();

        if (claimed) {
          // Solo se il claim ha avuto successo (nessun altro worker l'ha presa)
          try {
            await learnFromEscalation(claimed.id);
            patternsLearned++;
          } catch (learnError: any) {
            console.error(
              `[Support Alerts] Errore learning escalation ${claimed.id}:`,
              learnError.message
            );
          }
        }
      }
    }
  } catch (error: any) {
    results.errors.push(`learning: ${error.message}`);
  }

  const total = results.giacenze + results.trackingStale + results.holdExpiring;
  console.log(
    `[Support Alerts] Inviate ${total} notifiche, ${patternsLearned} pattern appresi:`,
    results
  );

  return NextResponse.json({
    success: true,
    notificationsSent: total,
    patternsLearned,
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
  const channels: string[] = ['in_app'];

  // Leggi preferenze notifica utente
  const { data: memory } = await supabaseAdmin
    .from('anne_user_memory')
    .select('preferences')
    .eq('user_id', userId)
    .single();

  const preferredChannels: string[] = memory?.preferences?.notification_channels || ['in_app'];

  // Invio email se richiesto dall'utente
  if (preferredChannels.includes('email')) {
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('email')
      .eq('id', userId)
      .single();

    if (user?.email) {
      const result = await sendEmail({
        to: user.email,
        subject: `SpedireSicuro — ${notificationSubject(type)}`,
        html: notificationEmailHtml(message, type),
      });
      if (result.success) channels.push('email');
    }
  }

  // Invio Telegram se richiesto e l'utente ha un chat_id salvato
  if (preferredChannels.includes('telegram')) {
    const telegramChatId = memory?.preferences?.telegram_chat_id;
    if (telegramChatId) {
      const result = await sendTelegramMessageDirect(
        `🔔 <b>${notificationSubject(type)}</b>\n\n${escapeHtml(message)}`,
        { chatId: telegramChatId }
      );
      if (result.success) channels.push('telegram');
    }
  }

  // Invio WhatsApp se richiesto e l'utente ha un numero salvato
  if (preferredChannels.includes('whatsapp') && isWhatsAppConfigured()) {
    const whatsappPhone = memory?.preferences?.whatsapp_phone;
    if (whatsappPhone) {
      const result = await sendWhatsAppText(
        whatsappPhone,
        `*${notificationSubject(type)}*\n\n${message}`
      );
      if (result.success) channels.push('whatsapp');
    }
  }

  // Salva notifica in DB con canali effettivamente consegnati
  const { error } = await supabaseAdmin.from('support_notifications').insert({
    user_id: userId,
    type,
    shipment_id: shipmentId,
    message,
    metadata,
    channels_delivered: channels,
  });

  if (error) {
    console.error(`[Support Alerts] Errore creazione notifica ${type}:`, error.message);
  }
}

function notificationSubject(type: string): string {
  const subjects: Record<string, string> = {
    giacenza_detected: 'Nuova giacenza rilevata',
    tracking_stale: 'Tracking fermo da 48h',
    hold_expiring: 'Giacenza in scadenza',
  };
  return subjects[type] || 'Notifica supporto';
}

function notificationEmailHtml(message: string, type: string): string {
  const colors: Record<string, string> = {
    giacenza_detected: '#f59e0b',
    tracking_stale: '#3b82f6',
    hold_expiring: '#ef4444',
  };
  const color = colors[type] || '#3b82f6';

  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: ${color}; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">🔔 ${notificationSubject(type)}</h1>
      </div>
      <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
        <p style="color: #334155; font-size: 16px; line-height: 1.5;">${escapeHtml(message)}</p>
        <p style="color: #64748b; font-size: 13px; margin-bottom: 0;">
          <a href="https://spediresicuro.it/dashboard" style="color: #3b82f6;">Vai alla dashboard</a>
        </p>
      </div>
      <div style="text-align: center; padding: 16px; color: #94a3b8; font-size: 12px;">
        SpedireSicuro — Spedizioni semplici e sicure
      </div>
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
