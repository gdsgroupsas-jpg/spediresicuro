/**
 * Tipi per il modulo Preventivatore Commerciale
 *
 * Preventivi PDF brandizzati per agenti/reseller verso nuovi clienti azienda.
 * Pipeline: draft -> sent -> negotiating -> accepted|rejected|expired
 * Revisioni tracciate con snapshot immutabili dopo invio.
 */

// ============================================
// MODALITA' CONSEGNA / RITIRO
// ============================================

/**
 * Come la merce arriva dal cliente al reseller/vettore.
 *
 * carrier_pickup: il vettore ritira direttamente dal cliente finale
 * own_fleet:      il reseller ritira con la propria flotta e affida al vettore
 * client_dropoff: il cliente scarica al point/magazzino del reseller
 */
export type DeliveryMode = 'carrier_pickup' | 'own_fleet' | 'client_dropoff';

export const DELIVERY_MODES = [
  {
    value: 'carrier_pickup' as const,
    label: 'Ritiro vettore',
    description: 'Il corriere ritira dal cliente',
  },
  {
    value: 'own_fleet' as const,
    label: 'Ritiro con nostra flotta',
    description: 'Ritiriamo noi e affidiamo al vettore',
  },
  {
    value: 'client_dropoff' as const,
    label: 'Consegna al punto',
    description: 'Il cliente scarica al nostro magazzino/punto',
  },
] as const;

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
  /** Supplemento ritiro in EUR (null = gratuito/incluso) */
  pickup_fee: number | null;
  /** Modalita' consegna/ritiro */
  delivery_mode: DeliveryMode;
  /** Merce richiede lavorazione (etichettatura, imballaggio) */
  goods_needs_processing: boolean;
  /** Costo lavorazione per spedizione in EUR (null = incluso/gratuito) */
  processing_fee: number | null;
  /** Divisore peso volumetrico (default 5000) */
  volumetric_divisor?: number;
  /** Timestamp generazione snapshot (ISO) */
  generated_at: string;
}

// ============================================
// CONFRONTO MULTI-CORRIERE
// ============================================

/**
 * Snapshot aggiuntivo per confronto multi-corriere.
 * Il corriere primario e' in price_matrix, gli altri qui.
 */
export interface AdditionalCarrierSnapshot {
  carrier_code: string;
  contract_code: string;
  price_matrix: PriceMatrixSnapshot;
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

  // Logistica inbound (Fase A)
  delivery_mode: DeliveryMode;
  pickup_fee: number | null; // Supplemento ritiro in EUR (null = gratuito)
  goods_needs_processing: boolean; // Merce da lavorare (etichettatura, imballaggio, etc.)
  processing_fee: number | null; // Costo lavorazione per spedizione in EUR (null = gratuito)

  // Revisioni
  revision: number;
  parent_quote_id: string | null;
  revision_notes: string | null;

  // Snapshot immutabile
  price_matrix: PriceMatrixSnapshot;
  /** Matrici aggiuntive per confronto multi-corriere (opzionale) */
  additional_carriers: AdditionalCarrierSnapshot[] | null;
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
  | 'reminder_sent'
  | 'renewed'
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
  delivery_mode?: DeliveryMode;
  pickup_fee?: number;
  goods_needs_processing?: boolean;
  processing_fee?: number;
  /** Divisore peso volumetrico (default 5000) */
  volumetric_divisor?: number;
  /** Corrieri aggiuntivi per confronto (opzionale) */
  additional_carrier_codes?: Array<{
    carrier_code: string;
    contract_code: string;
    price_list_id?: string;
    margin_percent?: number;
  }>;
}

export interface CreateRevisionInput {
  parent_quote_id: string;
  revision_notes: string;
  margin_percent?: number;
  validity_days?: number;
  clauses?: QuoteClause[];
  delivery_mode?: DeliveryMode;
  pickup_fee?: number;
  goods_needs_processing?: boolean;
  processing_fee?: number;
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

// ============================================
// ANALYTICS (Fase B)
// ============================================

/** KPI principali per dashboard analytics */
export interface QuoteAnalyticsKPI {
  conversion_rate: number;
  average_margin_accepted: number;
  average_days_to_close: number;
  total_revenue_value: number;
  total_quotes: number;
  total_accepted: number;
  total_rejected: number;
}

/** Dati per funnel di conversione */
export interface QuoteConversionFunnel {
  created: number;
  sent: number;
  negotiating: number;
  accepted: number;
  dropoff_created_to_sent: number;
  dropoff_sent_to_accepted: number;
}

/** Singolo data point per analisi margine */
export interface QuoteMarginDataPoint {
  quote_id: string;
  prospect_company: string;
  original_margin: number;
  final_margin: number;
  delta: number;
  accepted: boolean;
}

/** Analisi margine: confronto originale vs finale */
export interface QuoteMarginAnalysis {
  data_points: QuoteMarginDataPoint[];
  average_original_margin: number;
  average_final_margin: number;
  average_delta: number;
  avg_margin_accepted: number;
  avg_margin_rejected: number;
}

/** Performance per corriere */
export interface QuoteCarrierPerformance {
  carrier_code: string;
  carrier_display_name: string;
  total_quotes: number;
  accepted: number;
  rejected: number;
  acceptance_rate: number;
  average_margin: number;
}

/** Performance per settore prospect */
export interface QuoteSectorPerformance {
  sector: string;
  sector_label: string;
  total_quotes: number;
  accepted: number;
  rejected: number;
  acceptance_rate: number;
  average_margin: number;
}

/** Punto nella timeline (per settimana) */
export interface QuoteTimelinePoint {
  period: string;
  period_label: string;
  created: number;
  sent: number;
  accepted: number;
  rejected: number;
}

/** Risposta completa dell'analytics action */
export interface QuoteAnalyticsData {
  kpi: QuoteAnalyticsKPI;
  funnel: QuoteConversionFunnel;
  margin_analysis: QuoteMarginAnalysis;
  carrier_performance: QuoteCarrierPerformance[];
  sector_performance: QuoteSectorPerformance[];
  timeline: QuoteTimelinePoint[];
}

// ============================================
// NEGOZIAZIONE AVANZATA (Fase D)
// ============================================

/** Singola entry nella timeline negoziazione */
export interface NegotiationTimelineEntry {
  id: string;
  event_type: CommercialQuoteEventType;
  event_label: string;
  event_data: Record<string, unknown> | null;
  actor_name: string | null;
  created_at: string;
  notes: string | null;
}

/** Input per rinnovo preventivo scaduto */
export interface RenewExpiredQuoteInput {
  expired_quote_id: string;
  new_validity_days?: number;
  revision_notes?: string;
  margin_percent?: number;
}
