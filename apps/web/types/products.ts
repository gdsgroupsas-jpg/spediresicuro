/**
 * Types: Products, Suppliers, Product-Supplier
 *
 * Modello dati WMS MVP — include sconti cascata e contributi (RAEE)
 */

export type ProductType = 'physical' | 'digital' | 'service' | 'dropshipping';

export interface Product {
  id: string;
  workspace_id: string;
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

  // Contributi obbligatori
  raee_amount?: number;
  eco_contribution?: number;

  image_url?: string;

  active: boolean;

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
  suggested_retail_price?: number;
  raee_amount?: number;
  eco_contribution?: number;
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

export interface Supplier {
  id: string;
  workspace_id: string;
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
  average_processing_days?: number;

  notes?: string;

  active: boolean;

  created_at: string;
  updated_at: string;
}

export interface CreateSupplierInput {
  name: string;
  code?: string;
  company_name?: string;
  vat_number?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  zip?: string;
  province?: string;
  country?: string;
  payment_terms?: string;
}

export interface ProductSupplier {
  id: string;
  workspace_id: string;
  product_id: string;
  supplier_id: string;
  supplier?: Supplier;

  supplier_sku?: string;
  list_price: number;

  // Sconti a cascata (come gestionale "PER TE")
  discount_1: number;
  discount_2: number;
  discount_3: number;
  discount_4: number;
  discount_5: number;

  // Calcolato dal trigger DB
  net_cost?: number;

  min_order_quantity?: number;
  lead_time_days?: number;
  priority: number;

  active: boolean;

  created_at: string;
  updated_at: string;
}

// ─── PURCHASE ORDERS (Ordini Fornitore) ───

export type PurchaseOrderStatus =
  | 'draft'
  | 'confirmed'
  | 'shipped'
  | 'partial'
  | 'received'
  | 'cancelled';

export interface PurchaseOrder {
  id: string;
  workspace_id: string;
  supplier_id: string;
  supplier?: Supplier;

  order_number: string;
  status: PurchaseOrderStatus;

  order_date: string;
  expected_delivery_date?: string;
  received_date?: string;

  external_reference?: string;
  circular_reference?: string;

  notes?: string;
  internal_notes?: string;

  subtotal: number;
  total_raee: number;
  total_discount: number;
  tax_amount: number;
  total: number;

  items?: PurchaseOrderItem[];

  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PurchaseOrderItem {
  id: string;
  workspace_id: string;
  purchase_order_id: string;
  product_id: string;
  product?: Product;

  quantity_ordered: number;
  quantity_received: number;

  list_price: number;

  discount_1: number;
  discount_2: number;
  discount_3: number;
  discount_4: number;
  discount_5: number;

  raee_amount: number;

  unit_net_cost?: number;
  line_total?: number;

  warehouse_id?: string;
  notes?: string;

  created_at: string;
}

export interface CreatePurchaseOrderInput {
  supplier_id: string;
  order_number: string;
  order_date?: string;
  expected_delivery_date?: string;
  external_reference?: string;
  circular_reference?: string;
  notes?: string;
}

export interface CreatePurchaseOrderItemInput {
  product_id: string;
  quantity_ordered: number;
  list_price: number;
  discount_1?: number;
  discount_2?: number;
  discount_3?: number;
  discount_4?: number;
  discount_5?: number;
  raee_amount?: number;
  warehouse_id?: string;
  notes?: string;
}
