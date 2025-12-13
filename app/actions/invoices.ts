import { createServerActionClient } from '@/lib/supabase-server';
import { CreateInvoiceDTO, Invoice, InvoiceStatus } from '@/types/invoices';
import { revalidatePath } from 'next/cache';

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
