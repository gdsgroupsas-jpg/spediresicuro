/**
 * Spedisci.Online Tracking Webhook
 *
 * Endpoint: POST /api/webhooks/spediscionline
 *
 * Riceve eventi tracking push da Spedisci.Online:
 * - tracking.updated: cambio stato spedizione
 * - tracking.delivered: consegna completata
 * - tracking.exception: problema (giacenza, mancata consegna)
 * - shipment.created: nuova spedizione creata
 *
 * Flusso:
 * 1. Verifica HMAC-SHA256 (Webhook-Timestamp + Webhook-Signature)
 * 2. Deduplicazione in-memory
 * 3. Lookup spedizione per tracking_number
 * 4. Upsert eventi in tracking_events
 * 5. Trigger PostgreSQL aggiornano automaticamente shipments + holds
 * 6. Supabase Realtime broadcast → UI live
 * 7. Dispatch notifiche (async, non-bloccante)
 *
 * Sicurezza:
 * - Kill switch: SPEDISCI_WEBHOOK_ENABLED env var
 * - HMAC-SHA256 con timing-safe comparison
 * - Finestra 5 minuti anti-replay
 * - Sempre 200 in risposta (evita retry infiniti)
 *
 * Docs: https://docs.spedisci.online/Smart/webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  verifySpedisciSignature,
  processTrackingWebhook,
  isDuplicateWebhook,
  type SpedisciWebhookPayload,
} from '@/lib/services/tracking/webhook-processor';
import { dispatchTrackingNotification } from '@/lib/services/tracking/notification-dispatcher';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  // Kill switch
  if (process.env.SPEDISCI_WEBHOOK_ENABLED !== 'true') {
    return NextResponse.json({ status: 'disabled' });
  }

  // Leggi body raw PRIMA di parsare JSON (necessario per HMAC)
  const rawBody = await request.text();

  // Verifica firma HMAC-SHA256
  const isValid = await verifySpedisciSignature(request, rawBody);
  if (!isValid) {
    // 200 per evitare retry infiniti dal provider
    console.warn('[SPEDISCI_WEBHOOK] Firma non valida — ignorato');
    return NextResponse.json({ status: 'ignored' });
  }

  // Parse payload
  let payload: SpedisciWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    console.warn('[SPEDISCI_WEBHOOK] JSON non valido');
    return NextResponse.json({ status: 'invalid_json' });
  }

  // Validazione minima
  if (!payload.event || !payload.data?.tracking_number) {
    console.warn('[SPEDISCI_WEBHOOK] Payload incompleto');
    return NextResponse.json({ status: 'invalid_payload' });
  }

  // Deduplicazione
  if (isDuplicateWebhook(payload.event, payload.data.tracking_number, payload.timestamp)) {
    return NextResponse.json({ status: 'duplicate' });
  }

  // Processing principale
  const result = await processTrackingWebhook(payload);

  // Dispatch notifiche (async, non-bloccante)
  // Le notifiche non devono rallentare la risposta al webhook
  if (result.success && result.shipmentId) {
    dispatchTrackingNotification(payload, result.shipmentId).catch((err) => {
      console.error('[SPEDISCI_WEBHOOK] Errore dispatch notifica:', err);
    });
  }

  return NextResponse.json({
    status: 'ok',
    events_processed: result.eventsProcessed,
  });
}
