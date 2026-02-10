/**
 * Database Functions: Products, Suppliers, Purchase Orders
 *
 * CRUD operations isolate per workspace — usa supabaseAdmin (service role)
 */

import { supabaseAdmin } from './client';
import type {
  Product,
  ProductFilters,
  CreateProductInput,
  Supplier,
  CreateSupplierInput,
  PurchaseOrder,
  CreatePurchaseOrderInput,
  CreatePurchaseOrderItemInput,
} from '@/types/products';

// ─── PRODUCTS ───

export async function createProduct(
  workspaceId: string,
  data: CreateProductInput
): Promise<Product> {
  const { data: product, error } = await supabaseAdmin
    .from('products')
    .insert({ workspace_id: workspaceId, ...data })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`SKU "${data.sku}" gia' esistente in questo workspace`);
    }
    throw new Error(`Errore creazione prodotto: ${error.message}`);
  }

  return product as Product;
}

export async function getProductById(workspaceId: string, id: string): Promise<Product | null> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Errore recupero prodotto: ${error.message}`);
  }

  return data as Product;
}

export async function getProductBySKU(workspaceId: string, sku: string): Promise<Product | null> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('sku', sku)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Errore recupero prodotto: ${error.message}`);
  }

  return data as Product;
}

export async function listProducts(workspaceId: string, filters?: ProductFilters) {
  let query = supabaseAdmin
    .from('products')
    .select('*', { count: 'exact' })
    .eq('workspace_id', workspaceId);

  if (filters?.category) {
    query = query.eq('category', filters.category);
  }

  if (filters?.type) {
    query = query.eq('type', filters.type);
  }

  if (filters?.active !== undefined) {
    query = query.eq('active', filters.active);
  }

  if (filters?.search) {
    // Sanitizza input per PostgREST: escapa caratteri speciali nei filtri
    const sanitized = filters.search.replace(/[%_,.()"'\\]/g, '');
    if (sanitized.length > 0) {
      query = query.or(
        `name.ilike.%${sanitized}%,sku.ilike.%${sanitized}%,barcode.ilike.%${sanitized}%`
      );
    }
  }

  // Whitelist colonne ammesse per ordinamento — previene injection
  const allowedOrderColumns = [
    'name',
    'sku',
    'category',
    'type',
    'cost_price',
    'sale_price',
    'created_at',
    'updated_at',
  ];
  const orderBy = allowedOrderColumns.includes(filters?.order_by || '')
    ? filters!.order_by!
    : 'name';
  const orderDir = filters?.order_dir === 'desc' ? 'desc' : 'asc';
  query = query.order(orderBy, { ascending: orderDir === 'asc' });

  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Errore recupero prodotti: ${error.message}`);
  }

  return {
    products: (data as Product[]) || [],
    total: count || 0,
  };
}

export async function updateProduct(
  workspaceId: string,
  id: string,
  updates: Partial<Product>
): Promise<Product> {
  const { data, error } = await supabaseAdmin
    .from('products')
    .update(updates)
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .select()
    .single();

  if (error) {
    throw new Error(`Errore aggiornamento prodotto: ${error.message}`);
  }

  return data as Product;
}

export async function deleteProduct(workspaceId: string, id: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('products')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspaceId);

  if (error) {
    throw new Error(`Errore eliminazione prodotto: ${error.message}`);
  }
}

// ─── SUPPLIERS ───

export async function listSuppliers(workspaceId: string) {
  const { data, error } = await supabaseAdmin
    .from('suppliers')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('active', true)
    .order('name');

  if (error) {
    throw new Error(`Errore recupero fornitori: ${error.message}`);
  }

  return (data as Supplier[]) || [];
}

export async function createSupplier(
  workspaceId: string,
  data: CreateSupplierInput
): Promise<Supplier> {
  const { data: supplier, error } = await supabaseAdmin
    .from('suppliers')
    .insert({ workspace_id: workspaceId, ...data })
    .select()
    .single();

  if (error) {
    throw new Error(`Errore creazione fornitore: ${error.message}`);
  }

  return supplier as Supplier;
}

export async function getSupplierById(workspaceId: string, id: string): Promise<Supplier | null> {
  const { data, error } = await supabaseAdmin
    .from('suppliers')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Errore recupero fornitore: ${error.message}`);
  }

  return data as Supplier;
}

// ─── PRODUCT SUPPLIERS ───

