/**
 * Resend Event Webhook — Sprint S3d Gap Fix
 *
 * Endpoint: POST /api/webhooks/resend-events
 *
 * Riceve eventi da Resend (delivered, opened, clicked, bounced, complained)
 * e aggiorna outreach_executions per email delivery tracking.
 *
 * Setup in Resend Dashboard:
 *   Settings > Webhooks > Add Endpoint > URL: https://spediresicuro.it/api/webhooks/resend-events
 *   Events: email.delivered, email.opened, email.bounced, email.complained
 *
 * Security:
 * - Verifica webhook signature via `svix` headers (Resend usa Svix)
 * - RESEND_WEBHOOK_SECRET env var richiesto
 */

import { NextRequest, NextResponse } from 'next/server';
import { updateExecutionDeliveryStatus } from '@/lib/outreach/delivery-tracker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Verifica la firma del webhook Resend (Svix).
 * Resend invia 3 header: svix-id, svix-timestamp, svix-signature.
 * Per semplicita' e zero-dipendenze, verifichiamo con HMAC SHA-256.
 */
async function verifyResendSignature(request: NextRequest, rawBody: string): Promise<boolean> {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[RESEND_WEBHOOK] RESEND_WEBHOOK_SECRET non configurato — rifiuto');
    return false;
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn('[RESEND_WEBHOOK] Header svix mancanti');
    return false;
  }

  // Verifica timestamp (entro 5 minuti per prevenire replay)
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(svixTimestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > 300) {
    console.warn('[RESEND_WEBHOOK] Timestamp fuori range');
    return false;
  }

  // Svix firma: base64(HMAC-SHA256(base64decode(secret), "msgId.timestamp.body"))
  // Il secret Svix ha prefisso "whsec_" da rimuovere
  const secretBytes = base64ToUint8Array(secret.replace(/^whsec_/, ''));

  const signPayload = `${svixId}.${svixTimestamp}.${rawBody}`;
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(signPayload));

  const computedSig = uint8ArrayToBase64(new Uint8Array(signatureBuffer));

  // svix-signature puo' contenere multiple firme separate da spazio: "v1,<sig1> v1,<sig2>"
  const signatures = svixSignature.split(' ');
  for (const sig of signatures) {
    const [, sigValue] = sig.split(',', 2);
    if (sigValue === computedSig) return true;
  }

  console.warn('[RESEND_WEBHOOK] Firma non valida');
  return false;
}

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ==================== POST: Receive Events ====================

interface ResendEventPayload {
  type: string;
  data: {
    email_id: string;
    created_at: string;
    to: string[];
    from: string;
    subject: string;
  };
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Verifica firma
  const isValid = await verifyResendSignature(request, rawBody);
  if (!isValid) {
    // 200 per evitare retry infiniti da Resend
    return NextResponse.json({ status: 'ignored' });
  }

  let payload: ResendEventPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ status: 'invalid_json' });
  }

  const { type, data } = payload;
  const providerMessageId = data?.email_id;

  if (!providerMessageId) {
    return NextResponse.json({ status: 'no_email_id' });
  }

  const now = new Date().toISOString();

  switch (type) {
    case 'email.delivered':
      await updateExecutionDeliveryStatus(providerMessageId, 'delivered', {
        deliveredAt: now,
      });
      break;

    case 'email.opened':
      await updateExecutionDeliveryStatus(providerMessageId, 'opened', {
        openedAt: now,
      });
      break;

    case 'email.bounced':
      await updateExecutionDeliveryStatus(providerMessageId, 'bounced', {
        errorMessage: 'Email bounced',
      });
      break;

    case 'email.complained':
      await updateExecutionDeliveryStatus(providerMessageId, 'bounced', {
        errorMessage: 'Spam complaint',
      });
      break;

    // email.sent, email.clicked — ignorati (sent gia' tracciato, clicked non serve)
  }

  return NextResponse.json({ status: 'ok' });
}
