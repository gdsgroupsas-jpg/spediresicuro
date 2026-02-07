/**
 * API Route: Cron Job - CRM Health Check
 *
 * Endpoint: POST /api/cron/crm-health
 *
 * Analizza lead e prospect attivi, genera alert per:
 * - Prospect nuovi senza contatto (>3gg)
 * - Prospect contattati senza follow-up (>7gg)
 * - Lead caldi non contattati (score >80 + status new)
 * - Lead qualificati fermi (>5gg)
 * - Candidati win-back (persi >30gg)
 *
 * Invia notifiche via Telegram all'admin e email ai reseller.
 *
 * Security: Requires CRON_SECRET header for authentication.
 * Schedule: Ogni 6 ore (vercel.json)
 *
 * @module api/cron/crm-health
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/db/client';
import { evaluateHealthRules } from '@/lib/crm/health-rules';
import type { CrmAlert, HealthCheckEntity } from '@/lib/crm/health-rules';
import { sendAlert } from '@/lib/services/telegram-bot';
import type { AlertSeverity } from '@/lib/services/telegram-bot';
import { sendEmail } from '@/lib/email/resend';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET;

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
    const allAlerts: CrmAlert[] = [];

    // ─── STEP 1: Analisi Lead (Platform CRM) ───

    const { data: leads, error: leadsError } = await supabaseAdmin
      .from('leads')
      .select('id, company_name, status, lead_score, created_at, last_contact_at, updated_at')
      .not('status', 'eq', 'won');

    if (leadsError) {
      console.error('[CRON] crm-health: errore query leads:', leadsError);
    } else if (leads && leads.length > 0) {
      const leadAlerts = evaluateHealthRules(leads as HealthCheckEntity[], 'lead', now);
      allAlerts.push(...leadAlerts);
    }

    // ─── STEP 2: Analisi Prospect (Reseller CRM) ───

    const { data: prospects, error: prospectsError } = await supabaseAdmin
      .from('reseller_prospects')
      .select(
        'id, company_name, status, lead_score, created_at, last_contact_at, updated_at, workspace_id'
      )
      .not('status', 'eq', 'won');

    if (prospectsError) {
      console.error('[CRON] crm-health: errore query prospects:', prospectsError);
    } else if (prospects && prospects.length > 0) {
      const prospectAlerts = evaluateHealthRules(prospects as HealthCheckEntity[], 'prospect', now);
      allAlerts.push(...prospectAlerts);
    }

    // ─── STEP 3: Invia notifiche ───

    let telegramSent = 0;
    let emailSent = 0;

    if (allAlerts.length > 0) {
      // 3a. Alert Telegram all'admin (raggruppati per livello)
      const criticalAlerts = allAlerts.filter((a) => a.level === 'critical');
      const warningAlerts = allAlerts.filter((a) => a.level === 'warning');
      const infoAlerts = allAlerts.filter((a) => a.level === 'info');

      // Critical: singolo messaggio per ciascuno
      for (const alert of criticalAlerts) {
        const severity: AlertSeverity = 'critical';
        await sendAlert(severity, `CRM: ${alert.message}`, {
          Tipo: alert.type,
          Entita: `${alert.entityType} — ${alert.entityName}`,
          Giorni: alert.daysSinceEvent,
        });
        telegramSent++;
      }

      // Warning: raggruppati in un messaggio
      if (warningAlerts.length > 0) {
        const lines = warningAlerts
          .slice(0, 10)
          .map((a) => `• ${a.message}`)
          .join('\n');
        const extra = warningAlerts.length > 10 ? `\n...e altri ${warningAlerts.length - 10}` : '';
        await sendAlert('warning', `CRM Health: ${warningAlerts.length} warning`, {
          Dettaglio: `${lines}${extra}`,
        });
        telegramSent++;
      }

      // Info: raggruppati (win-back)
      if (infoAlerts.length > 0) {
        const lines = infoAlerts
          .slice(0, 5)
          .map((a) => `• ${a.message}`)
          .join('\n');
        await sendAlert('info', `CRM: ${infoAlerts.length} candidati win-back`, {
          Dettaglio: lines,
        });
        telegramSent++;
      }

      // 3b. Email ai reseller per i LORO prospect
      // Raggruppa prospect alerts per workspace
      const prospectAlerts = allAlerts.filter((a) => a.entityType === 'prospect');
      if (prospectAlerts.length > 0 && prospects) {
        const prospectMap = new Map(prospects.map((p) => [p.id, p]));
        const byWorkspace = new Map<string, CrmAlert[]>();

        for (const alert of prospectAlerts) {
          const prospect = prospectMap.get(alert.entityId);
          if (!prospect?.workspace_id) continue;
          const wsAlerts = byWorkspace.get(prospect.workspace_id) || [];
          wsAlerts.push(alert);
          byWorkspace.set(prospect.workspace_id, wsAlerts);
        }

        // Per ogni workspace, trova il reseller owner e invia email
        for (const [workspaceId, wsAlerts] of byWorkspace.entries()) {
          const { data: member } = await supabaseAdmin
            .from('workspace_members')
            .select('user_id, users!inner(email, name)')
            .eq('workspace_id', workspaceId)
            .eq('role', 'owner')
            .eq('status', 'active')
            .limit(1)
            .single();

          if (!member?.users) continue;

          const user = member.users as unknown as { email: string; name: string };
          if (!user.email) continue;

          // Costruisci email alert
          const alertRows = wsAlerts
            .map(
              (a) =>
                `<tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#334155;">${a.entityName}</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">${a.message}</td></tr>`
            )
            .join('');

          const html = `
            <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <div style="background:linear-gradient(135deg,#7c3aed,#a78bfa);padding:24px;border-radius:12px 12px 0 0;text-align:center;">
                <h1 style="color:white;margin:0;font-size:22px;">CRM Alert — Azione richiesta</h1>
              </div>
              <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;">
                <p style="color:#334155;font-size:15px;margin-top:0;">
                  Ciao ${user.name || 'Reseller'}, hai <strong>${wsAlerts.length}</strong> prospect che richiedono attenzione:
                </p>
                <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;border:1px solid #e2e8f0;">
                  <thead>
                    <tr style="background:#f1f5f9;">
                      <th style="padding:10px;text-align:left;color:#475569;font-size:13px;">Prospect</th>
                      <th style="padding:10px;text-align:left;color:#475569;font-size:13px;">Situazione</th>
                    </tr>
                  </thead>
                  <tbody>${alertRows}</tbody>
                </table>
                <div style="text-align:center;margin-top:20px;">
                  <a href="https://spediresicuro.it/dashboard/prospects" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#7c3aed,#6d28d9);color:white;text-decoration:none;border-radius:8px;font-weight:600;">Gestisci Prospect</a>
                </div>
              </div>
              <div style="text-align:center;padding:16px;color:#94a3b8;font-size:12px;">
                SpedireSicuro — Notifica automatica CRM
              </div>
            </div>
          `;

          try {
            await sendEmail({
              to: user.email,
              subject: `CRM: ${wsAlerts.length} prospect richiedono attenzione`,
              html,
            });
            emailSent++;
          } catch (emailErr: unknown) {
            const msg = emailErr instanceof Error ? emailErr.message : 'unknown';
            console.error(`[CRON] crm-health: errore email a ${user.email}:`, msg);
          }
        }
      }
    }

    console.log(
      `[CRON] crm-health: ${allAlerts.length} alert (${telegramSent} telegram, ${emailSent} email)`
    );

    return NextResponse.json({
      success: true,
      alerts_total: allAlerts.length,
      alerts_critical: allAlerts.filter((a) => a.level === 'critical').length,
      alerts_warning: allAlerts.filter((a) => a.level === 'warning').length,
      alerts_info: allAlerts.filter((a) => a.level === 'info').length,
      telegram_sent: telegramSent,
      email_sent: emailSent,
      timestamp: now.toISOString(),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CRON] crm-health exception:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// GET per health check
export async function GET() {
  return NextResponse.json({
    name: 'crm-health',
    description: 'Analisi salute pipeline CRM (lead + prospect) con alert Telegram + email',
    method: 'POST',
    auth: 'x-cron-secret or Bearer token',
    schedule: 'every 6 hours',
  });
}
