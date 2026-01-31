/**
 * Types: Shipments
 */

export type ShipmentStatus =
  | 'draft'
  | 'pending'
  | 'ready_to_ship'
  | 'processing'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'cancelled'
  | 'returned'
  | 'scanned_at_pickup'
  | 'in_giacenza';

export type RecipientType = 'B2C' | 'B2B';

export type CourierServiceType = 'standard' | 'express' | 'economy' | 'same_day' | 'next_day';

export interface Shipment {
  id: string;
  user_id: string;
  tracking_number: string;
  external_tracking_number?: string;
  ldv?: string; // Lettera di Vettura (per scansione)
  status: ShipmentStatus;

  // Mittente
  sender_name: string;
  sender_address?: string;
  sender_city?: string;
  sender_zip?: string;
  sender_province?: string;
  sender_country?: string;
  sender_phone?: string;
  sender_email?: string;

  // Destinatario
  recipient_name: string;
  recipient_type: RecipientType;
  recipient_address: string;
  recipient_address_number?: string;
  recipient_city: string;
  recipient_zip: string;
  recipient_province: string;
  recipient_country: string;
  recipient_phone: string;
  recipient_email?: string;
  recipient_notes?: string;

  // Pacco
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  volumetric_weight?: number;

  // Valore
  declared_value?: number;
  currency: string;

  // Servizio
  courier_id: string;
  courier?: any; // Riferimento corriere
  service_type: CourierServiceType;
  cash_on_delivery: boolean;
  cash_on_delivery_amount?: number;
  insurance: boolean;

  // Pricing
  base_price?: number;
  surcharges?: number;
  total_cost?: number;
  margin_percent?: number;
  final_price?: number;
  price_list_id?: string; // ID listino applicato (per audit)
  applied_price_rule_id?: string; // ID regola applicata (per audit)
  // ✨ NUOVO: VAT Semantics (ADR-001)
  vat_mode?: 'included' | 'excluded' | null; // NULL = legacy (assume 'excluded')
  vat_rate?: number; // Default 22.00

  // Geo-analytics
  geo_zone?: string;
  courier_quality_score?: number;

  // E-commerce
  ecommerce_platform?: string;
  ecommerce_order_id?: string;
  ecommerce_order_number?: string;

  // OCR
  created_via_ocr?: boolean;
  ocr_confidence_score?: number;

  // Note
  notes?: string;
  internal_notes?: string;

  // Timestamps
  shipped_at?: string;
  delivered_at?: string;
  created_at: string;
  updated_at: string;

  // Logistica e Ritiro
  pickup_time?: string; // Timestamp UTC del ritiro
  gps_location?: string; // Formato: "lat,lng" (es. "45.4642,9.1900")
  picked_up_by?: string; // ID o nome dell'operatore che ha ritirato

  // Resi
  is_return?: boolean; // Flag per identificare spedizioni di reso
  original_shipment_id?: string; // UUID o tracking della spedizione originale
  return_reason?: string; // Motivo del reso
  return_status?: 'requested' | 'processing' | 'completed' | 'cancelled'; // Stato del reso

  // Audit Trail - Tracciamento completo
  created_by_user_id: string;
  created_by_user_name?: string;
  updated_by_user_id?: string;
  updated_by_user_name?: string;

  // Soft Delete
  deleted: boolean;
  deleted_at?: string;
  deleted_by_user_id?: string;
  deleted_by_user_name?: string;
  deletion_reason?: string;
}

export interface CreateShipmentInput {
  sender_name: string;
  sender_address?: string;
  sender_city?: string;
  sender_zip?: string;
  sender_province?: string;
  sender_phone?: string;
  sender_email?: string;

  recipient_name: string;
  recipient_type?: RecipientType;
  recipient_address: string;
  recipient_city: string;
  recipient_zip: string;
  recipient_province: string;
  recipient_phone: string;
  recipient_email?: string;
  recipient_notes?: string;

  weight: number;
  length?: number;
  width?: number;
  height?: number;

  declared_value?: number;

  courier_id: string;
  service_type?: CourierServiceType;
  cash_on_delivery?: boolean;
  cash_on_delivery_amount?: number;
  insurance?: boolean;

  base_price?: number;
  margin_percent?: number;
  price_list_id?: string; // Listino da applicare (opzionale, altrimenti usa getApplicablePriceList)

  notes?: string;
}

export interface UpdateShipmentInput {
  status?: ShipmentStatus;
  external_tracking_number?: string;
  shipped_at?: string;
  delivered_at?: string;
  notes?: string;
  internal_notes?: string;
}

export interface ShipmentFilters {
  status?: ShipmentStatus;
  courier_id?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  order_by?: string;
  order_dir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ShipmentEvent {
  id: string;
  shipment_id: string;
  status: ShipmentStatus;
  description: string;
  location?: string;
  event_date: string;
  created_at: string;
}
