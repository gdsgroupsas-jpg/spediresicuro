import { supabaseAdmin } from '@/lib/db/client';
import { isAdminOrAbove } from '@/lib/auth-helpers';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { requireWorkspaceAuth } from '@/lib/workspace-auth';
import { getUserWorkspaceId } from '@/lib/db/user-helpers';
import type { Invoice } from '@/types/invoices';
import { internalGenerateInvoiceFromRecharges } from './invoice-recharges-generate.impl';

/**
 * Genera fattura periodica (mensile/trimestrale)
 */
export async function generatePeriodicInvoiceActionImpl(params: {
  userId: string;
  periodStart: string;
  periodEnd: string;
  periodType: 'monthly' | 'quarterly' | 'yearly';
}): Promise<{
  success: boolean;
  invoice?: Invoice;
  error?: string;
}> {
  try {
    const context = await requireWorkspaceAuth();

    const isAdmin = isAdminOrAbove(context.actor);

    if (!isAdmin) {
      return {
        success: false,
        error: 'Solo admin puo generare fatture periodiche',
      };
    }

    const { data: recharges, error: rechargesError } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id, amount, created_at')
      .eq('user_id', params.userId)
      .gt('amount', 0)
      .gte('created_at', params.periodStart)
      .lte('created_at', params.periodEnd)
      .not('id', 'in', supabaseAdmin.from('invoice_recharge_links').select('wallet_transaction_id'))
      .order('created_at', { ascending: true });

    if (rechargesError) {
      return {
        success: false,
        error: 'Errore recupero ricariche',
      };
    }

    if (!recharges || recharges.length === 0) {
      return {
        success: false,
        error: 'Nessuna ricarica da fatturare nel periodo specificato',
      };
    }

    const transactionIds = recharges.map((recharge) => recharge.id);

    return await internalGenerateInvoiceFromRecharges({
      userId: params.userId,
      transactionIds,
      invoiceType: 'periodic',
      periodStart: params.periodStart,
      periodEnd: params.periodEnd,
      notes: `Fattura ${params.periodType} dal ${params.periodStart} al ${params.periodEnd}`,
      generateXML: true,
    });
  } catch (error: any) {
    console.error('Errore generatePeriodicInvoiceAction:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto',
    };
  }
}

/**
 * Configura regola generazione fatture per utente
 */
export async function configureInvoiceGenerationRuleActionImpl(params: {
  userId: string;
  generationType: 'automatic' | 'manual' | 'periodic';
  periodFrequency?: 'monthly' | 'quarterly' | 'yearly';
  periodDay?: number;
  includeStripe?: boolean;
  includeBankTransfer?: boolean;
  minAmount?: number;
}): Promise<{
  success: boolean;
  ruleId?: string;
  error?: string;
}> {
  try {
    const context = await requireWorkspaceAuth();

    const isAdmin = isAdminOrAbove(context.actor);

    if (!isAdmin) {
      return {
        success: false,
        error: 'Solo admin puo configurare regole fatturazione',
      };
    }

    await supabaseAdmin
      .from('invoice_generation_rules')
      .update({ is_active: false })
      .eq('user_id', params.userId)
      .eq('generation_type', params.generationType);

    const { data: rule, error: ruleError } = await supabaseAdmin
      .from('invoice_generation_rules')
      .insert({
        user_id: params.userId,
        generation_type: params.generationType,
        period_frequency: params.periodFrequency || null,
        period_day: params.periodDay || null,
        include_stripe: params.includeStripe ?? true,
        include_bank_transfer: params.includeBankTransfer ?? true,
        min_amount: params.minAmount || 0,
        is_active: true,
      })
      .select('id')
      .single();

    if (ruleError) {
      return {
        success: false,
        error: ruleError.message || 'Errore creazione regola',
      };
    }

    return {
      success: true,
      ruleId: rule.id,
    };
  } catch (error: any) {
    console.error('Errore configureInvoiceGenerationRuleAction:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto',
    };
  }
}

/**
 * Lista ricariche non ancora fatturate per utente
 */
export async function listUninvoicedRechargesActionImpl(userId: string): Promise<{
  success: boolean;
  recharges?: Array<{
    id: string;
    amount: number;
    type: string;
    description: string;
    created_at: string;
  }>;
  error?: string;
}> {
  try {
    const context = await requireWorkspaceAuth();

    const isAdmin = isAdminOrAbove(context.actor);

    if (!isAdmin && context.target.id !== userId) {
      return {
        success: false,
        error: 'Non autorizzato',
      };
    }

    const { data: recharges, error: rechargesError } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id, amount, type, description, created_at')
      .eq('user_id', userId)
      .gt('amount', 0)
      .not('id', 'in', supabaseAdmin.from('invoice_recharge_links').select('wallet_transaction_id'))
      .order('created_at', { ascending: false });

    if (rechargesError) {
      return {
        success: false,
        error: 'Errore recupero ricariche',
      };
    }

    return {
      success: true,
      recharges: recharges || [],
    };
  } catch (error: any) {
    console.error('Errore listUninvoicedRechargesAction:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto',
    };
  }
}

/**
 * Genera fattura mensile per utente postpagato.
 */
