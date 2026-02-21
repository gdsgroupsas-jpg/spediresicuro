/**
 * Handler: Alert Saldo Basso
 *
 * Invia notifiche ai workspace il cui saldo wallet scende sotto soglia.
 * Deduplicazione: non invia se già notificato nelle ultime 24h.
 */

import { supabaseAdmin } from '@/lib/db/client';
import { sendEmail } from '@/lib/email/resend';
import type { Automation, AutomationResult } from '@/types/automations';

interface LowBalanceConfig {
  thresholdEur?: number;
  notifyOwner?: boolean;
  notifyAdmin?: boolean;
}

/** Sanitizzazione base anti-XSS per contenuto email HTML */
function escapeHtml(s: string | null | undefined): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function handleLowBalanceAlert(
  rawConfig: Record<string, unknown>,
  automation: Automation
): Promise<AutomationResult> {
  const config: LowBalanceConfig = rawConfig as LowBalanceConfig;
  const threshold = config.thresholdEur ?? 10;

  // Trova workspace con saldo sotto soglia
  const { data: lowBalanceWorkspaces, error } = await supabaseAdmin
    .from('workspaces')
    .select('id, name, wallet_balance')
    .lt('wallet_balance', threshold);

  if (error || !lowBalanceWorkspaces) {
    return {
      success: false,
      itemsProcessed: 0,
      itemsFailed: 0,
      error: `Errore query workspaces: ${error?.message}`,
    };
  }

  if (lowBalanceWorkspaces.length === 0) {
    return {
      success: true,
      itemsProcessed: 0,
      itemsFailed: 0,
      details: { message: 'Nessun workspace sotto soglia', threshold },
    };
  }

  // Deduplicazione: controlla se abbiamo già notificato nelle ultime 24h
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentRuns } = await supabaseAdmin
    .from('automation_runs')
    .select('id, result')
    .eq('automation_id', automation.id)
    .eq('status', 'success')
    .gte('started_at', twentyFourHoursAgo)
    .limit(1);

  const recentlyNotifiedWorkspaceIds: Set<string> = new Set();
  if (recentRuns && recentRuns.length > 0 && recentRuns[0].result) {
    const prevResult = recentRuns[0].result as { notifiedWorkspaces?: string[] };
    if (prevResult.notifiedWorkspaces) {
      prevResult.notifiedWorkspaces.forEach((id: string) => recentlyNotifiedWorkspaceIds.add(id));
    }
  }

  let processed = 0;
  let failed = 0;
  const notifiedWorkspaces: string[] = [];
  const errors: Array<{ workspaceId: string; error: string }> = [];

  for (const ws of lowBalanceWorkspaces) {
    // Dedup: salta se già notificato nelle ultime 24h
    if (recentlyNotifiedWorkspaceIds.has(ws.id)) {
      continue;
    }

    try {
      if (config.notifyOwner) {
        // Trova owner del workspace
        const { data: owner } = await supabaseAdmin
          .from('workspace_members')
          .select('user_id, users!inner(email, name)')
          .eq('workspace_id', ws.id)
          .eq('role', 'owner')
          .eq('status', 'active')
          .limit(1)
          .single();

        if (owner) {
          const userData = owner.users as unknown as { email: string; name: string };
          await sendEmail({
            to: userData.email,
            subject: `Saldo basso — ${escapeHtml(ws.name) || 'Il tuo workspace'}`,
            html: `<div style="font-family: -apple-system, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background: linear-gradient(135deg, #d97706, #f59e0b); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0; font-size: 24px;">Saldo Basso</h1>
              </div>
              <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
                <p>Ciao ${escapeHtml(userData.name) || 'utente'},</p>
                <p>Il saldo del workspace <strong>${escapeHtml(ws.name) || 'principale'}</strong> è sceso sotto la soglia di <strong>&euro;${threshold.toFixed(2)}</strong>.</p>
                <div style="background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; padding: 16px; margin: 16px 0; text-align: center;">
                  <p style="color: #92400e; margin: 0 0 8px;">Saldo attuale</p>
                  <p style="color: #d97706; font-size: 28px; font-weight: 700; margin: 0;">&euro;${(ws.wallet_balance || 0).toFixed(2)}</p>
                </div>
                <p>Ricarica il wallet per continuare a spedire senza interruzioni.</p>
                <div style="text-align: center; margin: 24px 0;">
                  <a href="https://spediresicuro.it/dashboard/wallet" style="display: inline-block; background: linear-gradient(135deg, #d97706, #f59e0b); color: white; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none;">
                    Ricarica Wallet
                  </a>
                </div>
              </div>
            </div>`,
          });
        }
      }

      processed++;
      notifiedWorkspaces.push(ws.id);
    } catch (err: any) {
      failed++;
      errors.push({ workspaceId: ws.id, error: err.message });
    }
  }

  // Notifica admin con riepilogo
  if (config.notifyAdmin && (processed > 0 || failed > 0)) {
    const adminEmails = await getAdminEmails();
    if (adminEmails.length > 0) {
      await sendEmail({
        to: adminEmails,
        subject: `Alert saldo basso — ${processed} workspace sotto €${threshold}`,
        html: `<h2>Alert Saldo Basso</h2>
          <p>Soglia: <strong>€${threshold.toFixed(2)}</strong></p>
          <p>Workspace notificati: <strong>${processed}</strong></p>
          <p>Errori: <strong>${failed}</strong></p>
          ${lowBalanceWorkspaces.length > 0 ? `<h3>Workspace sotto soglia:</h3><ul>${lowBalanceWorkspaces.map((ws) => `<li>${escapeHtml(ws.name) || ws.id} — &euro;${(ws.wallet_balance || 0).toFixed(2)}</li>`).join('')}</ul>` : ''}`,
      }).catch(() => {
        /* email non critica */
      });
    }
  }

  return {
    success: failed === 0,
    itemsProcessed: processed,
    itemsFailed: failed,
    details: {
      threshold,
      totalLowBalance: lowBalanceWorkspaces.length,
      notifiedWorkspaces,
      errors,
    },
  };
}

/**
 * Recupera email admin per notifiche.
 */
async function getAdminEmails(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('email')
    .in('account_type', ['admin', 'superadmin']);

  return (data || []).map((u) => u.email).filter(Boolean);
}
