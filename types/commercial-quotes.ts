/**
 * Tipi per il modulo Preventivatore Commerciale
 *
 * Preventivi PDF brandizzati per agenti/reseller verso nuovi clienti azienda.
 * Pipeline: draft -> sent -> negotiating -> accepted|rejected|expired
 * Revisioni tracciate con snapshot immutabili dopo invio.
 */

// ============================================
// STATO PIPELINE
// ============================================

export type CommercialQuoteStatus =
  | 'draft'
  | 'sent'
  | 'negotiating'
  | 'accepted'
  | 'rejected'
  | 'expired';

// ============================================
// MATRICE PREZZI (SNAPSHOT IMMUTABILE)
// ============================================

export interface PriceMatrixWeightRange {
  from: number;
  to: number;
  label: string; // es. "0 - 2 kg"
}

export interface PriceMatrixSnapshot {
  /** Nomi zone (colonne): es. ["Italia", "Sicilia", "Calabria", "Sardegna"] */
  zones: string[];
  /** Fasce peso (righe): es. [{from:0, to:2, label:"0 - 2 kg"}, ...] */
  weight_ranges: PriceMatrixWeightRange[];
  /** Matrice prezzi: prices[rigaIndex][colonnaIndex] in EUR */
  prices: number[][];
  /** Cosa e' incluso nel prezzo: es. ["fuel_surcharge", "base_insurance"] */
  services_included: string[];
  /** Nome corriere per display: es. "PosteDeliveryBusiness" */
  carrier_display_name: string;
  /** Modalita' IVA dello snapshot */
  vat_mode: 'included' | 'excluded';
  /** Aliquota IVA */
  vat_rate: number;
  /** Timestamp generazione snapshot (ISO) */
  generated_at: string;
}

// ============================================
// CLAUSOLE
// ============================================

export interface QuoteClause {
  title: string;
  text: string;
  type: 'standard' | 'custom';
}

// ============================================
// PREVENTIVO COMMERCIALE
// ============================================

export interface CommercialQuote {
  id: string;
  workspace_id: string;
  created_by: string;

  // Prospect
  prospect_company: string;
  prospect_contact_name: string | null;
  prospect_email: string | null;
  prospect_phone: string | null;
  prospect_sector: string | null;
  prospect_estimated_volume: number | null;
  prospect_notes: string | null;

  // Configurazione offerta
  carrier_code: string;
  contract_code: string;
  price_list_id: string | null;
  margin_percent: number | null;
  validity_days: number;

  // Revisioni
  revision: number;
  parent_quote_id: string | null;
  revision_notes: string | null;

  // Snapshot immutabile
  price_matrix: PriceMatrixSnapshot;
  price_includes: string[] | null;
  clauses: QuoteClause[] | null;

  // VAT (ADR-001)
  currency: string;
  vat_mode: 'included' | 'excluded';
  vat_rate: number;

  // Pipeline
  status: CommercialQuoteStatus;
  sent_at: string | null;
  responded_at: string | null;
  response_notes: string | null;
  expires_at: string | null;

  // PDF
  pdf_storage_path: string | null;

  // Conversione
  converted_user_id: string | null;
  converted_price_list_id: string | null;

  // Self-learning (Fase 2)
  original_margin_percent: number | null;

  // Timestamps
  created_at: string;
  updated_at: string;
}

// ============================================
// EVENTI LIFECYCLE
// ============================================

export type CommercialQuoteEventType =
  | 'created'
  | 'updated'
  | 'sent'
  | 'viewed'
  | 'revised'
  | 'accepted'
  | 'rejected'
  | 'expired'
  | 'converted';

export interface CommercialQuoteEvent {
  id: string;
  quote_id: string;
  event_type: CommercialQuoteEventType;
  event_data: Record<string, unknown> | null;
  actor_id: string | null;
  created_at: string;
}

// ============================================
// INPUT FORMS
// ============================================

export interface CreateCommercialQuoteInput {
  prospect_company: string;
  prospect_contact_name?: string;
  prospect_email?: string;
  prospect_phone?: string;
  prospect_sector?: string;
  prospect_estimated_volume?: number;
  prospect_notes?: string;
  carrier_code: string;
  contract_code: string;
  price_list_id?: string;
  margin_percent?: number;
  validity_days?: number;
  clauses?: QuoteClause[];
  vat_mode?: 'included' | 'excluded';
  vat_rate?: number;
}

export interface CreateRevisionInput {
  parent_quote_id: string;
  revision_notes: string;
  margin_percent?: number;
  validity_days?: number;
  clauses?: QuoteClause[];
}

export interface ConvertQuoteInput {
  quote_id: string;
  client_email: string;
  client_name: string;
  client_password: string;
  client_company_name?: string;
  client_phone?: string;
}

// ============================================
// STATISTICHE PIPELINE
// ============================================

export interface QuotePipelineStats {
  draft: number;
  sent: number;
  negotiating: number;
  accepted: number;
  rejected: number;
  expired: number;
  total: number;
  /** accepted / (accepted + rejected), 0 se nessun esito */
  conversion_rate: number;
}

// ============================================
// SETTORI PROSPECT (per select UI)
// ============================================

export const PROSPECT_SECTORS = [
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'cosmetica', label: 'Cosmetica' },
  { value: 'food', label: 'Food & Beverage' },
  { value: 'abbigliamento', label: 'Abbigliamento' },
  { value: 'elettronica', label: 'Elettronica' },
  { value: 'farmaceutico', label: 'Farmaceutico' },
  { value: 'arredamento', label: 'Arredamento' },
  { value: 'editoria', label: 'Editoria' },
  { value: 'automotive', label: 'Automotive / Ricambi' },
  { value: 'altro', label: 'Altro' },
] as const;

export type ProspectSector = (typeof PROSPECT_SECTORS)[number]['value'];
