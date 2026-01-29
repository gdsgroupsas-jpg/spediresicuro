/**
 * Types: Reseller Fiscal Report
 * Sistema di reportistica fiscale per reseller
 */

/**
 * Dati anagrafici di un'entita fiscale (cedente o committente)
 */
export interface FiscalEntity {
  id: string;
  name: string;
  email?: string;
  company_name?: string | null;
  vat_number?: string | null;
  fiscal_code?: string | null;
  address?: string | null;
  city?: string | null;
  province?: string | null;
  zip?: string | null;
  country?: string | null;
}

/**
 * Motivo per cui il margine non e calcolabile
 * @see lib/financial/margin-calculator.ts
 */
export type MarginUnavailableReason =
  | 'MISSING_COST_DATA'
  | 'NOT_APPLICABLE_FOR_MODEL'
  | 'MISSING_FINAL_PRICE';

/**
 * Singola riga di spedizione nel report fiscale
 */
export interface FiscalShipmentLine {
  shipment_id: string;
  tracking_number: string;
  date: string; // ISO date string

  // Prezzi
  base_price: number | null; // Costo fornitore/piattaforma (null se non disponibile)
  final_price: number; // Prezzo venduto al cliente
  margin_amount: number | null; // Margine assoluto (null se non calcolabile)
  margin_percent: number | null; // Margine percentuale (null se non calcolabile)
  margin_reason: MarginUnavailableReason | null; // Motivo se margine non calcolabile

  // IVA
  vat_rate: number; // Default 22.00
  net_amount: number; // Imponibile (final_price / 1.22)
  vat_amount: number; // IVA (final_price - net_amount)
  gross_amount: number; // Lordo (= final_price)

  // Destinatario (per dettaglio)
  recipient_name: string;
  recipient_city: string;

  // Servizio
  courier_name: string;
  service_type: string;
}

/**
 * Riepilogo fiscale per singolo cliente (sub-user)
 */
export interface ClientFiscalSummary {
  client: FiscalEntity;

  // Aggregati
  shipments_count: number;
  total_gross: number; // Totale lordo (con IVA)
  total_net: number; // Totale netto (imponibile)
  total_vat: number; // Totale IVA
  total_margin: number | null; // Margine totale (null se nessuna spedizione ha margine calcolabile)
  avg_margin_percent: number | null; // Margine medio percentuale (null se non calcolabile)

  // Contatori per trasparenza
  margin_calculable_count: number; // Spedizioni con margine calcolato
  margin_excluded_count: number; // Spedizioni escluse dal calcolo margine

  // Dettaglio spedizioni (per drill-down)
  shipments: FiscalShipmentLine[];
}

/**
 * Riepilogo fiscale mensile aggregato
 */
export interface MonthlyFiscalSummary {
  period: {
    month: number; // 1-12
    year: number;
    label: string; // "Gennaio 2026"
    start_date: string; // ISO date
    end_date: string; // ISO date
  };

  // Dati cedente (reseller)
  reseller: FiscalEntity;

  // Totali periodo
  total_shipments: number;
  total_gross: number; // Totale lordo
  total_net: number; // Totale netto (imponibile)
  total_vat: number; // Totale IVA
  total_margin: number | null; // Margine totale (null se nessuna spedizione calcolabile)
  avg_margin_percent: number | null; // Margine medio (null se non calcolabile)

  // Contatori per trasparenza
  margin_calculable_count: number; // Spedizioni con margine calcolato
  margin_excluded_count: number; // Spedizioni escluse (costo mancante, BYOC, ecc.)

  // Breakdown per cliente
  clients: ClientFiscalSummary[];
}

/**
 * Filtri per il report fiscale
 */
export interface FiscalReportFilters {
  month: number; // 1-12
  year: number;
  client_id?: string; // Opzionale: filtra per singolo cliente
}

/**
 * Risposta server action
 */
export interface FiscalReportResult {
  success: boolean;
  data?: MonthlyFiscalSummary;
  error?: string;
}

/**
 * Opzioni export
 */
export interface FiscalExportOptions {
  format: 'csv' | 'excel';
  include_details: boolean; // Include dettaglio spedizioni
  separator?: string; // Per CSV, default ';'
}

/**
 * Margine aggregato per configurazione API (fornitore) - vista reseller
 */
export interface ResellerProviderMarginData {
  config_id: string;
  provider_name: string;
  total_shipments: number;
  total_revenue: number;
  total_cost: number;
  gross_margin: number;
  avg_margin_percent: number;
}