export async function getProductSuppliers(workspaceId: string, productId: string) {
  const { data, error } = await supabaseAdmin
    .from('product_suppliers')
    .select('*, supplier:suppliers(*)')
    .eq('workspace_id', workspaceId)
    .eq('product_id', productId)
    .eq('active', true)
    .order('priority');

  if (error) {
    throw new Error(`Errore recupero fornitori prodotto: ${error.message}`);
  }

  return data || [];
}

export async function linkProductToSupplier(
  workspaceId: string,
  productId: string,
  supplierId: string,
  data: {
    supplier_sku?: string;
    list_price: number;
    discount_1?: number;
    discount_2?: number;
    discount_3?: number;
    discount_4?: number;
    discount_5?: number;
    min_order_quantity?: number;
    lead_time_days?: number;
    priority?: number;
  }
): Promise<void> {
  const { error } = await supabaseAdmin.from('product_suppliers').insert({
    workspace_id: workspaceId,
    product_id: productId,
    supplier_id: supplierId,
    ...data,
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error("Fornitore gia' associato a questo prodotto");
    }
    throw new Error(`Errore associazione prodotto-fornitore: ${error.message}`);
  }
}

// ─── PURCHASE ORDERS ───

export async function listPurchaseOrders(
  workspaceId: string,
  options?: { status?: string; supplierId?: string; limit?: number; offset?: number }
) {
  let query = supabaseAdmin
    .from('purchase_orders')
    .select('*, supplier:suppliers(id, name, code)', { count: 'exact' })
    .eq('workspace_id', workspaceId)
    .order('order_date', { ascending: false });

  if (options?.status) {
    query = query.eq('status', options.status);
  }

  if (options?.supplierId) {
    query = query.eq('supplier_id', options.supplierId);
  }

  const limit = options?.limit || 50;
  const offset = options?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Errore recupero ordini: ${error.message}`);
  }

  return { orders: (data as PurchaseOrder[]) || [], total: count || 0 };
}

export async function getPurchaseOrderById(
  workspaceId: string,
  id: string
): Promise<PurchaseOrder | null> {
  const { data, error } = await supabaseAdmin
    .from('purchase_orders')
    .select(
      '*, supplier:suppliers(*), items:purchase_order_items(*, product:products(id, sku, name, barcode))'
    )
    .eq('id', id)
    .eq('workspace_id', workspaceId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(`Errore recupero ordine: ${error.message}`);
  }

  return data as PurchaseOrder;
}

export async function createPurchaseOrder(
  workspaceId: string,
  input: CreatePurchaseOrderInput,
  userId: string
): Promise<PurchaseOrder> {
  const { data, error } = await supabaseAdmin
    .from('purchase_orders')
    .insert({
      workspace_id: workspaceId,
      ...input,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Numero ordine "${input.order_number}" gia' esistente`);
    }
    throw new Error(`Errore creazione ordine: ${error.message}`);
  }

  return data as PurchaseOrder;
}

export async function addPurchaseOrderItem(
  workspaceId: string,
  purchaseOrderId: string,
  input: CreatePurchaseOrderItemInput
) {
  const { data, error } = await supabaseAdmin
    .from('purchase_order_items')
    .insert({
      workspace_id: workspaceId,
      purchase_order_id: purchaseOrderId,
      ...input,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Errore aggiunta riga ordine: ${error.message}`);
  }

  return data;
}

const VALID_PO_STATUSES = ['draft', 'confirmed', 'shipped', 'partial', 'received', 'cancelled'];

export async function updatePurchaseOrderStatus(
  workspaceId: string,
  id: string,
  status: string
): Promise<void> {
  if (!VALID_PO_STATUSES.includes(status)) {
    throw new Error(`Stato ordine non valido: ${status}`);
  }

  const updates: Record<string, any> = { status };

  if (status === 'received') {
    updates.received_date = new Date().toISOString();
  }

  const { error } = await supabaseAdmin
    .from('purchase_orders')
    .update(updates)
    .eq('id', id)
    .eq('workspace_id', workspaceId);

  if (error) {
    throw new Error(`Errore aggiornamento stato ordine: ${error.message}`);
  }
}

// ─── UTILITY: Calcolo margine ───

export function calculateMarginPercent(costPrice: number, salePrice: number): number {
  if (costPrice <= 0) return 0;
  return ((salePrice - costPrice) / costPrice) * 100;
}

export function calculateNetCost(
  listPrice: number,
  discounts: number[],
  raee: number = 0,
  eco: number = 0
): number {
  let net = listPrice;
  for (const d of discounts) {
    if (d > 0) {
      net *= 1 - d / 100;
    }
  }
  return net + raee + eco;
}
