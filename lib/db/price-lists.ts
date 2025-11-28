/**
 * Database Functions: Price Lists
 *
 * CRUD operations per listini prezzi corrieri
 */

import { supabase } from './client';
import type { PriceList, PriceListEntry, CreatePriceListInput } from '@/types/listini';

/**
 * Crea nuovo listino
 */
export async function createPriceList(data: CreatePriceListInput, userId: string): Promise<PriceList> {
  const { data: priceList, error } = await supabase
    .from('price_lists')
    .insert({
      ...data,
      created_by: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating price list:', error);
    throw new Error(`Errore creazione listino: ${error.message}`);
  }

  return priceList as PriceList;
}

/**
 * Ottieni listino per ID
 */
export async function getPriceListById(id: string): Promise<PriceList | null> {
  const { data, error } = await supabase
    .from('price_lists')
    .select('*, courier:couriers(*), entries:price_list_entries(*)')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching price list:', error);
    throw new Error(`Errore recupero listino: ${error.message}`);
  }

  return data as PriceList;
}

/**
 * Lista listini per corriere
 */
export async function listPriceListsByCourier(courierId: string) {
  const { data, error } = await supabase
    .from('price_lists')
    .select('*, courier:couriers(*)')
    .eq('courier_id', courierId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing price lists:', error);
    throw new Error(`Errore recupero listini: ${error.message}`);
  }

  return data || [];
}

/**
 * Lista tutti i listini
 */
export async function listAllPriceLists() {
  const { data, error } = await supabase
    .from('price_lists')
    .select('*, courier:couriers(*)')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error listing all price lists:', error);
    throw new Error(`Errore recupero listini: ${error.message}`);
  }

  return data || [];
}

/**
 * Ottieni listino attivo per corriere
 */
export async function getActivePriceList(courierId: string): Promise<PriceList | null> {
  const now = new Date().toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('price_lists')
    .select('*, entries:price_list_entries(*)')
    .eq('courier_id', courierId)
    .eq('status', 'active')
    .lte('valid_from', now)
    .or(`valid_until.is.null,valid_until.gte.${now}`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    console.error('Error fetching active price list:', error);
    return null;
  }

  return data as PriceList;
}

/**
 * Aggiungi righe al listino
 */
export async function addPriceListEntries(
  priceListId: string,
  entries: Omit<PriceListEntry, 'id' | 'price_list_id' | 'created_at'>[]
): Promise<void> {
  const entriesWithListId = entries.map(entry => ({
    ...entry,
    price_list_id: priceListId,
  }));

  const { error } = await supabase
    .from('price_list_entries')
    .insert(entriesWithListId);

  if (error) {
    console.error('Error adding price list entries:', error);
    throw new Error(`Errore aggiunta righe listino: ${error.message}`);
  }
}

/**
 * Calcola prezzo per spedizione
 */
export async function calculatePrice(
  courierId: string,
  weight: number,
  destinationZip: string,
  serviceType: string = 'standard',
  options?: {
    declaredValue?: number;
    cashOnDelivery?: boolean;
    insurance?: boolean;
  }
): Promise<{
  basePrice: number;
  surcharges: number;
  totalCost: number;
  details: any;
} | null> {
  const priceList = await getActivePriceList(courierId);

  if (!priceList || !priceList.entries) {
    return null;
  }

  // Trova la riga corrispondente
  const entry = (priceList.entries as PriceListEntry[]).find(e => {
    const weightMatch = weight >= e.weight_from && weight <= e.weight_to;
    const serviceMatch = e.service_type === serviceType;

    // Match ZIP se specificato
    let zipMatch = true;
    if (e.zip_code_from && e.zip_code_to) {
      zipMatch = destinationZip >= e.zip_code_from && destinationZip <= e.zip_code_to;
    }

    return weightMatch && serviceMatch && zipMatch;
  });

  if (!entry) {
    return null;
  }

  // Calcola prezzo
  let basePrice = parseFloat(entry.base_price as any);
  let surcharges = 0;

  // Supplemento carburante
  if (entry.fuel_surcharge_percent) {
    surcharges += basePrice * (parseFloat(entry.fuel_surcharge_percent as any) / 100);
  }

  // Supplemento isole
  if (entry.island_surcharge) {
    surcharges += parseFloat(entry.island_surcharge as any);
  }

  // Supplemento ZTL
  if (entry.ztl_surcharge) {
    surcharges += parseFloat(entry.ztl_surcharge as any);
  }

  // Supplemento contrassegno
  if (options?.cashOnDelivery && entry.cash_on_delivery_surcharge) {
    surcharges += parseFloat(entry.cash_on_delivery_surcharge as any);
  }

  // Assicurazione
  if (options?.insurance && options?.declaredValue && entry.insurance_rate_percent) {
    surcharges += options.declaredValue * (parseFloat(entry.insurance_rate_percent as any) / 100);
  }

  const totalCost = basePrice + surcharges;

  return {
    basePrice,
    surcharges,
    totalCost,
    details: {
      entry,
      estimatedDeliveryDays: {
        min: entry.estimated_delivery_days_min,
        max: entry.estimated_delivery_days_max,
      },
    },
  };
}

/**
 * Aggiorna status listino
 */
export async function updatePriceListStatus(
  id: string,
  status: 'draft' | 'active' | 'archived'
): Promise<void> {
  const { error } = await supabase
    .from('price_lists')
    .update({ status })
    .eq('id', id);

  if (error) {
    console.error('Error updating price list status:', error);
    throw new Error(`Errore aggiornamento status listino: ${error.message}`);
  }
}

/**
 * Elimina listino
 */
export async function deletePriceList(id: string): Promise<void> {
  const { error } = await supabase
    .from('price_lists')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting price list:', error);
    throw new Error(`Errore eliminazione listino: ${error.message}`);
  }
}
