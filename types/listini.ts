/**
 * Types: Price Lists (Listini)
 */

import type { CourierServiceType } from './shipments';

export type PriceListStatus = 'draft' | 'active' | 'archived';
export type { CourierServiceType };

export interface PriceList {
  id: string;
  courier_id: string;
  courier?: any;

  name: string;
  version: string;
  status: PriceListStatus;

  valid_from?: string;
  valid_until?: string;

  source_type?: string;
  source_file_url?: string;

  notes?: string;

  entries?: PriceListEntry[];

  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface PriceListEntry {
  id: string;
  price_list_id: string;

  weight_from: number;
  weight_to: number;

  zone_code?: string;
  zip_code_from?: string;
  zip_code_to?: string;
  province_code?: string;
  region?: string;

  service_type: CourierServiceType;

  base_price: number;

  fuel_surcharge_percent?: number;
  island_surcharge?: number;
  ztl_surcharge?: number;
  cash_on_delivery_surcharge?: number;
  insurance_rate_percent?: number;

  estimated_delivery_days_min?: number;
  estimated_delivery_days_max?: number;

  created_at: string;
}

export interface CreatePriceListInput {
  courier_id: string;
  name: string;
  version: string;
  status?: PriceListStatus;
  valid_from?: string;
  valid_until?: string;
  source_type?: string;
  source_file_url?: string;
  notes?: string;
}

export interface ParsedPriceListRow {
  weight_from: number;
  weight_to: number;
  zone_code?: string;
  service_type?: CourierServiceType;
  base_price: number;
  fuel_surcharge_percent?: number;
  [key: string]: any;
}