export async function generatePostpaidMonthlyInvoiceImpl(
  userId: string,
  yearMonth: string
): Promise<{
  success: boolean;
  invoice?: Invoice;
  error?: string;
}> {
  try {
    const context = await requireWorkspaceAuth();
    const isAdmin = isAdminOrAbove(context.actor);
    const isReseller = (context.actor as unknown as { is_reseller?: boolean }).is_reseller === true;

    if (!isAdmin && !isReseller) {
      return { success: false, error: 'Solo admin o reseller possono generare fatture postpaid' };
    }

    if (isReseller && !isAdmin) {
      const { data: resellerUser } = await supabaseAdmin
        .from('users')
        .select('id, primary_workspace_id')
        .eq('email', context.actor.email)
        .single();

      if (!resellerUser) {
        return { success: false, error: 'Reseller non trovato' };
      }

      const { data: targetParent } = await supabaseAdmin
        .from('users')
        .select('parent_id')
        .eq('id', userId)
        .single();

      let isOwner = targetParent?.parent_id === resellerUser.id;

      if (!isOwner && resellerUser.primary_workspace_id) {
        const { data: subUserWs } = await supabaseAdmin
          .from('workspace_members')
          .select('workspace_id, workspaces!inner(parent_workspace_id)')
          .eq('user_id', userId)
          .eq('status', 'active')
          .eq('role', 'owner');

        if (subUserWs) {
          isOwner = subUserWs.some(
            (member: any) =>
              member.workspaces?.parent_workspace_id === resellerUser.primary_workspace_id
          );
        }
      }

      if (!isOwner) {
        return {
          success: false,
          error: 'Non hai i permessi per generare fatture per questo utente.',
        };
      }
    }

    const monthMatch = yearMonth.match(/^(\d{4})-(\d{2})$/);
    if (!monthMatch) {
      return { success: false, error: 'Formato mese non valido. Usare YYYY-MM.' };
    }

    const year = parseInt(monthMatch[1]);
    const month = parseInt(monthMatch[2]);

    if (month < 1 || month > 12) {
      return { success: false, error: 'Mese non valido. Deve essere tra 01 e 12.' };
    }

    if (year < 2020 || year > 2100) {
      return { success: false, error: 'Anno non valido.' };
    }

    const periodStart = new Date(year, month - 1, 1).toISOString();
    const periodEnd = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    const { data: targetUser, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, billing_mode, name, email')
      .eq('id', userId)
      .single();

    if (userError || !targetUser) {
      return { success: false, error: 'Utente non trovato' };
    }

    if (targetUser.billing_mode !== 'postpagato') {
      return { success: false, error: "L'utente non e' in modalita' postpagato" };
    }

    const postpaidWsId = await getUserWorkspaceId(userId);
    const postpaidWq = postpaidWsId ? workspaceQuery(postpaidWsId) : supabaseAdmin;

    const { data: existingInvoice } = await postpaidWq
      .from('invoices')
      .select('id, invoice_number')
      .eq('user_id', userId)
      .eq('invoice_type', 'periodic')
      .gte('period_start', periodStart)
      .lte('period_end', periodEnd)
      .limit(1);

    if (existingInvoice && existingInvoice.length > 0) {
      return {
        success: false,
        error: `Fattura gia\' generata per ${yearMonth}: ${existingInvoice[0].invoice_number}`,
      };
    }

    const { data: charges, error: chargesError } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id, amount, description, created_at, reference_id')
      .eq('user_id', userId)
      .eq('type', 'POSTPAID_CHARGE')
      .gte('created_at', periodStart)
      .lte('created_at', periodEnd)
      .order('created_at', { ascending: true });

    if (chargesError) {
      return { success: false, error: 'Errore recupero spedizioni postpagato' };
    }

    if (!charges || charges.length === 0) {
      return { success: false, error: `Nessuna spedizione postpagata trovata per ${yearMonth}` };
    }

    const subtotal = charges.reduce((sum, charge) => sum + Math.abs(charge.amount), 0);
    const taxRate = 22;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    const { data: nextNumber } = await supabaseAdmin.rpc('get_next_invoice_number');
    const invoiceNumber = nextNumber || `${year}-DRAFT`;

    const { data: newInvoice, error: invoiceError } = await postpaidWq
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
        notes: `Fattura spedizioni postpagato - ${yearMonth}`,
        created_by: context.actor.id,
      })
      .select()
      .single();

    if (invoiceError || !newInvoice) {
      console.error('Errore creazione fattura postpaid:', invoiceError);
      return { success: false, error: 'Errore creazione fattura' };
    }

    const items = charges.map((charge) => ({
      invoice_id: newInvoice.id,
      shipment_id: charge.reference_id || null,
      description: charge.description || `Spedizione postpagata`,
      quantity: 1,
      unit_price: Math.abs(charge.amount),
      tax_rate: taxRate,
      total: Math.abs(charge.amount),
    }));

    const { error: itemsError } = await postpaidWq.from('invoice_items').insert(items);

    if (itemsError) {
      console.error('Errore creazione invoice items - rollback fattura:', itemsError);
      await postpaidWq.from('invoices').delete().eq('id', newInvoice.id);
      return {
        success: false,
        error: 'Errore creazione dettagli fattura. Nessuna fattura generata.',
      };
    }

    const links = charges.map((charge) => ({
      invoice_id: newInvoice.id,
      wallet_transaction_id: charge.id,
      amount: Math.abs(charge.amount),
    }));

    const { error: linksError } = await supabaseAdmin.from('invoice_recharge_links').insert(links);

    if (linksError) {
      console.error('Errore creazione links anti-duplicazione - rollback fattura:', linksError);
      await postpaidWq.from('invoice_items').delete().eq('invoice_id', newInvoice.id);
      await postpaidWq.from('invoices').delete().eq('id', newInvoice.id);
      return {
        success: false,
        error: 'Errore collegamento transazioni. Nessuna fattura generata.',
      };
    }

    return {
      success: true,
      invoice: newInvoice as any,
    };
  } catch (error: any) {
    console.error('Errore generatePostpaidMonthlyInvoice:', error);
    return { success: false, error: error.message || 'Errore sconosciuto' };
  }
}
