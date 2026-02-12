/**
 * Server Actions: Invoice Recharges Management
 *
 * Sistema fatturazione ricariche wallet:
 * - Automatica per ricariche Stripe
 * - Manuale per bonifici (dopo approvazione)
 * - Periodica (mensile/trimestrale/riepilogativa)
 *
 * @module actions/invoice-recharges
 */

'use server';

import { supabaseAdmin } from '@/lib/db/client';
import { generateInvoicePDF, InvoiceData } from '@/lib/invoices/pdf-generator';
import {
  FatturaPAData,
  generateInvoiceXML,
  validateFatturaPAData,
} from '@/lib/invoices/xml-generator';
import { requireSafeAuth } from '@/lib/safe-auth';
import type { Invoice } from '@/types/invoices';

/**
 * Genera fattura da ricariche wallet
 *
 * ⚠️ RICHIEDE AUTENTICAZIONE: Solo admin può chiamare questa action.
 * Per uso interno (webhook), usa internalGenerateInvoiceFromRecharges().
 *
 * @param params - Parametri generazione fattura
 * @returns Fattura creata con PDF e XML
 */
export async function generateInvoiceFromRechargesAction(params: {
  userId: string;
  transactionIds: string[];
  invoiceType?: 'recharge' | 'periodic' | 'manual';
  periodStart?: string; // ISO date
  periodEnd?: string; // ISO date
  notes?: string;
  generateXML?: boolean; // Se true, genera anche XML FatturaPA
}): Promise<{
  success: boolean;
  invoice?: Invoice;
  error?: string;
}> {
  try {
    const context = await requireSafeAuth();

    // Solo admin/superadmin può generare fatture
    const isAdmin =
      context.actor.account_type === 'admin' || context.actor.account_type === 'superadmin';

    if (!isAdmin) {
      return {
        success: false,
        error: 'Solo admin può generare fatture',
      };
    }

    // 🔒 Usa funzione interna (dopo verifica auth)
    return await internalGenerateInvoiceFromRecharges(params);
  } catch (error: any) {
    console.error('Errore generateInvoiceFromRechargesAction:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto',
    };
  }
}

/**
 * 🔒 INTERNAL: Genera fattura da ricariche SENZA autenticazione
 *
 * Usata da webhook Stripe (system context, no user session).
 * Valida parametri e verifica ownership delle transazioni.
 *
 * ⚠️ NON esporre come Server Action pubblica - solo per uso interno.
 *
 * @param userId - ID utente proprietario delle ricariche
 * @param transactionIds - Array ID transazioni wallet
 * @param invoiceType - Tipo fattura
 * @param generateXML - Se true, genera anche XML FatturaPA
 * @returns Fattura creata
 */
