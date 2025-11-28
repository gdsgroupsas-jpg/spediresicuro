/**
 * Database Functions: Products
 *
 * CRUD operations per prodotti
 */

import { supabase } from './client';
import type { Product, ProductFilters, CreateProductInput } from '@/types/products';

/**
 * Crea nuovo prodotto
 */
export async function createProduct(data: CreateProductInput): Promise<Product> {
  const { data: product, error } = await supabase
    .from('products')
    .insert(data)
    .select()
    .single();

  if (error) {
    console.error('Error creating product:', error);
    throw new Error(`Errore creazione prodotto: ${error.message}`);
  }

  return product as Product;
}

/**
 * Ottieni prodotto per ID
 */
export async function getProductById(id: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*, suppliers:product_suppliers(*, supplier:suppliers(*))')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching product:', error);
    throw new Error(`Errore recupero prodotto: ${error.message}`);
  }

  return data as Product;
}

/**
 * Ottieni prodotto per SKU
 */
export async function getProductBySKU(sku: string): Promise<Product | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('sku', sku)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching product by SKU:', error);
    throw new Error(`Errore recupero prodotto: ${error.message}`);
  }

  return data as Product;
}

/**
 * Lista prodotti con filtri
 */
export async function listProducts(filters?: ProductFilters) {
  let query = supabase
    .from('products')
    .select('*', { count: 'exact' });

  // Filtri
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
    query = query.or(
      `name.ilike.%${filters.search}%,sku.ilike.%${filters.search}%,description.ilike.%${filters.search}%`
    );
  }

  // Ordinamento
  const orderBy = filters?.order_by || 'name';
  const orderDir = filters?.order_dir || 'asc';
  query = query.order(orderBy, { ascending: orderDir === 'asc' });

  // Paginazione
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error listing products:', error);
    throw new Error(`Errore recupero prodotti: ${error.message}`);
  }

  return {
    products: (data as Product[]) || [],
    total: count || 0,
  };
}

/**
 * Aggiorna prodotto
 */
export async function updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
  const { data, error } = await supabase
    .from('products')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating product:', error);
    throw new Error(`Errore aggiornamento prodotto: ${error.message}`);
  }

  return data as Product;
}

/**
 * Elimina prodotto
 */
export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase
    .from('products')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting product:', error);
    throw new Error(`Errore eliminazione prodotto: ${error.message}`);
  }
}

/**
 * Associa prodotto a fornitore
 */
export async function linkProductToSupplier(
  productId: string,
  supplierId: string,
  data: {
    supplier_sku?: string;
    cost_price: number;
    min_order_quantity?: number;
    lead_time_days?: number;
    priority?: number;
  }
): Promise<void> {
  const { error } = await supabase
    .from('product_suppliers')
    .insert({
      product_id: productId,
      supplier_id: supplierId,
      ...data,
    });

  if (error) {
    console.error('Error linking product to supplier:', error);
    throw new Error(`Errore associazione prodotto-fornitore: ${error.message}`);
  }
}

/**
 * Ottieni fornitori per prodotto
 */
export async function getProductSuppliers(productId: string) {
  const { data, error } = await supabase
    .from('product_suppliers')
    .select('*, supplier:suppliers(*)')
    .eq('product_id', productId)
    .eq('active', true)
    .order('priority');

  if (error) {
    console.error('Error fetching product suppliers:', error);
    throw new Error(`Errore recupero fornitori: ${error.message}`);
  }

  return data || [];
}

/**
 * Ottieni stock totale prodotto (tutti i magazzini)
 */
export async function getProductTotalStock(productId: string) {
  const { data, error } = await supabase
    .from('inventory')
    .select('quantity_available, quantity_reserved, warehouse:warehouses(*)')
    .eq('product_id', productId);

  if (error) {
    console.error('Error fetching product stock:', error);
    return {
      total_available: 0,
      total_reserved: 0,
      warehouses: [],
    };
  }

  const total_available = data.reduce((sum, inv) => sum + inv.quantity_available, 0);
  const total_reserved = data.reduce((sum, inv) => sum + inv.quantity_reserved, 0);

  return {
    total_available,
    total_reserved,
    warehouses: data,
  };
}
