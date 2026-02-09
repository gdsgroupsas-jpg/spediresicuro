/**
 * Webhook Processor per Spedisci.Online
 *
 * Gestisce la verifica HMAC-SHA256 e il processing dei webhook tracking.
 * I trigger PostgreSQL su tracking_events fanno il resto:
 * - Aggiornano shipments.tracking_status, tracking_last_update, delivered_at
 * - Creano shipment_holds per giacenze
 *
 * Flusso: webhook → verifica firma → lookup spedizione → upsert tracking_events
 *         → trigger DB → Supabase Realtime → UI live
 */

import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizeStatus } from './tracking-service';

// ═══════════════════════════════════════════════════════════════════════════
// TIPI
// ═══════════════════════════════════════════════════════════════════════════

export interface SpedisciWebhookPayload {
  event: 'tracking.updated' | 'tracking.delivered' | 'tracking.exception' | 'shipment.created';
  timestamp: number;
  data: {
    tracking_number: string;
    carrier: string;
    status: string;
    status_description: string;
    last_update: string;
    events: Array<{
      timestamp: string;
      status: string;
      location: string;
      description: string;
    }>;
  };
}

export interface WebhookResult {
  success: boolean;
  shipmentId?: string;
  eventsProcessed: number;
  error?: string;
}

interface ShipmentInfo {
  id: string;
  user_id: string;
  carrier: string | null;
  workspace_id: string | null;
  tracking_status: string | null;
  cash_on_delivery: boolean | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEDUPLICAZIONE IN-MEMORY
// ═══════════════════════════════════════════════════════════════════════════

const processedWebhooks = new Map<string, number>();
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minuti

function cleanupDedupMap(): void {
  const now = Date.now();
  for (const [key, ts] of processedWebhooks) {
    if (now - ts > DEDUP_TTL_MS) processedWebhooks.delete(key);
  }
}

export function isDuplicateWebhook(
  event: string,
  trackingNumber: string,
  timestamp: number
): boolean {
  cleanupDedupMap();
  const key = `${event}:${trackingNumber}:${timestamp}`;
  if (processedWebhooks.has(key)) return true;
  processedWebhooks.set(key, Date.now());
  return false;
}

// ═══════════════════════════════════════════════════════════════════════════
// VERIFICA FIRMA HMAC-SHA256
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Verifica la firma HMAC-SHA256 del webhook Spedisci.Online.
 *
 * Header richiesti:
 * - Webhook-Timestamp: unix timestamp in secondi
 * - Webhook-Signature: formato "t=<timestamp>,v1=<hmac_sha256_hex>"
 *
 * Payload firmato: "{timestamp}.{rawBody}"
 * Confronto timing-safe per prevenire timing attacks.
 */
export async function verifySpedisciSignature(
  request: NextRequest,
  rawBody: string
): Promise<boolean> {
  const secret = process.env.SPEDISCI_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[SPEDISCI_WEBHOOK] SPEDISCI_WEBHOOK_SECRET non configurato — rifiuto');
    return false;
  }

  const webhookTimestamp = request.headers.get('webhook-timestamp');
  const webhookSignature = request.headers.get('webhook-signature');

  if (!webhookTimestamp || !webhookSignature) {
    console.warn('[SPEDISCI_WEBHOOK] Header webhook-timestamp o webhook-signature mancanti');
    return false;
  }

  // Verifica timestamp (entro 5 minuti per prevenire replay)
  const ts = parseInt(webhookTimestamp, 10);
  if (isNaN(ts)) {
    console.warn('[SPEDISCI_WEBHOOK] Timestamp non valido');
    return false;
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) {
    console.warn('[SPEDISCI_WEBHOOK] Timestamp fuori range (>5 min)');
    return false;
  }

  // Estrai v1 signature dal formato "t=<ts>,v1=<hmac>"
  const receivedHmac = extractV1Signature(webhookSignature);
  if (!receivedHmac) {
    console.warn('[SPEDISCI_WEBHOOK] Formato signature non valido');
    return false;
  }

