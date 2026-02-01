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
 * - POST: X-Hub-Signature-256 HMAC validation (optional, requires app secret)
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

  let body: WhatsAppWebhookBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: 'ok' });
  }

  // Meta expects 200 OK immediately (process async)
  // But on Vercel serverless we must process before returning
  const messages = parseWebhookMessages(body);

  for (const msg of messages) {
    if (isDuplicate(msg.messageId)) {
      console.log('[WHATSAPP_WEBHOOK] Duplicate message, skipping:', msg.messageId);
      continue;
    }

    // Process in background-ish (don't await to not block other messages)
    // But we still need to finish before Vercel kills the function
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
      await sendWhatsAppText(
        phone,
        `Ciao ${senderName}! Per usare Anne via WhatsApp, collega il tuo numero dalla dashboard SpedireSicuro (Impostazioni > Notifiche > WhatsApp).`
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
      phone,
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
