/**
 * Types: Warehouse & Inventory
 *
 * Modello dati WMS MVP — isolato per workspace
 */

export type WarehouseMovementType =
  | 'inbound'
  | 'outbound'
  | 'transfer'
  | 'adjustment'
  | 'reservation'
  | 'release';

export type WarehouseType = 'standard' | 'transit' | 'returns' | 'dropship';

export interface Warehouse {
  id: string;
  workspace_id: string;
  code: string;
  name: string;
  type: WarehouseType;

  address?: string;
  city?: string;
  zip?: string;
  province?: string;
  country?: string;

  manager_name?: string;
  phone?: string;
  email?: string;

  active: boolean;

  created_at: string;
  updated_at: string;
}

export interface CreateWarehouseInput {
  code: string;
  name: string;
  type?: WarehouseType;
  address?: string;
  city?: string;
  zip?: string;
  province?: string;
  country?: string;
  manager_name?: string;
  phone?: string;
  email?: string;
}

export interface Inventory {
  id: string;
  workspace_id: string;
  product_id: string;
  warehouse_id: string;

  quantity_available: number;
  quantity_reserved: number;
  quantity_on_order: number;

  reorder_point: number;
  reorder_quantity: number;

  last_stock_take_at?: string;
  updated_at: string;

  // Join opzionali
  product?: import('./products').Product;
  warehouse?: Warehouse;
}

export interface WarehouseMovement {
  id: string;
  workspace_id: string;
  product_id: string;
  warehouse_id: string;

  type: WarehouseMovementType;
  quantity: number;

  to_warehouse_id?: string;

  reference_type?: string;
  reference_id?: string;

  notes?: string;

  created_by?: string;

  movement_date: string;
  created_at: string;

  // Join opzionali
  product?: import('./products').Product;
  warehouse?: Warehouse;
}

export interface StockUpdateInput {
  product_id: string;
  warehouse_id: string;
  quantity: number;
  type: 'inbound' | 'outbound' | 'adjustment';
  notes?: string;
  reference_type?: string;
  reference_id?: string;
}
