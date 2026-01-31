/**
 * API: Send Email
 *
 * POST /api/email/send
 * Sends an email via Resend and saves to emails table.
 * Superadmin only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSafeAuth } from '@/lib/safe-auth';
import { supabaseAdmin } from '@/lib/db/client';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 'placeholder');

export async function POST(request: NextRequest) {
  try {
    const context = await getSafeAuth();
    if (!context) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (context.actor.account_type !== 'superadmin') {
      return NextResponse.json(
        { error: 'Solo i superadmin possono inviare email' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { from, to, cc, bcc, subject, html, text, replyToEmailId, draft } = body;

    const toArray = Array.isArray(to) ? to.filter(Boolean) : to ? [to] : [];
    const ccArray = Array.isArray(cc) ? cc.filter(Boolean) : [];
    const bccArray = Array.isArray(bcc) ? bcc.filter(Boolean) : [];
    const fromAddress = from || 'SpedireSicuro <noreply@spediresicuro.it>';

    // Save as draft without sending
    if (draft) {
      const { data: draftRecord, error: draftError } = await supabaseAdmin
        .from('emails')
        .insert({
          message_id: null,
          direction: 'outbound',
          from_address: fromAddress,
          to_address: toArray.length > 0 ? toArray : [''],
          cc: ccArray,
          bcc: bccArray,
          subject: subject || '(bozza)',
          body_html: html || null,
          body_text: text || null,
          reply_to_message_id: replyToEmailId || null,
          status: 'draft',
          read: true,
          folder: 'drafts',
        })
        .select('id')
        .single();

      if (draftError) {
        return NextResponse.json({ error: draftError.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, id: draftRecord?.id, draft: true });
    }

    if (!toArray.length || !subject) {
      return NextResponse.json({ error: 'Campi obbligatori: to, subject' }, { status: 400 });
    }

    // Send via Resend
    const { data, error: sendError } = await resend.emails.send({
      from: fromAddress,
      to: toArray,
      cc: ccArray.length > 0 ? ccArray : undefined,
      bcc: bccArray.length > 0 ? bccArray : undefined,
      subject,
      html: html || undefined,
      text: text || undefined,
    });

    if (sendError) {
      // Save as failed
      await supabaseAdmin.from('emails').insert({
        message_id: null,
        direction: 'outbound',
        from_address: fromAddress,
        to_address: toArray,
        cc: ccArray,
        bcc: bccArray,
        subject,
        body_html: html || null,
        body_text: text || null,
        reply_to_message_id: replyToEmailId || null,
        status: 'failed',
        read: true,
        folder: 'sent',
      });

      return NextResponse.json({ error: sendError.message }, { status: 500 });
    }

    // Save as sent
    const { data: emailRecord, error: insertError } = await supabaseAdmin
      .from('emails')
      .insert({
        message_id: data?.id || null,
        direction: 'outbound',
        from_address: fromAddress,
        to_address: toArray,
        cc: ccArray,
        bcc: bccArray,
        subject,
        body_html: html || null,
        body_text: text || null,
        reply_to_message_id: replyToEmailId || null,
        status: 'sent',
        read: true,
        folder: 'sent',
      })
      .select('id')
      .single();

    if (insertError) {
      console.error('[EMAIL-SEND] Insert error:', insertError.message);
    }

    return NextResponse.json({
      success: true,
      id: emailRecord?.id,
      messageId: data?.id,
    });
  } catch (err: any) {
    console.error('[EMAIL-SEND] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
