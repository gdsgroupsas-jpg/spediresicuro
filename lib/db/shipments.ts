/**
 * Database Functions: Shipments
 *
 * CRUD operations per spedizioni
 */

import { supabase, supabaseAdmin } from './client';
import type {
  Shipment,
  ShipmentFilters,
  CreateShipmentInput,
  UpdateShipmentInput,
} from '@/types/shipments';
import { assertValidUserId } from '@/lib/validators';

/**
 * Genera tracking number univoco
 */
export function generateTrackingNumber(): string {
  const prefix = 'SS'; // SpedireSicuro
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${prefix}${timestamp}${random}`;
}

/**
 * Crea una nuova spedizione
 */
export async function createShipment(data: CreateShipmentInput, userId: string): Promise<Shipment> {
  // ⚠️ SICUREZZA: Valida userId prima di inserire
  assertValidUserId(userId);

  const trackingNumber = generateTrackingNumber();

  const shipmentData = {
    ...data,
    tracking_number: trackingNumber,
    user_id: userId,
    status: 'draft' as const,
  };

  const { data: shipment, error } = await supabase
    .from('shipments')
    .insert(shipmentData)
    .select()
    .single();

  if (error) {
    console.error('Error creating shipment:', error);
    throw new Error(`Errore creazione spedizione: ${error.message}`);
  }

  return shipment as Shipment;
}

/**
 * Ottieni spedizione per ID
 */
export async function getShipmentById(id: string): Promise<Shipment | null> {
  const { data, error } = await supabase
    .from('shipments')
    .select('*, courier:couriers(*)')
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    console.error('Error fetching shipment:', error);
    throw new Error(`Errore recupero spedizione: ${error.message}`);
  }

  return data as Shipment;
}

/**
 * Ottieni spedizione per tracking number (pubblico, no auth)
 */
export async function getShipmentByTracking(trackingNumber: string): Promise<Shipment | null> {
  const { data, error } = await supabaseAdmin
    .from('shipments')
    .select('*, courier:couriers(*)')
    .eq('tracking_number', trackingNumber)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching shipment by tracking:', error);
    throw new Error(`Errore recupero spedizione: ${error.message}`);
  }

  return data as Shipment;
}

/**
 * Ottiene tutti gli ID utenti nella gerarchia (incluso l'utente stesso)
 * Se l'utente è admin, include anche tutti i sotto-admin fino a 5 livelli
 */
async function getHierarchyUserIds(
  userId: string,
  includeSubAdmins: boolean = true
): Promise<string[]> {
  if (!includeSubAdmins) {
    return [userId];
  }

  try {
    // Verifica se l'utente è admin
    const { data: user } = await supabaseAdmin
      .from('users')
      .select('account_type')
      .eq('id', userId)
      .single();

    // Se non è admin, ritorna solo l'ID utente
    if (!user || (user.account_type !== 'admin' && user.account_type !== 'superadmin')) {
      return [userId];
    }

    // Se è admin, ottieni tutti i sotto-admin
    const { data: subAdmins } = await supabaseAdmin.rpc('get_all_sub_admins', {
      p_admin_id: userId,
      p_max_level: 5,
    });

    // Include anche l'admin stesso
    const allIds = [userId, ...(subAdmins?.map((u: any) => u.id) || [])];
    return allIds;
  } catch (error: any) {
    console.error('Errore recupero gerarchia:', error);
    // In caso di errore, ritorna solo l'ID utente
    return [userId];
  }
}

/**
 * Lista spedizioni con filtri
 * Se l'utente è admin, include anche le spedizioni dei sotto-admin
 */
export async function listShipments(
  userId: string,
  filters?: ShipmentFilters,
  includeSubAdmins: boolean = true
): Promise<{ shipments: Shipment[]; total: number }> {
  // Ottieni tutti gli ID della gerarchia
  const hierarchyIds = await getHierarchyUserIds(userId, includeSubAdmins);

  let query = supabase
    .from('shipments')
    .select('*, courier:couriers(*)', { count: 'exact' })
    .in('user_id', hierarchyIds);

  // Applica filtri
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }

  if (filters?.courier_id) {
    query = query.eq('courier_id', filters.courier_id);
  }

  if (filters?.search) {
    query = query.or(
      `recipient_name.ilike.%${filters.search}%,tracking_number.ilike.%${filters.search}%,recipient_city.ilike.%${filters.search}%`
    );
  }

  if (filters?.date_from) {
    query = query.gte('created_at', filters.date_from);
  }

  if (filters?.date_to) {
    query = query.lte('created_at', filters.date_to);
  }

  // Ordinamento
  const orderBy = filters?.order_by || 'created_at';
  const orderDir = filters?.order_dir || 'desc';
  query = query.order(orderBy, { ascending: orderDir === 'asc' });

  // Paginazione
  const limit = filters?.limit || 50;
  const offset = filters?.offset || 0;
  query = query.range(offset, offset + limit - 1);

  const { data, error, count } = await query;

  if (error) {
    console.error('Error listing shipments:', error);
    throw new Error(`Errore recupero spedizioni: ${error.message}`);
  }

  return {
    shipments: (data as Shipment[]) || [],
    total: count || 0,
  };
}

/**
 * Aggiorna spedizione
 */
export async function updateShipment(id: string, updates: UpdateShipmentInput): Promise<Shipment> {
  const { data, error } = await supabase
    .from('shipments')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating shipment:', error);
    throw new Error(`Errore aggiornamento spedizione: ${error.message}`);
  }

  return data as Shipment;
}

/**
 * Elimina spedizione
 */
export async function deleteShipment(id: string): Promise<void> {
  const { error } = await supabase.from('shipments').delete().eq('id', id);

  if (error) {
    console.error('Error deleting shipment:', error);
    throw new Error(`Errore eliminazione spedizione: ${error.message}`);
  }
}

/**
 * Aggiungi evento tracking a spedizione
 */
export async function addShipmentEvent(
  shipmentId: string,
  event: {
    status: string;
    description: string;
    location?: string;
    event_date?: Date;
  }
): Promise<void> {
  const { error } = await supabase.from('shipment_events').insert({
    shipment_id: shipmentId,
    status: event.status,
    description: event.description,
    location: event.location,
    event_date: event.event_date || new Date(),
  });

  if (error) {
    console.error('Error adding shipment event:', error);
    throw new Error(`Errore aggiunta evento: ${error.message}`);
  }

  // Aggiorna status spedizione
  await updateShipment(shipmentId, { status: event.status as any });
}

/**
 * Ottieni eventi tracking spedizione
 */
export async function getShipmentEvents(shipmentId: string) {
  const { data, error } = await supabase
    .from('shipment_events')
    .select('*')
    .eq('shipment_id', shipmentId)
    .order('event_date', { ascending: false });

  if (error) {
    console.error('Error fetching shipment events:', error);
    throw new Error(`Errore recupero eventi: ${error.message}`);
  }

  return data || [];
}

/**
 * Statistiche spedizioni per dashboard
 * Se l'utente è admin, include anche le statistiche dei sotto-admin
 */
export async function getShipmentStats(
  userId: string,
  period: 'today' | 'week' | 'month' | 'all' = 'all',
  includeSubAdmins: boolean = true
) {
  // Ottieni tutti gli ID della gerarchia
  const hierarchyIds = await getHierarchyUserIds(userId, includeSubAdmins);

  let query = supabase
    .from('shipments')
    .select('status, final_price, created_at, user_id')
    .in('user_id', hierarchyIds);

  // Filtra per periodo
  const now = new Date();
  if (period === 'today') {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    query = query.gte('created_at', today.toISOString());
  } else if (period === 'week') {
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    query = query.gte('created_at', weekAgo.toISOString());
  } else if (period === 'month') {
    const monthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    query = query.gte('created_at', monthAgo.toISOString());
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching stats:', error);
    return {
      total: 0,
      in_transit: 0,
      delivered: 0,
      pending: 0,
      total_revenue: 0,
    };
  }

  const stats = {
    total: data.length,
    in_transit: data.filter((s) => s.status === 'in_transit' || s.status === 'shipped').length,
    delivered: data.filter((s) => s.status === 'delivered').length,
    pending: data.filter((s) => s.status === 'pending' || s.status === 'draft').length,
    total_revenue: data.reduce((sum, s) => sum + (parseFloat(s.final_price as any) || 0), 0),
  };

  return stats;
}

/**
 * Export spedizioni in formato CSV
 */
export function exportShipmentsToCSV(shipments: Shipment[]): string {
  const headers = [
    'Tracking',
    'Data',
    'Destinatario',
    'Città',
    'CAP',
    'Provincia',
    'Telefono',
    'Corriere',
    'Status',
    'Peso (kg)',
    'Prezzo Finale',
  ];

  const rows = shipments.map((s) => [
    s.tracking_number,
    new Date(s.created_at).toLocaleDateString('it-IT'),
    s.recipient_name,
    s.recipient_city,
    s.recipient_zip,
    s.recipient_province,
    s.recipient_phone,
    (s.courier as any)?.name || '-',
    s.status,
    s.weight,
    `€${s.final_price?.toFixed(2) || '0.00'}`,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
  ].join('\n');

  // Aggiungi BOM UTF-8 per Excel
  return '\ufeff' + csvContent;
}
