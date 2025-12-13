export type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled' | 'refunded';

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  shipment_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total: number;
  created_at?: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  invoice_number: string | null;
  invoice_date: string | null; // ISO Date
  due_date: string | null; // ISO Date
  status: InvoiceStatus;
  
  // Totals
  subtotal: number;
  tax_amount: number;
  total: number;
  currency: string;
  amount_paid: number;
  
  // Recipient Snapshot
  recipient_name?: string;
  recipient_vat_number?: string;
  recipient_sdi_code?: string;
  recipient_pec?: string;
  recipient_address?: string;
  recipient_city?: string;
  recipient_province?: string;
  recipient_zip?: string;
  recipient_country?: string;
  
  pdf_url?: string | null;
  notes?: string;
  internal_notes?: string;
  
  created_at: string;
  updated_at: string;
  
  // Joined data (optional)
  items?: InvoiceItem[];
  user?: {
    name: string;
    email: string;
    company_name?: string;
  };
}

export interface CreateInvoiceDTO {
  user_id: string;
  items: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    shipment_id?: string;
  }>;
  due_date?: string;
  notes?: string;
}
