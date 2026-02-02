/**
 * WhatsApp Cloud API Webhook
 *
 * Endpoint: /api/webhooks/whatsapp
 *
 * GET  - Webhook verification (Meta challenge)
 * POST - Receive incoming messages, route to ANNE supervisor
 *
 * Flow:
 * 1. User sends WhatsApp message
 * 2. Meta forwards to this webhook
 * 3. We parse and extract text
 * 4. Look up user by phone number (anne_user_memory.preferences.whatsapp_phone)
 * 5. Route to supervisorRouter (same as web chat)
 * 6. Format response and send back via WhatsApp
 *
 * Security:
 * - GET: verify_token check (Meta webhook verification)
 * - POST: X-Hub-Signature-256 HMAC validation (fail-closed: rejects if app secret not configured)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import {
  isWhatsAppConfigured,
  getWhatsAppVerifyToken,
  parseWebhookMessages,
  sendWhatsAppText,
  markAsRead,
  type WhatsAppWebhookBody,
} from '@/lib/services/whatsapp';
import {
  sendPricingToWhatsApp,
  sendTrackingToWhatsApp,
  sendBookingToWhatsApp,
} from '@/lib/services/whatsapp-formatter';
import {
  supervisorRouter,
  formatPricingResponse,
} from '@/lib/agent/orchestrator/supervisor-router';
import { generateTraceId } from '@/lib/telemetry/logger';
import type { ActingContext } from '@/lib/safe-auth';
import type { UserRole } from '@/lib/rbac';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Simple in-memory dedup (webhook retries)
const processedMessages = new Map<string, number>();
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Rate limiting per phone number (prevent abuse)
const phoneCooldowns = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // max 10 messages per minute per phone

/** Mask phone number for GDPR-safe logging: 39340****67 */
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return digits.slice(0, 5) + '****' + digits.slice(-2);
}

function isDuplicate(messageId: string): boolean {
  const now = Date.now();
  // Cleanup old entries
  for (const [id, ts] of processedMessages) {
    if (now - ts > DEDUP_TTL_MS) processedMessages.delete(id);
  }
  if (processedMessages.has(messageId)) return true;
  processedMessages.set(messageId, now);
  return false;
}

function isRateLimited(phone: string): boolean {
  const now = Date.now();
  const entry = phoneCooldowns.get(phone);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    phoneCooldowns.set(phone, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT_MAX;
}

/**
 * Verify X-Hub-Signature-256 HMAC from Meta.
 * Requires WHATSAPP_APP_SECRET env var.
 * If app secret is not configured, rejects all requests (fail-closed).
 */
async function verifyWebhookSignature(request: NextRequest, rawBody: string): Promise<boolean> {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) {
    // Fail-closed: if no app secret configured, log warning and reject
    console.error('[WHATSAPP_WEBHOOK] WHATSAPP_APP_SECRET not configured - rejecting POST');
    return false;
  }

  const signature = request.headers.get('x-hub-signature-256');
  if (!signature) {
    console.warn('[WHATSAPP_WEBHOOK] Missing X-Hub-Signature-256 header');
    return false;
  }

  // signature format: "sha256=<hex>"
  const expectedPrefix = 'sha256=';
  if (!signature.startsWith(expectedPrefix)) return false;
  const receivedHmac = signature.slice(expectedPrefix.length);

  // Compute HMAC using Web Crypto API (available in Node 18+ and Edge Runtime)
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const computedHmac = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  // Timing-safe comparison (constant time)
  if (computedHmac.length !== receivedHmac.length) return false;
  let diff = 0;
  for (let i = 0; i < computedHmac.length; i++) {
    diff |= computedHmac.charCodeAt(i) ^ receivedHmac.charCodeAt(i);
  }
  return diff === 0;
}

// ==================== GET: Webhook Verification ====================

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  const verifyToken = getWhatsAppVerifyToken();

  if (mode === 'subscribe' && token === verifyToken && verifyToken) {
    console.log('[WHATSAPP_WEBHOOK] Verification successful');
    // Meta expects plain text challenge response
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  console.warn('[WHATSAPP_WEBHOOK] Verification failed:', {
    mode,
    tokenMatch: token === verifyToken,
  });
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

// ==================== POST: Incoming Messages ====================

export async function POST(request: NextRequest) {
  if (!isWhatsAppConfigured()) {
    console.warn('[WHATSAPP_WEBHOOK] Not configured');
    return NextResponse.json({ status: 'ok' });
  }

  // Read raw body for HMAC verification
  const rawBody = await request.text();

  // Verify HMAC signature (fail-closed: rejects if WHATSAPP_APP_SECRET not set)
  const isValid = await verifyWebhookSignature(request, rawBody);
  if (!isValid) {
    console.warn('[WHATSAPP_WEBHOOK] Invalid signature - rejecting');
    return NextResponse.json({ status: 'ok' }); // 200 to stop Meta retries
  }

  let body: WhatsAppWebhookBody;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ status: 'ok' });
  }

  const messages = parseWebhookMessages(body);

  for (const msg of messages) {
    if (isDuplicate(msg.messageId)) {
      continue;
    }

    // Rate limit per phone number
    if (isRateLimited(msg.from)) {
      console.warn('[WHATSAPP_WEBHOOK] Rate limited:', maskPhone(msg.from));
      continue;
    }

    await processIncomingMessage(msg.from, msg.name, msg.text, msg.messageId);
  }

  return NextResponse.json({ status: 'ok' });
}

