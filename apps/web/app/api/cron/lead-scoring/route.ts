/**
 * API Route: Cron Job - Lead & Prospect Scoring
 *
 * Endpoint: POST /api/cron/lead-scoring
 *
 * Ricalcola il lead_score per tutti i lead e prospect attivi.
 * Se il delta score e >= 10 punti, registra un evento 'score_changed'.
 *
 * Security: Requires CRON_SECRET header for authentication.
 * Schedule: Ogni 12 ore (vercel.json)
 *
 * @module api/cron/lead-scoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { calculateLeadScore } from '@/lib/crm/lead-scoring';
import type { LeadScoreInput } from '@/lib/crm/lead-scoring';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET;
const SCORE_CHANGE_THRESHOLD = 10;

// Mapping status lead → prospect (per lo scoring condiviso)
function mapLeadStatus(
  status: string
): 'new' | 'contacted' | 'quote_sent' | 'negotiating' | 'won' | 'lost' {
  const map: Record<string, string> = {
    new: 'new',
    contacted: 'contacted',
    qualified: 'contacted',
    negotiation: 'negotiating',
    won: 'won',
    lost: 'lost',
    // Prospect status (gia' compatibili)
    quote_sent: 'quote_sent',
    negotiating: 'negotiating',
  };
  return (map[status] || 'new') as
    | 'new'
    | 'contacted'
    | 'quote_sent'
    | 'negotiating'
    | 'won'
    | 'lost';
}

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

    const now = new Date();
    let leadsUpdated = 0;
    let prospectsUpdated = 0;
    let eventsCreated = 0;

    // ─── STEP 1: Ricalcola score lead attivi ───

    const { data: leads, error: leadsError } = await supabaseAdmin
      .from('leads')
      .select(
        'id, workspace_id, status, email, phone, sector, estimated_monthly_volume, email_open_count, last_contact_at, created_at, lead_score'
      )
      .not('status', 'in', '("won","lost")');

    if (leadsError) {
      console.error('[CRON] lead-scoring: errore query leads:', leadsError);
    } else if (leads && leads.length > 0) {
      for (const lead of leads) {
        const input: LeadScoreInput = {
          email: lead.email,
          phone: lead.phone,
          sector: lead.sector,
          estimated_monthly_volume: lead.estimated_monthly_volume,
          status: mapLeadStatus(lead.status),
          email_open_count: lead.email_open_count,
          last_contact_at: lead.last_contact_at,
          created_at: lead.created_at,
          linked_quote_ids: [],
        };

        const newScore = calculateLeadScore(input, now);
        const oldScore = lead.lead_score || 0;

        if (newScore !== oldScore) {
          const leadDb = lead.workspace_id ? workspaceQuery(lead.workspace_id) : supabaseAdmin;
          await leadDb.from('leads').update({ lead_score: newScore }).eq('id', lead.id);
          leadsUpdated++;

          // Evento se delta significativo
          if (Math.abs(newScore - oldScore) >= SCORE_CHANGE_THRESHOLD) {
            await leadDb.from('lead_events').insert({
              lead_id: lead.id,
              event_type: 'score_changed',
              event_data: { old_score: oldScore, new_score: newScore, source: 'cron' },
              actor_id: null,
            });
            eventsCreated++;
          }
        }
      }
    }

    // ─── STEP 2: Ricalcola score prospect attivi ───

    const { data: prospects, error: prospectsError } = await supabaseAdmin
      .from('reseller_prospects')
      .select(
        'id, workspace_id, status, email, phone, sector, estimated_monthly_volume, email_open_count, last_contact_at, created_at, lead_score, linked_quote_ids'
      )
      .not('status', 'in', '("won","lost")');

    if (prospectsError) {
      console.error('[CRON] lead-scoring: errore query prospects:', prospectsError);
    } else if (prospects && prospects.length > 0) {
      for (const prospect of prospects) {
        const input: LeadScoreInput = {
          email: prospect.email,
          phone: prospect.phone,
          sector: prospect.sector,
          estimated_monthly_volume: prospect.estimated_monthly_volume,
          status: mapLeadStatus(prospect.status),
          email_open_count: prospect.email_open_count,
          last_contact_at: prospect.last_contact_at,
          created_at: prospect.created_at,
          linked_quote_ids: prospect.linked_quote_ids,
        };

        const newScore = calculateLeadScore(input, now);
        const oldScore = prospect.lead_score || 0;

        if (newScore !== oldScore) {
          const prospectDb = prospect.workspace_id
            ? workspaceQuery(prospect.workspace_id)
            : supabaseAdmin;
          await prospectDb
            .from('reseller_prospects')
            .update({ lead_score: newScore })
            .eq('id', prospect.id);
          prospectsUpdated++;

          // Evento se delta significativo
          if (Math.abs(newScore - oldScore) >= SCORE_CHANGE_THRESHOLD) {
            await prospectDb.from('prospect_events').insert({
              prospect_id: prospect.id,
              event_type: 'score_changed',
              event_data: { old_score: oldScore, new_score: newScore, source: 'cron' },
              actor_id: null,
            });
            eventsCreated++;
          }
        }
      }
    }

    console.log(
      `[CRON] lead-scoring: leads=${leadsUpdated}, prospects=${prospectsUpdated}, events=${eventsCreated}`
    );

    return NextResponse.json({
      success: true,
      leads_updated: leadsUpdated,
      prospects_updated: prospectsUpdated,
      events_created: eventsCreated,
      timestamp: now.toISOString(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CRON] lead-scoring exception:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET per health check
export async function GET() {
  return NextResponse.json({
    name: 'lead-scoring',
    description: 'Ricalcolo periodico score per lead e prospect attivi',
    method: 'POST',
    auth: 'x-cron-secret or Bearer token',
    schedule: 'every 12 hours',
  });
}
