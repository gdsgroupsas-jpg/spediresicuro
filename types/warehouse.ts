/**
 * Types: Warehouse & Inventory
 */

export type WarehouseMovementType =
  | 'inbound'
  | 'outbound'
  | 'transfer'
  | 'adjustment'
  | 'reservation'
  | 'release';

export interface Warehouse {
  id: string;
  code: string;
  name: string;
  type: string;

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

export interface Inventory {
  id: string;
  product_id: string;
  warehouse_id: string;

  quantity_available: number;
  quantity_reserved: number;
  quantity_on_order: number;

  reorder_point: number;
  reorder_quantity: number;

  last_stock_take_at?: string;
  updated_at: string;
}

export interface WarehouseMovement {
  id: string;
  product_id: string;
  warehouse_id: string;

  type: WarehouseMovementType;
  quantity: number;

  to_warehouse_id?: string;

  shipment_id?: string;
  reference_type?: string;
  reference_id?: string;

  notes?: string;

  created_by?: string;

  movement_date: string;
  created_at: string;
}
