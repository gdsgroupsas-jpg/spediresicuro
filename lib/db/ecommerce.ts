/**
 * Database Functions: E-commerce Integrations
 *
 * Gestione integrazioni e-commerce e sync ordini
 */

import { supabase } from './client';
import type { EcommerceIntegration, EcommerceOrder } from '@/types/ecommerce';

/**
 * Crea nuova integrazione e-commerce
 */
export async function createEcommerceIntegration(
  userId: string,
  data: {
    platform: string;
    store_url: string;
    api_key_encrypted: string;
    api_secret_encrypted?: string;
    access_token_encrypted?: string;
    config?: any;
  }
): Promise<EcommerceIntegration> {
  const { data: integration, error } = await supabase
    .from('ecommerce_integrations')
    .insert({
      user_id: userId,
      ...data,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating e-commerce integration:', error);
    throw new Error(`Errore creazione integrazione: ${error.message}`);
  }

  return integration as EcommerceIntegration;
}

/**
 * Ottieni tutte le integrazioni di un utente
 */
export async function getUserIntegrations(userId: string) {
  const { data, error } = await supabase
    .from('ecommerce_integrations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching integrations:', error);
    throw new Error(`Errore recupero integrazioni: ${error.message}`);
  }

  return data as EcommerceIntegration[];
}

/**
 * Ottieni integrazioni attive per piattaforma
 */
export async function getActiveIntegrations(userId: string, platform?: string) {
  let query = supabase
    .from('ecommerce_integrations')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true);

  if (platform) {
    query = query.eq('platform', platform);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching active integrations:', error);
    return [];
  }

  return data as EcommerceIntegration[];
}

/**
 * Aggiorna status sync integrazione
 */
export async function updateIntegrationSyncStatus(
  integrationId: string,
  status: 'success' | 'error' | 'partial',
  error?: string
): Promise<void> {
  const { error: updateError } = await supabase
    .from('ecommerce_integrations')
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: status,
      last_sync_error: error || null,
    })
    .eq('id', integrationId);

  if (updateError) {
    console.error('Error updating sync status:', updateError);
  }
}

/**
 * Salva ordine e-commerce
 */
export async function saveEcommerceOrder(order: Partial<EcommerceOrder>): Promise<EcommerceOrder> {
  // Upsert: aggiorna se esiste, inserisci se nuovo
  const { data, error } = await supabase
    .from('ecommerce_orders')
    .upsert(
      {
        ...order,
        synced_at: new Date().toISOString(),
      },
      {
        onConflict: 'integration_id,platform_order_id',
      }
    )
    .select()
    .single();

  if (error) {
    console.error('Error saving e-commerce order:', error);
    throw new Error(`Errore salvataggio ordine: ${error.message}`);
  }

  return data as EcommerceOrder;
}

/**
 * Ottieni ordini da sincronizzare (senza spedizione)
 */
export async function getOrdersToFulfill(integrationId: string) {
  const { data, error } = await supabase
    .from('ecommerce_orders')
    .select('*')
    .eq('integration_id', integrationId)
    .is('shipment_id', null)
    .in('status', ['processing', 'pending'])
    .order('platform_created_at', { ascending: true });

  if (error) {
    console.error('Error fetching orders to fulfill:', error);
    return [];
  }

  return data as EcommerceOrder[];
}

/**
 * Collega ordine e-commerce a spedizione
 */
export async function linkOrderToShipment(
  orderId: string,
  shipmentId: string
): Promise<void> {
  const { error } = await supabase
    .from('ecommerce_orders')
    .update({ shipment_id: shipmentId })
    .eq('id', orderId);

  if (error) {
    console.error('Error linking order to shipment:', error);
    throw new Error(`Errore collegamento ordine-spedizione: ${error.message}`);
  }
}

/**
 * Aggiorna status ordine e-commerce
 */
export async function updateOrderStatus(
  orderId: string,
  status: string,
  fulfillmentStatus?: string
): Promise<void> {
  const updates: any = { status };

  if (fulfillmentStatus) {
    updates.fulfillment_status = fulfillmentStatus;
  }

  const { error } = await supabase
    .from('ecommerce_orders')
    .update(updates)
    .eq('id', orderId);

  if (error) {
    console.error('Error updating order status:', error);
    throw new Error(`Errore aggiornamento status ordine: ${error.message}`);
  }
}

/**
 * Ottieni statistiche sincronizzazioni
 */
export async function getSyncStats(userId: string, period: 'today' | 'week' | 'month' = 'week') {
  const now = new Date();
  let dateFrom: Date;

  if (period === 'today') {
    dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === 'week') {
    dateFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  } else {
    dateFrom = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
  }

  // Ottieni integrazioni dell'utente
  const integrations = await getUserIntegrations(userId);
  const integrationIds = integrations.map(i => i.id);

  if (integrationIds.length === 0) {
    return {
      total_orders: 0,
      orders_fulfilled: 0,
      orders_pending: 0,
      total_revenue: 0,
    };
  }

  const { data, error } = await supabase
    .from('ecommerce_orders')
    .select('status, total, shipment_id')
    .in('integration_id', integrationIds)
    .gte('synced_at', dateFrom.toISOString());

  if (error) {
    console.error('Error fetching sync stats:', error);
    return {
      total_orders: 0,
      orders_fulfilled: 0,
      orders_pending: 0,
      total_revenue: 0,
    };
  }

  const stats = {
    total_orders: data.length,
    orders_fulfilled: data.filter(o => o.shipment_id !== null).length,
    orders_pending: data.filter(o => o.shipment_id === null && ['pending', 'processing'].includes(o.status)).length,
    total_revenue: data.reduce((sum, o) => sum + (parseFloat(o.total as any) || 0), 0),
  };

  return stats;
}