// ==================== MESSAGE PROCESSING ====================

async function processIncomingMessage(
  phone: string,
  senderName: string,
  text: string,
  messageId: string
): Promise<void> {
  const traceId = generateTraceId();

  try {
    // Mark as read (blue ticks)
    markAsRead(messageId).catch(() => {});

    // 1. Look up user by WhatsApp phone number
    const user = await lookupUserByPhone(phone);

    if (!user) {
      // Sanitize sender name (user-controlled, strip to alphanumeric + spaces, max 50 chars)
      const safeName = senderName.replace(/[^\p{L}\p{N}\s]/gu, '').slice(0, 50) || 'utente';
      await sendWhatsAppText(
        phone,
        `Ciao ${safeName}! Per usare Anne via WhatsApp, collega il tuo numero dalla dashboard SpedireSicuro (Impostazioni > Notifiche > WhatsApp).`
      );
      return;
    }

    // 2. Build ActingContext for supervisor
    const actingContext: ActingContext = {
      actor: {
        id: user.id,
        email: user.email,
        role: (user.role || 'user') as UserRole,
        name: user.name || senderName,
      },
      target: {
        id: user.id,
        email: user.email,
        role: (user.role || 'user') as UserRole,
        name: user.name || senderName,
      },
      isImpersonating: false,
    };

    // 3. Call supervisor (same as web chat)
    const result = await supervisorRouter({
      message: text,
      userId: user.id,
      userEmail: user.email,
      traceId,
      actingContext,
      // No typingNonce for WhatsApp (no realtime channel)
    });

    // 4. Send response back via WhatsApp
    if (result.decision === 'END') {
      const state = result.agentState;

      // Try to send rich card formats first
      if (state?.pricing_options && state.pricing_options.length > 0) {
        await sendPricingToWhatsApp(phone, state.pricing_options);
        return;
      }

      if (state?.booking_result) {
        await sendBookingToWhatsApp(phone, state.booking_result);
        return;
      }

      // Build response text
      let responseText = '';
      if (result.pricingOptions?.length) {
        responseText = formatPricingResponse(result.pricingOptions);
      } else if (result.clarificationRequest) {
        responseText = result.clarificationRequest;
      } else if (state?.support_response) {
        responseText =
          typeof state.support_response === 'string'
            ? state.support_response
            : state.support_response.message || '';
      } else if (state?.userMessage) {
        responseText = state.userMessage;
      } else {
        responseText = 'Mi dispiace, non sono riuscita a elaborare la richiesta. Riprova.';
      }

      await sendWhatsAppText(phone, responseText);
    } else {
      // Legacy/fallback path - supervisor didn't produce a final answer
      // This means it went through the legacy Claude handler which
      // doesn't return a message in supervisorResult
      await sendWhatsAppText(
        phone,
        'Ho ricevuto il tuo messaggio. Per questa richiesta ti consiglio di usare la chat dalla dashboard per una risposta completa.'
      );
    }
  } catch (error) {
    console.error('[WHATSAPP_WEBHOOK] Error processing message:', {
      phone: maskPhone(phone),
      traceId,
      error: error instanceof Error ? error.message : 'Unknown',
    });

    await sendWhatsAppText(phone, 'Si e verificato un errore. Riprova tra qualche istante.').catch(
      () => {}
    );
  }
}

// ==================== USER LOOKUP ====================

/**
 * Look up a SpedireSicuro user by WhatsApp phone number.
 * Phone is stored in anne_user_memory.preferences.whatsapp_phone
 */
async function lookupUserByPhone(
  phone: string
): Promise<{ id: string; email: string; role: string; name?: string } | null> {
  // Normalize phone: remove + prefix, ensure starts with country code
  const normalizedPhone = phone.replace(/^\+/, '');

  // Validate phone is digits only (prevent PostgREST filter injection)
  if (!/^\d{7,15}$/.test(normalizedPhone)) {
    console.warn('[WHATSAPP_WEBHOOK] Invalid phone format rejected');
    return null;
  }

  // Search in anne_user_memory preferences
  const { data: memory } = await supabaseAdmin
    .from('anne_user_memory')
    .select('user_id, preferences')
    .or(
      `preferences->>whatsapp_phone.eq.${normalizedPhone},preferences->>whatsapp_phone.eq.+${normalizedPhone}`
    )
    .limit(1)
    .single();

  if (!memory?.user_id) return null;

  // Get user details
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('id, email, role, name')
    .eq('id', memory.user_id)
    .single();

  if (!user) return null;

  return {
    id: user.id,
    email: user.email || '',
    role: user.role || 'user',
    name: user.name,
  };
}
