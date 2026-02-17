/**
 * Handler: Fatturazione Mensile Postpagato
 *
 * Genera fatture mensili per tutti gli utenti postpagato.
 * Logica estratta da actions/invoice-recharges.ts:696-865.
 *
 * Differenze dal caller originale:
 * - Nessuna autenticazione utente (contesto system/cron)
 * - Ciclo su TUTTI gli utenti postpagato (non singolo userId)
 * - Supporto dryRun
 * - Notifiche email admin/owner
 */

import { supabaseAdmin } from '@/lib/db/client';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { getUserWorkspaceId } from '@/lib/db/user-helpers';
import { sendEmail } from '@/lib/email/resend';
import type { Automation, AutomationResult } from '@/types/automations';

interface PostpaidCharge {
  id: string;
  amount: number;
  description: string | null;
  created_at: string;
  reference_id: string | null;
}

interface PostpaidBillingConfig {
  dryRun?: boolean;
  notifyAdmin?: boolean;
  notifyWorkspaceOwner?: boolean;
}

/** Sanitizzazione base anti-XSS per contenuto email HTML */
function escapeHtml(s: string | null | undefined): string {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Determina il mese precedente in formato 'YYYY-MM'.
 */
function getPreviousMonth(now: Date = new Date()): string {
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export async function handlePostpaidBilling(
  rawConfig: Record<string, unknown>,
  _automation: Automation
): Promise<AutomationResult> {
  const config: PostpaidBillingConfig = rawConfig as PostpaidBillingConfig;
  const yearMonth = getPreviousMonth();
  const monthMatch = yearMonth.match(/^(\d{4})-(\d{2})$/);
  if (!monthMatch) {
    return { success: false, itemsProcessed: 0, itemsFailed: 0, error: 'Formato mese invalido' };
  }

  const year = parseInt(monthMatch[1]);
  const month = parseInt(monthMatch[2]);
  const periodStart = new Date(year, month - 1, 1).toISOString();
  const periodEnd = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

  // Trova tutti gli utenti postpagato
  const { data: postpaidUsers, error: usersError } = await supabaseAdmin
    .from('users')
    .select('id, name, email, billing_mode')
    .eq('billing_mode', 'postpagato');

  if (usersError || !postpaidUsers) {
    return {
      success: false,
      itemsProcessed: 0,
      itemsFailed: 0,
      error: `Errore query utenti postpagato: ${usersError?.message}`,
    };
  }

  if (postpaidUsers.length === 0) {
    return {
      success: true,
      itemsProcessed: 0,
      itemsFailed: 0,
      details: { message: 'Nessun utente postpagato trovato' },
    };
  }

  let processed = 0;
  let failed = 0;
  const invoices: Array<{ userId: string; email: string; invoiceNumber: string; total: number }> =
    [];
  const errors: Array<{ userId: string; error: string }> = [];

  for (const user of postpaidUsers) {
    try {
      const result = await generateInvoiceForUser(
        user.id,
        user.name,
        user.email,
        year,
        month,
        periodStart,
        periodEnd,
        config.dryRun || false
      );

      if (result.success && result.invoiceNumber) {
        processed++;
        invoices.push({
          userId: user.id,
          email: user.email,
          invoiceNumber: result.invoiceNumber,
          total: result.total || 0,
        });

        // Notifica owner workspace
        if (config.notifyWorkspaceOwner && !config.dryRun) {
          await sendEmail({
            to: user.email,
            subject: `Fattura ${yearMonth} — SpedireSicuro`,
            html: `<p>Gentile ${escapeHtml(user.name) || 'utente'},</p>
              <p>La fattura <strong>${escapeHtml(result.invoiceNumber)}</strong> per il mese di ${yearMonth} è stata generata.</p>
              <p>Importo totale (IVA inclusa): <strong>&euro;${(result.total || 0).toFixed(2)}</strong></p>
              <p>Puoi visualizzarla nella tua <a href="https://spediresicuro.it/dashboard">dashboard</a>.</p>`,
          }).catch(() => {
            /* email non critica */
          });
        }
      } else if (result.skipped) {
        // Nessuna spedizione per questo utente o fattura già esistente — skip ok
        continue;
      } else {
        failed++;
        errors.push({ userId: user.id, error: result.error || 'Errore sconosciuto' });
      }
    } catch (err: any) {
      failed++;
      errors.push({ userId: user.id, error: err.message });
    }
  }

  // Notifica admin
  if (config.notifyAdmin && (processed > 0 || failed > 0)) {
    const adminEmails = await getAdminEmails();
    if (adminEmails.length > 0) {
      const prefix = config.dryRun ? '[DRY RUN] ' : '';
      await sendEmail({
        to: adminEmails,
        subject: `${prefix}Fatturazione postpagato ${yearMonth} — Riepilogo`,
        html: `<h2>${prefix}Fatturazione Mensile Postpagato — ${yearMonth}</h2>
          <p>Utenti processati: <strong>${processed}</strong></p>
          <p>Errori: <strong>${failed}</strong></p>
          ${invoices.length > 0 ? `<h3>Fatture generate:</h3><ul>${invoices.map((i) => `<li>${escapeHtml(i.email)} — ${escapeHtml(i.invoiceNumber)} — &euro;${i.total.toFixed(2)}</li>`).join('')}</ul>` : ''}
          ${errors.length > 0 ? `<h3>Errori:</h3><ul>${errors.map((e) => `<li>${escapeHtml(e.userId)}: ${escapeHtml(e.error)}</li>`).join('')}</ul>` : ''}`,
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
      yearMonth,
      dryRun: config.dryRun || false,
      totalUsers: postpaidUsers.length,
      invoices: invoices.map((i) => ({
        email: i.email,
        invoiceNumber: i.invoiceNumber,
        total: i.total,
      })),
      errors,
    },
  };
}

/**
 * Genera fattura per un singolo utente postpagato.
 * Logica estratta da actions/invoice-recharges.ts:696-865.
 */
async function generateInvoiceForUser(
  userId: string,
  userName: string | null,
  _userEmail: string,
  year: number,
  month: number,
  periodStart: string,
  periodEnd: string,
  dryRun: boolean
): Promise<{
  success: boolean;
  skipped?: boolean;
  invoiceNumber?: string;
  total?: number;
  error?: string;
}> {
  // Recupera workspace per isolamento multi-tenant
  const wsId = await getUserWorkspaceId(userId);
  const wq = wsId ? workspaceQuery(wsId) : supabaseAdmin;

  // Verifica fattura già esistente per questo mese
  const { data: existingInvoice } = await wq
    .from('invoices')
    .select('id, invoice_number')
    .eq('user_id', userId)
    .eq('invoice_type', 'periodic')
    .gte('period_start', periodStart)
    .lte('period_end', periodEnd)
    .limit(1);

  if (existingInvoice && existingInvoice.length > 0) {
    return { success: false, skipped: true };
  }

  // Recupera POSTPAID_CHARGE del mese (via workspaceQuery per isolamento multi-tenant)
  const { data: chargesRaw, error: chargesError } = await wq
    .from('wallet_transactions')
    .select('id, amount, description, created_at, reference_id')
    .eq('user_id', userId)
    .eq('type', 'POSTPAID_CHARGE')
    .gte('created_at', periodStart)
    .lte('created_at', periodEnd)
    .order('created_at', { ascending: true });

  const charges = (chargesRaw || []) as PostpaidCharge[];

  if (chargesError) {
    return { success: false, error: `Errore recupero charges: ${chargesError.message}` };
  }

  if (!charges || charges.length === 0) {
    return { success: false, skipped: true };
  }

  // Calcola totali
  const subtotal = charges.reduce((sum, c) => sum + Math.abs(c.amount), 0);
  const taxRate = 22;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  if (dryRun) {
    return {
      success: true,
      invoiceNumber: `DRY-${year}-${String(month).padStart(2, '0')}`,
      total,
    };
  }

  // Genera numero fattura
  const { data: nextNumber } = await supabaseAdmin.rpc('get_next_invoice_number');
  const invoiceNumber = nextNumber || `${year}-DRAFT`;

  // Crea fattura
  const { data: newInvoice, error: invoiceError } = await wq
    .from('invoices')
    .insert({
      user_id: userId,
      invoice_number: invoiceNumber,
      invoice_date: new Date().toISOString(),
      due_date: (() => {
        const endOfMonth = new Date(year, month, 0);
        endOfMonth.setDate(endOfMonth.getDate() + 30);
        return endOfMonth.toISOString();
      })(),
      status: 'issued',
      subtotal,
      tax_amount: taxAmount,
      total,
      amount_paid: 0,
      currency: 'EUR',
      invoice_type: 'periodic',
      period_start: periodStart,
      period_end: periodEnd,
      notes: `Fattura spedizioni postpagato - ${year}-${String(month).padStart(2, '0')}`,
    })
    .select()
    .single();

  if (invoiceError || !newInvoice) {
    return { success: false, error: `Errore creazione fattura: ${invoiceError?.message}` };
  }

  // Crea invoice_items
  const items = charges.map((charge) => ({
    invoice_id: newInvoice.id,
    shipment_id: charge.reference_id || null,
    description: charge.description || 'Spedizione postpagata',
    quantity: 1,
    unit_price: Math.abs(charge.amount),
    tax_rate: taxRate,
    total: Math.abs(charge.amount),
  }));

  const { error: itemsError } = await wq.from('invoice_items').insert(items);

  if (itemsError) {
    // Rollback fattura
    await wq.from('invoices').delete().eq('id', newInvoice.id);
    return { success: false, error: `Errore creazione items: ${itemsError.message}` };
  }

  // Collega transazioni alla fattura (anti-duplicazione)
  const links = charges.map((charge) => ({
    invoice_id: newInvoice.id,
    wallet_transaction_id: charge.id,
    amount: Math.abs(charge.amount),
  }));

  const { error: linksError } = await supabaseAdmin.from('invoice_recharge_links').insert(links);

  if (linksError) {
    // Rollback items + fattura
    await wq.from('invoice_items').delete().eq('invoice_id', newInvoice.id);
    await wq.from('invoices').delete().eq('id', newInvoice.id);
    return { success: false, error: `Errore links anti-duplicazione: ${linksError.message}` };
  }

  return { success: true, invoiceNumber, total };
}

/**
 * Recupera email degli admin per notifiche.
 */
async function getAdminEmails(): Promise<string[]> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('email')
    .in('account_type', ['admin', 'superadmin']);

  return (data || []).map((u) => u.email).filter(Boolean);
}
