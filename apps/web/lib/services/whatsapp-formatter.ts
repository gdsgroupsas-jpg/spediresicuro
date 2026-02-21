/**
 * WhatsApp Message Formatter
 *
 * Converte i dati delle card ANNE (pricing, tracking, booking)
 * in messaggi WhatsApp (testo + interattivi).
 *
 * WhatsApp limits:
 * - Text body: 4096 chars
 * - Interactive body: 1024 chars
 * - Button title: 20 chars
 * - List row title: 24 chars
 * - Max 3 buttons OR 1 list (max 10 rows per section)
 */

import type { PricingResult } from '@/lib/ai/pricing-engine';
import type { BookingResult } from '@/lib/agent/workers/booking';

/** Same shape as TrackingCardData from cards (duplicated to avoid component import in lib) */
interface TrackingCardData {
  trackingNumber: string;
  courier: string;
  status: 'in_transit' | 'delivered' | 'pending' | 'exception' | 'unknown';
  lastUpdate?: string;
  lastLocation?: string;
  estimatedDelivery?: string;
}
import {
  sendWhatsAppText,
  sendWhatsAppButtons,
  sendWhatsAppList,
  type WhatsAppSendResult,
} from './whatsapp';

// ==================== PRICING ====================

const RECOMMENDATION_LABELS: Record<string, string> = {
  best_price: 'Miglior prezzo',
  best_speed: 'Piu veloce',
  best_reliability: 'Piu affidabile',
};

/**
 * Send pricing comparison as WhatsApp list message.
 * Best option highlighted in body, others as list rows.
 */
export async function sendPricingToWhatsApp(
  to: string,
  options: PricingResult[]
): Promise<WhatsAppSendResult> {
  if (!options || options.length === 0) {
    return sendWhatsAppText(to, 'Nessun preventivo disponibile per questa spedizione.');
  }

  const best = options[0];
  const recLabel = RECOMMENDATION_LABELS[best.recommendation] || '';

  // Body: show best option details
  let body = `*Preventivo Spedizione*\n\n`;
  body += `*${best.courier}* - ${best.serviceType}\n`;
  body += `${best.finalPrice.toFixed(2).replace('.', ',')} EUR`;
  if (recLabel) body += ` (${recLabel})`;
  body += `\n${best.estimatedDeliveryDays.min}-${best.estimatedDeliveryDays.max} giorni`;

  if (options.length === 1) {
    return sendWhatsAppText(to, body + '\n\n_Prezzi con margine applicato. Dati indicativi._');
  }

  // Multiple options: use list
  const rows = options.slice(0, 10).map((opt, idx) => {
    const rec = RECOMMENDATION_LABELS[opt.recommendation] || '';
    return {
      id: `pricing_${idx}`,
      title: `${opt.courier}`.slice(0, 24),
      description:
        `${opt.finalPrice.toFixed(2).replace('.', ',')} EUR - ${opt.estimatedDeliveryDays.min}-${opt.estimatedDeliveryDays.max}gg${rec ? ' | ' + rec : ''}`.slice(
          0,
          72
        ),
    };
  });

  return sendWhatsAppList(
    to,
    body,
    'Vedi alternative',
    [{ title: 'Corrieri disponibili', rows }],
    undefined,
    'Prezzi indicativi con margine'
  );
}

// ==================== TRACKING ====================

const TRACKING_STATUS_LABELS: Record<string, string> = {
  pending: 'In attesa',
  in_transit: 'In transito',
  delivered: 'Consegnato',
  exception: 'Anomalia',
  unknown: 'Sconosciuto',
};

const TRACKING_STATUS_EMOJI: Record<string, string> = {
  pending: '',
  in_transit: '',
  delivered: '',
  exception: '',
  unknown: '',
};

/**
 * Send tracking status as WhatsApp text + optional buttons.
 */
export async function sendTrackingToWhatsApp(
  to: string,
  data: TrackingCardData
): Promise<WhatsAppSendResult> {
  const statusLabel = TRACKING_STATUS_LABELS[data.status] || data.status;
  const emoji = TRACKING_STATUS_EMOJI[data.status] || '';

  let text = `${emoji} *Tracking ${data.trackingNumber}*\n\n`;
  text += `Stato: *${statusLabel}*\n`;
  text += `Corriere: ${data.courier}\n`;
  if (data.lastLocation) text += `Posizione: ${data.lastLocation}\n`;
  if (data.lastUpdate) text += `Ultimo aggiornamento: ${data.lastUpdate}\n`;
  if (data.estimatedDelivery && data.status !== 'delivered') {
    text += `Consegna stimata: ${data.estimatedDelivery}\n`;
  }

  // Add action button if in transit or exception
  if (data.status === 'in_transit' || data.status === 'exception') {
    return sendWhatsAppButtons(to, text, [
      { id: `track_${data.trackingNumber}`, title: 'Aggiorna stato' },
    ]);
  }

  return sendWhatsAppText(to, text);
}

// ==================== BOOKING ====================

const BOOKING_STATUS_LABELS: Record<string, string> = {
  success: 'Confermata',
  failed: 'Fallita',
  retryable: 'Errore temporaneo',
};

const BOOKING_STATUS_EMOJI: Record<string, string> = {
  success: '',
  failed: '',
  retryable: '',
};

/**
 * Send booking confirmation as WhatsApp message.
 */
export async function sendBookingToWhatsApp(
  to: string,
  result: BookingResult
): Promise<WhatsAppSendResult> {
  const statusLabel = BOOKING_STATUS_LABELS[result.status] || result.status;
  const emoji = BOOKING_STATUS_EMOJI[result.status] || '';

  let text = `${emoji} *Prenotazione ${statusLabel}*\n\n`;
  text += `${result.user_message}\n`;

  if (result.carrier_reference) {
    text += `\nTracking: *${result.carrier_reference}*`;
  }
  if (result.shipment_id) {
    text += `\nID Spedizione: ${result.shipment_id}`;
  }

  // Copy tracking is not available on WA, but we can offer to track
  if (result.status === 'success' && result.carrier_reference) {
    return sendWhatsAppButtons(to, text, [
      { id: `track_${result.carrier_reference}`, title: 'Traccia spedizione' },
    ]);
  }

  return sendWhatsAppText(to, text);
}
