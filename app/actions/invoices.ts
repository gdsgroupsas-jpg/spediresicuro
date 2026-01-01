'use server';

import { createServerActionClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/db/client';
import { CreateInvoiceDTO, Invoice, InvoiceStatus } from '@/types/invoices';
import { revalidatePath } from 'next/cache';
import { generateInvoicePDF, InvoiceData } from '@/lib/invoices/pdf-generator';

/**
 * Crea una nuova bozza di fattura
 */
export async function createInvoice(data: CreateInvoiceDTO) {
  const supabase = createServerActionClient();
  
  // 1. Crea la testata (Draft)
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      user_id: data.user_id,
      status: 'draft',
      due_date: data.due_date,
      notes: data.notes
    })
    .select()
    .single();

  if (invoiceError) throw new Error(`Errore creazione fattura: ${invoiceError.message}`);

  // 2. Aggiungi le righe
  const itemsToAdd = data.items.map(item => ({
    invoice_id: invoice.id,
    shipment_id: item.shipment_id,
    description: item.description,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total: item.quantity * item.unit_price, // Trigger ricalcolerà comunque
    tax_rate: 22.0 // Default IVA
  }));

  const { error: itemsError } = await supabase
    .from('invoice_items')
    .insert(itemsToAdd);

  if (itemsError) throw new Error(`Errore inserimento righe: ${itemsError.message}`);

  revalidatePath('/dashboard/admin/invoices');
  return invoice as Invoice;
}

/**
 * Emette la fattura (Draft -> Issued)
 * Questo scatena il trigger per generare il numero progressivo
 */
