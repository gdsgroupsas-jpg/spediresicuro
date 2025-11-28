/**
 * Database Functions: Warehouses & Inventory
 *
 * Gestione magazzini, inventory e movimenti
 */

import { supabase } from './client';
import type { Warehouse, Inventory, WarehouseMovement } from '@/types/warehouse';

/**
 * Lista tutti i magazzini
 */
export async function listWarehouses() {
  const { data, error } = await supabase
    .from('warehouses')
    .select('*')
    .eq('active', true)
    .order('name');

  if (error) {
    console.error('Error listing warehouses:', error);
    throw new Error(`Errore recupero magazzini: ${error.message}`);
  }

  return data as Warehouse[];
}

/**
 * Ottieni magazzino per ID
 */
export async function getWarehouseById(id: string): Promise<Warehouse | null> {
  const { data, error } = await supabase
    .from('warehouses')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching warehouse:', error);
    throw new Error(`Errore recupero magazzino: ${error.message}`);
  }

  return data as Warehouse;
}

/**
 * Ottieni inventory per prodotto in un magazzino
 */
export async function getInventory(
  productId: string,
  warehouseId: string
): Promise<Inventory | null> {
  const { data, error } = await supabase
    .from('inventory')
    .select('*')
    .eq('product_id', productId)
    .eq('warehouse_id', warehouseId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching inventory:', error);
    return null;
  }

  return data as Inventory;
}

/**
 * Aggiorna stock prodotto in magazzino
 */
export async function updateStock(
  productId: string,
  warehouseId: string,
  quantityDelta: number,
  movementType: 'inbound' | 'outbound' | 'adjustment',
  userId: string,
  options?: {
    reference_type?: string;
    reference_id?: string;
    notes?: string;
  }
): Promise<void> {
  // Ottieni inventory corrente
  let inventory = await getInventory(productId, warehouseId);

  if (!inventory) {
    // Crea inventory se non esiste
    const { data, error: createError } = await supabase
      .from('inventory')
      .insert({
        product_id: productId,
        warehouse_id: warehouseId,
        quantity_available: 0,
        quantity_reserved: 0,
      })
      .select()
      .single();

    if (createError) {
      throw new Error(`Errore creazione inventory: ${createError.message}`);
    }

    inventory = data as Inventory;
  }

  // Aggiorna quantità
  const newQuantity = inventory.quantity_available + quantityDelta;

  if (newQuantity < 0) {
    throw new Error('Stock insufficiente');
  }

  const { error: updateError } = await supabase
    .from('inventory')
    .update({ quantity_available: newQuantity })
    .eq('product_id', productId)
    .eq('warehouse_id', warehouseId);

  if (updateError) {
    throw new Error(`Errore aggiornamento stock: ${updateError.message}`);
  }

  // Registra movimento
  await recordWarehouseMovement({
    product_id: productId,
    warehouse_id: warehouseId,
    type: movementType,
    quantity: quantityDelta,
    created_by: userId,
    reference_type: options?.reference_type,
    reference_id: options?.reference_id,
    notes: options?.notes,
  });
}

/**
 * Riserva stock per ordine
 */
export async function reserveStock(
  productId: string,
  warehouseId: string,
  quantity: number,
  userId: string,
  shipmentId?: string
): Promise<void> {
  const inventory = await getInventory(productId, warehouseId);

  if (!inventory || inventory.quantity_available < quantity) {
    throw new Error('Stock insufficiente per la prenotazione');
  }

  const newAvailable = inventory.quantity_available - quantity;
  const newReserved = inventory.quantity_reserved + quantity;

  const { error } = await supabase
    .from('inventory')
    .update({
      quantity_available: newAvailable,
      quantity_reserved: newReserved,
    })
    .eq('product_id', productId)
    .eq('warehouse_id', warehouseId);

  if (error) {
    throw new Error(`Errore riserva stock: ${error.message}`);
  }

  // Registra movimento
  await recordWarehouseMovement({
    product_id: productId,
    warehouse_id: warehouseId,
    type: 'reservation',
    quantity: -quantity,
    created_by: userId,
    shipment_id: shipmentId,
    reference_type: 'shipment',
    reference_id: shipmentId,
    notes: 'Riserva stock per spedizione',
  });
}

/**
 * Rilascia riserva stock
 */
export async function releaseStock(
  productId: string,
  warehouseId: string,
  quantity: number,
  userId: string,
  shipmentId?: string
): Promise<void> {
  const inventory = await getInventory(productId, warehouseId);

  if (!inventory || inventory.quantity_reserved < quantity) {
    throw new Error('Quantità riservata insufficiente');
  }

  const newAvailable = inventory.quantity_available + quantity;
  const newReserved = inventory.quantity_reserved - quantity;

  const { error } = await supabase
    .from('inventory')
    .update({
      quantity_available: newAvailable,
      quantity_reserved: newReserved,
    })
    .eq('product_id', productId)
    .eq('warehouse_id', warehouseId);

  if (error) {
    throw new Error(`Errore rilascio riserva: ${error.message}`);
  }

  // Registra movimento
  await recordWarehouseMovement({
    product_id: productId,
    warehouse_id: warehouseId,
    type: 'release',
    quantity: quantity,
    created_by: userId,
    shipment_id: shipmentId,
    reference_type: 'shipment',
    reference_id: shipmentId,
    notes: 'Rilascio riserva stock',
  });
}

/**
 * Registra movimento magazzino
 */
async function recordWarehouseMovement(movement: Partial<WarehouseMovement>): Promise<void> {
  const { error } = await supabase
    .from('warehouse_movements')
    .insert(movement);

  if (error) {
    console.error('Error recording warehouse movement:', error);
    // Non blocchiamo l'operazione, solo log
  }
}

/**
 * Ottieni movimenti magazzino
 */
export async function getWarehouseMovements(
  productId?: string,
  warehouseId?: string,
  limit: number = 100
) {
  let query = supabase
    .from('warehouse_movements')
    .select('*, product:products(*), warehouse:warehouses(*)')
    .order('movement_date', { ascending: false })
    .limit(limit);

  if (productId) {
    query = query.eq('product_id', productId);
  }

  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching warehouse movements:', error);
    return [];
  }

  return data || [];
}

/**
 * Ottieni prodotti sotto soglia di riordino
 */
export async function getLowStockProducts() {
  const { data, error } = await supabase
    .from('inventory')
    .select('*, product:products(*), warehouse:warehouses(*)')
    .lt('quantity_available', 'reorder_point')
    .gt('reorder_point', 0)
    .order('quantity_available');

  if (error) {
    console.error('Error fetching low stock products:', error);
    return [];
  }

  return data || [];
}

/**
 * Valore totale stock
 */
export async function getStockValue(warehouseId?: string) {
  let query = supabase
    .from('inventory')
    .select('quantity_available, product:products(cost_price, sale_price)');

  if (warehouseId) {
    query = query.eq('warehouse_id', warehouseId);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error calculating stock value:', error);
    return { cost_value: 0, retail_value: 0 };
  }

  const cost_value = data.reduce((sum, inv: any) => {
    return sum + (inv.quantity_available * (inv.product?.cost_price || 0));
  }, 0);

  const retail_value = data.reduce((sum, inv: any) => {
    return sum + (inv.quantity_available * (inv.product?.sale_price || 0));
  }, 0);

  return { cost_value, retail_value };
}