async function internalGenerateInvoiceFromRecharges(params: {
  userId: string;
  transactionIds: string[];
  invoiceType?: 'recharge' | 'periodic' | 'manual';
  periodStart?: string;
  periodEnd?: string;
  notes?: string;
  generateXML?: boolean;
}): Promise<{
  success: boolean;
  invoice?: Invoice;
  error?: string;
}> {
  try {
    // Validazione input
    if (!params.userId || !params.transactionIds || params.transactionIds.length === 0) {
      return {
        success: false,
        error: 'Parametri mancanti: userId e transactionIds obbligatori',
      };
    }

    // 🔒 SICUREZZA: Verifica che tutte le transazioni appartengano all'utente
    const { data: transactions, error: txError } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id, user_id, amount, type')
      .in('id', params.transactionIds)
      .eq('user_id', params.userId) // ⚠️ CRITICAL: Verifica ownership
      .gt('amount', 0);

    if (txError) {
      return {
        success: false,
        error: 'Errore verifica transazioni',
      };
    }

    if (!transactions || transactions.length !== params.transactionIds.length) {
      return {
        success: false,
        error: "Una o più transazioni non trovate o non appartengono all'utente",
      };
    }

    // Verifica che non siano già fatturate
    const { data: existingLinks } = await supabaseAdmin
      .from('invoice_recharge_links')
      .select('wallet_transaction_id')
      .in('wallet_transaction_id', params.transactionIds);

    if (existingLinks && existingLinks.length > 0) {
      return {
        success: false,
        error: 'Una o più transazioni sono già state fatturate',
      };
    }

    // Chiama funzione SQL per creare fattura
    const { data: invoiceId, error: invoiceError } = await supabaseAdmin.rpc(
      'generate_invoice_from_recharges',
      {
        p_user_id: params.userId,
        p_transaction_ids: params.transactionIds,
        p_invoice_type: params.invoiceType || 'recharge',
        p_period_start: params.periodStart || null,
        p_period_end: params.periodEnd || null,
        p_notes: params.notes || null,
      }
    );

    if (invoiceError) {
      console.error('Errore generazione fattura:', invoiceError);
      return {
        success: false,
        error: invoiceError.message || 'Errore durante la generazione della fattura',
      };
    }

    // Recupera fattura creata con items
    const { data: invoice, error: fetchError } = await supabaseAdmin
      .from('invoices')
      .select(
        `
        *,
        items:invoice_items(*),
        user:users(
          id,
          name,
          email,
          company_name,
          vat_number,
          tax_code,
          address,
          city,
          province,
          zip,
          country,
          codiceSDI,
          pec
        )
      `
      )
      .eq('id', invoiceId)
      .single();

    if (fetchError || !invoice) {
      return {
        success: false,
        error: 'Errore recupero fattura creata',
      };
    }

    // Genera PDF
    const invoiceData: InvoiceData = {
      invoiceNumber: invoice.invoice_number || '',
      issueDate: invoice.invoice_date ? new Date(invoice.invoice_date) : new Date(),
      dueDate: invoice.due_date ? new Date(invoice.due_date) : undefined,
      sender: {
        companyName: process.env.COMPANY_NAME || 'GDS Group SAS',
        vatNumber: process.env.COMPANY_VAT_NUMBER || '',
        taxCode: process.env.COMPANY_TAX_CODE || '',
        address: process.env.COMPANY_ADDRESS || '',
        city: process.env.COMPANY_CITY || '',
        province: process.env.COMPANY_PROVINCE || '',
        zip: process.env.COMPANY_ZIP || '',
        country: 'Italia',
      },
      recipient: {
        name: (invoice.user as any)?.company_name || (invoice.user as any)?.name || '',
        vatNumber: (invoice.user as any)?.vat_number,
        taxCode: (invoice.user as any)?.tax_code,
        address: (invoice.user as any)?.address || '',
        city: (invoice.user as any)?.city || '',
        province: (invoice.user as any)?.province || '',
        zip: (invoice.user as any)?.zip || '',
        country: (invoice.user as any)?.country || 'Italia',
      },
      items: (invoice.items || []).map((item: any) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        vatRate: item.tax_rate,
        total: item.total,
      })),
      paymentMethod: 'Bonifico bancario',
      iban: process.env.COMPANY_IBAN || '',
      notes: invoice.notes || undefined,
    };

    // Genera e salva PDF
    const pdfBuffer = await generateInvoicePDF(invoiceData);
    const currentYear = new Date().getFullYear();
    const pdfPath = `invoices/${currentYear}/${invoice.invoice_number}.pdf`;

    const { error: pdfUploadError } = await supabaseAdmin.storage
      .from('documents')
      .upload(pdfPath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (pdfUploadError) {
      console.error('Errore upload PDF:', pdfUploadError);
      // Non bloccare: la fattura è già creata
    } else {
      const {
        data: { publicUrl: pdfUrl },
      } = supabaseAdmin.storage.from('documents').getPublicUrl(pdfPath);

      // Aggiorna fattura con PDF URL
      await supabaseAdmin.from('invoices').update({ pdf_url: pdfUrl }).eq('id', invoiceId);
    }

    // Genera XML se richiesto e dati completi
    if (params.generateXML) {
      try {
        const fatturaPAData: FatturaPAData = {
          ...invoiceData,
          sdiCode: (invoice.user as any)?.codiceSDI,
          pec: (invoice.user as any)?.pec,
          sender: {
            ...invoiceData.sender,
            sdiCode: process.env.COMPANY_SDI_CODE,
            pec: process.env.COMPANY_PEC,
          },
        };

        // Valida dati prima di generare XML
        const validationErrors = validateFatturaPAData(fatturaPAData);
        if (validationErrors.length > 0) {
          console.warn('⚠️ Validazione XML fallita:', validationErrors);
          // Non bloccare: la fattura è già creata con PDF
        } else {
          const xmlBuffer = await generateInvoiceXML(fatturaPAData);
          const xmlPath = `invoices/${currentYear}/${invoice.invoice_number}.xml`;

          const { error: xmlUploadError } = await supabaseAdmin.storage
            .from('documents')
            .upload(xmlPath, xmlBuffer, {
              contentType: 'application/xml',
              upsert: false,
            });

          if (!xmlUploadError) {
            const {
              data: { publicUrl: xmlUrl },
            } = supabaseAdmin.storage.from('documents').getPublicUrl(xmlPath);

            // Aggiorna fattura con XML URL
            await supabaseAdmin.from('invoices').update({ xml_url: xmlUrl }).eq('id', invoiceId);
          }
        }
      } catch (xmlError: any) {
        console.error('Errore generazione XML:', xmlError);
        // Non bloccare: la fattura è già creata con PDF
      }
    }

    return {
      success: true,
      invoice: invoice as Invoice,
    };
  } catch (error: any) {
    console.error('Errore internalGenerateInvoiceFromRecharges:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto',
    };
  }
}

