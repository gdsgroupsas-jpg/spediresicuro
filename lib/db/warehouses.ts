/**
 * Database Functions: Warehouses & Inventory
 *
 * Gestione magazzini, inventory e movimenti — isolato per workspace
 * Usa supabaseAdmin (service role) perche' chiamato da API routes dopo auth
 */

import { supabaseAdmin } from './client';
import type { Warehouse, Inventory, WarehouseMovement, StockUpdateInput } from '@/types/warehouse';

// ─── WAREHOUSES ───

export async function listWarehouses(workspaceId: string) {
  const { data, error } = await supabaseAdmin
    .from('warehouses')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('active', true)
    .order('name');

  if (error) {
    console.error('[WMS] Error listing warehouses:', error.message);
    throw new Error(`Errore recupero magazzini: ${error.message}`);
  }

  return data as Warehouse[];
}

export async function getWarehouseById(workspaceId: string, id: string): Promise<Warehouse | null> {
  const { data, error } = await supabaseAdmin
    .from('warehouses')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Errore recupero magazzino: ${error.message}`);
  }

  return data as Warehouse;
}

// ─── INVENTORY ───

export async function getInventory(
  workspaceId: string,
  productId: string,
  warehouseId: string
): Promise<Inventory | null> {
  const { data, error } = await supabaseAdmin
    .from('inventory')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('product_id', productId)
    .eq('warehouse_id', warehouseId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    return null;
  }

  return data as Inventory;
}

export async function listInventory(
  workspaceId: string,
  warehouseId?: string,
  options?: { search?: string; lowStockOnly?: boolean; limit?: number; offset?: number }
) {
  let query = supabaseAdmin
    .from('inventory')
    .select('*, product:products(*), warehouse:warehouses(*)', { count: 'exact' })
    .eq('workspace_id', workspaceId);

  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId);
  }

  // Nota: lowStockOnly richiede filtro client-side perche' Supabase
  // non supporta confronto tra colonne (.lte('quantity_available', 'reorder_point'))
  if (options?.lowStockOnly) {
    query = query.gt('reorder_point', 0);
  }

  const limit = options?.limit || 50;
  const offset = options?.offset || 0;

  // Se lowStockOnly, recupera tutto per filtrare client-side, poi pagina
  if (options?.lowStockOnly) {
    query = query.order('quantity_available', { ascending: true });

    const { data, error } = await query;

    if (error) {
      console.error('[WMS] Error listing inventory:', error.message);
      throw new Error(`Errore recupero inventario: ${error.message}`);
    }

    // Filtra client-side: quantity_available <= reorder_point
    const filtered = (data || []).filter((inv: any) => inv.quantity_available <= inv.reorder_point);

    return {
      inventory: filtered.slice(offset, offset + limit),
      total: filtered.length,
    };
  }

  query = query.order('quantity_available', { ascending: true }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('[WMS] Error listing inventory:', error.message);
    throw new Error(`Errore recupero inventario: ${error.message}`);
  }

  return { inventory: data || [], total: count || 0 };
}

// ─── STOCK UPDATE ───

export async function updateStock(
  workspaceId: string,
  input: StockUpdateInput,
  userId: string
): Promise<void> {
  // Update atomico via funzione SQL — evita race condition read-then-write
  const { data: newQty, error } = await supabaseAdmin.rpc('wms_update_stock', {
    p_workspace_id: workspaceId,
    p_product_id: input.product_id,
    p_warehouse_id: input.warehouse_id,
    p_delta: input.quantity,
  });

  if (error) {
    throw new Error(`Errore aggiornamento stock: ${error.message}`);
  }

  if (newQty === -1) {
    throw new Error('Stock insufficiente');
  }

  // Registra movimento
  await recordMovement(workspaceId, {
    product_id: input.product_id,
    warehouse_id: input.warehouse_id,
    type: input.type,
    quantity: input.quantity,
    created_by: userId,
    reference_type: input.reference_type,
    reference_id: input.reference_id,
    notes: input.notes,
  });
}

// ─── MOVEMENTS ───

async function recordMovement(
  workspaceId: string,
  movement: Partial<WarehouseMovement>
): Promise<void> {
  const { error } = await supabaseAdmin.from('warehouse_movements').insert({
    workspace_id: workspaceId,
    ...movement,
  });

  if (error) {
    // Propaga errore — stock gia' aggiornato ma movimento non registrato e' incoerente
    console.error('[WMS] Error recording movement:', error.message);
    throw new Error(`Errore registrazione movimento: ${error.message}`);
  }
}

export async function getWarehouseMovements(
  workspaceId: string,
  options?: {
    productId?: string;
    warehouseId?: string;
    limit?: number;
    offset?: number;
  }
) {
  let query = supabaseAdmin
    .from('warehouse_movements')
    .select('*, product:products(id, sku, name), warehouse:warehouses(id, code, name)', {
      count: 'exact',
    })
    .eq('workspace_id', workspaceId)
    .order('movement_date', { ascending: false });

  if (options?.productId) {
    query = query.eq('product_id', options.productId);
  }

  if (options?.warehouseId) {
    query = query.eq('warehouse_id', options.warehouseId);
  }

  const limit = options?.limit || 50;
  const offset = options?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('[WMS] Error fetching movements:', error.message);
    return { movements: [], total: 0 };
  }

  return { movements: data || [], total: count || 0 };
}

// ─── STOCK VALUE ───

export async function getStockValue(workspaceId: string, warehouseId?: string) {
  let query = supabaseAdmin
    .from('inventory')
    .select('quantity_available, product:products(cost_price, sale_price)')
    .eq('workspace_id', workspaceId);

  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[WMS] Error calculating stock value:', error.message);
    return { cost_value: 0, retail_value: 0 };
  }

  const cost_value = (data || []).reduce((sum: number, inv: any) => {
    return sum + inv.quantity_available * (inv.product?.cost_price || 0);
  }, 0);

  const retail_value = (data || []).reduce((sum: number, inv: any) => {
    return sum + inv.quantity_available * (inv.product?.sale_price || 0);
  }, 0);

  return { cost_value, retail_value };
}

// ─── LOW STOCK ───

export async function getLowStockProducts(workspaceId: string) {
  const { data, error } = await supabaseAdmin
    .from('inventory')
    .select('*, product:products(*), warehouse:warehouses(*)')
    .eq('workspace_id', workspaceId)
    .gt('reorder_point', 0)
    .order('quantity_available');

  if (error) {
    console.error('[WMS] Error fetching low stock:', error.message);
    return [];
  }

  // Filtra client-side perche' Supabase non supporta confronto tra colonne in .lt()
  return (data || []).filter((inv: any) => inv.quantity_available <= inv.reorder_point);
}