export async function issueInvoice(id: string) {
  const supabase = createServerActionClient();
  
  // Recupera dati cliente per snapshot
  const { data: invoice } = await supabase.from('invoices').select('user_id').eq('id', id).single();
  if (!invoice) throw new Error('Fattura non trovata');

  const { data: user } = await supabase.from('users').select('*').eq('id', invoice.user_id).single();
  
  // Update stato e snapshot dati cliente
  const { data: updated, error } = await supabase
    .from('invoices')
    .update({
      status: 'issued',
      invoice_date: new Date().toISOString(),
      recipient_name: user?.company_name || user?.name,
      recipient_vat_number: user?.vat_number,
      // Altri campi snapshot andrebbero mappati qui se presenti su user
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Errore emissione fattura: ${error.message}`);
  
  revalidatePath('/dashboard/admin/invoices');
  return updated as Invoice;
}

/**
 * Aggiorna stato pagamento
 */
export async function updateInvoiceStatus(id: string, status: InvoiceStatus) {
  const supabase = createServerActionClient();
  
  const { error } = await supabase
    .from('invoices')
    .update({ status })
    .eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/dashboard/admin/invoices');
}

/**
 * Get fatture per admin table
 */
export async function getInvoices(limit = 50) {
  const supabase = createServerActionClient();
  
  const { data, error } = await supabase
    .from('invoices')
    .select('*, user:users(name, email, company_name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data as Invoice[];
}

/**
 * Get fatture per utente loggato
 */
export async function getUserInvoices(limit = 20) {
  const supabase = createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Utente non autenticato');
  
  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data as Invoice[];
}

/**
 * Get singola fattura con items
 */
export async function getInvoiceById(id: string) {
  const supabase = createServerActionClient();
  
  const { data, error } = await supabase
    .from('invoices')
    .select('*, items:invoice_items(*), user:users(name, email, company_name, vat_number, address, city, province, zip, country)')
    .eq('id', id)
    .single();

  if (error) throw new Error(error.message);
  return data as Invoice;
}

/**
 * Genera numero progressivo fattura per anno
 */
async function getNextInvoiceNumber(year: number): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select('invoice_number')
    .not('invoice_number', 'is', null)
    .like('invoice_number', `${year}-%`)
    .order('invoice_number', { ascending: false })
    .limit(1);

  if (error) {
    throw new Error(`Errore recupero ultimo numero fattura: ${error.message}`);
  }

  let nextSeq = 1;
  if (data && data.length > 0 && data[0].invoice_number) {
    const lastNumber = data[0].invoice_number;
    const match = lastNumber.match(/^\d{4}-(\d+)$/);
    if (match) {
      nextSeq = parseInt(match[1], 10) + 1;
    }
  }

  return `${year}-${nextSeq.toString().padStart(4, '0')}`;
}

/**
 * Genera fattura PDF per una spedizione
 * 
 * @param shipmentId - ID spedizione
 * @returns Invoice con PDF generato
 */
export async function generateInvoiceForShipment(shipmentId: string) {
  const supabase = createServerActionClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) throw new Error('Unauthorized');

  // 1. Carica dati spedizione
  const { data: shipment, error: shipmentError } = await supabase
    .from('shipments')
    .select('*, user:users(*)')
    .eq('id', shipmentId)
    .single();

  if (shipmentError || !shipment) {
    throw new Error(`Spedizione non trovata: ${shipmentError?.message}`);
  }

  // 2. Verifica se fattura già esiste
  const { data: existingInvoice } = await supabase
    .from('invoices')
    .select('id')
    .eq('user_id', shipment.user_id)
    .contains('items', [{ shipment_id: shipmentId }])
    .limit(1)
    .maybeSingle();

  if (existingInvoice) {
    throw new Error('Fattura già esistente per questa spedizione');
  }

  // 3. Genera numero progressivo
  const currentYear = new Date().getFullYear();
  const invoiceNumber = await getNextInvoiceNumber(currentYear);

  // 4. Prepara dati fattura
  const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 giorni
  const invoiceData: InvoiceData = {
    invoiceNumber,
    issueDate: new Date(),
    dueDate,
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
      name: (shipment.user as any)?.company_name || (shipment.user as any)?.name || '',
      vatNumber: (shipment.user as any)?.vat_number,
      taxCode: (shipment.user as any)?.tax_code,
      address: (shipment.user as any)?.address || '',
      city: (shipment.user as any)?.city || '',
      province: (shipment.user as any)?.province || '',
      zip: (shipment.user as any)?.zip || '',
      country: (shipment.user as any)?.country || 'Italia',
    },
    items: [
      {
        description: `Spedizione #${shipment.tracking_number}`,
        quantity: 1,
        unitPrice: shipment.final_price || shipment.total_cost || 0,
        vatRate: 22,
        total: shipment.final_price || shipment.total_cost || 0,
      },
    ],
    paymentMethod: 'Bonifico bancario',
    iban: process.env.COMPANY_IBAN || '',
    notes: shipment.notes,
  };

  // 5. Genera PDF
  const pdfBuffer = await generateInvoicePDF(invoiceData);

  // 6. Upload a Supabase Storage
  const filePath = `invoices/${currentYear}/${invoiceNumber}.pdf`;
  const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
    .from('documents')
    .upload(filePath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Errore upload PDF: ${uploadError.message}`);
  }

  // 7. Ottieni URL pubblico
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('documents')
    .getPublicUrl(filePath);

  // 8. Crea record fattura in DB
  const { data: invoice, error: invoiceError } = await supabaseAdmin
    .from('invoices')
    .insert({
      user_id: shipment.user_id,
      invoice_number: invoiceNumber,
      invoice_date: new Date().toISOString(),
      due_date: dueDate.toISOString(),
      status: 'issued',
      subtotal: invoiceData.items[0].total,
      tax_amount: invoiceData.items[0].total * 0.22,
      total: invoiceData.items[0].total * 1.22,
      recipient_name: invoiceData.recipient.name,
      recipient_vat_number: invoiceData.recipient.vatNumber,
      recipient_address: invoiceData.recipient.address,
      recipient_city: invoiceData.recipient.city,
      recipient_province: invoiceData.recipient.province,
      recipient_zip: invoiceData.recipient.zip,
      recipient_country: invoiceData.recipient.country,
      pdf_url: publicUrl,
      notes: invoiceData.notes,
    })
    .select()
    .single();

  if (invoiceError) {
    throw new Error(`Errore creazione fattura: ${invoiceError.message}`);
  }

  // 9. Crea riga fattura
  const { error: itemError } = await supabaseAdmin
    .from('invoice_items')
    .insert({
      invoice_id: invoice.id,
      shipment_id: shipmentId,
      description: invoiceData.items[0].description,
      quantity: 1,
      unit_price: invoiceData.items[0].unitPrice,
      tax_rate: 22,
      total: invoiceData.items[0].total,
    });

  if (itemError) {
    throw new Error(`Errore creazione riga fattura: ${itemError.message}`);
  }

  revalidatePath('/dashboard/fatture');
  revalidatePath('/dashboard/admin/invoices');

  return invoice as Invoice;
}
