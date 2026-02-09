/**
 * Webhook: Resend Inbound Email
 *
 * Receives inbound emails from Resend and stores them in the emails table.
 * Configure Resend Inbound to POST to: https://www.spediresicuro.it/api/webhooks/email-inbound
 *
 * Resend payload structure:
 * { type: "email.received", created_at: "...", data: { from, to, cc, bcc, subject, message_id, ... } }
 * Note: html/text are NOT included in the webhook — must be fetched via Resend API.
 *
 * Sicurezza:
 * - FIX #13: Verifica svix-signature per autenticare webhook Resend
 * - FIX #14: Sanitizza body_html inbound (Stored XSS protection)
 * - FIX #15: Limita dimensione raw_payload
 * - FIX #16: Non espone errori DB nella response
 * - FIX #17: Valida resendEmailId prima di usarlo in URL
 * - FIX #18: Rate limiting implicito via webhook authentication
 *
 * Routing workspace:
 * - Cerca TO addresses nella tabella workspace_email_addresses
 * - Se trovato → assegna email al workspace del destinatario
 * - Se NON trovato → workspace_id = NULL (visibile solo al superadmin, legacy)
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { lookupWorkspaceByEmail, sanitizeEmailHtml } from '@/lib/email/workspace-email-service';

// ─── WEBHOOK AUTHENTICATION ───

/**
 * Verifica la firma del webhook Resend/Svix.
 * FIX #13: Blocca payload non autenticati.
 *
 * Se RESEND_WEBHOOK_SECRET non è configurato, logga warning e permetti
 * (per non bloccare in dev/staging dove il secret potrebbe non esistere).
 */
async function verifyWebhookSignature(request: NextRequest, rawBody: string): Promise<boolean> {
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.warn(
      '[EMAIL-INBOUND] ⚠️ RESEND_WEBHOOK_SECRET non configurato, webhook non autenticato'
    );
    return true; // Permetti in dev/staging
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error('[EMAIL-INBOUND] ❌ Header svix mancanti');
    return false;
  }

  // Verifica timestamp (max 5 minuti di differenza per prevenire replay attack)
  const timestampSec = parseInt(svixTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestampSec) > 300) {
    console.error('[EMAIL-INBOUND] ❌ Timestamp svix troppo vecchio');
    return false;
  }

  // Verifica firma HMAC-SHA256
  try {
    // Svix firma: base64(HMAC-SHA256(secret, "${svix_id}.${svix_timestamp}.${body}"))
    const secretBytes = Buffer.from(webhookSecret.replace('whsec_', ''), 'base64');
    const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;

    const crypto = await import('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', secretBytes)
      .update(signedContent)
      .digest('base64');

    // Svix invia multiple firme separate da spazio, formato: "v1,{signature}"
    const signatures = svixSignature.split(' ');
    for (const sig of signatures) {
      const [, sigValue] = sig.split(',');
      if (sigValue === expectedSignature) {
        return true;
      }
    }

    console.error('[EMAIL-INBOUND] ❌ Firma svix non valida');
    return false;
  } catch (err: any) {
    console.error('[EMAIL-INBOUND] ❌ Errore verifica firma:', err.message);
    return false;
  }
}

// ─── HELPERS ───

/**
 * Estrai email pura da formato "Name <email@domain.com>"
 */
function extractEmailAddress(raw: string): string {
  if (raw.includes('<') && raw.includes('>')) {
    return raw.split('<')[1]?.split('>')[0]?.trim().toLowerCase() || raw.toLowerCase();
  }
  return raw.trim().toLowerCase();
}

/**
 * FIX #17: Valida che un ID Resend sia alfanumerico (previene path traversal)
 */
function isValidResendId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id) && id.length < 100;
}

// Limite dimensione payload per raw_payload (FIX #15)
const MAX_RAW_PAYLOAD_SIZE = 50_000; // 50KB

// ─── HANDLER ───

