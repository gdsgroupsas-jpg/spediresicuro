/**
 * API Route: Cron Job - Expire Commercial Quotes
 *
 * Endpoint: POST /api/cron/expire-quotes
 *
 * Due operazioni:
 * 1. Auto-scadenza: preventivi sent/negotiating con expires_at passato -> status = 'expired'
 * 2. Reminder: preventivi in scadenza entro 5 giorni -> email reminder al reseller (se non gia' inviato)
 *
 * Security: Requires CRON_SECRET header for authentication.
 *
 * @module api/cron/expire-quotes
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { sendQuoteExpiryReminderEmail } from '@/lib/email/resend';
import { AUDIT_ACTIONS } from '@/lib/security/audit-actions';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET;
const REMINDER_DAYS_BEFORE = 5;

export async function POST(request: NextRequest) {
  try {
    // 1. Verify cron secret
    const cronSecret =
      request.headers.get('x-cron-secret') ||
      request.headers.get('authorization')?.replace('Bearer ', '');

    if (!CRON_SECRET) {
      return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }

    if (cronSecret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date().toISOString();
    let expiredCount = 0;
    let remindedCount = 0;

    // ─── STEP 1: Auto-scadenza preventivi ───

    const { data: expiredQuotes, error: expireError } = await supabaseAdmin
      .from('commercial_quotes')
      .select('id, workspace_id, prospect_company')
      .in('status', ['sent', 'negotiating'])
      .not('expires_at', 'is', null)
      .lt('expires_at', now);

    if (expireError) {
      console.error('[CRON] expire-quotes: errore query scaduti:', expireError);
    } else if (expiredQuotes && expiredQuotes.length > 0) {
      const quoteIds = expiredQuotes.map((q) => q.id);

      // Aggiorna status in batch
      const { error: updateError } = await supabaseAdmin
        .from('commercial_quotes')
        .update({ status: 'expired' })
        .in('id', quoteIds);

      if (updateError) {
        console.error('[CRON] expire-quotes: errore update:', updateError);
      } else {
        expiredCount = quoteIds.length;

        // Inserisci eventi lifecycle (per workspace)
        const eventsByWs = new Map<
          string | null,
          Array<{
            quote_id: string;
            event_type: 'expired';
            event_data: Record<string, unknown>;
            actor_id: null;
          }>
        >();
        for (const q of expiredQuotes) {
          const wsKey = q.workspace_id || null;
          if (!eventsByWs.has(wsKey)) eventsByWs.set(wsKey, []);
          eventsByWs.get(wsKey)!.push({
            quote_id: q.id,
            event_type: 'expired' as const,
            event_data: { reason: 'auto_expiry', cron: true },
            actor_id: null,
          });
        }
        for (const [wsKey, wsEvents] of eventsByWs) {
          const evDb = wsKey ? workspaceQuery(wsKey) : supabaseAdmin;
          await evDb.from('commercial_quote_events').insert(wsEvents);
        }

        // Audit log (system actor, workspace-isolated)
        const auditEntries = expiredQuotes.map((q) => ({
          action: AUDIT_ACTIONS.COMMERCIAL_QUOTE_EXPIRED,
          resource_type: 'commercial_quote',
          resource_id: q.id,
          user_id: null,
          user_email: 'system@cron',
          actor_id: null,
          target_id: null,
          workspace_id: q.workspace_id || null,
          impersonation_active: false,
          audit_metadata: {
            prospect_company: q.prospect_company,
            reason: 'auto_expiry_cron',
          },
          created_at: now,
        }));
        // Raggruppa per workspace_id e inserisci con isolamento
        const byWorkspace = new Map<string | null, typeof auditEntries>();
        for (const entry of auditEntries) {
          const wsKey = entry.workspace_id || null;
          if (!byWorkspace.has(wsKey)) byWorkspace.set(wsKey, []);
          byWorkspace.get(wsKey)!.push(entry);
        }
        for (const [wsId, entries] of byWorkspace) {
          const db = wsId ? workspaceQuery(wsId) : supabaseAdmin;
          await db.from('audit_logs').insert(entries);
        }

        console.log(`[CRON] expire-quotes: ${expiredCount} preventivi scaduti`);
      }
    }

    // ─── STEP 2: Reminder pre-scadenza ───

    const reminderDeadline = new Date();
    reminderDeadline.setDate(reminderDeadline.getDate() + REMINDER_DAYS_BEFORE);
    const reminderDeadlineStr = reminderDeadline.toISOString();

    // Preventivi che scadono entro REMINDER_DAYS_BEFORE giorni
    const { data: soonExpiring, error: soonError } = await supabaseAdmin
      .from('commercial_quotes')
      .select('id, workspace_id, prospect_company, expires_at, created_by')
      .in('status', ['sent', 'negotiating'])
      .not('expires_at', 'is', null)
      .gt('expires_at', now) // Non ancora scaduti
      .lte('expires_at', reminderDeadlineStr);

    if (soonError) {
      console.error('[CRON] expire-quotes: errore query reminder:', soonError);
    } else if (soonExpiring && soonExpiring.length > 0) {
      for (const quote of soonExpiring) {
        const quoteDb = quote.workspace_id ? workspaceQuery(quote.workspace_id) : supabaseAdmin;

        // Controlla se reminder gia' inviato per questa quote
        const { data: existingReminder } = await quoteDb
          .from('commercial_quote_events')
          .select('id')
          .eq('quote_id', quote.id)
          .eq('event_type', 'reminder_sent')
          .limit(1);

        if (existingReminder && existingReminder.length > 0) {
          continue; // Gia' inviato, skip
        }

        // Carica email del reseller (created_by)
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('email, full_name')
          .eq('id', quote.created_by)
          .single();

        if (!user?.email) continue;

        // Invia reminder (non-bloccante)
        try {
          await sendQuoteExpiryReminderEmail({
            to: user.email,
            resellerName: user.full_name || user.email,
            prospectCompany: quote.prospect_company,
            expiresAt: quote.expires_at!,
          });

          // Registra evento
          await quoteDb.from('commercial_quote_events').insert({
            quote_id: quote.id,
            event_type: 'reminder_sent',
            event_data: { sent_to: user.email },
            actor_id: null,
          });

          remindedCount++;
        } catch (emailErr: any) {
          console.error(
            `[CRON] expire-quotes: errore email reminder per ${quote.id}:`,
            emailErr.message
          );
        }
      }

      console.log(`[CRON] expire-quotes: ${remindedCount} reminder inviati`);
    }

    return NextResponse.json({
      success: true,
      expired_count: expiredCount,
      reminded_count: remindedCount,
      timestamp: now,
    });
  } catch (error: any) {
    console.error('[CRON] expire-quotes exception:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GET per health check
export async function GET() {
  return NextResponse.json({
    name: 'expire-quotes',
    description: 'Auto-scadenza preventivi commerciali + reminder pre-scadenza',
    method: 'POST',
    auth: 'x-cron-secret or Bearer token',
  });
}
