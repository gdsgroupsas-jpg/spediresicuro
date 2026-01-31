/**
 * Webhook: Resend Inbound Email
 *
 * Receives inbound emails from Resend and stores them in the emails table.
 * Configure Resend Inbound to POST to: https://www.spediresicuro.it/api/webhooks/email-inbound
 *
 * Resend payload structure:
 * { type: "email.received", created_at: "...", data: { from, to, cc, bcc, subject, message_id, ... } }
 * Note: html/text are NOT included in the webhook — must be fetched via Resend API.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Resend wraps inbound email data inside "data"
    const emailData = payload.data || payload;

    const { from, to, cc, bcc, subject, attachments, message_id, email_id } = emailData;

    // from is a string like "Name <email@example.com>"
    const fromAddress = typeof from === 'string' ? from : '';
    // to/cc/bcc are arrays of strings
    const toAddresses = Array.isArray(to) ? to : typeof to === 'string' ? [to] : [];
    const ccAddresses = Array.isArray(cc) ? cc : [];
    const bccAddresses = Array.isArray(bcc) ? bcc : [];

    // Fetch email content (html/text) from Resend API since webhook doesn't include it
    let bodyHtml: string | null = null;
    let bodyText: string | null = null;
    const resendEmailId = email_id || message_id;

    if (resendEmailId && process.env.RESEND_API_KEY) {
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

    const { error } = await supabaseAdmin.from('emails').insert({
      message_id: message_id || email_id || null,
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
      raw_payload: payload,
    });

    if (error) {
      console.error('[EMAIL-INBOUND] Insert error:', error.message);
      return NextResponse.json({ received: true, error: error.message }, { status: 200 });
    }

    console.log(`[EMAIL-INBOUND] Saved email from ${fromAddress}: "${subject}"`);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error('[EMAIL-INBOUND] Error:', err.message);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
