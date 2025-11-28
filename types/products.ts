/**
 * Types: Products
 */

export type ProductType = 'physical' | 'digital' | 'service' | 'dropshipping';

export interface Product {
  id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;

  category?: string;
  subcategory?: string;
  tags?: string[];

  type: ProductType;

  weight?: number;
  length?: number;
  width?: number;
  height?: number;

  cost_price?: number;
  sale_price?: number;
  suggested_retail_price?: number;

  image_url?: string;
  images?: any;

  active: boolean;

  seo_title?: string;
  seo_description?: string;

  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  category?: string;
  subcategory?: string;
  tags?: string[];
  type?: ProductType;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  cost_price?: number;
  sale_price?: number;
  image_url?: string;
  active?: boolean;
}

export interface ProductFilters {
  category?: string;
  type?: ProductType;
  active?: boolean;
  search?: string;
  order_by?: string;
  order_dir?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface ProductSupplier {
  id: string;
  product_id: string;
  supplier_id: string;
  supplier?: any;

  supplier_sku?: string;
  cost_price: number;
  min_order_quantity?: number;
  lead_time_days?: number;
  priority: number;

  active: boolean;

  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  code?: string;
  company_name?: string;
  vat_number?: string;

  email?: string;
  phone?: string;
  website?: string;

  address?: string;
  city?: string;
  zip?: string;
  province?: string;
  country?: string;

  payment_terms?: string;
  min_order_quantity?: number;
  min_order_value?: number;

  ships_from_city?: string;
  ships_from_zip?: string;
  default_courier_id?: string;
  average_processing_days?: number;

  quality_rating?: number;
  reliability_rating?: number;

  active: boolean;
  is_dropshipper: boolean;

  notes?: string;

  created_at: string;
  updated_at: string;
}
