/**
 * Webhook: Resend Inbound Email
 *
 * Receives inbound emails from Resend and stores them in the emails table.
 * Configure Resend Inbound to POST to: https://spediresicuro.it/api/webhooks/email-inbound
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();

    // Resend inbound webhook payload fields
    const { from, to, cc, subject, html, text, attachments, message_id } = payload;

    // Normalize addresses
    const fromAddress = typeof from === 'string' ? from : from?.address || from?.[0]?.address || '';
    const toAddresses = Array.isArray(to)
      ? to.map((t: any) => (typeof t === 'string' ? t : t?.address || ''))
      : typeof to === 'string'
        ? [to]
        : [];
    const ccAddresses = Array.isArray(cc)
      ? cc.map((c: any) => (typeof c === 'string' ? c : c?.address || ''))
      : [];

    const { error } = await supabaseAdmin.from('emails').insert({
      message_id: message_id || null,
      direction: 'inbound',
      from_address: fromAddress,
      to_address: toAddresses,
      cc: ccAddresses,
      bcc: [],
      subject: subject || '(nessun oggetto)',
      body_html: html || null,
      body_text: text || null,
      attachments: attachments || [],
      status: 'received',
      read: false,
      starred: false,
      folder: 'inbox',
      raw_payload: payload,
    });

    if (error) {
      console.error('[EMAIL-INBOUND] Insert error:', error.message);
      // Still return 200 to avoid Resend retries
      return NextResponse.json({ received: true, error: error.message }, { status: 200 });
    }

    console.log(`[EMAIL-INBOUND] Saved email from ${fromAddress}: "${subject}"`);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (err: any) {
    console.error('[EMAIL-INBOUND] Error:', err.message);
    return NextResponse.json({ received: true }, { status: 200 });
  }
}
