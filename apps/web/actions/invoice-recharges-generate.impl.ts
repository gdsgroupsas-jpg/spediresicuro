import { supabaseAdmin } from '@/lib/db/client';
import { isAdminOrAbove } from '@/lib/auth-helpers';
import { workspaceQuery } from '@/lib/db/workspace-query';
import { generateInvoicePDF, InvoiceData } from '@/lib/invoices/pdf-generator';
import {
  FatturaPAData,
  generateInvoiceXML,
  validateFatturaPAData,
} from '@/lib/invoices/xml-generator';
import { requireWorkspaceAuth } from '@/lib/workspace-auth';
import { getUserWorkspaceId } from '@/lib/db/user-helpers';
import type { Invoice } from '@/types/invoices';

/**
 * Genera fattura da ricariche wallet
 *
 * Richiede autenticazione: solo admin.
 */
export async function generateInvoiceFromRechargesActionImpl(params: {
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
    const context = await requireWorkspaceAuth();

    const isAdmin = isAdminOrAbove(context.actor);

    if (!isAdmin) {
      return {
        success: false,
        error: 'Solo admin puo generare fatture',
      };
    }

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
 * INTERNAL: Genera fattura da ricariche SENZA autenticazione.
 * Usata da webhook Stripe (system context, no user session).
 */
export async function internalGenerateInvoiceFromRecharges(params: {
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
    if (!params.userId || !params.transactionIds || params.transactionIds.length === 0) {
      return {
        success: false,
        error: 'Parametri mancanti: userId e transactionIds obbligatori',
      };
    }

    const { data: transactions, error: txError } = await supabaseAdmin
      .from('wallet_transactions')
      .select('id, user_id, amount, type')
      .in('id', params.transactionIds)
      .eq('user_id', params.userId)
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
        error: "Una o piu transazioni non trovate o non appartengono all'utente",
      };
    }

    const { data: existingLinks } = await supabaseAdmin
      .from('invoice_recharge_links')
      .select('wallet_transaction_id')
      .in('wallet_transaction_id', params.transactionIds);

    if (existingLinks && existingLinks.length > 0) {
      return {
        success: false,
        error: 'Una o piu transazioni sono gia state fatturate',
      };
    }

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

    const wsId = await getUserWorkspaceId(params.userId);
    const wq = wsId ? workspaceQuery(wsId) : supabaseAdmin;

    const { data: invoice, error: fetchError } = await wq
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
    } else {
      const {
        data: { publicUrl: pdfUrl },
      } = supabaseAdmin.storage.from('documents').getPublicUrl(pdfPath);

      await wq.from('invoices').update({ pdf_url: pdfUrl }).eq('id', invoiceId);
    }

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

        const validationErrors = validateFatturaPAData(fatturaPAData);
        if (validationErrors.length > 0) {
          console.warn('Validazione XML fallita:', validationErrors);
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

            await wq.from('invoices').update({ xml_url: xmlUrl }).eq('id', invoiceId);
          }
        }
      } catch (xmlError: any) {
        console.error('Errore generazione XML:', xmlError);
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
 * Chiamata automaticamente dopo webhook Stripe successo.
 */
export async function generateAutomaticInvoiceForStripeRechargeImpl(
  transactionId: string
): Promise<{
  success: boolean;
  invoiceId?: string;
  error?: string;
}> {
  try {
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

    const { data: rule } = await supabaseAdmin
      .from('invoice_generation_rules')
      .select('*')
      .eq('user_id', transaction.user_id)
      .eq('generation_type', 'automatic')
      .eq('is_active', true)
      .single();

    if (!rule) {
      return {
        success: false,
        error: 'Nessuna regola automatica attiva per questo utente',
      };
    }

    const result = await internalGenerateInvoiceFromRecharges({
      userId: transaction.user_id,
      transactionIds: [transactionId],
      invoiceType: 'recharge',
      generateXML: true,
    });

    if (!result.success || !result.invoice) {
      return result as any;
    }

    const autoWsId = await getUserWorkspaceId(transaction.user_id);
    const autoWq = autoWsId ? workspaceQuery(autoWsId) : supabaseAdmin;
    await autoWq.from('invoices').update({ status: 'issued' }).eq('id', result.invoice.id);

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