/**
 * Genera fattura automatica per ricarica Stripe
 * Chiamata automaticamente dopo webhook Stripe successo
 *
 * ⚠️ SYSTEM CONTEXT: Non richiede autenticazione (webhook Stripe non ha sessione)
 *
 * @param transactionId - ID transazione wallet della ricarica
 * @returns Fattura creata
 */
export async function generateAutomaticInvoiceForStripeRecharge(transactionId: string): Promise<{
  success: boolean;
  invoiceId?: string;
  error?: string;
}> {
  try {
    // Recupera transazione wallet
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('wallet_transactions')
      .select('*, user:users(*)')
      .eq('id', transactionId)
      .eq('type', 'deposit')
      .single();

    if (txError || !transaction) {
      return {
        success: false,
        error: 'Transazione non trovata o non valida',
      };
    }

    // Verifica se già fatturata
    const { data: existingLink } = await supabaseAdmin
      .from('invoice_recharge_links')
      .select('invoice_id')
      .eq('wallet_transaction_id', transactionId)
      .single();

    if (existingLink) {
      return {
        success: true,
        invoiceId: existingLink.invoice_id,
      };
    }

    // Verifica regola generazione automatica per questo utente
    const { data: rule } = await supabaseAdmin
      .from('invoice_generation_rules')
      .select('*')
      .eq('user_id', transaction.user_id)
      .eq('generation_type', 'automatic')
      .eq('is_active', true)
      .single();

    // Se non c'è regola automatica, non genera fattura
    if (!rule) {
      return {
        success: false,
        error: 'Nessuna regola automatica attiva per questo utente',
      };
    }

    // 🔒 Usa funzione interna (senza autenticazione) per webhook
    const result = await internalGenerateInvoiceFromRecharges({
      userId: transaction.user_id,
      transactionIds: [transactionId],
      invoiceType: 'recharge',
      generateXML: true, // Genera XML per fatturazione elettronica
    });

    if (!result.success || !result.invoice) {
      return result;
    }

    // Emetti fattura (draft → issued)
    await supabaseAdmin.from('invoices').update({ status: 'issued' }).eq('id', result.invoice.id);

    return {
      success: true,
      invoiceId: result.invoice.id,
    };
  } catch (error: any) {
    console.error('Errore generateAutomaticInvoiceForStripeRecharge:', error);
    return {
      success: false,
      error: error.message || 'Errore sconosciuto',
    };
  }
}

