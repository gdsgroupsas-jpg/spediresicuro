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
import { requireSafeAuth } from '@/lib/safe-auth';
import { generateInvoicePDF, InvoiceData } from '@/lib/invoices/pdf-generator';
import { generateInvoiceXML, validateFatturaPAData, FatturaPAData } from '@/lib/invoices/xml-generator';
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
    const isAdmin = context.actor.account_type === 'admin' || 
                    context.actor.account_type === 'superadmin';
    
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
        error: 'Una o più transazioni non trovate o non appartengono all\'utente',
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
      .select(`
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
      `)
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
      const { data: { publicUrl: pdfUrl } } = supabaseAdmin.storage
        .from('documents')
        .getPublicUrl(pdfPath);

      // Aggiorna fattura con PDF URL
      await supabaseAdmin
        .from('invoices')
        .update({ pdf_url: pdfUrl })
        .eq('id', invoiceId);
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
            const { data: { publicUrl: xmlUrl } } = supabaseAdmin.storage
              .from('documents')
              .getPublicUrl(xmlPath);

            // Aggiorna fattura con XML URL
            await supabaseAdmin
              .from('invoices')
              .update({ xml_url: xmlUrl })
              .eq('id', invoiceId);
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
export async function generateAutomaticInvoiceForStripeRecharge(
  transactionId: string
): Promise<{
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
    await supabaseAdmin
      .from('invoices')
      .update({ status: 'issued' })
      .eq('id', result.invoice.id);

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
    
    const isAdmin = context.actor.account_type === 'admin' || 
                    context.actor.account_type === 'superadmin';
    
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
      .not('id', 'in', 
        supabaseAdmin
          .from('invoice_recharge_links')
          .select('wallet_transaction_id')
      )
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

    const transactionIds = recharges.map(r => r.id);

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
    
    const isAdmin = context.actor.account_type === 'admin' || 
                    context.actor.account_type === 'superadmin';
    
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
export async function listUninvoicedRechargesAction(
  userId: string
): Promise<{
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
    const isAdmin = context.actor.account_type === 'admin' || 
                    context.actor.account_type === 'superadmin';
    
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
      .not('id', 'in',
        supabaseAdmin
          .from('invoice_recharge_links')
          .select('wallet_transaction_id')
      )
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