export async function POST(request: NextRequest) {
  try {
    // FIX #13: Leggi body come testo per verifica firma, poi parse JSON
    const rawBody = await request.text();

    // FIX #15: Rifiuta payload troppo grandi
    if (rawBody.length > 1_000_000) {
      // 1MB max
      console.error('[EMAIL-INBOUND] ❌ Payload troppo grande:', rawBody.length);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // FIX #13: Verifica firma webhook
    const isValid = await verifyWebhookSignature(request, rawBody);
    if (!isValid) {
      return NextResponse.json({ received: false }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);

    // Resend wraps inbound email data inside "data"
    const emailData = payload.data || payload;

    const { from, to, cc, bcc, subject, attachments, message_id, email_id } = emailData;

    // from is a string like "Name <email@example.com>"
    const fromAddress = typeof from === 'string' ? from : '';
    // to/cc/bcc are arrays of strings
    const toAddresses: string[] = Array.isArray(to) ? to : typeof to === 'string' ? [to] : [];
    const ccAddresses: string[] = Array.isArray(cc) ? cc : [];
    const bccAddresses: string[] = Array.isArray(bcc) ? bcc : [];

    // Fetch email content (html/text) from Resend API since webhook doesn't include it
    let bodyHtml: string | null = null;
    let bodyText: string | null = null;
    const resendEmailId = email_id || message_id;

    // FIX #17: Valida resendEmailId prima di usarlo in URL
    if (resendEmailId && isValidResendId(resendEmailId) && process.env.RESEND_API_KEY) {
      try {
        const res = await fetch(`https://api.resend.com/emails/${resendEmailId}`, {
          headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
        });
        if (res.ok) {
          const detail = await res.json();
          bodyHtml = detail.html || null;
          bodyText = detail.text || null;
        }
      } catch (fetchErr: any) {
        console.error('[EMAIL-INBOUND] Failed to fetch email content:', fetchErr.message);
      }
    }

    // FIX #14: Sanitizza body_html inbound (protezione Stored XSS)
    if (bodyHtml) {
      bodyHtml = sanitizeEmailHtml(bodyHtml);
    }

    // ─── ROUTING WORKSPACE ───
    // Cerca il workspace destinatario: controlla tutti gli indirizzi TO e CC
    let workspaceId: string | null = null;

    const allRecipients = [...toAddresses, ...ccAddresses];
    for (const recipient of allRecipients) {
      const cleanEmail = extractEmailAddress(recipient);
      const wsId = await lookupWorkspaceByEmail(cleanEmail);
      if (wsId) {
        workspaceId = wsId;
        break; // Primo match vince
      }
    }

    if (workspaceId) {
      console.log(`[EMAIL-INBOUND] Routing to workspace: ${workspaceId}`);
    } else {
      console.log('[EMAIL-INBOUND] No workspace match, email goes to superadmin (legacy)');
    }

    // FIX #15: Limita dimensione raw_payload salvato nel DB
    const rawPayloadStr = JSON.stringify(payload);
    const savedRawPayload =
      rawPayloadStr.length > MAX_RAW_PAYLOAD_SIZE
        ? { _truncated: true, message_id: message_id || email_id, subject }
        : payload;

    const { error } = await supabaseAdmin.from('emails').insert({
      message_id: message_id || email_id || null,
      workspace_id: workspaceId,
      direction: 'inbound',
      from_address: fromAddress,
      to_address: toAddresses,
      cc: ccAddresses,
      bcc: bccAddresses,
      subject: subject || '(nessun oggetto)',
      body_html: bodyHtml,
      body_text: bodyText,
      attachments: attachments || [],
      status: 'received',
      read: false,
      starred: false,
      folder: 'inbox',
      raw_payload: savedRawPayload,
    });

    if (error) {
      // FIX #16: Non esporre errori DB nella response
      console.error('[EMAIL-INBOUND] Insert error:', error.message);
      return NextResponse.json({ received: true }, { status: 200 });
    }

    console.log(
      `[EMAIL-INBOUND] Saved email from ${fromAddress}: "${subject}" (workspace: ${workspaceId || 'none'})`
    );
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error('[EMAIL-INBOUND] Error:', err.message);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