/**
 * Genera fattura periodica (mensile/trimestrale)
 *
 * @param params - Parametri generazione periodica
 * @returns Fattura creata
 */
export async function generatePeriodicInvoiceAction(params: {
  userId: string;
  periodStart: string; // ISO date
  periodEnd: string; // ISO date
  periodType: 'monthly' | 'quarterly' | 'yearly';
}): Promise<{
  success: boolean;
  invoice?: Invoice;
  error?: string;
}> {
  try {
    const context = await requireSafeAuth();

    const isAdmin =
      context.actor.account_type === 'admin' || context.actor.account_type === 'superadmin';

    if (!isAdmin) {
      return {
        success: false,
        error: 'Solo admin può generare fatture periodiche',
      };
    }

    // Recupera ricariche nel periodo non ancora fatturate
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

    const transactionIds = recharges.map((r) => r.id);

    // 🔒 Usa funzione interna (dopo verifica auth)
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
 *
 * @param params - Parametri regola
 * @returns Regola creata/aggiornata
 */
export async function configureInvoiceGenerationRuleAction(params: {
  userId: string;
  generationType: 'automatic' | 'manual' | 'periodic';
  periodFrequency?: 'monthly' | 'quarterly' | 'yearly';
  periodDay?: number; // Giorno del mese/trimestre
  includeStripe?: boolean;
  includeBankTransfer?: boolean;
  minAmount?: number;
}): Promise<{
  success: boolean;
  ruleId?: string;
  error?: string;
}> {
  try {
    const context = await requireSafeAuth();

    const isAdmin =
      context.actor.account_type === 'admin' || context.actor.account_type === 'superadmin';

    if (!isAdmin) {
      return {
        success: false,
        error: 'Solo admin può configurare regole fatturazione',
      };
    }

    // Disattiva regole esistenti dello stesso tipo
    await supabaseAdmin
      .from('invoice_generation_rules')
      .update({ is_active: false })
      .eq('user_id', params.userId)
      .eq('generation_type', params.generationType);

    // Crea nuova regola
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
 *
 * @param userId - ID utente
 * @returns Array di ricariche non fatturate
 */
export async function listUninvoicedRechargesAction(userId: string): Promise<{
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
    const context = await requireSafeAuth();

    // Verifica permessi: admin vede tutto, utenti vedono solo proprie
    const isAdmin =
      context.actor.account_type === 'admin' || context.actor.account_type === 'superadmin';

    if (!isAdmin && context.target.id !== userId) {
      return {
        success: false,
        error: 'Non autorizzato',
      };
    }

    // Recupera ricariche non fatturate
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
 *
 * Aggrega tutti i POSTPAID_CHARGE del mese specificato e crea una fattura
 * con tipo 'periodic', period_start/period_end, e invoice_items per ogni spedizione.
 *
 * @param userId - ID utente postpagato
 * @param yearMonth - Mese in formato 'YYYY-MM' (es. '2026-02')
 * @returns Fattura creata o errore
 */
export async function generatePostpaidMonthlyInvoice(
  userId: string,
  yearMonth: string
): Promise<{
  success: boolean;
  invoice?: Invoice;
  error?: string;
}> {
  try {
    // Solo admin/superadmin puo' generare fatture postpaid
    const context = await requireSafeAuth();
    const isAdmin =
      context.actor.account_type === 'admin' || context.actor.account_type === 'superadmin';
    const isReseller = (context.actor as unknown as { is_reseller?: boolean }).is_reseller === true;

    if (!isAdmin && !isReseller) {
      return { success: false, error: 'Solo admin o reseller possono generare fatture postpaid' };
    }

    // Se reseller (non admin): verifica ownership sub-user
    if (isReseller && !isAdmin) {
      const { data: resellerUser } = await supabaseAdmin
        .from('users')
        .select('id, primary_workspace_id')
        .eq('email', context.actor.email)
        .single();

      if (!resellerUser) {
        return { success: false, error: 'Reseller non trovato' };
      }

      // Check 1: Legacy parent_id
      const { data: targetParent } = await supabaseAdmin
        .from('users')
        .select('parent_id')
        .eq('id', userId)
        .single();

      let isOwner = targetParent?.parent_id === resellerUser.id;

      // Check 2: Workspace V2
      if (!isOwner && resellerUser.primary_workspace_id) {
        const { data: subUserWs } = await supabaseAdmin
          .from('workspace_members')
          .select('workspace_id, workspaces!inner(parent_workspace_id)')
          .eq('user_id', userId)
          .eq('status', 'active')
          .eq('role', 'owner');

        if (subUserWs) {
          isOwner = subUserWs.some(
            (m: any) => m.workspaces?.parent_workspace_id === resellerUser.primary_workspace_id
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

    // Validazione yearMonth
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

    // Verifica che l'utente sia postpagato
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

    // Verifica che non esista gia' una fattura per questo mese
    const { data: existingInvoice } = await supabaseAdmin
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

    // Recupera POSTPAID_CHARGE del mese
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

    // Calcola totali (amount e' negativo, usiamo ABS)
    const subtotal = charges.reduce((sum, c) => sum + Math.abs(c.amount), 0);
    const taxRate = 22; // IVA 22%
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount;

    // Genera numero fattura
    const { data: nextNumber } = await supabaseAdmin.rpc('get_next_invoice_number');
    const invoiceNumber = nextNumber || `${year}-DRAFT`;

    // Crea fattura
    const { data: newInvoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .insert({
        user_id: userId,
        invoice_number: invoiceNumber,
        invoice_date: new Date().toISOString(),
        due_date: (() => {
          // 30 giorni dopo l'ultimo giorno del mese di riferimento
          const endOfMonth = new Date(year, month, 0); // ultimo giorno del mese
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

    // Crea invoice_items per ogni spedizione
    const items = charges.map((charge) => ({
      invoice_id: newInvoice.id,
      shipment_id: charge.reference_id || null,
      description: charge.description || `Spedizione postpagata`,
      quantity: 1,
      unit_price: Math.abs(charge.amount),
      tax_rate: taxRate,
      total: Math.abs(charge.amount),
    }));

    const { error: itemsError } = await supabaseAdmin.from('invoice_items').insert(items);

    if (itemsError) {
      console.error('Errore creazione invoice items - rollback fattura:', itemsError);
      // ROLLBACK: cancella fattura orfana per evitare inconsistenze
      await supabaseAdmin.from('invoices').delete().eq('id', newInvoice.id);
      return {
        success: false,
        error: 'Errore creazione dettagli fattura. Nessuna fattura generata.',
      };
    }

    // Collega transazioni alla fattura (per evitare doppia fatturazione)
    const links = charges.map((charge) => ({
      invoice_id: newInvoice.id,
      wallet_transaction_id: charge.id,
      amount: Math.abs(charge.amount),
    }));

    const { error: linksError } = await supabaseAdmin.from('invoice_recharge_links').insert(links);

    if (linksError) {
      console.error('Errore creazione links anti-duplicazione - rollback fattura:', linksError);
      // ROLLBACK: cancella items + fattura per evitare fatture senza protezione duplicazione
      await supabaseAdmin.from('invoice_items').delete().eq('invoice_id', newInvoice.id);
      await supabaseAdmin.from('invoices').delete().eq('id', newInvoice.id);
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