  // Calcola HMAC-SHA256 sul payload "{timestamp}.{rawBody}"
  const signPayload = `${webhookTimestamp}.${rawBody}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signPayload));
  const computedHmac = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Confronto timing-safe (constant time)
  return timingSafeEqual(computedHmac, receivedHmac);
}

/**
 * Estrae il valore v1 dal formato "t=<ts>,v1=<hmac>"
 */
export function extractV1Signature(signatureHeader: string): string | null {
  // Formato: "t=1733678400,v1=abc123def456..."
  const parts = signatureHeader.split(',');
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('v1=')) {
      return trimmed.slice(3);
    }
  }
  return null;
}

/**
 * Confronto timing-safe per stringhe (previene timing attacks).
 * Stessa tecnica usata in app/api/webhooks/whatsapp/route.ts.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESSING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Processa un webhook di tracking da Spedisci.Online.
 *
 * 1. Cerca la spedizione per tracking_number
 * 2. Upsert degli eventi in tracking_events
 * 3. I trigger PostgreSQL aggiornano automaticamente shipments
 */
export async function processTrackingWebhook(
  payload: SpedisciWebhookPayload
): Promise<WebhookResult> {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = payload;

  if (!data?.tracking_number) {
    return { success: false, eventsProcessed: 0, error: 'tracking_number mancante' };
  }

  // Lookup spedizione per tracking_number
  const shipment = await lookupShipmentByTracking(supabaseAdmin, data.tracking_number);
  if (!shipment) {
    // Non e' un errore: potrebbe essere un webhook per una spedizione
    // gestita da un altro account o vecchia
    console.warn(
      `[SPEDISCI_WEBHOOK] Nessuna spedizione trovata per tracking ${data.tracking_number}`
    );
    return { success: true, eventsProcessed: 0 };
  }

  // Upsert eventi tracking
  const eventsProcessed = await upsertWebhookEvents(
    supabaseAdmin,
    shipment.id,
    data.tracking_number,
    data.events || [],
    data.carrier
  );

  console.log(
    `[SPEDISCI_WEBHOOK] ${payload.event}: ${data.tracking_number} → ` +
      `${eventsProcessed} eventi processati per spedizione ${shipment.id}`
  );

  return {
    success: true,
    shipmentId: shipment.id,
    eventsProcessed,
  };
}

/**
 * Cerca una spedizione per tracking_number.
 */
async function lookupShipmentByTracking(
  supabase: any,
  trackingNumber: string
): Promise<ShipmentInfo | null> {
  const { data, error } = await supabase
    .from('shipments')
    .select('id, user_id, carrier, workspace_id, tracking_status, cash_on_delivery')
    .eq('tracking_number', trackingNumber)
    .single();

  if (error || !data) return null;
  return data as ShipmentInfo;
}

/**
 * Upsert degli eventi webhook in tracking_events.
 * Riusa normalizeStatus() da tracking-service.ts per mappare gli stati.
 * Il constraint UNIQUE(shipment_id, event_date, status) previene duplicati.
 */
async function upsertWebhookEvents(
  supabase: any,
  shipmentId: string,
  trackingNumber: string,
  events: SpedisciWebhookPayload['data']['events'],
  carrier: string
): Promise<number> {
  if (!events || events.length === 0) return 0;

  const now = new Date().toISOString();
  let processed = 0;

  for (const event of events) {
    const eventDate = parseWebhookDate(event.timestamp);
    const statusNormalized = normalizeStatus(event.status);

    const { error } = await supabase.from('tracking_events').upsert(
      {
        shipment_id: shipmentId,
        tracking_number: trackingNumber,
        event_date: eventDate,
        status: event.status,
        status_normalized: statusNormalized,
        location: event.location || null,
        description: event.description || null,
        carrier: carrier || 'unknown',
        provider: 'spediscionline_webhook',
        raw_data: event as unknown,
        fetched_at: now,
      },
      {
        onConflict: 'shipment_id,event_date,status',
        ignoreDuplicates: false,
      }
    );

    if (error) {
      console.error(`[SPEDISCI_WEBHOOK] Errore upsert evento per ${shipmentId}:`, error.message);
    } else {
      processed++;
    }
  }

  return processed;
}

/**
 * Parse data webhook (formato ISO 8601 o timestamp Unix).
 */
function parseWebhookDate(dateStr: string): string {
  // Se e' un numero, trattalo come Unix timestamp
  const asNum = Number(dateStr);
  if (!isNaN(asNum) && asNum > 1e9) {
    // Secondi se < 1e12, millisecondi altrimenti
    const ms = asNum < 1e12 ? asNum * 1000 : asNum;
    return new Date(ms).toISOString();
  }

  // Altrimenti prova come stringa ISO
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString();
  }

  // Fallback: data corrente
  console.warn(`[SPEDISCI_WEBHOOK] Formato data non riconosciuto: ${dateStr}`);
  return new Date().toISOString();
}
